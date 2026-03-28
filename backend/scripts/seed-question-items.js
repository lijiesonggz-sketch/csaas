/**
 * Seed question_items for all control_points in the fixture catalog.
 * This bridges the gap between the in-memory resolver (fixture-based) and
 * the database-backed OrganizationQuestionSetService.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Map control family prefixes to valid taxonomy l1/l2 codes
const FAMILY_TAXONOMY_MAP = {
  ACC_AUTH: { l1: 'IT02', l2: 'IT02-03' },
  AI_GOVERNANCE: { l1: 'IT01', l2: 'IT01-05' },
  BCP: { l1: 'IT08', l2: 'IT08-02' },
  CIIO: { l1: 'IT08', l2: 'IT08-02' },
  CLOUD: { l1: 'IT07', l2: 'IT08-02' },
  DATA_GOVERNANCE: { l1: 'IT03', l2: 'IT03-04' },
  DATA_PROTECTION: { l1: 'IT03', l2: 'IT03-04' },
  DATA_TRANSFER: { l1: 'IT03', l2: 'IT03-04' },
  REGULATORY: { l1: 'IT04', l2: 'IT04-06' },
  ONLINE: { l1: 'IT02', l2: 'IT02-03' },
  OUTSOURCING: { l1: 'IT05', l2: 'IT02-03' },
  PUBLIC: { l1: 'IT04', l2: 'IT04-06' },
  CHANGE_MGMT: { l1: 'IT06', l2: 'IT06-07' },
};

// Default fallback
const DEFAULT_TAXONOMY = { l1: 'IT01', l2: 'IT01-05' };

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas',
  });

  await client.connect();
  console.log('Connected to database');

  // 1. Read fixture catalog
  const catalogPath = path.join(
    __dirname,
    '../src/modules/applicability-engine/seeds/data/resolver-control-catalog.fixture.json'
  );
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  console.log('Fixture catalog entries:', catalog.length);

  // 2. Get valid taxonomy codes
  const taxL1 = await client.query('SELECT l1_code FROM taxonomy_l1');
  const taxL2 = await client.query('SELECT l2_code, l1_code FROM taxonomy_l2');
  const validL1 = new Set(taxL1.rows.map(r => r.l1_code));
  const validL2 = new Set(taxL2.rows.map(r => r.l2_code));
  console.log('Valid L1 codes:', [...validL1]);
  console.log('Valid L2 codes:', [...validL2]);

  // 3. Seed control_points from fixture (skip if exists)
  let cpInserted = 0;
  let cpSkipped = 0;

  for (const cp of catalog) {
    const exists = await client.query(
      'SELECT 1 FROM control_points WHERE control_id = $1',
      [cp.controlId]
    );

    if (exists.rows.length > 0) {
      cpSkipped++;
      continue;
    }

    // Resolve taxonomy codes
    const tax = FAMILY_TAXONOMY_MAP[cp.controlFamily] || DEFAULT_TAXONOMY;
    const l1 = validL1.has(tax.l1) ? tax.l1 : 'IT01';
    const l2 = validL2.has(tax.l2) ? tax.l2 : 'IT01-05';

    await client.query(
      `INSERT INTO control_points
        (control_id, control_code, control_name, control_desc, l1_code, l2_code,
         control_family, control_type, mandatory_default, risk_level_default, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')`,
      [
        cp.controlId,
        cp.controlCode,
        cp.controlName,
        cp.controlName,
        l1,
        l2,
        cp.controlFamily,
        'preventive',
        cp.mandatoryDefault ?? true,
        cp.priorityDefault || 'MEDIUM',
      ]
    );
    cpInserted++;
  }

  console.log(`control_points: inserted=${cpInserted}, skipped=${cpSkipped}`);

  // 4. Seed question_items for ALL control_points (including pre-existing ones)
  const allControls = await client.query(
    'SELECT control_id, control_code, control_name, control_family FROM control_points'
  );
  console.log('Total control_points in DB:', allControls.rows.length);

  let qiInserted = 0;
  let qiSkipped = 0;

  for (const cp of allControls.rows) {
    const existing = await client.query(
      'SELECT 1 FROM question_items WHERE control_id = $1',
      [cp.control_id]
    );

    if (existing.rows.length > 0) {
      qiSkipped++;
      continue;
    }

    // Create YES_NO question for every control point
    const qCode1 = `${cp.control_code}-Q001`;
    const questionText1 = `组织是否已建立并实施了「${cp.control_name}」相关的管理措施？`;

    await client.query(
      `INSERT INTO question_items
        (question_code, control_id, question_text, question_type, required, status, answer_schema, scoring_json)
       VALUES ($1, $2, $3, $4, true, 'ACTIVE', $5, $6)`,
      [
        qCode1,
        cp.control_id,
        questionText1,
        'YES_NO',
        JSON.stringify({
          type: 'YES_NO',
          options: [
            { value: 'yes', label: '是' },
            { value: 'no', label: '否' },
          ],
        }),
        JSON.stringify({ yes: 1, no: 0 }),
      ]
    );
    qiInserted++;

    // Add a TEXT follow-up question for some control families
    const family = cp.control_family || '';
    if (family.includes('GEN') || family.includes('ACC') || family.includes('DATA') || family.includes('AI')) {
      const qCode2 = `${cp.control_code}-Q002`;
      const questionText2 = `请简要描述「${cp.control_name}」的具体实施情况和相关证据。`;

      await client.query(
        `INSERT INTO question_items
          (question_code, control_id, question_text, question_type, required, status, answer_schema, scoring_json)
         VALUES ($1, $2, $3, $4, false, 'ACTIVE', $5, $6)`,
        [
          qCode2,
          cp.control_id,
          questionText2,
          'TEXT',
          JSON.stringify({ type: 'TEXT', placeholder: '请输入描述...' }),
          JSON.stringify({ keyword_match: 0.5, min_length: 50 }),
        ]
      );
      qiInserted++;
    }
  }

  console.log(`question_items: inserted=${qiInserted}, skipped=${qiSkipped}`);

  // 5. Verify
  const r1 = await client.query('SELECT COUNT(*) as cnt FROM control_points');
  const r2 = await client.query('SELECT COUNT(*) as cnt FROM question_items');
  console.log(`Final: control_points=${r1.rows[0].cnt}, question_items=${r2.rows[0].cnt}`);

  await client.end();
  console.log('Done!');
}

main().catch((e) => {
  console.error('Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
