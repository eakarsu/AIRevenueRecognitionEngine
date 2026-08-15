'use strict';

const crypto = require('crypto');
const pool = require('./db');
const R = require('./domain/revenuePolicy');
const { modules, seedRows } = require('./domain/featureModuleCatalog');

const MINIMUM_ROWS = 16;

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isoDate(year, month, day = 1) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

async function count(client, table, where = '', values = []) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table} ${where}`, values);
  return result.rows[0].count;
}

async function seedCoreTables(client, userId) {
  const industries = ['Technology', 'Healthcare', 'Financial Services', 'Manufacturing', 'Energy', 'Retail', 'Logistics', 'Media'];
  for (let i = 1; await count(client, 'customers') < MINIMUM_ROWS && i <= 64; i += 1) {
    const name = `Revenue Operations Demo Customer ${String(i).padStart(2, '0')}`;
    await client.query(
      `INSERT INTO customers (name, industry, contact_email, contact_phone, address, credit_rating)
       SELECT $1,$2,$3,$4,$5,$6
       WHERE NOT EXISTS (SELECT 1 FROM customers WHERE name=$7)`,
      [name, industries[(i - 1) % industries.length], `revrec-${i}@demo.example`, `+1-212-555-${String(1000 + i)}`, `${100 + i} Finance Plaza, New York, NY`, ['AAA', 'AA', 'A', 'BBB'][i % 4], name]
    );
  }

  const customerIds = (await client.query('SELECT id FROM customers ORDER BY id LIMIT 16')).rows.map((row) => row.id);
  if (!customerIds.length) throw new Error('At least one customer is required before contracts can be seeded');

  for (let i = 1; await count(client, 'contracts') < MINIMUM_ROWS && i <= 64; i += 1) {
    const contractNumber = `DEMO-REVREC-${String(i).padStart(3, '0')}`;
    const startMonth = ((i - 1) % 12) + 1;
    await client.query(
      `INSERT INTO contracts
        (customer_id,contract_number,title,description,start_date,end_date,total_value,status,payment_terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (contract_number) DO NOTHING`,
      [customerIds[(i - 1) % customerIds.length], contractNumber, `Enterprise Revenue Agreement ${i}`, 'Multi-element SaaS subscription, implementation, and support agreement governed by ASC 606.', isoDate(2026, startMonth), isoDate(2027, startMonth), 480000 + i * 75000, ['active', 'active', 'draft', 'completed'][i % 4], i % 2 ? 'Net 30' : 'Net 45']
    );
  }

  const contractIds = (await client.query('SELECT id FROM contracts ORDER BY id LIMIT 16')).rows.map((row) => row.id);
  if (!contractIds.length) throw new Error('At least one contract is required before related records can be seeded');

  for (let i = 1; await count(client, 'performance_obligations') < MINIMUM_ROWS && i <= 64; i += 1) {
    const description = `Seeded performance obligation ${String(i).padStart(2, '0')} — ${i % 2 ? 'platform access' : 'implementation services'}`;
    await client.query(
      `INSERT INTO performance_obligations
        (contract_id,description,standalone_selling_price,allocated_price,satisfaction_method,satisfaction_progress,status,start_date,end_date)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9
       WHERE NOT EXISTS (SELECT 1 FROM performance_obligations WHERE contract_id=$1 AND description=$2)`,
      [contractIds[(i - 1) % contractIds.length], description, 150000 + i * 10000, 145000 + i * 9500, i % 3 === 0 ? 'point_in_time' : 'over_time', (i * 13) % 101, ['pending', 'in_progress', 'satisfied'][i % 3], isoDate(2026, ((i - 1) % 12) + 1), isoDate(2027, ((i - 1) % 12) + 1)]
    );
  }

  for (let i = 1; await count(client, 'revenue_schedules') < MINIMUM_ROWS && i <= 64; i += 1) {
    const month = ((i - 1) % 12) + 1;
    const notes = `DEMO-SEED schedule ${String(i).padStart(2, '0')} with controller-reviewed allocation evidence`;
    await client.query(
      `INSERT INTO revenue_schedules
        (contract_id,period_start,period_end,recognized_amount,deferred_amount,status,notes)
       SELECT $1,$2,$3,$4,$5,$6,$7
       WHERE NOT EXISTS (SELECT 1 FROM revenue_schedules WHERE notes=$7)`,
      [contractIds[(i - 1) % contractIds.length], isoDate(2026, month), isoDate(2026, month + 1, 0), 35000 + i * 2750, 220000 - i * 5000, ['scheduled', 'recognized', 'deferred', 'adjusted'][i % 4], notes]
    );
  }

  for (let i = 1; await count(client, 'journal_entries') < MINIMUM_ROWS && i <= 64; i += 1) {
    const description = `DEMO-SEED revenue journal ${String(i).padStart(2, '0')}`;
    await client.query(
      `INSERT INTO journal_entries
        (entry_date,description,debit_account,credit_account,amount,contract_id,status,created_by)
       SELECT $1,$2,'Contract Liability','Subscription Revenue',$3,$4,$5,'Revenue Automation'
       WHERE NOT EXISTS (SELECT 1 FROM journal_entries WHERE description=$2)`,
      [isoDate(2026, ((i - 1) % 12) + 1, 28), description, 25000 + i * 1750, contractIds[(i - 1) % contractIds.length], ['draft', 'posted', 'posted', 'reversed'][i % 4]]
    );
  }

  for (let i = 1; await count(client, 'invoices') < MINIMUM_ROWS && i <= 64; i += 1) {
    const invoiceNumber = `DEMO-INV-${String(i).padStart(4, '0')}`;
    const issueMonth = ((i - 1) % 12) + 1;
    const amount = 45000 + i * 3250;
    await client.query(
      `INSERT INTO invoices
        (contract_id,invoice_number,issue_date,due_date,amount,paid_amount,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (invoice_number) DO NOTHING`,
      [contractIds[(i - 1) % contractIds.length], invoiceNumber, isoDate(2026, issueMonth, 1), isoDate(2026, issueMonth, 28), amount, i % 4 === 0 ? 0 : amount, ['sent', 'paid', 'paid', 'overdue'][i % 4]]
    );
  }

  for (let i = 1; await count(client, 'audit_trail') < MINIMUM_ROWS && i <= 64; i += 1) {
    const seedKey = `demo-audit-${String(i).padStart(2, '0')}`;
    await client.query(
      `INSERT INTO audit_trail (entity_type,entity_id,action,changes,user_id)
       SELECT 'revenue_seed',$1,'DEMO_RECORD_VERIFIED',$2::jsonb,$3
       WHERE NOT EXISTS (SELECT 1 FROM audit_trail WHERE changes->>'seed_key'=$4)`,
      [i, JSON.stringify({ seed_key: seedKey, control: 'ASC 606 evidence completeness', outcome: 'passed' }), userId, seedKey]
    );
  }
}

async function seedFeatureModules(client) {
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS feature_module_records_module_reference_idx ON feature_module_records(module_key,reference)`);
  for (const moduleDef of modules) {
    for (const row of seedRows(moduleDef, MINIMUM_ROWS)) {
      await client.query(
        `INSERT INTO feature_module_records
          (module_key,reference,title,category,status,owner,priority,due_date,summary,amount,source_system,risk_level,ai_enabled,last_action)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (module_key,reference) DO NOTHING`,
        [row.module_key,row.reference,row.title,row.category,row.status,row.owner,row.priority,row.due_date,row.summary,row.amount,row.source_system,row.risk_level,row.ai_enabled,row.last_action]
      );
    }
  }
}

