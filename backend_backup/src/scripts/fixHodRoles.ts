import 'dotenv/config';
import { getPool, closePool } from '../db/connection';

const HOD_EMAILS = [
  'alhaji.saine@newhorizon.edu.gm',
  'mariama.camara@newhorizon.edu.gm',
  'joseph.ceesay@newhorizon.edu.gm',
  'hassan.njie@stpeterslamin.edu.gm',
  'abdoulie.touray@stpeterslamin.edu.gm',
  'ebrima.sanyang@stpeterslamin.edu.gm',
  'momodou.bojang@daddyjobe.edu.gm',
  'isatou.jatta@daddyjobe.edu.gm',
  'ousman.darboe@daddyjobe.edu.gm'
];

async function fixHodRoles() {
  const pool = getPool();

  console.log('[fix] Fixing HOD roles...\n');

  for (const email of HOD_EMAILS) {
    const result = await pool.query(`SELECT id, email, role FROM shared.users WHERE email = $1`, [
      email.toLowerCase()
    ]);

    if ((result.rowCount ?? 0) === 0) {
      console.log(`  ❌ HOD ${email} not found`);
      continue;
    }

    const user = result.rows[0];
    if (user.role !== 'teacher') {
      console.log(`  🔧 Fixing ${email}: ${user.role} -> teacher`);
      await pool.query(`UPDATE shared.users SET role = 'teacher' WHERE id = $1`, [user.id]);
    } else {
      console.log(`  ✅ ${email} already has correct role: teacher`);
    }
  }

  console.log('\n[fix] HOD role fixes complete.');
}

async function main() {
  try {
    await fixHodRoles();
  } catch (error) {
    console.error('[fix] Error fixing HOD roles:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('[fix] Unexpected failure', error);
  process.exit(1);
});
