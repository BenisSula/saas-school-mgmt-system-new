/**
 * File Upload Service
 * Handles file uploads with local storage or S3 (configurable via environment)
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
// getPool not used in this file but may be needed for future implementations
import { withDbClient, tableExists } from '../lib/dbHelpers';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const USE_S3 = process.env.USE_S3 === 'true';
const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export interface FileUploadResult {
  id: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface FileUploadInput {
  file: {
    data: Buffer;
    filename: string;
    mimetype: string;
    size: number;
  };
  userId: string;
  tenantId: string;
  description?: string;
  entityType?: 'user' | 'student' | 'teacher' | 'hod';
  entityId?: string;
}

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(): Promise<void> {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Generate unique filename
 */
function generateFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  const hash = crypto.randomBytes(8).toString('hex');
  const sanitized = basename.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  return `${sanitized}_${hash}${ext}`;
}

/**
 * Validate file
 */
function validateFile(file: { size: number; mimetype: string }): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(`File type ${file.mimetype} is not allowed`);
  }
}

/**
 * Upload file to S3 (if configured) or local storage
 */
async function uploadToStorage(filename: string, fileData: Buffer): Promise<string> {
  if (USE_S3 && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
    // S3 upload
    try {
      // Dynamically import AWS SDK if S3 is enabled (optional dependency)
      // Using eval to avoid TypeScript compile-time checking of optional dependency
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let s3Module: any;
      try {
        s3Module = await new Function('return import("@aws-sdk/client-s3")')();
      } catch {
        console.warn(
          '[fileUploadService] AWS SDK not installed, falling back to local storage. Install @aws-sdk/client-s3 for S3 support.'
        );
        throw new Error('S3 SDK not available');
      }

      if (!s3Module || !s3Module.S3Client || !s3Module.PutObjectCommand) {
        console.warn(
          '[fileUploadService] AWS SDK not properly installed, falling back to local storage.'
        );
        throw new Error('S3 SDK not available');
      }

      const { S3Client, PutObjectCommand } = s3Module;

      const s3Client = new S3Client({
        region: S3_REGION,
        credentials: {
          accessKeyId: S3_ACCESS_KEY_ID,
          secretAccessKey: S3_SECRET_ACCESS_KEY,
        },
      });

      const key = `uploads/${filename}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: fileData,
          ContentType: 'application/octet-stream',
        })
      );

      // Return S3 URL
      return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
    } catch (error) {
      console.error('[fileUploadService] S3 upload failed, falling back to local storage:', error);
      // Fall through to local storage
    }
  }

  // Local storage fallback or default
  await ensureUploadDir();
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filePath, fileData);
  return `/uploads/${filename}`;
}

/**
 * Upload file to local storage or S3
 */
export async function uploadFile(input: FileUploadInput): Promise<FileUploadResult> {
  // Validate file
  validateFile(input.file);

  // Generate unique filename
  const filename = generateFilename(input.file.filename);

  // Upload to storage (S3 or local)
  const fileUrl = await uploadToStorage(filename, input.file.data);

  // Save file metadata to database
  return withDbClient(async (client) => {
    // Check if file_uploads table exists
    const tableExistsCheck = await tableExists(client, 'shared', 'file_uploads');

    if (!tableExistsCheck) {
      // If table doesn't exist, just return the file info without DB storage
      // In production, you'd want to create the table via migration
      return {
        id: crypto.randomUUID(),
        filename,
        originalFilename: input.file.filename,
        fileSize: input.file.size,
        mimeType: input.file.mimetype,
        fileUrl,
        uploadedBy: input.userId,
        uploadedAt: new Date(),
      };
    }

    // Insert file record
    const result = await client.query(
      `
        INSERT INTO shared.file_uploads (
          id, filename, original_filename, file_size, mime_type, file_url,
          uploaded_by, tenant_id, description, entity_type, entity_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, filename, original_filename, file_size, mime_type, file_url,
                  uploaded_by, uploaded_at
      `,
      [
        crypto.randomUUID(),
        filename,
        input.file.filename,
        input.file.size,
        input.file.mimetype,
        fileUrl,
        input.userId,
        input.tenantId,
        input.description || null,
        input.entityType || null,
        input.entityId || null,
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      filename: row.filename,
      originalFilename: row.original_filename,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      fileUrl: row.file_url,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
    };
  });
}

/**
 * Get file uploads for a user
 */
export async function getUserFileUploads(
  userId: string,
  tenantId: string
): Promise<FileUploadResult[]> {
  return withDbClient(async (client) => {
    const tableExistsCheck = await tableExists(client, 'shared', 'file_uploads');

    if (!tableExistsCheck) {
      return [];
    }

    const result = await client.query(
      `
        SELECT id, filename, original_filename, file_size, mime_type, file_url,
               uploaded_by, uploaded_at
        FROM shared.file_uploads
        WHERE uploaded_by = $1 AND tenant_id = $2
        ORDER BY uploaded_at DESC
      `,
      [userId, tenantId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      originalFilename: row.original_filename,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      fileUrl: row.file_url,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
    }));
  });
}

/**
 * Delete file upload
 */
export async function deleteFileUpload(
  fileId: string,
  userId: string,
  tenantId: string
): Promise<void> {
  return withDbClient(async (client) => {
    const tableExistsCheck = await tableExists(client, 'shared', 'file_uploads');

    if (!tableExistsCheck) {
      throw new Error('File uploads table does not exist');
    }

    // Get file info
    const fileResult = await client.query(
      `
        SELECT filename, uploaded_by, tenant_id
        FROM shared.file_uploads
        WHERE id = $1
      `,
      [fileId]
    );

    if (fileResult.rowCount === 0) {
      throw new Error('File not found');
    }

    const file = fileResult.rows[0];

    // Verify ownership
    if (file.uploaded_by !== userId || file.tenant_id !== tenantId) {
      throw new Error('Unauthorized to delete this file');
    }

    // Delete file from storage (S3 or local)
    try {
      if (
        USE_S3 &&
        S3_BUCKET &&
        S3_ACCESS_KEY_ID &&
        S3_SECRET_ACCESS_KEY &&
        file.file_url.startsWith('https://')
      ) {
        // S3 deletion
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let s3Module: any;
        try {
          s3Module = await new Function('return import("@aws-sdk/client-s3")')();
        } catch {
          console.warn('[fileUploadService] AWS SDK not installed, skipping S3 deletion.');
          throw new Error('S3 SDK not available');
        }

        if (!s3Module || !s3Module.S3Client || !s3Module.DeleteObjectCommand) {
          console.warn('[fileUploadService] AWS SDK not properly installed, skipping S3 deletion.');
          throw new Error('S3 SDK not available');
        }

        const { S3Client, DeleteObjectCommand } = s3Module;
        const s3Client = new S3Client({
          region: S3_REGION,
          credentials: {
            accessKeyId: S3_ACCESS_KEY_ID,
            secretAccessKey: S3_SECRET_ACCESS_KEY,
          },
        });

        // Extract key from URL
        const url = new URL(file.file_url);
        const key = url.pathname.substring(1); // Remove leading /

        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
          })
        );
      } else {
        // Local file deletion
        const filePath = path.join(UPLOAD_DIR, file.filename);
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.warn(`Failed to delete file from storage: ${file.filename}`, error);
      // Continue with DB deletion even if file deletion fails
    }

    // Delete from database
    await client.query(
      `
        DELETE FROM shared.file_uploads
        WHERE id = $1
      `,
      [fileId]
    );
  });
}