async function seedGovernedRevenue(client, tenantId, userId) {
  const contractRows = [];
  for (let i = 1; i <= MINIMUM_ROWS; i += 1) {
    const contract = {
      tenantId: String(tenantId), contractId: `GOV-DEMO-${String(i).padStart(3, '0')}`, version: 'v1',
      framework: i % 4 === 0 ? 'IFRS15' : 'ASC606', currency: ['USD', 'EUR', 'GBP', 'CAD'][i % 4],
      effectiveFrom: isoDate(2026, ((i - 1) % 12) + 1), ruleVersion: 'revrec-2026.1',
      fixedConsiderationMinor: 40000000 + i * 1250000,
      variableConsideration: { estimateMinor: 3000000, constraintMinor: 1800000, method: 'expected_value' },
      obligations: [
        { id: `license-${i}`, standaloneSellingPriceMinor: 30000000, satisfactionMethod: 'point_in_time', evidenceRef: `contract-memo-${i}` },
        { id: `support-${i}`, standaloneSellingPriceMinor: 12000000, satisfactionMethod: 'over_time', evidenceRef: `support-plan-${i}` },
      ],
    };
    const contractDigest = R.digest(contract);
    const inserted = await client.query(
      `INSERT INTO revrec_contract_versions
        (tenant_id,contract_ref,version,framework,currency,effective_from,contract,contract_digest,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING RETURNING *`,
      [tenantId, contract.contractId, contract.version, contract.framework, contract.currency, contract.effectiveFrom, contract, contractDigest, userId]
    );
    contractRows.push(inserted.rows[0] || (await client.query('SELECT * FROM revrec_contract_versions WHERE tenant_id=$1 AND contract_ref=$2 AND version=$3', [tenantId, contract.contractId, contract.version])).rows[0]);
  }

  const periodRows = [];
  for (let i = 1; i <= MINIMUM_ROWS; i += 1) {
    const offset = i - 1;
    const year = 2025 + Math.floor(offset / 12);
    const month = (offset % 12) + 1;
    const periodRef = `DEMO-${year}-${String(month).padStart(2, '0')}`;
    const inserted = await client.query(
      `INSERT INTO revrec_periods (tenant_id,period_ref,period_start,period_end,status)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,period_ref) DO NOTHING RETURNING *`,
      [tenantId, periodRef, isoDate(year, month), isoDate(year, month + 1, 0), ['open', 'review'][i % 2]]
    );
    periodRows.push(inserted.rows[0] || (await client.query('SELECT * FROM revrec_periods WHERE tenant_id=$1 AND period_ref=$2', [tenantId, periodRef])).rows[0]);
  }

  const scheduleRows = [];
  const journalRows = [];
  for (let i = 1; i <= MINIMUM_ROWS; i += 1) {
    const contractRow = contractRows[i - 1];
    const periodRow = periodRows[i - 1];
    const contract = contractRow.contract;
    const eventDate = `${contract.effectiveFrom}T12:00:00.000Z`;
    const events = [
      { eventId: `delivery-${i}`, obligationId: `license-${i}`, type: 'satisfied', occurredAt: eventDate, receivedAt: eventDate, sourceDigest: digest(`delivery-${i}`) },
      { eventId: `progress-${i}`, obligationId: `support-${i}`, type: 'progress', progressBasisPoints: Math.min(10000, 2500 + i * 400), occurredAt: eventDate, receivedAt: eventDate, sourceDigest: digest(`progress-${i}`) },
    ];
    const schedule = R.recognize(contract, events);
    const scheduleInserted = await client.query(
      `INSERT INTO revrec_schedules
        (tenant_id,contract_version_id,period_id,idempotency_key,satisfaction_events,schedule,schedule_digest,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *`,
      [tenantId, contractRow.id, periodRow.id, `demo-schedule-${i}`, JSON.stringify(events), schedule, schedule.scheduleDigest, userId]
    );
    const scheduleRow = scheduleInserted.rows[0] || (await client.query('SELECT * FROM revrec_schedules WHERE tenant_id=$1 AND idempotency_key=$2', [tenantId, `demo-schedule-${i}`])).rows[0];
    scheduleRows.push(scheduleRow);

    const journal = R.proposeJournal(schedule, { id: periodRow.period_ref, start: periodRow.period_start, end: periodRow.period_end });
    const journalInserted = await client.query(
      `INSERT INTO revrec_journal_proposals
        (tenant_id,schedule_id,state,revision,journal,journal_digest,created_by)
       VALUES ($1,$2,$3,1,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *`,
      [tenantId, scheduleRow.id, ['review_pending', 'approved', 'posting_pending', 'posted', 'reconciled'][i % 5], journal, journal.journalDigest, userId]
    );
    journalRows.push(journalInserted.rows[0] || (await client.query('SELECT * FROM revrec_journal_proposals WHERE tenant_id=$1 AND journal_digest=$2', [tenantId, journal.journalDigest])).rows[0]);
  }

  for (let i = 1; i <= MINIMUM_ROWS; i += 1) {
    const contractRow = contractRows[i - 1];
    const periodRow = periodRows[i - 1];
    const scheduleRow = scheduleRows[i - 1];
    const journalRow = journalRows[i - 1];
    const amendment = { amendmentId: `DEMO-AMD-${String(i).padStart(3, '0')}`, version: 'v1', priceDeltaMinor: 500000 + i * 25000, sourceDigest: digest(`amendment-${i}`), addsDistinctGoods: i % 2 === 0, pricedAtStandaloneSellingPrice: i % 2 === 0 };
    const assessment = R.assessModification(contractRow.contract, amendment);
    await client.query(
      `INSERT INTO revrec_amendments
        (tenant_id,contract_version_id,amendment_ref,amendment,treatment,modification_digest,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [tenantId, contractRow.id, amendment.amendmentId, amendment, assessment.treatment, assessment.modificationDigest, userId]
    );
    await client.query(
      `INSERT INTO revrec_approvals (tenant_id,journal_id,actor_id,decision,attestation_digest)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [tenantId, journalRow.id, userId, i % 6 === 0 ? 'reject' : 'approve', digest(`approval-attestation-${i}`)]
    );
    await client.query(
      `INSERT INTO revrec_posting_outbox
        (tenant_id,journal_id,idempotency_key,payload,status,attempts,external_posting_id,evidence_digest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [tenantId, journalRow.id, `demo-post-${i}`, { journalDigest: journalRow.journal_digest, destination: 'Revenue Subledger' }, ['pending', 'processing', 'retry', 'delivered'][i % 4], i % 3, i % 4 === 3 ? `ERP-DEMO-${i}` : null, i % 4 === 3 ? digest(`posting-evidence-${i}`) : null]
    );
    const amount = Number(journalRow.journal.debitMinor);
    await client.query(
      `INSERT INTO revrec_reconciliations
        (tenant_id,journal_id,expected_debit_minor,expected_credit_minor,ledger_debit_minor,ledger_credit_minor,matched,evidence_digest,reconciled_by)
       VALUES ($1,$2,$3,$3,$4,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [tenantId, journalRow.id, amount, i % 5 === 0 ? amount - 100 : amount, i % 5 !== 0, digest(`reconciliation-${i}`), userId]
    );
    await client.query(
      `INSERT INTO revrec_source_syncs
        (tenant_id,provider,idempotency_key,external_cursor,source_version,source_digest,record_count,reconciled,received_at,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
      [tenantId, ['crm', 'contracts', 'billing', 'erp', 'usage', 'general_ledger', 'fx'][i % 7], `demo-sync-${i}`, `cursor-${String(i).padStart(4, '0')}`, `2026.${i}`, digest(`source-sync-${i}`), 120 + i * 7, i % 5 !== 0, new Date(Date.UTC(2026, 7, i)).toISOString(), userId]
    );
    const goldenResult = { fixture: `demo-golden-${i}`, passed: i % 7 !== 0, controls: ['allocation', 'timing', 'journal_balance'], exactMatches: 24 + i };
    await client.query(
      `INSERT INTO revrec_golden_results (tenant_id,fixture_version,result,evidence_digest,passed,evaluated_by)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [tenantId, `demo-fixture-${i}`, goldenResult, digest(goldenResult), goldenResult.passed, userId]
    );
    const replay = { replayId: `demo-replay-${i}`, contractRef: contractRow.contract_ref, lockedThrough: periodRow.period_end, adjustmentMinor: i % 4 === 0 ? 12500 : 0, outcome: i % 4 === 0 ? 'restatement_required' : 'no_change' };
    await client.query(
      `INSERT INTO revrec_replays (tenant_id,contract_version_id,replay,replay_digest,evaluated_by)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [tenantId, contractRow.id, replay, digest(replay), userId]
    );
    const manifest = { periodRef: periodRow.period_ref, journalId: journalRow.id, scheduleDigest: scheduleRow.schedule_digest, evidenceFiles: 8 + i, status: 'audit_ready' };
    await client.query(
      `INSERT INTO revrec_audit_exports (tenant_id,period_id,manifest,manifest_digest,exported_by)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [tenantId, periodRow.id, manifest, digest(manifest), userId]
    );
    await client.query(
      `INSERT INTO revrec_failures (tenant_id,journal_id,provider,operation,retryable,error_code,sanitized_detail)
       SELECT $1,$2,$3,$4,$5,$6,$7
       WHERE NOT EXISTS (SELECT 1 FROM revrec_failures WHERE tenant_id=$1 AND error_code=$6)`,
      [tenantId, journalRow.id, ['billing', 'erp', 'general_ledger', 'usage'][i % 4], 'demo_control_validation', i % 4 !== 0, `DEMO-CONTROL-${String(i).padStart(3, '0')}`, 'Demonstration exception with sanitized provider detail.']
    );
    await client.query(
      `INSERT INTO revrec_events (tenant_id,journal_id,actor_id,event_type,payload,evidence_digest)
       SELECT $1,$2,$3,'demo_evidence_verified',$4,$5
       WHERE NOT EXISTS (SELECT 1 FROM revrec_events WHERE tenant_id=$1 AND evidence_digest=$5)`,
      [tenantId, journalRow.id, userId, { workflow: 'revenue_close', sequence: i, result: 'evidence linked' }, digest(`event-${i}`)]
    );
  }
}

async function seedBackgroundJobs(client) {
  for (let i = 1; i <= MINIMUM_ROWS; i += 1) {
    const jobKey = `demo-revenue-control-${String(i).padStart(3, '0')}`;
    await client.query(
      `INSERT INTO background_jobs (job_key,status,payload,result,run_at,completed_at)
       SELECT $1,$2,$3,$4,NOW() + ($5 || ' hours')::interval,CASE WHEN $2='completed' THEN NOW() ELSE NULL END
       WHERE NOT EXISTS (SELECT 1 FROM background_jobs WHERE job_key=$1)`,
      [jobKey, ['queued', 'running', 'completed', 'completed', 'failed'][i % 5], { control: 'revenue evidence validation', batch: i }, { reviewed: i % 5 !== 4, records: 75 + i * 5 }, String(i)]
    );
  }
}

async function report(client, tenantId) {
  const tables = ['customers','contracts','performance_obligations','revenue_schedules','journal_entries','invoices','audit_trail','background_jobs','revrec_contract_versions','revrec_amendments','revrec_periods','revrec_schedules','revrec_journal_proposals','revrec_approvals','revrec_posting_outbox','revrec_reconciliations','revrec_source_syncs','revrec_golden_results','revrec_replays','revrec_audit_exports','revrec_failures','revrec_events'];
  for (const table of tables) {
    const governed = table.startsWith('revrec_');
    const total = await count(client, table, governed ? 'WHERE tenant_id=$1' : '', governed ? [tenantId] : []);
    console.log(`${table}: ${total}`);
    if (total < MINIMUM_ROWS) throw new Error(`${table} has ${total} rows; expected at least ${MINIMUM_ROWS}`);
  }
  for (const moduleDef of modules) {
    const total = await count(client, 'feature_module_records', 'WHERE module_key=$1', [moduleDef.key]);
    if (total < MINIMUM_ROWS) throw new Error(`${moduleDef.key} has ${total} rows; expected at least ${MINIMUM_ROWS}`);
  }
  console.log(`feature modules: ${modules.length} modules with at least ${MINIMUM_ROWS} records each`);
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = (await client.query('SELECT id FROM users ORDER BY CASE WHEN role=$1 THEN 0 ELSE 1 END,id LIMIT 1', ['admin'])).rows[0];
    if (!user) throw new Error('Create the application administrator before loading demo data');
    let tenant = (await client.query('SELECT tenant_id AS id FROM revrec_memberships WHERE user_id=$1 AND active=TRUE ORDER BY tenant_id LIMIT 1', [user.id])).rows[0];
    if (!tenant) {
      tenant = (await client.query("INSERT INTO revrec_tenants(name) VALUES('Revenue Recognition Demo') RETURNING id")).rows[0];
      await client.query("INSERT INTO revrec_memberships(tenant_id,user_id,role,active) VALUES($1,$2,'admin',TRUE) ON CONFLICT DO NOTHING", [tenant.id, user.id]);
    }
    await seedCoreTables(client, user.id);
    await seedFeatureModules(client);
    await seedGovernedRevenue(client, tenant.id, user.id);
    await seedBackgroundJobs(client);
    await report(client, tenant.id);
    await client.query('COMMIT');
    console.log('Demo data seed completed without deleting existing records.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  if (error.detail) console.error(`Database detail: ${error.detail}`);
  if (error.position) console.error(`Database position: ${error.position}`);
  process.exit(1);
});
