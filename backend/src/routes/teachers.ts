import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission } from '../middleware/rbac';
import { teacherSchema } from '../validators/teacherValidator';
import {
  listTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher
} from '../services/teacherService';

const router = Router();

router.use(authenticate, tenantResolver(), requirePermission('users:manage'));

router.get('/', async (req, res) => {
  const teachers = await listTeachers(req.tenantClient!);
  res.json(teachers);
});

router.get('/:id', async (req, res) => {
  const teacher = await getTeacher(req.tenantClient!, req.params.id);
  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found' });
  }
  res.json(teacher);
});

router.post('/', async (req, res, next) => {
  const parsed = teacherSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }

  try {
    const teacher = await createTeacher(req.tenantClient!, parsed.data);
    res.status(201).json(teacher);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  const parsed = teacherSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }

  try {
    const teacher = await updateTeacher(req.tenantClient!, req.params.id, parsed.data);
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
    await deleteTeacher(req.tenantClient!, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

