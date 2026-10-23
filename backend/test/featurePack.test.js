'use strict';
// Offline tests for the feature pack. Provider keys are removed before the
// (provider-free) module is imported, and no network or database is used.
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  FALLBACK_LABEL,
  normalizeTaskInput,
  applyTaskUpdate,
  filterRecords,
  toCsv,
  serializeExport,
  contractPortfolioSummary,
  recognitionReadinessChecklist,
  invoiceAgingSummary,
} = require('../services/featurePack');

test('task create requires a title and applies defaults', () => {
  assert.deepEqual(normalizeTaskInput({}).errors, ['title is required']);
  const { task, errors } = normalizeTaskInput({ title: '  Review SSP allocation  ' });
  assert.deepEqual(errors, []);
  assert.equal(task.title, 'Review SSP allocation');
  assert.equal(task.status, 'open');
  assert.equal(task.priority, 'medium');
  assert.equal(task.description, '');
});

test('task update preserves explicit empty values', () => {
  const next = applyTaskUpdate(
    { title: 'Old', description: 'keep?', status: 'open', priority: 'high' },
    { description: '', status: 'done' }
  );
  assert.equal(next.title, 'Old');
  assert.equal(next.description, '');
  assert.equal(next.status, 'done');
});

test('search and status filters narrow the contract list', () => {
  const rows = [
    { contract_number: 'C-100', title: 'Platform licence', status: 'active' },
    { contract_number: 'C-200', title: 'Support renewal', status: 'draft' },
    { contract_number: 'C-300', title: 'Platform services', status: 'active' },
  ];
  assert.equal(filterRecords(rows, { search: 'platform' }).length, 2);
  assert.equal(filterRecords(rows, { status: 'active' }).length, 2);
  assert.equal(filterRecords(rows, {}).length, 3);
});

test('CSV and JSON export preserve false, 0 and empty values', () => {
  const rows = [{ contract_number: 'C-100', total_value: 0, approved: false, payment_terms: '' }];
  const csv = toCsv(rows);
  assert.match(csv, /total_value/);
  assert.match(csv, /,0,/);
  assert.match(csv, /false/);
  const json = JSON.parse(serializeExport(rows, 'json').body);
  assert.equal(json[0].total_value, 0);
  assert.equal(json[0].approved, false);
  assert.equal(json[0].payment_terms, '');
  assert.equal(serializeExport(rows, 'xml'), null);
});

test('domain fallbacks are labelled, deterministic and keep zero counts', () => {
  const contracts = [
    { id: 1, status: 'active', total_value: 0, payment_terms: '' },
    { id: 2, status: 'draft', total_value: 5000, payment_terms: 'net-30' },
  ];
  const portfolio = contractPortfolioSummary({ contracts });
  assert.equal(portfolio.aiGenerated, false);
  assert.equal(portfolio.label, FALLBACK_LABEL);
  assert.deepEqual(portfolio, contractPortfolioSummary({ contracts }));
  const p = Object.fromEntries(portfolio.sections.map((s) => [s.label, s.value]));
  assert.equal(p['Total contract value'], 5000);
  assert.equal(p['Has draft contracts'], true);

  const readiness = recognitionReadinessChecklist({
    contracts,
    obligations: [{ contract_id: 1, allocated_price: 0, status: 'pending' }],
  });
  const r = Object.fromEntries(readiness.sections.map((s) => [s.label, s.value]));
  assert.equal(r['Contracts without performance obligations'], 1);
  assert.equal(r['Every contract has an obligation'], false);

  const aging = invoiceAgingSummary({ invoices: [] });
  const a = Object.fromEntries(aging.sections.map((s) => [s.label, s.value]));
  assert.equal(a['Outstanding amount'], 0);
  assert.equal(a['Has outstanding balance'], false);
});

test('server mounts the feature pack without provider calls', () => {
  const server = fs.readFileSync(__dirname + '/../server.js', 'utf8');
  assert.ok(server.includes("require('./routes/featurePack')"), 'feature pack must be mounted');
  const route = fs.readFileSync(__dirname + '/../routes/featurePack.js', 'utf8');
  assert.ok(!route.includes('openrouter.ai') && !route.includes('api.openai.com'), 'feature pack must not call a provider');
  const contracts = fs.readFileSync(__dirname + '/../routes/contracts.js', 'utf8');
  assert.ok(contracts.includes('req.query.search'), 'contracts list search must be available');
});
