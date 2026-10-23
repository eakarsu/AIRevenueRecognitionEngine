'use strict';
// Deterministic feature-pack logic for AIRevenueRecognitionEngine.
// This module never calls an AI provider, never loads dotenv, and never
// touches the database, so tests can import it offline with provider
// keys unset. AI-style endpoints built on it always return the labelled
// deterministic fallback (aiGenerated: false) computed from the caller's
// own contracts, performance obligations, and invoices. Figures are
// operational summaries for accountant review, not accounting advice.

const FALLBACK_LABEL = 'Deterministic fallback — not AI-generated';
const TASK_STATUSES = ['open', 'in_progress', 'done', 'blocked'];
const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'];

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeTaskInput(body, { partial = false } = {}) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = [];
  const task = {};
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'title')) {
    const title = cleanText(input.title);
    if (!title) errors.push('title is required');
    else task.title = title.slice(0, 300);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'description')) {
    task.description = cleanText(input.description);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'status')) {
    const status = cleanText(input.status).toLowerCase();
    task.status = TASK_STATUSES.includes(status) ? status : 'open';
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'priority')) {
    const priority = cleanText(input.priority).toLowerCase();
    task.priority = TASK_PRIORITIES.includes(priority) ? priority : 'medium';
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'due_date')) {
    task.due_date = cleanText(input.due_date) || null;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'related_type')) {
    task.related_type = cleanText(input.related_type);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'related_id')) {
    const raw = input.related_id;
    task.related_id = raw === null || raw === undefined ? '' : String(raw);
  }
  return { task, errors };
}

// Merges a partial patch without dropping explicit false / 0 / '' values.
function applyTaskUpdate(existing, patch) {
  const base = existing && typeof existing === 'object' ? existing : {};
  const next = { ...base };
  const input = patch && typeof patch === 'object' ? patch : {};
  for (const key of ['title', 'description', 'status', 'priority', 'due_date', 'related_type', 'related_id']) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined) {
      next[key] = input[key];
    }
  }
  return next;
}

function filterRecords(records, { search = '', status = '', priority = '', searchFields = [] } = {}) {
  const rows = Array.isArray(records) ? records : [];
  const q = cleanText(search).toLowerCase();
  const wantedStatus = cleanText(status).toLowerCase();
  const wantedPriority = cleanText(priority).toLowerCase();
  return rows.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    if (wantedStatus && String(row.status ?? '').toLowerCase() !== wantedStatus) return false;
    if (wantedPriority && String(row.priority ?? '').toLowerCase() !== wantedPriority) return false;
    if (!q) return true;
    const fields = searchFields.length ? searchFields : Object.keys(row);
    return fields.some((field) => String(row[field] ?? '').toLowerCase().includes(q));
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

// Serializes rows without dropping false / 0 values; empties stay empty.
function toCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return '';
  const columns = Array.from(new Set(list.flatMap((row) => Object.keys(row && typeof row === 'object' ? row : {}))));
  if (!columns.length) return '';
  return [columns.map(csvEscape).join(','), ...list.map((row) => columns.map((c) => csvEscape(row ? row[c] : '')).join(','))].join('\n');
}

function serializeExport(rows, format) {
  const fmt = cleanText(format).toLowerCase();
  if (fmt === 'csv') return { contentType: 'text/csv; charset=utf-8', body: toCsv(rows) };
  if (fmt === 'json') return { contentType: 'application/json; charset=utf-8', body: JSON.stringify(rows ?? [], null, 2) };
  return null;
}

function section(label, value) {
  return { label: String(label), value: value === undefined ? null : value };
}

