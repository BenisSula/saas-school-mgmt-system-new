import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import authorizeSuperUser from '../../middleware/authorizeSuperUser';
import { getPool } from '../../db/connection';
import {
  createInvestigationCase,
  updateCaseStatus,
  getInvestigationCases,
  getInvestigationCase,
  addCaseNote,
  addCaseEvidence,
  detectAnomalies,
  getUserActions,
  exportCaseAuditTrail,
} from '../../services/superuser/investigationService';
import {
  createCaseSchema,
  updateCaseStatusSchema,
  addCaseNoteSchema,
  addCaseEvidenceSchema,
  caseFiltersQuerySchema,
  anomalyDetectionQuerySchema,
  userActionsQuerySchema,
  exportAuditTrailQuerySchema,
} from '../../validators/superuserInvestigationValidator';
import { Role } from '../../config/permissions';

const router = Router();

// All routes require authentication and superuser authorization
router.use(authenticate, authorizeSuperUser);

/**
 * POST /superuser/investigations/cases
 * Create a new investigation case
 */
router.post('/cases', async (req, res, next) => {
  try {
    const pool = getPool();
    const bodyResult = createCaseSchema.safeParse(req.body);

    if (!bodyResult.success) {
      return res.status(400).json({ message: bodyResult.error.message });
    }

    const case_ = await createInvestigationCase(
      pool,
      bodyResult.data,
      req.user!.id,
      req.user!.role as Role
    );

    res.status(201).json(case_);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/investigations/cases
 * Get investigation cases with filters
 */
router.get('/cases', async (req, res, next) => {
  try {
    const pool = getPool();
    const queryResult = caseFiltersQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({ message: queryResult.error.message });
    }

    const result = await getInvestigationCases(pool, queryResult.data, req.user!.role as Role);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/investigations/cases/:caseId
 * Get a single investigation case with notes and evidence
 */
router.get('/cases/:caseId', async (req, res, next) => {
  try {
    const pool = getPool();
    const { caseId } = req.params;

    const result = await getInvestigationCase(pool, caseId, req.user!.role as Role);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /superuser/investigations/cases/:caseId/status
 * Update case status
 */
router.patch('/cases/:caseId/status', async (req, res, next) => {
  try {
    const pool = getPool();
    const { caseId } = req.params;
    const bodyResult = updateCaseStatusSchema.safeParse(req.body);

    if (!bodyResult.success) {
      return res.status(400).json({ message: bodyResult.error.message });
    }

    const case_ = await updateCaseStatus(
      pool,
      caseId,
      bodyResult.data.status,
      req.user!.id,
      req.user!.role as Role,
      bodyResult.data.resolution,
      bodyResult.data.resolutionNotes
    );

    res.json(case_);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /superuser/investigations/cases/:caseId/notes
 * Add a note to a case
 */
router.post('/cases/:caseId/notes', async (req, res, next) => {
  try {
    const pool = getPool();
    const { caseId } = req.params;
    const bodyResult = addCaseNoteSchema.safeParse(req.body);

    if (!bodyResult.success) {
      return res.status(400).json({ message: bodyResult.error.message });
    }

    const note = await addCaseNote(
      pool,
      caseId,
      bodyResult.data.note,
      bodyResult.data.noteType || 'note',
      req.user!.id,
      req.user!.role as Role,
      bodyResult.data.metadata
    );

    res.status(201).json(note);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /superuser/investigations/cases/:caseId/evidence
 * Add evidence to a case
 */
router.post('/cases/:caseId/evidence', async (req, res, next) => {
  try {
    const pool = getPool();
    const { caseId } = req.params;
    const bodyResult = addCaseEvidenceSchema.safeParse(req.body);

    if (!bodyResult.success) {
      return res.status(400).json({ message: bodyResult.error.message });
    }

    const evidence = await addCaseEvidence(
      pool,
      caseId,
      bodyResult.data.evidenceType,
      bodyResult.data.evidenceId,
      bodyResult.data.evidenceSource,
      bodyResult.data.description || '',
      req.user!.id,
      req.user!.role as Role,
      bodyResult.data.metadata
    );

    res.status(201).json(evidence);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/investigations/anomalies
 * Detect behavioral anomalies
 */
router.get('/anomalies', async (req, res, next) => {
  try {
    const pool = getPool();
    const queryResult = anomalyDetectionQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({ message: queryResult.error.message });
    }

    const anomalies = await detectAnomalies(pool, queryResult.data, req.user!.role as Role);

    res.json({ anomalies });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/investigations/users/:userId/actions
 * Get all actions performed by a user (cross-tenant)
 */
router.get('/users/:userId/actions', async (req, res, next) => {
  try {
    const pool = getPool();
    const { userId } = req.params;
    const queryResult = userActionsQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({ message: queryResult.error.message });
    }

    const result = await getUserActions(pool, userId, queryResult.data, req.user!.role as Role);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/investigations/cases/:caseId/export
 * Export audit trail for a case
 */
router.get('/cases/:caseId/export', async (req, res, next) => {
  try {
    const pool = getPool();
    const { caseId } = req.params;
    const queryResult = exportAuditTrailQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({ message: queryResult.error.message });
    }

    const exportData = await exportCaseAuditTrail(
      pool,
      caseId,
      queryResult.data.format || 'json',
      req.user!.role as Role
    );

    res.setHeader('Content-Type', exportData.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
    res.send(exportData.data);
  } catch (error) {
    next(error);
  }
});

export default router;
