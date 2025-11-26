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
  listTerms,
} from '../services/termService';
import { validateContextOrRespond } from '../lib/contextHelpers';

const router = Router();

const termIdSchema = z.object({
  termId: z.string().uuid('Invalid term identifier'),
});

const classIdSchema = z.object({
  classId: z.string().uuid('Invalid class identifier'),
});

router.use(authenticate, tenantResolver());

router.get('/branding', requirePermission('settings:branding'), async (req, res, next) => {
  const context = validateContextOrRespond(req, res);
  if (!context) return;
  try {
    const branding = await getBranding(context.tenantClient, context.tenant.schema);
    res.json(branding);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.put('/branding', requirePermission('settings:branding'), async (req, res, next) => {
  const context = validateContextOrRespond(req, res);
  if (!context) return;
  try {
    const parsed = brandingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const branding = await upsertBranding(context.tenantClient, context.tenant.schema, parsed.data);
    res.json(branding);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.post('/terms', requirePermission('settings:terms'), async (req, res, next) => {
  const context = validateContextOrRespond(req, res);
  if (!context) return;
  try {
    const parsed = academicTermSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const term = await createOrUpdateTerm(req.tenantClient!, req.tenant!.schema, parsed.data);
    res.status(201).json(term);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.get('/terms', requirePermission('settings:terms'), async (req, res, next) => {
  const context = validateContextOrRespond(req, res);
  if (!context) return;
  try {
    const terms = await listTerms(req.tenantClient!, req.tenant!.schema);
    res.json(terms);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.put('/terms/:termId', requirePermission('settings:terms'), async (req, res, next) => {
  const context = validateContextOrRespond(req, res);
  if (!context) return;
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
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.delete('/terms/:termId', requirePermission('settings:terms'), async (req, res, next) => {
  const context = validateContextOrRespond(req, res);
  if (!context) return;
  try {
    const params = termIdSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: params.error.message });
    }
    await deleteTerm(req.tenantClient!, req.tenant!.schema, params.data.termId);
    res.status(204).send();
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.post('/classes', requirePermission('settings:classes'), async (req, res, next) => {
  const context = validateContextOrRespond(req, res);
  if (!context) return;
  try {
    const parsed = classSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const classRow = await createOrUpdateClass(req.tenantClient!, req.tenant!.schema, parsed.data);
    res.status(201).json(classRow);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.get('/classes', requirePermission('settings:classes'), async (req, res, next) => {
  const context = validateContextOrRespond(req, res);
  if (!context) return;
  try {
    const classes = await listClasses(req.tenantClient!, req.tenant!.schema);
    res.json(classes);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.put('/classes/:classId', requirePermission('settings:classes'), async (req, res, next) => {
  const context = validateContextOrRespond(req, res);
  if (!context) return;
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
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.delete(
  '/classes/:classId',
  requirePermission('settings:classes'),
  async (req, res, next) => {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    try {
      const params = classIdSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: params.error.message });
      }
      await deleteClass(req.tenantClient!, req.tenant!.schema, params.data.classId);
      res.status(204).send();
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

export default router;
