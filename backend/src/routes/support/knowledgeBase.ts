import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  createKbCategory,
  getKbCategories,
  createKbArticle,
  getKbArticles,
  getKbArticleBySlug,
  updateKbArticle,
  submitArticleFeedback
} from '../../services/support/knowledgeBaseService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, tenantResolver({ optional: true }));

const createCategorySchema = z.object({
  tenantId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  displayOrder: z.number().int().optional()
});

const createArticleSchema = z.object({
  tenantId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  title: z.string().min(1),
  slug: z.string().optional(),
  content: z.string().min(1),
  contentHtml: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional()
});

const updateArticleSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  content: z.string().optional(),
  contentHtml: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  categoryId: z.string().uuid().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional()
});

const feedbackSchema = z.object({
  feedbackType: z.enum(['helpful', 'not_helpful', 'comment']),
  comment: z.string().optional()
});

// Get categories
router.get('/categories', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const categories = await getKbCategories(client, req.tenant?.id);
      res.json({ categories });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Create category
router.post('/categories', requirePermission('kb:manage'), async (req, res, next) => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const category = await createKbCategory(client, {
        ...parsed.data,
        tenantId: req.tenant?.id
      });
      res.status(201).json(category);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Get articles
router.get('/articles', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getKbArticles(client, {
        tenantId: req.tenant?.id,
        categoryId: req.query.categoryId as string,
        isPublished: req.query.published === 'true' ? true : req.query.published === 'false' ? false : undefined,
        isFeatured: req.query.featured === 'true' ? true : undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined
      });
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Get article by slug
router.get('/articles/:slug', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const article = await getKbArticleBySlug(client, req.params.slug, req.tenant?.id);
      if (!article) {
        return res.status(404).json({ message: 'Article not found' });
      }
      res.json(article);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Create article
router.post('/articles', requirePermission('kb:manage'), async (req, res, next) => {
  try {
    const parsed = createArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const article = await createKbArticle(client, {
        ...parsed.data,
        tenantId: req.tenant?.id,
        authorId: req.user?.id
      });
      res.status(201).json(article);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Update article
router.patch('/articles/:id', requirePermission('kb:manage'), async (req, res, next) => {
  try {
    const parsed = updateArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const article = await updateKbArticle(client, req.params.id, parsed.data);
      res.json(article);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Submit article feedback
router.post('/articles/:id/feedback', async (req, res, next) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const feedback = await submitArticleFeedback(
        client,
        req.params.id,
        req.user?.id || null,
        parsed.data.feedbackType,
        parsed.data.comment
      );
      res.json(feedback);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;

