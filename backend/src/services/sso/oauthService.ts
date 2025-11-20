import crypto from 'crypto';
import type { PoolClient } from 'pg';

export interface CreateOAuthProviderInput {
  tenantId?: string;
  providerName: string;
  providerType: 'oauth2' | 'oidc';
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl?: string;
  scopes?: string[];
  jitProvisioning?: boolean;
  jitDefaultRole?: string;
  attributeMapping?: Record<string, string>;
  createdBy?: string;
}

export interface OAuthAuthorizationRequest {
  providerId: string;
  redirectUri: string;
  state?: string;
  scopes?: string[];
}

/**
 * Generate OAuth authorization URL
 */
export function generateOAuthAuthorizationUrl(
  authorizationUrl: string,
  clientId: string,
  redirectUri: string,
  scopes: string[],
  state: string
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state
  });

  return `${authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeAuthorizationCode(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
}> {
  // In production, make actual HTTP request to token endpoint
  // For now, simulate token exchange
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  const tokens = await response.json();
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    expiresIn: tokens.expires_in
  };
}

/**
 * Get user info from OAuth provider
 */
export async function getUserInfo(
  userinfoUrl: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetch(userinfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`UserInfo request failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Create OAuth provider
 */
export async function createOAuthProvider(
  client: PoolClient,
  input: CreateOAuthProviderInput
): Promise<unknown> {
  const providerId = crypto.randomUUID();

  // Encrypt client secret (in production, use proper encryption)
  const clientSecretEncrypted = Buffer.from(input.clientSecret).toString('base64');

  const result = await client.query(
    `
      INSERT INTO shared.sso_providers (
        id, tenant_id, provider_name, provider_type, is_active,
        client_id, client_secret_encrypted, authorization_url,
        token_url, userinfo_url, scopes, jit_provisioning,
        jit_default_role, attribute_mapping, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `,
    [
      providerId,
      input.tenantId || null,
      input.providerName,
      input.providerType,
      true,
      input.clientId,
      clientSecretEncrypted,
      input.authorizationUrl,
      input.tokenUrl,
      input.userinfoUrl || null,
      input.scopes || [],
      input.jitProvisioning || false,
      input.jitDefaultRole || 'teacher',
      JSON.stringify(input.attributeMapping || {}),
      input.createdBy || null
    ]
  );

  return result.rows[0];
}

/**
 * Process OAuth callback
 */
export async function processOAuthCallback(
  client: PoolClient,
  providerId: string,
  code: string,
  redirectUri: string,
  state?: string
): Promise<{
  userId: string;
  email: string;
  attributes: Record<string, unknown>;
  isNewUser: boolean;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
}> {
  // Get provider
  const providerResult = await client.query(
    'SELECT * FROM shared.sso_providers WHERE id = $1',
    [providerId]
  );

  if (providerResult.rowCount === 0) {
    throw new Error('OAuth provider not found');
  }

  const provider = providerResult.rows[0];

  // Decrypt client secret
  const clientSecret = Buffer.from(provider.client_secret_encrypted, 'base64').toString('utf-8');

  // Exchange code for tokens
  const tokens = await exchangeAuthorizationCode(
    provider.token_url,
    provider.client_id,
    clientSecret,
    code,
    redirectUri
  );

  // Get user info
  let userInfo: Record<string, unknown> = {};
  if (provider.userinfo_url && tokens.accessToken) {
    userInfo = await getUserInfo(provider.userinfo_url, tokens.accessToken);
  } else if (tokens.idToken) {
    // Parse JWT ID token (simplified - in production use jwt library)
    const parts = tokens.idToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      userInfo = payload;
    }
  }

  // Map attributes
  const attributeMapping = provider.attribute_mapping || {};
  const email = (userInfo[attributeMapping.email || 'email'] || userInfo.email) as string;
  const firstName = (userInfo[attributeMapping.firstName || 'given_name'] || userInfo.given_name) as string;
  const lastName = (userInfo[attributeMapping.lastName || 'family_name'] || userInfo.family_name) as string;
  const externalUserId = (userInfo[attributeMapping.userId || 'sub'] || userInfo.sub) as string;

  // Check if user exists
  let userResult = await client.query(
    'SELECT id FROM shared.users WHERE email = $1',
    [email]
  );

  let userId: string;
  let isNewUser = false;

  if (userResult.rowCount === 0) {
    // JIT Provisioning
    if (provider.jit_provisioning) {
      userId = crypto.randomUUID();
      const defaultRole = provider.jit_default_role || 'teacher';

      await client.query(
        `
          INSERT INTO shared.users (
            id, email, first_name, last_name, role, is_verified, status
          )
          VALUES ($1, $2, $3, $4, $5, TRUE, 'active')
        `,
        [userId, email, firstName, lastName, defaultRole]
      );

      // Create SSO user mapping
      await client.query(
        `
          INSERT INTO shared.sso_user_mappings (
            tenant_id, provider_id, external_user_id, user_id, external_email, attributes
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          provider.tenant_id,
          providerId,
          externalUserId,
          userId,
          email,
          JSON.stringify(userInfo)
        ]
      );

      isNewUser = true;
    } else {
      throw new Error('User not found and JIT provisioning is disabled');
    }
  } else {
    userId = userResult.rows[0].id;
  }

  // Create SSO session
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expiresIn || 3600));

  // Encrypt tokens (in production, use proper encryption)
  const accessTokenEncrypted = Buffer.from(tokens.accessToken).toString('base64');
  const refreshTokenEncrypted = tokens.refreshToken
    ? Buffer.from(tokens.refreshToken).toString('base64')
    : null;

  await client.query(
    `
      INSERT INTO shared.sso_sessions (
        tenant_id, user_id, provider_id, sso_session_id,
        access_token_encrypted, refresh_token_encrypted, id_token,
        attributes, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id, user_id, provider_id, sso_session_id)
      DO UPDATE SET
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
        id_token = EXCLUDED.id_token,
        attributes = EXCLUDED.attributes,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `,
    [
      provider.tenant_id,
      userId,
      providerId,
      sessionId,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokens.idToken || null,
      JSON.stringify(userInfo),
      expiresAt
    ]
  );

  return {
    userId,
    email,
    attributes: userInfo,
    isNewUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    idToken: tokens.idToken
  };
}

/**
 * Get OAuth providers
 */
export async function getOAuthProviders(
  client: PoolClient,
  tenantId?: string
): Promise<unknown[]> {
  const conditions: string[] = ["provider_type IN ('oauth2', 'oidc')"];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  const result = await client.query(
    `
      SELECT id, tenant_id, provider_name, provider_type, is_active, is_default,
             client_id, authorization_url, token_url, userinfo_url, scopes,
             jit_provisioning, jit_default_role, created_at, updated_at
      FROM shared.sso_providers
      WHERE ${conditions.join(' AND ')}
      ORDER BY is_default DESC, provider_name ASC
    `,
    values
  );

  return result.rows;
}

/**
 * Refresh OAuth access token
 */
export async function refreshOAuthToken(
  client: PoolClient,
  providerId: string,
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}> {
  const providerResult = await client.query(
    'SELECT * FROM shared.sso_providers WHERE id = $1',
    [providerId]
  );

  if (providerResult.rowCount === 0) {
    throw new Error('OAuth provider not found');
  }

  const provider = providerResult.rows[0];
  const clientSecret = Buffer.from(provider.client_secret_encrypted, 'base64').toString('utf-8');

  const response = await fetch(provider.token_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${provider.client_id}:${clientSecret}`).toString('base64')}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  const tokens = await response.json();
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in
  };
}

