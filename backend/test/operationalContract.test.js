'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=(name)=>fs.readFileSync(path.join(root,name),'utf8');

test('governed migration defines the durable accounting evidence model',()=>{
  const sql=read('backend/migrations/004_governed_revrec.sql');
  for(const table of ['revrec_contract_versions','revrec_amendments','revrec_periods','revrec_schedules','revrec_journal_proposals','revrec_approvals','revrec_posting_outbox','revrec_reconciliations','revrec_source_syncs','revrec_replays','revrec_golden_results','revrec_audit_exports','revrec_events'])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(sql,/BEGIN;[\s\S]*COMMIT;/);
});

test('migration is additive and guards immutable evidence',()=>{
  const sql=read('backend/migrations/004_governed_revrec.sql');
  assert.doesNotMatch(sql,/\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i);
  for(const guard of ['prevent_revrec_evidence_mutation','guard_revrec_journal_evidence','guard_revrec_period_lock'])assert.match(sql,new RegExp(guard));
});

test('server exposes only health, tenant auth, and governed revenue surfaces',()=>{
  const server=read('backend/server.js');
  assert.match(server,/\/api\/governed-revenue/);
  assert.match(server,/\/api\/auth/);
  assert.doesNotMatch(server,/routes\/(?:ai|gap-|contracts|journals|recognition|dashboard)/i);
  assert.match(server,/status\(404\)/);
});

test('governed route covers source evidence, close controls, adjustments, posting, reconciliation, replay, and export',()=>{
  const route=read('backend/routes/governedRevenue.js');
  for(const fragment of ['/source-syncs','/amendments','/periods/:id/review','/periods/:id/lock','/schedules/:id/credits','/journals/:id/approvals','/posting-outbox/:id/outcome','/journals/:id/reconciliations','/late-event-replays','/golden-replays','/audit-exports'])assert.ok(route.includes(fragment),`missing ${fragment}`);
});

test('launcher is non-mutating and controls only processes it owns',()=>{
  const launcher=read('start.sh');
  assert.doesNotMatch(launcher,/npm\s+(?:install|ci)|kill\s+-9|createdb|brew\s+services|seed\.js|psql/i);
  assert.match(launcher,/Missing dependencies/);
  assert.match(launcher,/no process was changed/);
  assert.match(launcher,/kill "\$frontend_pid"/);
  assert.match(launcher,/kill "\$backend_pid"/);
});
