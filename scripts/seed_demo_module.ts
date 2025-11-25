/**
 * Seed Demo Module Data
 * 
 * Seeds demo data for the class-resources-manager module
 * 
 * Usage:
 *   ts-node scripts/seed_demo_module.ts
 */

import { getPool, getTenantClient } from '../backend/src/db/connection';
import { listClasses } from '../backend/src/services/classes/classService';

interface ClassResourceInput {
  class_id: string;
  title: string;
  description?: string;
  resource_type: 'document' | 'link' | 'file' | 'video';
  resource_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}

const DEMO_RESOURCES: Omit<ClassResourceInput, 'class_id'>[] = [
  {
    title: 'Mathematics Syllabus 2024',
    description: 'Complete syllabus for Mathematics course',
    resource_type: 'document',
    resource_url: 'https://example.com/math-syllabus.pdf',
    file_name: 'math-syllabus.pdf',
    file_size: 1024000,
    mime_type: 'application/pdf',
  },
  {
    title: 'Science Lab Safety Guidelines',
    description: 'Important safety guidelines for science laboratory',
    resource_type: 'document',
    resource_url: 'https://example.com/lab-safety.pdf',
    file_name: 'lab-safety.pdf',
    file_size: 512000,
    mime_type: 'application/pdf',
  },
  {
    title: 'Khan Academy - Algebra Basics',
    description: 'Video series on algebra fundamentals',
    resource_type: 'video',
    resource_url: 'https://www.khanacademy.org/math/algebra',
    file_name: null,
    file_size: null,
    mime_type: null,
  },
  {
    title: 'Periodic Table Reference',
    description: 'Interactive periodic table for chemistry',
    resource_type: 'link',
    resource_url: 'https://www.ptable.com',
    file_name: null,
    file_size: null,
    mime_type: null,
  },
  {
    title: 'History Timeline Template',
    description: 'Template for creating historical timelines',
    resource_type: 'file',
    resource_url: 'https://example.com/timeline-template.docx',
    file_name: 'timeline-template.docx',
    file_size: 256000,
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
];

async function seedDemoModule() {
  console.log('🌱 Seeding demo class resources...\n');

  const pool = getPool();

  try {
    // Get demo tenant (first active tenant)
    const tenantResult = await pool.query(
      `SELECT id, schema_name FROM shared.tenants WHERE status = 'active' LIMIT 1`
    );

    if (tenantResult.rows.length === 0) {
      console.error('❌ No active tenant found. Please create a tenant first.');
      process.exit(1);
    }

    const tenant = tenantResult.rows[0];
    const tenantClient = await getTenantClient(tenant.id);

    try {
      // Get classes for this tenant
      const classes = await listClasses(tenantClient, tenant.schema_name);

      if (classes.length === 0) {
        console.error('❌ No classes found. Please create classes first.');
        tenantClient.release();
        process.exit(1);
      }

      console.log(`📚 Found ${classes.length} classes`);

      // Seed resources for each class
      let seededCount = 0;
      for (const classItem of classes) {
        // Seed 2-3 resources per class
        const resourcesForClass = DEMO_RESOURCES.slice(0, Math.min(3, DEMO_RESOURCES.length));
        
        for (const resource of resourcesForClass) {
          try {
            await tenantClient.query(
              `INSERT INTO ${tenant.schema_name}.class_resources 
               (class_id, title, description, resource_type, resource_url, file_name, file_size, mime_type, created_by, updated_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 
                 (SELECT id FROM shared.users WHERE tenant_id = $9 LIMIT 1),
                 (SELECT id FROM shared.users WHERE tenant_id = $9 LIMIT 1))
               ON CONFLICT DO NOTHING`,
              [
                classItem.id,
                resource.title,
                resource.description || null,
                resource.resource_type,
                resource.resource_url,
                resource.file_name || null,
                resource.file_size || null,
                resource.mime_type || null,
                tenant.id,
              ]
            );
            seededCount++;
          } catch (error) {
            console.warn(`⚠️  Failed to seed resource "${resource.title}" for class ${classItem.name}:`, error);
          }
        }
      }

      console.log(`\n✅ Seeded ${seededCount} class resources across ${classes.length} classes\n`);
      tenantClient.release();
    } catch (error) {
      tenantClient.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Error seeding demo module:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  seedDemoModule()
    .then(() => {
      console.log('✨ Demo module seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export { seedDemoModule };

