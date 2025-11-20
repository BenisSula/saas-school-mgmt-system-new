import type { PoolClient } from 'pg';
import { z } from 'zod';

export interface CreateIpWhitelistInput {
  tenantId: string;
  ipAddress: string; // Supports CIDR notation (e.g., "192.168.1.0/24")
  description?: string;
  createdBy?: string;
}

/**
 * Check if IP address matches CIDR notation
 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) {
    // Exact match
    return ip === cidr;
  }

  const [network, prefixLength] = cidr.split('/');
  const prefix = parseInt(prefixLength, 10);

  // Simple CIDR matching (for production, use a proper CIDR library)
  const ipParts = ip.split('.').map(Number);
  const networkParts = network.split('.').map(Number);

  if (ipParts.length !== 4 || networkParts.length !== 4) {
    return false;
  }

  // Convert to binary and compare
  const ipBinary = ipParts.map(part => part.toString(2).padStart(8, '0')).join('');
  const networkBinary = networkParts.map(part => part.toString(2).padStart(8, '0')).join('');

  return ipBinary.substring(0, prefix) === networkBinary.substring(0, prefix);
}

/**
 * Check if IP address is whitelisted for tenant
 */
export async function isIpWhitelisted(
  client: PoolClient,
  tenantId: string,
  ipAddress: string
): Promise<boolean> {
  // If no whitelist entries exist, allow all IPs
  const countResult = await client.query(
    `
      SELECT COUNT(*) as count
      FROM shared.ip_whitelist
      WHERE tenant_id = $1 AND is_active = TRUE
    `,
    [tenantId]
  );

  const count = parseInt(countResult.rows[0].count, 10);
  if (count === 0) {
    return true; // No whitelist = allow all
  }

  // Check if IP matches any whitelist entry
  const whitelistResult = await client.query(
    `
      SELECT ip_address
      FROM shared.ip_whitelist
      WHERE tenant_id = $1 AND is_active = TRUE
    `,
    [tenantId]
  );

  return whitelistResult.rows.some(row => ipMatchesCidr(ipAddress, row.ip_address));
}

/**
 * Create IP whitelist entry
 */
export async function createIpWhitelistEntry(
  client: PoolClient,
  input: CreateIpWhitelistInput
): Promise<unknown> {
  // Validate IP address format (basic validation)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  if (!ipRegex.test(input.ipAddress)) {
    throw new Error('Invalid IP address format');
  }

  const result = await client.query(
    `
      INSERT INTO shared.ip_whitelist (
        tenant_id, ip_address, description, created_by, is_active
      )
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *
    `,
    [
      input.tenantId,
      input.ipAddress,
      input.description || null,
      input.createdBy || null
    ]
  );

  return result.rows[0];
}

/**
 * Get IP whitelist entries for tenant
 */
export async function getIpWhitelistEntries(
  client: PoolClient,
  tenantId: string
): Promise<unknown[]> {
  const result = await client.query(
    `
      SELECT id, ip_address, description, is_active, created_at, updated_at
      FROM shared.ip_whitelist
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `,
    [tenantId]
  );

  return result.rows;
}

/**
 * Update IP whitelist entry
 */
export async function updateIpWhitelistEntry(
  client: PoolClient,
  entryId: string,
  tenantId: string,
  updates: {
    ipAddress?: string;
    description?: string;
    isActive?: boolean;
  }
): Promise<unknown> {
  const updateFields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.ipAddress) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(updates.ipAddress)) {
      throw new Error('Invalid IP address format');
    }
    updateFields.push(`ip_address = $${paramIndex++}`);
    values.push(updates.ipAddress);
  }

  if (updates.description !== undefined) {
    updateFields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }

  if (updates.isActive !== undefined) {
    updateFields.push(`is_active = $${paramIndex++}`);
    values.push(updates.isActive);
  }

  if (updateFields.length === 0) {
    throw new Error('No updates provided');
  }

  updateFields.push(`updated_at = NOW()`);
  values.push(entryId, tenantId);

  const result = await client.query(
    `
      UPDATE shared.ip_whitelist
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  if (result.rowCount === 0) {
    throw new Error('IP whitelist entry not found');
  }

  return result.rows[0];
}

/**
 * Delete IP whitelist entry
 */
export async function deleteIpWhitelistEntry(
  client: PoolClient,
  entryId: string,
  tenantId: string
): Promise<void> {
  const result = await client.query(
    'DELETE FROM shared.ip_whitelist WHERE id = $1 AND tenant_id = $2',
    [entryId, tenantId]
  );

  if (result.rowCount === 0) {
    throw new Error('IP whitelist entry not found');
  }
}

