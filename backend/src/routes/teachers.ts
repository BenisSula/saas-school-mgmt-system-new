import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { validateInput } from '../middleware/validateInput';
import { createPaginatedResponse } from '../middleware/pagination';
import { teacherSchema } from '../validators/teacherValidator';
import { z } from 'zod';
import {
  listTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher
} from '../services/teacherService';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext(),
  requirePermission('users:manage')
);

const listTeachersQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  page: z.string().optional()
});

router.get('/', validateInput(listTeachersQuerySchema, 'query'), async (req, res) => {
  const pagination = req.pagination!;
  const allTeachers = await listTeachers(req.tenantClient!, req.tenant!.schema);
  
  // Apply pagination
  const paginated = allTeachers.slice(pagination.offset, pagination.offset + pagination.limit);
  const response = createPaginatedResponse(paginated, allTeachers.length, pagination);
  
  res.json(response);
});

router.get('/:id', async (req, res) => {
  const teacher = await getTeacher(req.tenantClient!, req.tenant!.schema, req.params.id);
  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found' });
  }
  res.json(teacher);
});

router.post('/', validateInput(teacherSchema, 'body'), async (req, res, next) => {
  try {
    const teacher = await createTeacher(req.tenantClient!, req.tenant!.schema, req.body);
    res.status(201).json(teacher);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', validateInput(teacherSchema.partial(), 'body'), async (req, res, next) => {
  try {
    const teacher = await updateTeacher(
      req.tenantClient!,
      req.tenant!.schema,
      req.params.id,
      req.body
    );
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    res.json(teacher);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteTeacher(req.tenantClient!, req.tenant!.schema, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
