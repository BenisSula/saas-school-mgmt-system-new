/**
 * Swagger UI Configuration
 * Serves API documentation for auditing and testing
 */

import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

/**
 * Load OpenAPI specification from YAML file
 */
function loadOpenAPISpec(): Record<string, unknown> {
  try {
    const specPath = path.join(__dirname, '../../openapi.yaml');
    const specContent = fs.readFileSync(specPath, 'utf-8');
    const parsed = yaml.parse(specContent);
    return (parsed as Record<string, unknown>) || {};
  } catch (error) {
    console.error('[Swagger] Failed to load OpenAPI spec:', error);
    // Return a minimal spec if file can't be loaded
    return {
      openapi: '3.0.3',
      info: {
        title: 'SaaS School Management API',
        version: '1.0.0',
        description: 'API documentation (OpenAPI spec file not found)',
      },
      paths: {},
    };
  }
}

/**
 * Setup Swagger UI middleware
 */
export function setupSwagger(app: Express): void {
  const openApiSpec = loadOpenAPISpec();

  // Swagger UI options
  const swaggerOptions = {
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
    `,
    customSiteTitle: 'SaaS School Management API - Swagger UI',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true, // Keep auth token after page refresh
      displayRequestDuration: true,
      filter: true, // Enable search/filter
      tryItOutEnabled: true,
    },
  };

  // Serve Swagger UI at /api-docs
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(openApiSpec, swaggerOptions));

  // Also serve raw OpenAPI spec at /api-docs/openapi.json
  app.get('/api-docs/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  console.log('✅ Swagger UI available at http://localhost:3001/api-docs');
}

