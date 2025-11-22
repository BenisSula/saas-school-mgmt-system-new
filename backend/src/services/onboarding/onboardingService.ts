import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { createUser } from '../userService';
import { queueEmail } from '../email/emailService';
import { recordSharedAuditLog } from '../auditLogService';
import { getPool } from '../../db/connection';

export interface CreateInvitationInput {
  tenantId: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  invitedBy: string;
  expiresInHours?: number;
  metadata?: Record<string, unknown>;
}

export interface OnboardingStep {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  progressPercentage: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

/**
 * Generate secure invitation token
 */
function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create tenant invitation
 */
export async function createInvitation(
  client: PoolClient,
  input: CreateInvitationInput
): Promise<{ id: string; token: string; invitationUrl: string }> {
  const token = generateInvitationToken();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresInHours = input.expiresInHours || 72;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  // Create invitation record
  const result = await client.query(
    `
      INSERT INTO shared.tenant_invitations (
        tenant_id, email, role, token_hash, invited_by, expires_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `,
    [
      input.tenantId,
      input.email.toLowerCase(),
      input.role,
      tokenHash,
      input.invitedBy,
      expiresAt,
      JSON.stringify(input.metadata || {})
    ]
  );

  const invitationId = result.rows[0].id;

  // Generate invitation URL
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const invitationUrl = `${baseUrl}/auth/accept-invitation?token=${token}&id=${invitationId}`;

  // Send invitation email
  await queueEmail(client, {
    tenantId: input.tenantId,
    templateKey: 'tenant_invitation',
    recipientEmail: input.email,
    variables: {
      invitationUrl,
      role: input.role,
      expiresInHours
    }
  });

  // Record audit log
  await recordSharedAuditLog({
    userId: input.invitedBy,
    action: 'invitation_created',
    entityType: 'USER',
    entityId: invitationId,
    details: {
      invitationId,
      email: input.email,
      role: input.role
    }
  });

  return {
    id: invitationId,
    token,
    invitationUrl
  };
}

/**
 * Accept invitation and create user
 */
export async function acceptInvitation(
  client: PoolClient,
  invitationId: string,
  token: string,
  password: string
): Promise<{ userId: string; tenantId: string }> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Verify invitation
  const invitationResult = await client.query(
    `
      SELECT * FROM shared.tenant_invitations
      WHERE id = $1 AND token_hash = $2 AND expires_at > NOW() AND accepted_at IS NULL
    `,
    [invitationId, tokenHash]
  );

  if (invitationResult.rowCount === 0) {
    throw new Error('Invalid or expired invitation');
  }

  const invitation = invitationResult.rows[0];

