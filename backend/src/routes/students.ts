import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { studentSchema } from '../validators/studentValidator';
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentClassRoster
} from '../services/studentService';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

router.get('/', requirePermission('users:manage'), async (req, res) => {
  const { classId } = req.query;
  if (classId && typeof classId === 'string') {
    // Check if classId is a UUID or name
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
    const students = await listStudents(req.tenantClient!, req.tenant!.schema);
    if (isUUID) {
      // Filter by class_uuid
      const filtered = students.filter((s) => s.class_uuid === classId);
      return res.json(filtered);
    } else {
      // Filter by class_id (name)
      const filtered = students.filter((s) => s.class_id === classId);
      return res.json(filtered);
    }
  }
  const students = await listStudents(req.tenantClient!, req.tenant!.schema);
  res.json(students);
});

router.get('/:id', requirePermission('users:manage'), async (req, res) => {
  const student = await getStudent(req.tenantClient!, req.tenant!.schema, req.params.id);
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }
  res.json(student);
});

router.post('/', requirePermission('users:manage'), async (req, res, next) => {
  const parsed = studentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }

  try {
    const student = await createStudent(req.tenantClient!, req.tenant!.schema, parsed.data);
    res.status(201).json(student);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requirePermission('users:manage'), async (req, res) => {
  const parsed = studentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }

  const student = await updateStudent(
    req.tenantClient!,
    req.tenant!.schema,
    req.params.id,
    parsed.data
  );
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }
  res.json(student);
});

router.delete('/:id', requirePermission('users:manage'), async (req, res) => {
  await deleteStudent(req.tenantClient!, req.tenant!.schema, req.params.id);
  res.status(204).send();
});

// Student roster endpoint - accessible to students for their own class, or admins/teachers
router.get('/:id/roster', async (req, res, next) => {
  try {
    // Check if user is accessing their own roster or has permission
    const isOwnRoster = req.user?.id === req.params.id;
    const hasPermission =
      req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.role === 'teacher';

    if (!isOwnRoster && !hasPermission) {
      return res.status(403).json({ message: 'You can only view your own class roster' });
    }

    const roster = await getStudentClassRoster(
      req.tenantClient!,
      req.tenant!.schema,
      req.params.id
    );

    if (!roster) {
      return res.status(404).json({ message: 'Student not found or not assigned to a class' });
    }

    res.json(roster);
  } catch (error) {
    next(error);
  }
});

export default router;
