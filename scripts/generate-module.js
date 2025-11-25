#!/usr/bin/env node
/**
 * Module Generator
 * 
 * Generates a new module scaffold following the project's architecture patterns.
 * 
 * Usage:
 *   node scripts/generate-module.js --name=module-name --type=frontend|backend|full
 * 
 * Example:
 *   node scripts/generate-module.js --name=attendance-retrospective --type=full
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      parsed[key] = value || true;
    }
  });
  
  return parsed;
}

// Convert kebab-case to PascalCase
function toPascalCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Convert kebab-case to camelCase
function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// Convert kebab-case to UPPER_SNAKE_CASE
function toSnakeCase(str) {
  return str.toUpperCase().replace(/-/g, '_');
}

// Ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Check if file exists and prompt for overwrite
function shouldOverwrite(filePath) {
  if (fs.existsSync(filePath)) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(`File ${filePath} already exists. Overwrite? (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }
  return true;
}

// Write file with template replacement
async function writeTemplateFile(templatePath, outputPath, replacements) {
  const shouldWrite = await shouldOverwrite(outputPath);
  if (!shouldWrite) {
    console.log(`Skipping ${outputPath}`);
    return false;
  }
  
  ensureDir(path.dirname(outputPath));
  
  let content = fs.readFileSync(templatePath, 'utf-8');
  Object.entries(replacements).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    content = content.replace(regex, value);
  });
  
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`✓ Created ${outputPath}`);
  return true;
}

// Generate backend route
async function generateBackendRoute(moduleName, moduleDir) {
  const pascalName = toPascalCase(moduleName);
  const camelName = toCamelCase(moduleName);
  
  const template = `/**
 * {{PascalName}} Routes
 * Handles {{moduleName}} endpoints
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { validateInput } from '../middleware/validateInput';
import { createPaginatedResponse } from '../middleware/pagination';
import {
  list{{PascalName}},
  get{{PascalName}},
  create{{PascalName}},
  update{{PascalName}},
  delete{{PascalName}},
} from '../services/{{moduleName}}/{{moduleName}}Service';
import {
  create{{PascalName}}Schema,
  update{{PascalName}}Schema,
} from '../validators/{{moduleName}}Validator';
import { createSuccessResponse, createErrorResponse } from '../lib/responseHelpers';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

/**
 * GET /{{moduleName}}
 * List all {{moduleName}} with pagination and filters
 */