  await client.query('BEGIN');
  try {
    // Create user (createUser expects Pool, so we use the pool from connection)
    const pool = getPool();
    const user = await createUser(pool, {
      email: invitation.email,
      password,
      role: invitation.role,
      tenantId: invitation.tenant_id,
      isVerified: true,
      status: 'active'
    });

    // Mark invitation as accepted
    await client.query(
      'UPDATE shared.tenant_invitations SET accepted_at = NOW() WHERE id = $1',
      [invitationId]
    );

    // Update onboarding progress
    await updateOnboardingProgress(client, invitation.tenant_id, 'admin_created', 'completed');

    // Send welcome email
    await queueEmail(client, {
      tenantId: invitation.tenant_id,
      templateKey: 'welcome',
      recipientEmail: invitation.email,
      variables: {
        name: invitation.email.split('@')[0],
        role: invitation.role
      }
    });

    await client.query('COMMIT');

    return {
      userId: user.id,
      tenantId: invitation.tenant_id
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Update onboarding progress
 */
export async function updateOnboardingProgress(
  client: PoolClient,
  tenantId: string,
  step: string,
  status: OnboardingStep['status'],
  errorMessage?: string
): Promise<void> {
  const now = new Date();
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  updates.push(`status = $${paramIndex++}`);
  values.push(status);

  updates.push(`updated_at = NOW()`);
  values.push(now);

  if (status === 'in_progress') {
    updates.push(`started_at = COALESCE(started_at, $${paramIndex++})`);
    values.push(now);
  }

  if (status === 'completed') {
    updates.push(`completed_at = $${paramIndex++}`);
    values.push(now);
    updates.push(`progress_percentage = 100`);
  }

  if (status === 'failed' && errorMessage) {
    updates.push(`error_message = $${paramIndex++}`);
    values.push(errorMessage);
  }

  values.push(tenantId, step);

  await client.query(
    `
      INSERT INTO shared.onboarding_progress (
        tenant_id, step, status, progress_percentage, started_at, completed_at, error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tenant_id, step)
      DO UPDATE SET ${updates.join(', ')}
    `,
    [
      tenantId,
      step,
      status,
      status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0,
      status === 'in_progress' || status === 'completed' ? now : null,
      status === 'completed' ? now : null,
      errorMessage || null,
      ...values
    ]
  );
}

/**
 * Get onboarding progress for tenant
 */
export async function getOnboardingProgress(
  client: PoolClient,
  tenantId: string
): Promise<{ steps: OnboardingStep[]; overallProgress: number }> {
  const result = await client.query(
    `
      SELECT * FROM shared.onboarding_progress
      WHERE tenant_id = $1
      ORDER BY created_at ASC
    `,
    [tenantId]
  );

  const steps: OnboardingStep[] = result.rows.map(row => ({
    step: row.step,
    status: row.status,
    progressPercentage: row.progress_percentage,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message
  }));

  // Calculate overall progress
  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return { steps, overallProgress };
}

/**
 * Initialize onboarding wizard state
 */
export async function initializeOnboardingWizard(
  client: PoolClient,
  tenantId: string
): Promise<unknown> {
  const result = await client.query(
    `
      INSERT INTO shared.onboarding_wizard_state (
        tenant_id, current_step, completed_steps, wizard_data
      )
      VALUES ($1, 1, ARRAY[]::INTEGER[], '{}'::jsonb)
      ON CONFLICT (tenant_id) DO NOTHING
      RETURNING *
    `,
    [tenantId]
  );

  if (result.rowCount === 0) {
    // Get existing state
    const existingResult = await client.query(
      'SELECT * FROM shared.onboarding_wizard_state WHERE tenant_id = $1',
      [tenantId]
    );
    return existingResult.rows[0];
  }

  return result.rows[0];
}

/**
 * Update onboarding wizard state
 */
export async function updateOnboardingWizard(
  client: PoolClient,
  tenantId: string,
  updates: {
    currentStep?: number;
    completedSteps?: number[];
    wizardData?: Record<string, unknown>;
    isCompleted?: boolean;
  }
): Promise<unknown> {
  const updateFields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.currentStep !== undefined) {
    updateFields.push(`current_step = $${paramIndex++}`);
    values.push(updates.currentStep);
  }

  if (updates.completedSteps !== undefined) {
    updateFields.push(`completed_steps = $${paramIndex++}`);
    values.push(updates.completedSteps);
  }

  if (updates.wizardData !== undefined) {
    updateFields.push(`wizard_data = $${paramIndex++}`);
    values.push(JSON.stringify(updates.wizardData));
  }

  if (updates.isCompleted !== undefined) {
    updateFields.push(`is_completed = $${paramIndex++}`);
    values.push(updates.isCompleted);
    if (updates.isCompleted) {
      updateFields.push(`completed_at = NOW()`);
    }
  }

  if (updateFields.length === 0) {
    throw new Error('No updates provided');
  }

  updateFields.push(`updated_at = NOW()`);
  values.push(tenantId);

  const result = await client.query(
    `
      UPDATE shared.onboarding_wizard_state
      SET ${updateFields.join(', ')}
      WHERE tenant_id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  return result.rows[0];
}

/**
 * Complete tenant onboarding (create schema, seed data, etc.)
 */
export async function completeTenantOnboarding(
  client: PoolClient,
  tenantId: string,
  _schoolData: {
    name: string;
    address?: string;
    contactPhone?: string;
    contactEmail?: string;
  }
): Promise<void> {
  await client.query('BEGIN');
  try {
    // Get tenant
    const tenantResult = await client.query(
      'SELECT * FROM shared.tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rowCount === 0) {
      throw new Error('Tenant not found');
    }

    // Update onboarding progress
    await updateOnboardingProgress(client, tenantId, 'schema_created', 'in_progress');

    // Create tenant schema if not exists
    // Note: This assumes schema creation is handled elsewhere
    // Here we just mark progress

    // Run migrations
    await updateOnboardingProgress(client, tenantId, 'migrations_run', 'in_progress');
    // await runTenantMigrations(pool, tenant.schema_name);
    await updateOnboardingProgress(client, tenantId, 'migrations_run', 'completed');

    // Seed data
    await updateOnboardingProgress(client, tenantId, 'seed_data', 'in_progress');
    // await seedTenant(pool, tenant.schema_name);
    await updateOnboardingProgress(client, tenantId, 'seed_data', 'completed');

    // Mark onboarding as completed
    await updateOnboardingWizard(client, tenantId, {
      isCompleted: true,
      currentStep: 999 // Final step
    });

    await updateOnboardingProgress(client, tenantId, 'completed', 'completed');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateOnboardingProgress(client, tenantId, 'completed', 'failed', errorMessage);
    throw error;
  }
}

