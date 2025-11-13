import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import {
  findLatestStudentExamId,
  listStudentExamSummaries,
  listStudentSubjectsDetailed,
  listStudentMessages,
  requestStudentPromotion,
  requestStudentSubjectDrop,
  getStudentProfileDetail,
  updateStudentProfile,
  listAcademicTermsForStudent,
  listStudentTermReports,
  generateStudentTermReport,
  fetchStudentReportPdf
} from '../services/studentPortalService';

const router = Router();

router.use(authenticate, tenantResolver());

router.get('/subjects', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }

    const subjects = await listStudentSubjectsDetailed(
      req.tenantClient,
      req.tenant.schema,
      req.user.id
    );
    res.json(subjects);
  } catch (error) {
    next(error);
  }
});

router.post('/subjects/:subjectId/drop', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }

    const result = await requestStudentSubjectDrop(
      req.tenantClient,
      req.tenant.schema,
      req.user.id,
      req.params.subjectId,
      typeof req.body?.reason === 'string' ? req.body.reason : undefined
    );
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/results/exams', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }
    const exams = await listStudentExamSummaries(req.tenantClient, req.tenant.schema, req.user.id);
    res.json(exams);
  } catch (error) {
    next(error);
  }
});

router.get('/results/latest-exam-id', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }
    const latestExamId = await findLatestStudentExamId(
      req.tenantClient,
      req.tenant.schema,
      req.user.id
    );
    res.json({ examId: latestExamId });
  } catch (error) {
    next(error);
  }
});

router.get('/profile', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }
    const profile = await getStudentProfileDetail(req.tenantClient, req.tenant.schema, req.user.id);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }
    const profile = await updateStudentProfile(req.tenantClient, req.tenant.schema, req.user.id, {
      firstName: typeof req.body?.firstName === 'string' ? req.body.firstName : undefined,
      lastName: typeof req.body?.lastName === 'string' ? req.body.lastName : undefined,
      parentContacts: Array.isArray(req.body?.parentContacts) ? req.body.parentContacts : undefined
    });
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.post('/promotion-requests', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }
    const targetClassId = req.body?.targetClassId;
    if (!targetClassId || typeof targetClassId !== 'string') {
      return res.status(400).json({ message: 'targetClassId is required' });
    }
    await requestStudentPromotion(
      req.tenantClient,
      req.tenant.schema,
      req.user.id,
      targetClassId,
      typeof req.body?.notes === 'string' ? req.body.notes : undefined
    );
    res.status(202).json({ status: 'pending' });
  } catch (error) {
    next(error);
  }
});

router.get('/messages', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }
    const messages = await listStudentMessages(req.tenantClient, req.tenant.schema, req.user.id);
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

router.get('/terms', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const terms = await listAcademicTermsForStudent(req.tenantClient, req.tenant.schema);
    res.json(terms);
  } catch (error) {
    next(error);
  }
});

router.get('/reports', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }
    const reports = await listStudentTermReports(req.tenantClient, req.tenant.schema, req.user.id);
    res.json(reports);
  } catch (error) {
    next(error);
  }
});

router.post('/reports', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }
    const termId = req.body?.termId;
    if (!termId || typeof termId !== 'string') {
      return res.status(400).json({ message: 'termId is required' });
    }
    const reportId = await generateStudentTermReport(
      req.tenantClient,
      req.tenant.schema,
      req.user.id,
      termId
    );
    res.status(201).json({ reportId });
  } catch (error) {
    next(error);
  }
});

router.get('/reports/:reportId/pdf', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.id) {
      return res.status(500).json({ message: 'Student context missing' });
    }
    const pdfBuffer = await fetchStudentReportPdf(
      req.tenantClient,
      req.tenant.schema,
      req.user.id,
      req.params.reportId
    );
    if (!pdfBuffer) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', 'attachment; filename="term-report.pdf"')
      .send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

export default router;