router.get(
  '/',
  requirePermission('{{moduleName}}:read'),
  async (req, res, next) => {
    try {
      if (!req.tenant || !req.tenantClient) {
        return res.status(500).json(createErrorResponse('Tenant context missing'));
      }

      const pagination = req.pagination!;
      const filters = {
        // Add filter logic here
        ...req.query,
      };

      const items = await list{{PascalName}}(
        req.tenantClient,
        req.tenant.schema,
        filters,
        pagination
      );

      return res.json(createPaginatedResponse(items, pagination));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /{{moduleName}}/:id
 * Get a single {{moduleName}} by ID
 */
router.get(
  '/:id',
  requirePermission('{{moduleName}}:read'),
  async (req, res, next) => {
    try {
      if (!req.tenant || !req.tenantClient) {
        return res.status(500).json(createErrorResponse('Tenant context missing'));
      }

      const item = await get{{PascalName}}(
        req.tenantClient,
        req.tenant.schema,
        req.params.id
      );

      if (!item) {
        return res.status(404).json(createErrorResponse('{{PascalName}} not found'));
      }

      return res.json(createSuccessResponse(item));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /{{moduleName}}
 * Create a new {{moduleName}}
 */
router.post(
  '/',
  requirePermission('{{moduleName}}:create'),
  validateInput(create{{PascalName}}Schema),
  async (req, res, next) => {
    try {
      if (!req.tenant || !req.tenantClient) {
        return res.status(500).json(createErrorResponse('Tenant context missing'));
      }

      const item = await create{{PascalName}}(
        req.tenantClient,
        req.tenant.schema,
        req.body,
        req.user!.id
      );

      return res.status(201).json(createSuccessResponse(item));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /{{moduleName}}/:id
 * Update an existing {{moduleName}}
 */
router.put(
  '/:id',
  requirePermission('{{moduleName}}:update'),
  validateInput(update{{PascalName}}Schema),
  async (req, res, next) => {
    try {
      if (!req.tenant || !req.tenantClient) {
        return res.status(500).json(createErrorResponse('Tenant context missing'));
      }

      const item = await update{{PascalName}}(
        req.tenantClient,
        req.tenant.schema,
        req.params.id,
        req.body,
        req.user!.id
      );

      if (!item) {
        return res.status(404).json(createErrorResponse('{{PascalName}} not found'));
      }

      return res.json(createSuccessResponse(item));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /{{moduleName}}/:id
 * Delete a {{moduleName}}
 */
router.delete(
  '/:id',
  requirePermission('{{moduleName}}:delete'),
  async (req, res, next) => {
    try {
      if (!req.tenant || !req.tenantClient) {
        return res.status(500).json(createErrorResponse('Tenant context missing'));
      }

      const deleted = await delete{{PascalName}}(
        req.tenantClient,
        req.tenant.schema,
        req.params.id,
        req.user!.id
      );

      if (!deleted) {
        return res.status(404).json(createErrorResponse('{{PascalName}} not found'));
      }

      return res.json(createSuccessResponse({ deleted: true }));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
`;

  const outputPath = path.join(moduleDir, 'backend', 'src', 'routes', `${moduleName}.ts`);
  await writeTemplateFile(
    path.join(__dirname, 'templates', 'route.ts.template'),
    outputPath,
    {
      moduleName,
      PascalName: pascalName,
      camelName: camelName,
    }
  ).catch(() => {
    // If template doesn't exist, write directly
    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const replacements = {
        moduleName,
        PascalName: pascalName,
        camelName: camelName,
      };
      return replacements[key] || match;
    }));
    console.log(`✓ Created ${outputPath}`);
  });
}

// Generate backend service
async function generateBackendService(moduleName, moduleDir) {
  const pascalName = toPascalCase(moduleName);
  const camelName = toCamelCase(moduleName);
  
  const template = `/**
 * {{PascalName}} Service
 *
 * Business logic for {{PascalName}} domain.
 * Uses repository pattern for data access and emits events for async workflows.
 */

import type { PoolClient } from 'pg';
import type {
  {{PascalName}},
  {{PascalName}}Input,
  {{PascalName}}Filters,
} from '../../../../shared/domain/types/{{moduleName}}.types';
import { createAuditLog } from '../audit/enhancedAuditService';

/**
 * List {{moduleName}} with optional filters
 */
export async function list{{PascalName}}(
  client: PoolClient,
  schema: string,
  filters?: {{PascalName}}Filters,
  pagination?: { limit: number; offset: number }
): Promise<{{PascalName}}[]> {
  // TODO: Implement repository pattern
  // const repository = new {{PascalName}}Repository(client, schema);
  // return repository.findWithFilters(filters || {}, pagination);
  
  // Placeholder implementation
  const result = await client.query(
    \`SELECT * FROM \${schema}.{{moduleName}} ORDER BY created_at DESC LIMIT \$1 OFFSET \$2\`,
    [pagination?.limit || 50, pagination?.offset || 0]
  );
  return result.rows;
}

/**
 * Get {{moduleName}} by ID
 */
export async function get{{PascalName}}(
  client: PoolClient,
  schema: string,
  id: string
): Promise<{{PascalName}} | null> {
  // TODO: Implement repository pattern
  const result = await client.query(
    \`SELECT * FROM \${schema}.{{moduleName}} WHERE id = \$1\`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create {{moduleName}}
 */
export async function create{{PascalName}}(
  client: PoolClient,
  schema: string,
  input: {{PascalName}}Input,
  actorId: string
): Promise<{{PascalName}}> {
  // TODO: Implement repository pattern
  const result = await client.query(
    \`INSERT INTO \${schema}.{{moduleName}} (name, created_by, updated_by)
     VALUES (\$1, \$2, \$2)
     RETURNING *\`,
    [input.name, actorId]
  );

  const item = result.rows[0];

  // Create audit log
  await createAuditLog(client, {
    tenantId: null, // Will be set by middleware
    userId: actorId,
    action: '{{SNAKE_NAME}}_CREATED',
    resourceType: '{{moduleName}}',
    resourceId: item.id,
    details: { name: item.name },
    severity: 'info',
  });

  return item;
}

/**
 * Update {{moduleName}}
 */
export async function update{{PascalName}}(
  client: PoolClient,
  schema: string,
  id: string,
  input: Partial<{{PascalName}}Input>,
  actorId: string
): Promise<{{PascalName}} | null> {
  // TODO: Implement repository pattern
  const result = await client.query(
    \`UPDATE \${schema}.{{moduleName}}
     SET name = COALESCE(\$1, name), updated_by = \$2, updated_at = NOW()
     WHERE id = \$3
     RETURNING *\`,
    [input.name, actorId, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const item = result.rows[0];

  // Create audit log
  await createAuditLog(client, {
    tenantId: null,
    userId: actorId,
    action: '{{SNAKE_NAME}}_UPDATED',
    resourceType: '{{moduleName}}',
    resourceId: item.id,
    details: { name: item.name },
    severity: 'info',
  });

  return item;
}

/**
 * Delete {{moduleName}}
 */
export async function delete{{PascalName}}(
  client: PoolClient,
  schema: string,
  id: string,
  actorId: string
): Promise<boolean> {
  // TODO: Implement repository pattern
  const result = await client.query(
    \`DELETE FROM \${schema}.{{moduleName}} WHERE id = \$1\`,
    [id]
  );

  if (result.rowCount === 0) {
    return false;
  }

  // Create audit log
  await createAuditLog(client, {
    tenantId: null,
    userId: actorId,
    action: '{{SNAKE_NAME}}_DELETED',
    resourceType: '{{moduleName}}',
    resourceId: id,
    details: {},
    severity: 'info',
  });

  return true;
}
`;

  const outputPath = path.join(moduleDir, 'backend', 'src', 'services', moduleName, `${moduleName}Service.ts`);
  ensureDir(path.dirname(outputPath));
  
  const content = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const replacements = {
      moduleName,
      PascalName: pascalName,
      camelName: camelName,
      SNAKE_NAME: toSnakeCase(moduleName),
    };
    return replacements[key] || match;
  });
  
  const shouldWrite = await shouldOverwrite(outputPath);
  if (shouldWrite) {
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`✓ Created ${outputPath}`);
  }
}

// Generate backend validator
async function generateBackendValidator(moduleName, moduleDir) {
  const pascalName = toPascalCase(moduleName);
  
  const template = `import { z } from 'zod';

export const create{{PascalName}}Schema = z.object({
  name: z.string().min(1).max(255),
  // TODO: Add more fields as needed
});

export const update{{PascalName}}Schema = create{{PascalName}}Schema.partial();

export type Create{{PascalName}}Input = z.infer<typeof create{{PascalName}}Schema>;
export type Update{{PascalName}}Input = z.infer<typeof update{{PascalName}}Schema>;
`;

  const outputPath = path.join(moduleDir, 'backend', 'src', 'validators', `${moduleName}Validator.ts`);
  ensureDir(path.dirname(outputPath));
  
  const content = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const replacements = {
      moduleName,
      PascalName: pascalName,
    };
    return replacements[key] || match;
  });
  
  const shouldWrite = await shouldOverwrite(outputPath);
  if (shouldWrite) {
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`✓ Created ${outputPath}`);
  }
}

// Generate frontend page
async function generateFrontendPage(moduleName, moduleDir) {
  const pascalName = toPascalCase(moduleName);
  const camelName = toCamelCase(moduleName);
  
  const template = `/**
 * {{PascalName}} Management Page
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { ManagementPageLayout } from '../../components/admin/ManagementPageLayout';
import { Button } from '../../components/ui/Button';
import { Table, type TableColumn } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Plus } from 'lucide-react';

interface {{PascalName}} {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export default function {{PascalName}}Page() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['{{moduleName}}'],
    queryFn: () => api.{{camelName}}.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => api.{{camelName}}.create(data),
    onSuccess: () => {
      toast.success('{{PascalName}} created successfully');
      queryClient.invalidateQueries({ queryKey: ['{{moduleName}}'] });
      setIsCreateModalOpen(false);
      setFormData({ name: '' });
    },
    onError: (error: Error) => {
      toast.error(\`Failed to create {{moduleName}}: \${error.message}\`);
    },
  });

  const columns: TableColumn<{{PascalName}}>[] = [
    {
      header: 'Name',
      key: 'name',
    },
    {
      header: 'Created',
      key: 'created_at',
      render: (item) => new Date(item.created_at).toLocaleDateString(),
    },
  ];

  return (
    <ManagementPageLayout
      title="{{PascalName}}"
      description="Manage {{moduleName}}"
      error={error ? (error as Error).message : null}
      loading={isLoading}
      bulkActionButton={
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create {{PascalName}}
        </Button>
      }
    >
      <Table
        columns={columns}
        data={data || []}
        emptyMessage="No {{moduleName}} found"
      />

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create {{PascalName}}"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(formData);
          }}
        >
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </ManagementPageLayout>
  );
}
`;

  const outputPath = path.join(moduleDir, 'frontend', 'src', 'pages', 'admin', moduleName, 'page.tsx');
  ensureDir(path.dirname(outputPath));
  
  const content = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const replacements = {
      moduleName,
      PascalName: pascalName,
      camelName: camelName,
    };
    return replacements[key] || match;
  });
  
  const shouldWrite = await shouldOverwrite(outputPath);
  if (shouldWrite) {
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`✓ Created ${outputPath}`);
  }
}

// Generate frontend hook
async function generateFrontendHook(moduleName, moduleDir) {
  const pascalName = toPascalCase(moduleName);
  const camelName = toCamelCase(moduleName);
  
  const template = `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from 'sonner';

export interface {{PascalName}} {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function use{{PascalName}}() {
  return useQuery({
    queryKey: ['{{moduleName}}'],
    queryFn: () => api.{{camelName}}.list(),
  });
}

export function useCreate{{PascalName}}() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { name: string }) => api.{{camelName}}.create(data),
    onSuccess: () => {
      toast.success('{{PascalName}} created successfully');
      queryClient.invalidateQueries({ queryKey: ['{{moduleName}}'] });
    },
    onError: (error: Error) => {
      toast.error(\`Failed to create {{moduleName}}: \${error.message}\`);
    },
  });
}
`;

  const outputPath = path.join(moduleDir, 'frontend', 'src', 'hooks', 'queries', `use${pascalName}.ts`);
  ensureDir(path.dirname(outputPath));
  
  const content = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const replacements = {
      moduleName,
      PascalName: pascalName,
      camelName: camelName,
    };
    return replacements[key] || match;
  });
  
  const shouldWrite = await shouldOverwrite(outputPath);
  if (shouldWrite) {
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`✓ Created ${outputPath}`);
  }
}

// Generate README
async function generateREADME(moduleName, moduleDir) {
  const pascalName = toPascalCase(moduleName);
  
  const template = `# {{PascalName}} Module

## Overview

This module handles {{moduleName}} management functionality.

## Backend

### Routes
- \`GET /api/{{moduleName}}\` - List all {{moduleName}}
- \`GET /api/{{moduleName}}/:id\` - Get a single {{moduleName}}
- \`POST /api/{{moduleName}}\` - Create a new {{moduleName}}
- \`PUT /api/{{moduleName}}/:id\` - Update a {{moduleName}}
- \`DELETE /api/{{moduleName}}/:id\` - Delete a {{moduleName}}

### Service
Located at: \`backend/src/services/{{moduleName}}/{{moduleName}}Service.ts\`

### Validators
Located at: \`backend/src/validators/{{moduleName}}Validator.ts\`

## Frontend

### Pages
- \`/admin/{{moduleName}}\` - Management page

### Components
Located at: \`frontend/src/components/{{moduleName}}/\`

### Hooks
Located at: \`frontend/src/hooks/queries/use{{PascalName}}.ts\`

## Database

### Migration
Create migration file: \`backend/src/db/migrations/tenants/XXX_create_{{moduleName}}.sql\`

\`\`\`sql
CREATE TABLE IF NOT EXISTS {{schema}}.{{moduleName}} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES shared.users(id),
  updated_by UUID REFERENCES shared.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_{{moduleName}}_created_at ON {{schema}}.{{moduleName}}(created_at);
\`\`\`

## Testing

### Backend Tests
\`backend/src/services/{{moduleName}}/__tests__/{{moduleName}}Service.test.ts\`

### Frontend Tests
\`frontend/src/pages/admin/{{moduleName}}/__tests__/page.test.tsx\`

## Development

1. Run migrations: \`npm run migrate --prefix backend\`
2. Start dev servers: \`npm run dev\`
3. Access at: \`http://localhost:5173/admin/{{moduleName}}\`
`;

  const outputPath = path.join(moduleDir, 'README.md');
  
  const content = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const replacements = {
      moduleName,
      PascalName: pascalName,
      schema: '{{schema}}', // Keep template variable for migrations
    };
    return replacements[key] || match;
  });
  
  const shouldWrite = await shouldOverwrite(outputPath);
  if (shouldWrite) {
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`✓ Created ${outputPath}`);
  }
}

// Main generator function
async function generateModule(moduleName, type) {
  console.log(`\n🚀 Generating ${type} module: ${moduleName}\n`);
  
  const rootDir = path.resolve(__dirname, '..');
  const moduleDir = rootDir;
  
  try {
    if (type === 'backend' || type === 'full') {
      console.log('📦 Generating backend files...');
      await generateBackendRoute(moduleName, moduleDir);
      await generateBackendService(moduleName, moduleDir);
      await generateBackendValidator(moduleName, moduleDir);
    }
    
    if (type === 'frontend' || type === 'full') {
      console.log('🎨 Generating frontend files...');
      await generateFrontendPage(moduleName, moduleDir);
      await generateFrontendHook(moduleName, moduleDir);
    }
    
    await generateREADME(moduleName, moduleDir);
    
    console.log(`\n✅ Module ${moduleName} generated successfully!\n`);
    console.log('Next steps:');
    console.log('1. Add route to backend/src/app.ts (if backend)');
    console.log('2. Add route to frontend/src/App.tsx (if frontend)');
    console.log('3. Create database migration');
    console.log('4. Add API methods to frontend/src/lib/api.ts');
    console.log('5. Run: npm run lint && npm run format:write');
    console.log('6. Run: npm run test\n');
    
  } catch (error) {
    console.error('❌ Error generating module:', error);
    process.exit(1);
  }
}

// Main execution
const args = parseArgs();
const moduleName = args.name;
const type = args.type || 'full';

if (!moduleName) {
  console.error('❌ Error: --name parameter is required');
  console.log('\nUsage: node scripts/generate-module.js --name=module-name --type=frontend|backend|full');
  process.exit(1);
}

if (!['frontend', 'backend', 'full'].includes(type)) {
  console.error('❌ Error: --type must be one of: frontend, backend, full');
  process.exit(1);
}

generateModule(moduleName, type).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

