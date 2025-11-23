import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission } from '../middleware/rbac';
import {
  classSubjectAssignmentSchema,
  promotionSchema,
  studentSubjectSchema,
  subjectSchema,
  teacherAssignmentSchema,
  termReportSchema
} from '../validators/subjectValidator';
import {
  createSubject,
  deleteSubject,
  listClassSubjects,
  listStudentSubjects,
  listSubjects,
  listTeacherAssignments,
  recordPromotion,
  removeTeacherAssignment,
  replaceClassSubjects,
  replaceStudentSubjects,
  updateSubject,
  upsertTeacherAssignment
} from '../services/subjectService';
import { generateTermReport, fetchReportPdf } from '../services/reportService';
import { moveStudentToClass } from '../services/studentService';

const router = Router();

router.use(authenticate, tenantResolver(), requirePermission('users:manage'));

router.get('/subjects', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const subjects = await listSubjects(req.tenantClient, req.tenant.schema);
    res.json(subjects);
  } catch (error) {
    next(error);
  }
});

router.post('/subjects', async (req, res, next) => {
  const parsed = subjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const subject = await createSubject(req.tenantClient, req.tenant.schema, parsed.data);
    res.status(201).json(subject);
  } catch (error) {
    next(error);
  }
});

router.put('/subjects/:id', async (req, res, next) => {
  const parsed = subjectSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const subject = await updateSubject(
      req.tenantClient,
      req.tenant.schema,
      req.params.id,
      parsed.data
    );
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    res.json(subject);
  } catch (error) {
    next(error);
  }
});

router.delete('/subjects/:id', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    await deleteSubject(req.tenantClient, req.tenant.schema, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/classes/:classId/subjects', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const subjects = await listClassSubjects(
      req.tenantClient,
      req.tenant.schema,
      req.params.classId
    );
    res.json(subjects);
  } catch (error) {
    next(error);
  }
});

router.post('/classes/:classId/subjects', async (req, res, next) => {
  const parsed = classSubjectAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const assignments = await replaceClassSubjects(
      req.tenantClient,
      req.tenant.schema,
      req.params.classId,
      parsed.data
    );
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

router.get('/teacher-assignments', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const assignments = await listTeacherAssignments(req.tenantClient, req.tenant.schema);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

router.post('/teachers/:teacherId/assignments', async (req, res, next) => {
  const parsed = teacherAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const assignment = await upsertTeacherAssignment(
      req.tenantClient,
      req.tenant.schema,
      req.params.teacherId,
      parsed.data
    );
    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
});

router.delete('/teacher-assignments/:id', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    await removeTeacherAssignment(req.tenantClient, req.tenant.schema, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/students/:studentId/subjects', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const subjects = await listStudentSubjects(
      req.tenantClient,
      req.tenant.schema,
      req.params.studentId
    );
    res.json(subjects);
  } catch (error) {
    next(error);
  }
});

router.post('/students/:studentId/subjects', async (req, res, next) => {
  const parsed = studentSubjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const subjects = await replaceStudentSubjects(
      req.tenantClient,
      req.tenant.schema,
      req.params.studentId,
      parsed.data
    );
    res.json(subjects);
  } catch (error) {
    next(error);
  }
});

router.post('/students/:studentId/promote', async (req, res, next) => {
  const parsed = promotionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }
  try {
    if (!req.tenantClient || !req.tenant || !req.user) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const result = await moveStudentToClass(
      req.tenantClient,
      req.tenant.schema,
      req.params.studentId,
      parsed.data.toClassId
    );
    if (!result) {
      return res.status(404).json({ message: 'Student not found' });
    }
    await recordPromotion(
      req.tenantClient,
      req.tenant.schema,
      req.params.studentId,
      result.previousClassId,
      parsed.data.toClassId,
      req.user.id,
      parsed.data.notes
    );
    res.json(result.student);
  } catch (error) {
    next(error);
  }
});

router.post('/reports/term', async (req, res, next) => {
  const parsed = termReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const report = await generateTermReport(
      req.tenantClient,
      req.tenant.schema,
      parsed.data,
      req.user?.id ?? null
    );
    res
      .status(201)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="term-report-${report.summary.student.fullName.replace(/\s+/g, '_')}.pdf"`
      )
      .send(report.pdfBuffer);
  } catch (error) {
    next(error);
  }
});

router.get('/reports/term/:reportId/pdf', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const buffer = await fetchReportPdf(req.tenantClient, req.tenant.schema, req.params.reportId);
    if (!buffer) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', 'inline')
      .send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
