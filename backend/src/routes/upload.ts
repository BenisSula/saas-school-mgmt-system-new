import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { fileUploadLimiter, mutationRateLimiter } from '../middleware/mutationRateLimiter';
import { uploadFile, getUserFileUploads, deleteFileUpload } from '../services/fileUploadService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

// POST /upload - Upload a file
const uploadSchema = z.object({
  file: z.string(), // base64 encoded file
  filename: z.string().min(1),
  mimetype: z.string().min(1),
  description: z.string().optional(),
  entityType: z.enum(['user', 'student', 'teacher', 'hod']).optional(),
  entityId: z.string().uuid().optional(),
});

router.post('/', fileUploadLimiter, async (req, res, next) => {
  try {
    if (!req.user || !req.tenant) {
      return res.status(500).json({ message: 'User or tenant context missing' });
    }

    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    // Server-side validation
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_MIMETYPES = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
    ];

    const fileData = Buffer.from(parsed.data.file, 'base64');

    // Validate file size
    if (fileData.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        message: `File size (${(fileData.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (10MB)`,
      });
    }

    // Validate MIME type
    if (!ALLOWED_MIMETYPES.includes(parsed.data.mimetype)) {
      return res.status(400).json({
        message: `File type ${parsed.data.mimetype} is not allowed. Allowed types: ${ALLOWED_MIMETYPES.join(', ')}`,
      });
    }

    const result = await uploadFile({
      file: {
        data: fileData,
        filename: parsed.data.filename,
        mimetype: parsed.data.mimetype,
        size: fileData.length,
      },
      userId: req.user.id,
      tenantId: req.tenant.id,
      description: parsed.data.description,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('exceeds maximum')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message.includes('not allowed')) {
        return res.status(400).json({ message: error.message });
      }
    }
    next(error);
  }
});

// GET /upload - Get user's file uploads
router.get('/', async (req, res, next) => {
  try {
    if (!req.user || !req.tenant) {
      return res.status(500).json({ message: 'User or tenant context missing' });
    }

    const uploads = await getUserFileUploads(req.user.id, req.tenant.id);
    res.json(uploads);
  } catch (error) {
    next(error);
  }
});

// DELETE /upload/:id - Delete a file upload
router.delete('/:id', mutationRateLimiter, async (req, res, next) => {
  try {
    if (!req.user || !req.tenant) {
      return res.status(500).json({ message: 'User or tenant context missing' });
    }

    await deleteFileUpload(req.params.id, req.user.id, req.tenant.id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'File not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({ message: error.message });
      }
    }
    next(error);
  }
});

export default router;
