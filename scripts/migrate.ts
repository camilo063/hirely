import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://hirely_user:hirely_dev_2026@localhost:5434/hirely',
  });

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Get already executed migrations
  const executed = await pool.query('SELECT name FROM _migrations ORDER BY name');
  const executedSet = new Set(executed.rows.map((r: { name: string }) => r.name));

  const migrationsDir = path.join(__dirname, '..', 'src', 'lib', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files, ${executedSet.size} already executed`);

  let ran = 0;
  for (const file of files) {
    if (executedSet.has(file)) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log(`Running migration: ${file}`);
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`  ✓ ${file} completed`);
      ran++;
    } catch (error) {
      console.error(`  ✗ ${file} failed:`, error);
      process.exit(1);
    }
  }

  if (ran === 0) {
    console.log('No pending migrations');
  } else {
    console.log(`${ran} migration(s) completed successfully`);
  }
  await pool.end();
}

migrate().catch(console.error);
