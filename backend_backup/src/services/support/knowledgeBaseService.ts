import crypto from 'crypto';
import type { PoolClient } from 'pg';

export interface CreateKbCategoryInput {
  tenantId?: string;
  parentId?: string;
  name: string;
  slug: string;
  description?: string;
  displayOrder?: number;
}

export interface CreateKbArticleInput {
  tenantId?: string;
  categoryId?: string;
  title: string;
  slug: string;
  content: string;
  contentHtml?: string;
  summary?: string;
  tags?: string[];
  isPublished?: boolean;
  isFeatured?: boolean;
  authorId?: string;
}

export interface UpdateKbArticleInput {
  title?: string;
  slug?: string;
  content?: string;
  contentHtml?: string;
  summary?: string;
  tags?: string[];
  categoryId?: string;
  isPublished?: boolean;
  isFeatured?: boolean;
}

/**
 * Generate slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Create KB category
 */
export async function createKbCategory(
  client: PoolClient,
  input: CreateKbCategoryInput
): Promise<unknown> {
  const categoryId = crypto.randomUUID();
  const slug = input.slug || generateSlug(input.name);

  const result = await client.query(
    `
      INSERT INTO shared.kb_categories (
        id, tenant_id, parent_id, name, slug, description, display_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      categoryId,
      input.tenantId || null,
      input.parentId || null,
      input.name,
      slug,
      input.description || null,
      input.displayOrder || 0
    ]
  );

  return result.rows[0];
}

/**
 * Get KB categories
 */
export async function getKbCategories(
  client: PoolClient,
  tenantId?: string
): Promise<unknown[]> {
  const conditions: string[] = ['is_active = TRUE'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  const result = await client.query(
    `
      SELECT c.*,
             COUNT(a.id) as article_count
      FROM shared.kb_categories c
      LEFT JOIN shared.kb_articles a ON a.category_id = c.id AND a.is_published = TRUE
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `,
    values
  );

  return result.rows;
}

/**
 * Create KB article
 */
export async function createKbArticle(
  client: PoolClient,
  input: CreateKbArticleInput
): Promise<unknown> {
  const articleId = crypto.randomUUID();
  const slug = input.slug || generateSlug(input.title);

  const result = await client.query(
    `
      INSERT INTO shared.kb_articles (
        id, tenant_id, category_id, title, slug, content, content_html,
        summary, tags, is_published, is_featured, author_id, published_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `,
    [
      articleId,
      input.tenantId || null,
      input.categoryId || null,
      input.title,
      slug,
      input.content,
      input.contentHtml || null,
      input.summary || null,
      input.tags || [],
      input.isPublished || false,
      input.isFeatured || false,
      input.authorId || null,
      input.isPublished ? new Date() : null
    ]
  );

  return result.rows[0];
}

/**
 * Get KB articles
 */
export async function getKbArticles(
  client: PoolClient,
  filters: {
    tenantId?: string;
    categoryId?: string;
    isPublished?: boolean;
    isFeatured?: boolean;
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ articles: unknown[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(filters.tenantId);
  }

  if (filters.categoryId) {
    conditions.push(`category_id = $${paramIndex++}`);
    values.push(filters.categoryId);
  }

  if (filters.isPublished !== undefined) {
    conditions.push(`is_published = $${paramIndex++}`);
    values.push(filters.isPublished);
  }

  if (filters.isFeatured !== undefined) {
    conditions.push(`is_featured = $${paramIndex++}`);
    values.push(filters.isFeatured);
  }

  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`tags && $${paramIndex++}`);
    values.push(filters.tags);
  }

  if (filters.search) {
    conditions.push(`(title ILIKE $${paramIndex++} OR content ILIKE $${paramIndex} OR summary ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM shared.kb_articles ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get articles
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  values.push(limit, offset);

  const articlesResult = await client.query(
    `
      SELECT a.*,
             c.name as category_name,
             u.email as author_email
      FROM shared.kb_articles a
      LEFT JOIN shared.kb_categories c ON c.id = a.category_id
      LEFT JOIN shared.users u ON u.id = a.author_id
      ${whereClause}
      ORDER BY is_featured DESC, created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    articles: articlesResult.rows,
    total
  };
}

/**
 * Get KB article by slug
 */
export async function getKbArticleBySlug(
  client: PoolClient,
  slug: string,
  tenantId?: string
): Promise<unknown | null> {
  const conditions: string[] = ['slug = $1', 'is_published = TRUE'];
  const values: unknown[] = [slug];
  let paramIndex = 2;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  const result = await client.query(
    `
      SELECT a.*,
             c.name as category_name,
             u.email as author_email
      FROM shared.kb_articles a
      LEFT JOIN shared.kb_categories c ON c.id = a.category_id
      LEFT JOIN shared.users u ON u.id = a.author_id
      WHERE ${conditions.join(' AND ')}
    `,
    values
  );

  if (result.rowCount === 0) {
    return null;
  }

  const article = result.rows[0];

  // Increment view count
  await client.query(
    'UPDATE shared.kb_articles SET view_count = view_count + 1 WHERE id = $1',
    [article.id]
  );

  return article;
}

/**
 * Update KB article
 */
export async function updateKbArticle(
  client: PoolClient,
  articleId: string,
  input: UpdateKbArticleInput
): Promise<unknown> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.title) {
    updates.push(`title = $${paramIndex++}`);
    values.push(input.title);
  }

  if (input.slug) {
    updates.push(`slug = $${paramIndex++}`);
    values.push(input.slug);
  }

  if (input.content) {
    updates.push(`content = $${paramIndex++}`);
    values.push(input.content);
  }

  if (input.contentHtml !== undefined) {
    updates.push(`content_html = $${paramIndex++}`);
    values.push(input.contentHtml);
  }

  if (input.summary !== undefined) {
    updates.push(`summary = $${paramIndex++}`);
    values.push(input.summary);
  }

  if (input.tags !== undefined) {
    updates.push(`tags = $${paramIndex++}`);
    values.push(input.tags);
  }

  if (input.categoryId !== undefined) {
    updates.push(`category_id = $${paramIndex++}`);
    values.push(input.categoryId);
  }

  if (input.isPublished !== undefined) {
    updates.push(`is_published = $${paramIndex++}`);
    values.push(input.isPublished);
    if (input.isPublished) {
      updates.push(`published_at = COALESCE(published_at, NOW())`);
    }
  }

  if (input.isFeatured !== undefined) {
    updates.push(`is_featured = $${paramIndex++}`);
    values.push(input.isFeatured);
  }

  if (updates.length === 0) {
    throw new Error('No updates provided');
  }

  updates.push(`updated_at = NOW()`);
  values.push(articleId);

  const result = await client.query(
    `
      UPDATE shared.kb_articles
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  return result.rows[0];
}

/**
 * Submit article feedback
 */
export async function submitArticleFeedback(
  client: PoolClient,
  articleId: string,
  userId: string | null,
  feedbackType: 'helpful' | 'not_helpful' | 'comment',
  comment?: string
): Promise<unknown> {
  const feedbackId = crypto.randomUUID();

  const result = await client.query(
    `
      INSERT INTO shared.kb_article_feedback (
        id, article_id, user_id, feedback_type, comment
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (article_id, user_id, feedback_type)
      DO UPDATE SET comment = EXCLUDED.comment
      RETURNING *
    `,
    [feedbackId, articleId, userId, feedbackType, comment || null]
  );

  // Update article helpful/not helpful counts
  if (feedbackType === 'helpful') {
    await client.query(
      'UPDATE shared.kb_articles SET helpful_count = helpful_count + 1 WHERE id = $1',
      [articleId]
    );
  } else if (feedbackType === 'not_helpful') {
    await client.query(
      'UPDATE shared.kb_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = $1',
      [articleId]
    );
  }

  return result.rows[0];
}

