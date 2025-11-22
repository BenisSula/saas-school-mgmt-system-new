import { Router } from 'express';
import { z } from 'zod';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission } from '../middleware/rbac';
import { brandingSchema } from '../validators/brandingValidator';
import { academicTermSchema, classSchema } from '../validators/termValidator';
import { getBranding, upsertBranding } from '../services/brandingService';
import {
  createOrUpdateTerm,
  deleteTerm,
  createOrUpdateClass,
  deleteClass,
  listClasses,
  listTerms
} from '../services/termService';
import { requireTenantContext } from '../lib/routeHelpers';

const router = Router();

const termIdSchema = z.object({
  termId: z.string().uuid('Invalid term identifier')
});

const classIdSchema = z.object({
  classId: z.string().uuid('Invalid class identifier')
});

router.use(authenticate, tenantResolver());

router.get('/branding', requirePermission('settings:branding'), async (req, res, next) => {
  if (!requireTenantContext(req, res)) return;
  try {
    const branding = await getBranding(req.tenantClient!, req.tenant!.schema);
    res.json(branding);
  } catch (error) {
    next(error);
  }
});

router.put('/branding', requirePermission('settings:branding'), async (req, res, next) => {
  if (!requireTenantContext(req, res)) return;
  try {
    const parsed = brandingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const branding = await upsertBranding(req.tenantClient!, req.tenant!.schema, parsed.data);
    res.json(branding);
  } catch (error) {
    next(error);
  }
});

router.post('/terms', requirePermission('settings:terms'), async (req, res, next) => {
  if (!requireTenantContext(req, res)) return;
  try {
    const parsed = academicTermSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const term = await createOrUpdateTerm(req.tenantClient!, req.tenant!.schema, parsed.data);
    res.status(201).json(term);
  } catch (error) {
    next(error);
  }
});

router.get('/terms', requirePermission('settings:terms'), async (req, res, next) => {
  if (!requireTenantContext(req, res)) return;
  try {
    const terms = await listTerms(req.tenantClient!, req.tenant!.schema);
    res.json(terms);
  } catch (error) {
    next(error);
  }
});

router.put('/terms/:termId', requirePermission('settings:terms'), async (req, res, next) => {
  if (!requireTenantContext(req, res)) return;
  try {
    const params = termIdSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: params.error.message });
    }
    const parsed = academicTermSchema.safeParse({ ...req.body, id: params.data.termId });
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const term = await createOrUpdateTerm(req.tenantClient!, req.tenant!.schema, parsed.data);
    res.json(term);
  } catch (error) {
    next(error);
  }
});

router.delete('/terms/:termId', requirePermission('settings:terms'), async (req, res, next) => {
  if (!requireTenantContext(req, res)) return;
  try {
    const params = termIdSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: params.error.message });
    }
      await deleteTerm(req.tenantClient!, req.tenant!.schema, params.data.termId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/classes', requirePermission('settings:classes'), async (req, res, next) => {
  if (!requireTenantContext(req, res)) return;
  try {
    const parsed = classSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const classRow = await createOrUpdateClass(req.tenantClient!, req.tenant!.schema, parsed.data);
    res.status(201).json(classRow);
  } catch (error) {
    next(error);
  }
});

router.get('/classes', requirePermission('settings:classes'), async (req, res, next) => {
  if (!requireTenantContext(req, res)) return;
  try {
    const classes = await listClasses(req.tenantClient!, req.tenant!.schema);
    res.json(classes);
  } catch (error) {
    next(error);
  }
});

router.put('/classes/:classId', requirePermission('settings:classes'), async (req, res, next) => {
  if (!requireTenantContext(req, res)) return;
  try {
    const params = classIdSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: params.error.message });
    }
    const parsed = classSchema.safeParse({ ...req.body, id: params.data.classId });
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const classRow = await createOrUpdateClass(req.tenantClient!, req.tenant!.schema, parsed.data);
    res.json(classRow);
  } catch (error) {
    next(error);
  }
});

router.delete(
  '/classes/:classId',
  requirePermission('settings:classes'),
  async (req, res, next) => {
    if (!requireTenantContext(req, res)) return;
    try {
      const params = classIdSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: params.error.message });
      }
      await deleteClass(req.tenantClient!, req.tenant!.schema, params.data.classId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
