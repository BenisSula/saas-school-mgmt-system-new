import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { validateInput } from '../middleware/validateInput';
import { generateCredentialPDFBase64 } from '../lib/pdfGenerator';
import { emailService } from '../services/emailService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

const credentialSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  fullName: z.string().min(1),
  role: z.string(),
  schoolName: z.string().optional()
});

/**
 * POST /credentials/pdf
 * Generate credential PDF
 */
router.post(
  '/pdf',
  requirePermission('users:manage'),
  validateInput(credentialSchema, 'body'),
  async (req, res, next) => {
    try {
      const { email, password, fullName, role, schoolName } = req.body;

      const base64 = await generateCredentialPDFBase64({
        email,
        password,
        fullName,
        role,
        schoolName,
        generatedAt: new Date(),
        generatedBy: req.user?.email
      });

      res.json({ base64 });
    } catch (error) {
      console.error('[credentials] Error generating PDF:', error);
      next(error);
    }
  }
);

/**
 * POST /credentials/email
 * Send credentials email
 */
router.post(
  '/email',
  requirePermission('users:manage'),
  validateInput(credentialSchema, 'body'),
  async (req, res, next) => {
    try {
      const { email, password, fullName, role } = req.body;

      await emailService.sendCredentials({
        email,
        password,
        fullName,
        role
      });

      res.json({ success: true, message: 'Credentials email sent successfully' });
    } catch (error) {
      console.error('[credentials] Error sending email:', error);
      next(error);
    }
  }
);

export default router;

