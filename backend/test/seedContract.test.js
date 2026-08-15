'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { modules, seedRows } = require('../domain/featureModuleCatalog');

const seedSource = fs.readFileSync(path.join(__dirname, '..', 'seed.js'), 'utf8');

test('demo seed preserves existing application data', () => {
  assert.doesNotMatch(seedSource, /\b(?:DROP|TRUNCATE|DELETE)\s+(?:TABLE|FROM)\b/i);
  assert.match(seedSource, /ON CONFLICT DO NOTHING/);
  assert.match(seedSource, /MINIMUM_ROWS = 16/);
});

test('every feature module provides 16 unique professional demo records', () => {
  assert.ok(modules.length > 0);
  for (const moduleDef of modules) {
    const rows = seedRows(moduleDef);
    assert.equal(rows.length, 16, moduleDef.key);
    assert.equal(new Set(rows.map((row) => row.reference)).size, 16, moduleDef.key);
    assert.ok(rows.every((row) => row.title && row.summary && row.owner && row.status), moduleDef.key);
  }
});

test('governed workflow seed covers every evidence stage', () => {
  for (const table of [
    'revrec_contract_versions', 'revrec_amendments', 'revrec_periods', 'revrec_schedules',
    'revrec_journal_proposals', 'revrec_approvals', 'revrec_posting_outbox',
    'revrec_reconciliations', 'revrec_source_syncs', 'revrec_golden_results',
    'revrec_replays', 'revrec_audit_exports', 'revrec_failures', 'revrec_events',
  ]) assert.match(seedSource, new RegExp(`INSERT INTO ${table}`), table);
});
