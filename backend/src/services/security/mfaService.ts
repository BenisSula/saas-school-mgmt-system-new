import crypto from 'crypto';
// TODO: Install otplib package: npm install otplib @types/otplib
// import { authenticator } from 'otplib';
import type { PoolClient } from 'pg';
import { z } from 'zod';

// Temporary stub for otplib until package is installed
// TODO: Install otplib: npm install otplib @types/otplib
const authenticator = {
  generateSecret: () => crypto.randomBytes(20).toString('base64'),
  generate: (secret: string) => {
    // Stub implementation - replace with actual otplib when installed
    const time = Math.floor(Date.now() / 1000 / 30);
    const secretBuffer = Buffer.from(secret, 'base64');
    const timeBuffer = Buffer.allocUnsafe(8);
    timeBuffer.writeUInt32BE(time, 4);
    const hash = crypto.createHmac('sha1', secretBuffer).update(timeBuffer).digest();
    const offset = hash[hash.length - 1] & 0xf;
    const code =
      (((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff)) %
      1000000;
    return code.toString().padStart(6, '0');
  },
  verify: (token: string, secret: string) => {
    // Stub implementation
    const generated = authenticator.generate(secret);
    return token === generated;
  },
  keyuri: (user: string, service: string, secret: string) => {
    // Stub implementation for QR code URL generation
    return `otpauth://totp/${encodeURIComponent(service)}:${encodeURIComponent(user)}?secret=${secret}&issuer=${encodeURIComponent(service)}`;
  },
  check: (token: string, secret: string) => {
    // Alias for verify
    return authenticator.verify(token, secret);
  },
};

export const mfaDeviceTypeSchema = z.enum(['totp', 'sms', 'email', 'backup_code']);

export type MfaDeviceType = z.infer<typeof mfaDeviceTypeSchema>;

export interface CreateMfaDeviceInput {
  userId: string;
  type: MfaDeviceType;
  name: string;
}

export interface VerifyMfaCodeInput {
  userId: string;
  deviceId: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Generate TOTP secret and QR code data URL
 */
export function generateTotpSecret(
  userEmail: string,
  issuer: string = 'SaaS School Management'
): {
  secret: string;
  qrCodeUrl: string;
} {
  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(userEmail, issuer, secret);

  // Generate QR code data URL (simplified - in production, use a QR code library)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`;

  return { secret, qrCodeUrl };
}

/**
 * Create a new MFA device
 */
export async function createMfaDevice(
  client: PoolClient,
  input: CreateMfaDeviceInput
): Promise<unknown> {
  const deviceId = crypto.randomUUID();
  let secret: string;
  let backupCodes: string[] = [];

  if (input.type === 'totp') {
    // Generate TOTP secret
    const userResult = await client.query('SELECT email FROM shared.users WHERE id = $1', [
      input.userId,
    ]);
    if (userResult.rowCount === 0) {
      throw new Error('User not found');
    }
    const userEmail = userResult.rows[0].email;
    const totpData = generateTotpSecret(userEmail);
    secret = totpData.secret;

    // Generate backup codes
    backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex'));
  } else {
    // For SMS/email, secret is not needed (handled externally)
    secret = crypto.randomBytes(32).toString('hex');
  }

  // Hash backup codes before storing
  const hashedBackupCodes = backupCodes.map((code) =>
    crypto.createHash('sha256').update(code).digest('hex')
  );

  const result = await client.query(
    `
      INSERT INTO shared.mfa_devices (
        id, user_id, type, name, secret, backup_codes, is_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, FALSE)
      RETURNING *
    `,
    [deviceId, input.userId, input.type, input.name, secret, hashedBackupCodes]
  );

  // Return device with unhashed backup codes for initial display (only once)
  return {
    ...result.rows[0],
    backupCodes: input.type === 'totp' ? backupCodes : undefined,
  };
}

/**
 * Verify MFA code
 */
export async function verifyMfaCode(
  client: PoolClient,
  input: VerifyMfaCodeInput
): Promise<{ success: boolean; isBackupCode?: boolean }> {
  // Get device
  const deviceResult = await client.query(
    `
      SELECT * FROM shared.mfa_devices
      WHERE id = $1 AND user_id = $2 AND is_enabled = TRUE
    `,
    [input.deviceId, input.userId]
  );

  if (deviceResult.rowCount === 0) {
    throw new Error('MFA device not found or disabled');
  }

  const device = deviceResult.rows[0];
  let isValid = false;
  let isBackupCode = false;

  if (device.type === 'totp') {
    // Verify TOTP code
    isValid = authenticator.check(input.code, device.secret);
  } else if (device.type === 'backup_code') {
    // Verify backup code
    const hashedCode = crypto.createHash('sha256').update(input.code).digest('hex');
    isValid = device.backup_codes?.includes(hashedCode) || false;
    isBackupCode = isValid;

    if (isValid) {
      // Remove used backup code
      const updatedCodes = device.backup_codes.filter((code: string) => code !== hashedCode);
      await client.query('UPDATE shared.mfa_devices SET backup_codes = $1 WHERE id = $2', [
        updatedCodes,
        input.deviceId,
      ]);
    }
  } else {
    // SMS/email verification handled externally
    // For now, accept any code (in production, verify against sent code)
    isValid = true;
  }

  // Record attempt
  await client.query(
    `
      INSERT INTO shared.mfa_attempts (
        user_id, device_id, code, success, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      input.userId,
      input.deviceId,
      '***', // Don't store actual code
      isValid,
      input.ipAddress || null,
      input.userAgent || null,
    ]
  );

  if (isValid && !device.is_verified) {
    // Mark device as verified on first successful verification
    await client.query(
      'UPDATE shared.mfa_devices SET is_verified = TRUE, last_used_at = NOW() WHERE id = $1',
      [input.deviceId]
    );
  } else if (isValid) {
    // Update last used timestamp
    await client.query('UPDATE shared.mfa_devices SET last_used_at = NOW() WHERE id = $1', [
      input.deviceId,
    ]);
  }

  return { success: isValid, isBackupCode };
}

/**
 * Get MFA devices for a user
 */
export async function getMfaDevices(client: PoolClient, userId: string): Promise<unknown[]> {
  const result = await client.query(
    `
      SELECT id, type, name, is_enabled, is_verified, last_used_at, created_at
      FROM shared.mfa_devices
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows;
}

/**
 * Enable/disable MFA device
 */
export async function toggleMfaDevice(
  client: PoolClient,
  deviceId: string,
  userId: string,
  enabled: boolean
): Promise<unknown> {
  const result = await client.query(
    `
      UPDATE shared.mfa_devices
      SET is_enabled = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `,
    [enabled, deviceId, userId]
  );

  if (result.rowCount === 0) {
    throw new Error('MFA device not found');
  }

  return result.rows[0];
}

/**
 * Delete MFA device
 */
export async function deleteMfaDevice(
  client: PoolClient,
  deviceId: string,
  userId: string
): Promise<void> {
  const result = await client.query(
    'DELETE FROM shared.mfa_devices WHERE id = $1 AND user_id = $2',
    [deviceId, userId]
  );

  if (result.rowCount === 0) {
    throw new Error('MFA device not found');
  }
}

/**
 * Check if user has MFA enabled
 */
export async function isMfaEnabled(client: PoolClient, userId: string): Promise<boolean> {
  const result = await client.query(
    `
      SELECT COUNT(*) as count
      FROM shared.mfa_devices
      WHERE user_id = $1 AND is_enabled = TRUE AND is_verified = TRUE
    `,
    [userId]
  );

  return parseInt(result.rows[0].count, 10) > 0;
}