function fallbackEnvelope(feature, summary, sections, extra = {}) {
  return {
    aiGenerated: false,
    label: FALLBACK_LABEL,
    feature,
    summary,
    sections,
    ...extra,
  };
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// --- Domain deterministic fallbacks over the caller's own records ---

function contractPortfolioSummary({ contracts = [] } = {}) {
  const rows = Array.isArray(contracts) ? contracts : [];
  const totalValue = rows.reduce((sum, r) => sum + numberOrZero(r.total_value), 0);
  const active = rows.filter((r) => String(r.status ?? '').toLowerCase() === 'active').length;
  const drafts = rows.filter((r) => String(r.status ?? '').toLowerCase() === 'draft').length;
  const summary = rows.length
    ? `${rows.length} contract(s) totalling ${totalValue}; ${active} active and ${drafts} in draft.`
    : 'No contracts available; totals are zero.';
  return fallbackEnvelope('contract-portfolio-summary', summary, [
    section('Contracts reviewed', rows.length),
    section('Total contract value', totalValue),
    section('Active contracts', active),
    section('Draft contracts', drafts),
    section('Has draft contracts', drafts > 0),
    section('Contracts without payment terms', rows.filter((r) => cleanText(r.payment_terms) === '').length),
  ]);
}

function recognitionReadinessChecklist({ contracts = [], obligations = [] } = {}) {
  const contractRows = Array.isArray(contracts) ? contracts : [];
  const obligationRows = Array.isArray(obligations) ? obligations : [];
  const covered = new Set(obligationRows.map((o) => String(o.contract_id ?? '')).filter(Boolean));
  const withoutObligations = contractRows.filter((r) => !covered.has(String(r.id ?? ''))).length;
  const unallocated = obligationRows.filter((r) => numberOrZero(r.allocated_price) === 0).length;
  const summary = contractRows.length
    ? `${contractRows.length} contract(s) checked against ${obligationRows.length} performance obligation(s); ${withoutObligations} contract(s) have none recorded.`
    : 'No contracts available; readiness counts are zero.';
  return fallbackEnvelope('recognition-readiness-checklist', summary, [
    section('Contracts reviewed', contractRows.length),
    section('Performance obligations reviewed', obligationRows.length),
    section('Contracts without performance obligations', withoutObligations),
    section('Obligations with zero allocated price', unallocated),
    section('Every contract has an obligation', withoutObligations === 0 && contractRows.length > 0),
    section('Completed obligations', obligationRows.filter((r) => String(r.status ?? '').toLowerCase() === 'completed').length),
  ]);
}

function invoiceAgingSummary({ invoices = [] } = {}) {
  const rows = Array.isArray(invoices) ? invoices : [];
  const outstanding = rows.reduce((sum, r) => sum + Math.max(0, numberOrZero(r.amount) - numberOrZero(r.paid_amount)), 0);
  const unpaid = rows.filter((r) => numberOrZero(r.paid_amount) < numberOrZero(r.amount)).length;
  const fullyPaid = rows.filter((r) => numberOrZero(r.amount) > 0 && numberOrZero(r.paid_amount) >= numberOrZero(r.amount)).length;
  const summary = rows.length
    ? `${rows.length} invoice(s) with ${outstanding} outstanding; ${unpaid} not fully paid.`
    : 'No invoices available; amounts are zero.';
  return fallbackEnvelope('invoice-aging-summary', summary, [
    section('Invoices reviewed', rows.length),
    section('Outstanding amount', outstanding),
    section('Invoices not fully paid', unpaid),
    section('Fully paid invoices', fullyPaid),
    section('Has outstanding balance', outstanding > 0),
    section('Draft invoices', rows.filter((r) => String(r.status ?? '').toLowerCase() === 'draft').length),
  ]);
}

const TASKS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  related_type TEXT NOT NULL DEFAULT '',
  related_id TEXT NOT NULL DEFAULT '',
  owner_id INTEGER,
  tenant_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

module.exports = {
  FALLBACK_LABEL,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASKS_TABLE_SQL,
  normalizeTaskInput,
  applyTaskUpdate,
  filterRecords,
  toCsv,
  serializeExport,
  contractPortfolioSummary,
  recognitionReadinessChecklist,
  invoiceAgingSummary,
};
