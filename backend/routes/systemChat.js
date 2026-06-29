const express = require('express');
const axios = require('axios');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const coreResources = [
  { key: 'customers', label: 'Customers', endpoint: '/api/customers', aliases: ['customer', 'customers', 'account', 'accounts'] },
  { key: 'contracts', label: 'Contracts', endpoint: '/api/contracts', aliases: ['contract', 'contracts'] },
  { key: 'performance-obligations', label: 'Performance Obligations', endpoint: '/api/performance-obligations', aliases: ['performance obligation', 'performance obligations', 'obligation', 'obligations', 'pob', 'pobs'] },
  { key: 'revenue-schedules', label: 'Revenue Schedules', endpoint: '/api/revenue-schedules', aliases: ['revenue schedule', 'revenue schedules', 'schedule', 'schedules'] },
  { key: 'journal-entries', label: 'Journal Entries', endpoint: '/api/journal-entries', aliases: ['journal entry', 'journal entries', 'journal', 'journals'] },
  { key: 'invoices', label: 'Invoices', endpoint: '/api/invoices', aliases: ['invoice', 'invoices'] },
  { key: 'audit-trail', label: 'Audit Trail', endpoint: '/api/audit-trail', aliases: ['audit trail', 'audit log', 'audit entry', 'audit entries'] },
];

const featureModules = [
  { key: 'document-repository', label: 'Contract Documents', endpoint: '/api/feature-modules/document-repository', aliases: ['document', 'documents', 'contract document', 'repository'], ai: true },
  { key: 'erp-connectors', label: 'ERP Connectors', endpoint: '/api/feature-modules/erp-connectors', aliases: ['erp', 'connector', 'connectors', 'netsuite', 'sap', 'oracle', 'salesforce'] },
  { key: 'approval-workflows', label: 'Approval Workflows', endpoint: '/api/feature-modules/approval-workflows', aliases: ['approval', 'approvals', 'workflow', 'workflows'], ai: true },
  { key: 'period-close', label: 'Period Close', endpoint: '/api/feature-modules/period-close', aliases: ['period close', 'close', 'close checklist'], ai: true },
  { key: 'fx-rates', label: 'FX Rates', endpoint: '/api/feature-modules/fx-rates', aliases: ['fx', 'foreign exchange', 'currency', 'multicurrency'] },
  { key: 'notifications', label: 'Notifications', endpoint: '/api/feature-modules/notifications', aliases: ['notification', 'notifications', 'alert', 'alerts'] },
  { key: 'export-center', label: 'Export Center', endpoint: '/api/feature-modules/export-center', aliases: ['export', 'exports', 'pdf', 'excel', 'audit package'] },
  { key: 'permissions', label: 'Roles & Permissions', endpoint: '/api/feature-modules/permissions', aliases: ['permission', 'permissions', 'role', 'roles', 'rbac'] },
  { key: 'live-erp-integrations', label: 'Live ERP Integrations', endpoint: '/api/feature-modules/live-erp-integrations', aliases: ['live erp', 'erp sync', 'live integration', 'netsuite sync'], ai: true },
  { key: 'notification-delivery', label: 'Notification Delivery', endpoint: '/api/feature-modules/notification-delivery', aliases: ['notification delivery', 'send notification', 'slack', 'email alert'], ai: true },
  { key: 'rbac-enforcement', label: 'RBAC Enforcement', endpoint: '/api/feature-modules/rbac-enforcement', aliases: ['rbac enforcement', 'access control matrix', 'permissions enforcement'], ai: true },
  { key: 'file-intelligence', label: 'File Intelligence', endpoint: '/api/feature-modules/file-intelligence', aliases: ['file intelligence', 'document intelligence', 'analyze file', 'ocr'], ai: true },
  { key: 'migration-center', label: 'Migration Center', endpoint: '/api/feature-modules/migration-center', aliases: ['migration', 'migrations', 'schema migration'] },
  { key: 'background-jobs', label: 'Background Jobs', endpoint: '/api/feature-modules/background-jobs', aliases: ['background job', 'jobs', 'scheduled job', 'worker'], ai: true },
  { key: 'automated-tests', label: 'Automated Tests', endpoint: '/api/feature-modules/automated-tests', aliases: ['automated tests', 'tests', 'test suite'] },
  { key: 'production-hardening', label: 'Production Hardening', endpoint: '/api/feature-modules/production-hardening', aliases: ['production hardening', 'observability', 'backups', 'security headers'], ai: true },
  { key: 'ai-governance', label: 'AI Governance', endpoint: '/api/feature-modules/ai-governance', aliases: ['ai governance', 'prompt approval', 'model governance', 'ai cost'], ai: true },
  { key: 'change-history', label: 'Change History', endpoint: '/api/feature-modules/change-history', aliases: ['change history', 'history', 'change log'], ai: true },
  { key: 'ai-contract-extraction', label: 'AI Contract Extraction', endpoint: '/api/feature-modules/ai-contract-extraction', aliases: ['contract extraction', 'extract contract', 'ai contract'], ai: true },
  { key: 'ai-obligation-identifier', label: 'AI Obligation Identifier', endpoint: '/api/feature-modules/ai-obligation-identifier', aliases: ['identify obligation', 'obligation identifier', 'ai obligation'], ai: true },
  { key: 'ai-schedule-generator', label: 'AI Schedule Generator', endpoint: '/api/feature-modules/ai-schedule-generator', aliases: ['schedule generator', 'generate schedule', 'ai schedule'], ai: true },
  { key: 'ai-disclosure-drafting', label: 'AI Disclosure Drafting', endpoint: '/api/feature-modules/ai-disclosure-drafting', aliases: ['disclosure drafting', 'draft disclosure', 'ai disclosure'], ai: true },
  { key: 'ai-close-anomalies', label: 'AI Close Anomalies', endpoint: '/api/feature-modules/ai-close-anomalies', aliases: ['close anomaly', 'close anomalies', 'ai close'], ai: true },
  { key: 'ai-leakage-monitor', label: 'AI Leakage Monitor', endpoint: '/api/feature-modules/ai-leakage-monitor', aliases: ['leakage', 'revenue leakage', 'leakage monitor'], ai: true },
  { key: 'ai-approval-risk', label: 'AI Approval Risk', endpoint: '/api/feature-modules/ai-approval-risk', aliases: ['approval risk', 'risk reviewer'], ai: true },
  { key: 'ai-customer-risk', label: 'AI Customer Risk', endpoint: '/api/feature-modules/ai-customer-risk', aliases: ['customer risk', 'churn', 'collectibility'], ai: true },
  { key: 'ai-evidence-completeness', label: 'AI Evidence Completeness', endpoint: '/api/feature-modules/ai-evidence-completeness', aliases: ['evidence completeness', 'evidence review'], ai: true },
];

const aiTools = [
  { key: 'compliance-check', label: 'ASC 606 Compliance Check', endpoint: '/api/ai/compliance-check', aliases: ['compliance check', 'asc 606 check'], payload: { contract: { title: 'Enterprise Cloud Platform License', total_value: 2500000, obligations: ['license', 'support', 'migration'], term: '12 months' } } },
  { key: 'transaction-price-allocation', label: 'Transaction Price Allocation', endpoint: '/api/ai/transaction-price-allocation', aliases: ['transaction price', 'allocation'], payload: { total_price: 2500000, performance_obligations: [{ obligation: 'License', standalone_selling_price: 1500000 }, { obligation: 'Support', standalone_selling_price: 600000 }] } },
  { key: 'variable-consideration', label: 'Variable Consideration', endpoint: '/api/ai/variable-consideration', aliases: ['variable consideration'], payload: { contract_terms: 'SaaS subscription with usage fees and performance bonus.', variable_elements: ['usage overage', 'performance bonus'] } },
  { key: 'contract-modification', label: 'Contract Modification', endpoint: '/api/ai/contract-modification', aliases: ['contract modification', 'amendment'], payload: { original_contract: { value: 1800000, term: '12 months' }, modification: { added_services: 'premium support', added_price: 250000 } } },
  { key: 'risk-assessment', label: 'Revenue Risk Assessment', endpoint: '/api/ai/risk-assessment', aliases: ['risk assessment', 'revenue risk'], payload: { contract: { title: 'Multi-element SaaS arrangement', variable_consideration: true, custom_services: true } } },
  { key: 'revenue-forecast', label: 'Revenue Forecast', endpoint: '/api/ai/revenue-forecast', aliases: ['revenue forecast', 'forecast'], payload: { historical_data: [{ period: '2026-01', revenue: 1200000 }, { period: '2026-02', revenue: 1350000 }], forecast_periods: 6 } },
  { key: 'journal-entry-suggestion', label: 'Journal Entry Suggestion', endpoint: '/api/ai/journal-entry-suggestion', aliases: ['journal entry suggestion', 'suggest journal'], payload: { revenue_event: { contract_value: 900000, recognized_amount: 75000, period: 'June 2026' } } },
  { key: 'audit-readiness', label: 'Audit Readiness', endpoint: '/api/ai/audit-readiness', aliases: ['audit readiness'], payload: { company_data: { contracts: 20, revenue_schedules: 25, journal_entries: 25 } } },
  { key: 'disclosure-generator', label: 'Disclosure Generator', endpoint: '/api/ai/disclosure-generator', aliases: ['disclosure generator', 'generate disclosure'], payload: { revenue_data: { recognized: 12500000, deferred: 4100000 }, accounting_policies: 'ASC 606 five-step model' } },
  { key: 'period-close', label: 'Period Close Workflow', endpoint: '/api/ai/period-close', aliases: ['run period close', 'period close workflow'], payload: { period: '2026-06' } },
];

const pages = [
  { key: 'dashboard', label: 'Dashboard', aliases: ['dashboard', 'home'] },
  { key: 'reports', label: 'Reports', aliases: ['reports', 'reporting'] },
  { key: 'ai', label: 'AI Workbench', aliases: ['ai workbench', 'workbench', 'ai tools'] },
  ...coreResources,
  ...featureModules,
];

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function match(items, text) {
  const normalized = normalize(text);
  return items
    .map((item) => {
      const aliases = [item.key, item.label, ...(item.aliases || [])].map(normalize);
      const score = aliases.filter((alias) => normalized.includes(alias)).sort((a, b) => b.length - a.length)[0]?.length || 0;
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item;
}

function baseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function authHeaders(req) {
  return {
    Authorization: req.headers.authorization || '',
    'Content-Type': 'application/json',
  };
}

async function callInternal(req, endpoint, options = {}) {
  const response = await fetch(`${baseUrl(req)}${endpoint}`, {
    method: options.method || 'GET',
    headers: authHeaders(req),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.details || `${endpoint} failed with ${response.status}`);
  return data;
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function inferId(text) {
  return normalize(text).match(/\b(?:id|record|row|#)?\s*(\d+)\b/)?.[1];
}

function inferProvider(text) {
  const normalized = normalize(text);
  if (normalized.includes('netsuite')) return 'netsuite';
  if (normalized.includes('salesforce')) return 'salesforce';
  if (/\bsap\b/.test(normalized)) return 'sap';
  return null;
}

function titleFromMessage(message, resource) {
  return String(message || '')
    .replace(new RegExp(`\\b(${[resource.key, resource.label, ...(resource.aliases || [])].join('|')})\\b`, 'ig'), ' ')
    .replace(/\b(create|add|new|record|item|called|named|titled|for|with)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim() || `Chat-created ${resource.label}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createPayload(resource, message) {
  const title = titleFromMessage(message, resource);
  const suffix = Date.now().toString().slice(-6);
  if (featureModules.some((m) => m.key === resource.key)) {
    return {
      title,
      summary: `Created from System Chat: ${message}`,
      status: 'Open',
      owner: 'Revenue Controller',
      priority: /urgent|critical/i.test(message) ? 'Urgent' : /high/i.test(message) ? 'High' : 'Medium',
      due_date: today(),
      source_system: 'Revenue Subledger',
      risk_level: /critical/i.test(message) ? 'Critical' : /high/i.test(message) ? 'High' : 'Medium',
      ai_enabled: Boolean(resource.ai),
    };
  }
  const defaults = {
    customers: { name: title, industry: 'Technology', contact_email: 'customer@example.com', contact_phone: '555-0100', address: '100 Revenue Way', credit_rating: 'A' },
    contracts: { customer_id: 1, contract_number: `CTR-CHAT-${suffix}`, title, description: `Created from System Chat: ${message}`, start_date: today(), end_date: today(), total_value: 100000, status: 'draft', payment_terms: 'Net 30' },
    'performance-obligations': { contract_id: 1, description: title, standalone_selling_price: 50000, allocated_price: 50000, satisfaction_method: 'over_time', satisfaction_progress: 0, status: 'pending', start_date: today(), end_date: today() },
    'revenue-schedules': { contract_id: 1, period_start: today(), period_end: today(), recognized_amount: 0, deferred_amount: 0, status: 'scheduled', notes: `Created from System Chat: ${message}` },
    'journal-entries': { entry_date: today(), description: title, debit_account: 'Deferred Revenue', credit_account: 'Revenue', amount: 1000, contract_id: 1, status: 'draft', created_by: reqUserLabel(message) },
    invoices: { contract_id: 1, invoice_number: `INV-CHAT-${suffix}`, issue_date: today(), due_date: today(), amount: 1000, paid_amount: 0, status: 'draft' },
    'audit-trail': { entity_type: 'system_chat', entity_id: 1, action: 'CREATE', changes: { message }, user_id: 1 },
  };
  return defaults[resource.key] || { title };
}

function reqUserLabel() {
  return 'system-chat';
}

function parseAIJson(content) {
  if (typeof content !== 'string') return content || {};
  try { return JSON.parse(content); } catch {}
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  const objectMatch = content.match(/(\{[\s\S]*\})/);
  if (objectMatch) {
    try { return JSON.parse(objectMatch[1]); } catch {}
  }
  return { summary: content };
}

async function listResource(req, resource) {
  const data = await callInternal(req, resource.endpoint);
  const rows = rowsFrom(data);
  return {
    reply: `Loaded ${rows.length} ${resource.label} records.`,
    action: `list_${resource.key}`,
    view: resource.key,
    data: { rows: rows.slice(0, 10), total: rows.length },
  };
}

async function createResource(req, resource, message) {
  const data = await callInternal(req, resource.endpoint, { method: 'POST', body: createPayload(resource, message) });
  return {
    reply: `Created ${resource.label} record: ${data.title || data.name || data.contract_number || data.invoice_number || `#${data.id}`}.`,
    action: `create_${resource.key}`,
    view: resource.key,
    data: { record: data },
  };
}

async function updateResource(req, resource, message) {
  const id = inferId(message);
  if (!id) return { reply: `Tell me which ${resource.label} record ID to update.`, action: 'needs_id', view: resource.key };
  const current = await callInternal(req, `${resource.endpoint}/${id}`);
  const patch = { ...current };
  if ('status' in patch) {
    if (/approve|approved/i.test(message)) patch.status = 'Approved';
    else if (/close|closed|complete|completed/i.test(message)) patch.status = 'completed';
    else if (/review/i.test(message)) patch.status = 'Review';
    else if (/progress|start/i.test(message)) patch.status = 'In Progress';
    else if (/open|reopen/i.test(message)) patch.status = 'Open';
  }
  if ('priority' in patch) {
    if (/urgent|critical/i.test(message)) patch.priority = 'Urgent';
    else if (/high/i.test(message)) patch.priority = 'High';
    else if (/low/i.test(message)) patch.priority = 'Low';
  }
  if ('last_action' in patch) patch.last_action = `Updated from System Chat: ${message}`;
  const updated = await callInternal(req, `${resource.endpoint}/${id}`, { method: 'PUT', body: patch });
  return {
    reply: `Updated ${resource.label} record #${id}.`,
    action: `update_${resource.key}`,
    view: resource.key,
    data: { record: updated },
  };
}

async function deleteResource(req, resource, message) {
  const id = inferId(message);
  if (!id || !/\bdelete\b/i.test(message)) return { reply: `Use explicit wording like "delete ${resource.label} 12".`, action: 'delete_needs_explicit_id', view: resource.key };
  await callInternal(req, `${resource.endpoint}/${id}`, { method: 'DELETE' });
  return { reply: `Deleted ${resource.label} record #${id}.`, action: `delete_${resource.key}`, view: resource.key, data: { deleted_id: id } };
}

async function exportData(message) {
  const text = normalize(message);
  if (/audit package|evidence package/.test(text)) {
    return {
      reply: 'Audit package is ready to download from Export Center.',
      action: 'export_audit_package',
      view: 'export-center',
      data: { download: { path: '/api/exports/audit-package', filename: 'revrec-audit-package.json' } },
    };
  }
  if (/audit binder|pdf binder|binder pdf/.test(text)) {
    return {
      reply: 'Audit binder PDF is ready to download from Export Center.',
      action: 'export_audit_binder_pdf',
      view: 'export-center',
      data: { download: { path: '/api/exports/audit-binder.pdf', filename: 'revrec-audit-binder.pdf' } },
    };
  }
  if (/backup/.test(text)) {
    return {
      reply: 'Application backup JSON is ready to download.',
      action: 'export_backup',
      view: 'production-hardening',
      data: { download: { path: '/api/ops/backup/export', filename: 'revrec-backup.json' } },
    };
  }
  const resource = [
    ['contracts', 'contracts.csv'],
    ['invoices', 'invoices.csv'],
    ['revenue-schedules', 'revenue-schedules.csv'],
    ['journal-entries', 'journal-entries.csv'],
    ['performance-obligations', 'performance-obligations.csv'],
    ['customers', 'customers.csv'],
    ['feature-modules', 'feature-modules.csv'],
    ['audit-trail', 'audit-trail.csv'],
  ].find(([key]) => text.includes(key));
  if (!resource) {
    return {
      reply: 'Tell me what to export, for example "export contracts csv" or "export audit package".',
      action: 'export_needs_resource',
      view: 'export-center',
    };
  }
  return {
    reply: `${resource[1]} is ready to download from Export Center.`,
    action: `export_${resource[0]}`,
    view: 'export-center',
    data: { download: { path: `/api/exports/csv/${resource[0]}`, filename: resource[1] } },
  };
}

async function testConnector(req, resource, message) {
  let id = inferId(message);
  if (!id) {
    const rows = rowsFrom(await callInternal(req, resource.endpoint));
    id = rows[0]?.id;
  }
  if (!id) return { reply: 'No ERP connector record is available to test.', action: 'no_connector', view: resource.key };
  const data = await callInternal(req, `/api/feature-modules/erp-connectors/${id}/test`, { method: 'POST', body: {} });
  return { reply: `Connector test completed for ERP connector #${id}.`, action: 'test_connector', view: resource.key, data };
}

async function syncConnector(req, resource, message) {
  const provider = inferProvider(message);
  if (provider) {
    const data = await callInternal(req, `/api/integrations/${provider}/sync`, { method: 'POST', body: {} });
    return { reply: `${data.result.label} sync ${data.result.status}.`, action: `sync_${provider}`, view: 'live-erp-integrations', data };
  }
  let id = inferId(message);
  if (!id) {
    const rows = rowsFrom(await callInternal(req, resource.endpoint));
    id = rows[0]?.id;
  }
  if (!id) return { reply: `No ${resource.label} record is available to sync.`, action: 'no_connector', view: resource.key };
  const data = await callInternal(req, `/api/feature-modules/erp-connectors/${id}/sync`, { method: 'POST', body: {} });
  return { reply: `ERP sync executed for ${resource.label} record #${id}.`, action: `sync_${resource.key}`, view: resource.key, data };
}

async function testProviderConnector(req, message) {
  const provider = inferProvider(message);
  if (!provider) return null;
  const data = await callInternal(req, `/api/integrations/${provider}/test`, { method: 'POST', body: {} });
  return { reply: `${data.result.label} connection test ${data.result.status}.`, action: `test_${provider}`, view: 'live-erp-integrations', data };
}

async function sendNotification(req, resource, message) {
  let id = inferId(message);
  if (!id) {
    const rows = rowsFrom(await callInternal(req, resource.endpoint));
    id = rows[0]?.id;
  }
  if (!id) return { reply: `No ${resource.label} record is available to send.`, action: 'no_notification', view: resource.key };
  const data = await callInternal(req, `/api/feature-modules/notifications/${id}/send`, { method: 'POST', body: {} });
  return { reply: `Notification delivery attempted for ${resource.label} record #${id}.`, action: `send_${resource.key}`, view: resource.key, data };
}

async function runFileIntelligence(req, message) {
  let id = inferId(message);
  if (!id) {
    const rows = rowsFrom(await callInternal(req, '/api/feature-modules/document-repository'));
    id = rows.find((row) => row.file_name)?.id || rows[0]?.id;
  }
  if (!id) return { reply: 'No contract document record is available for file intelligence.', action: 'no_document', view: 'document-repository' };
  const data = await callInternal(req, `/api/feature-modules/document-repository/${id}/intelligence`, { method: 'POST', body: {} });
  return { reply: `File intelligence completed for contract document #${id}.`, action: 'file_intelligence', view: 'document-repository', data };
}

async function governanceMetrics(req) {
  const data = await callInternal(req, '/api/ops/ai-governance/metrics');
  return { reply: 'AI governance metrics loaded.', action: 'ai_governance_metrics', view: 'ai-governance', data };
}

async function configReadiness(req) {
  const data = await callInternal(req, '/api/ops/config/readiness');
  return { reply: `Configuration readiness: ${data.ready_count} of ${data.total_count} areas configured.`, action: 'config_readiness', view: 'production-hardening', data };
}

async function runBackgroundJob(req, message) {
  const data = await callInternal(req, '/api/ops/jobs/run', { method: 'POST', body: { job_key: /close/i.test(message) ? 'period-close-health-check' : 'revrec-background-check' } });
  return { reply: `Background job ${data.job_key} completed.`, action: 'run_background_job', view: 'background-jobs', data: { record: data } };
}

async function transitionWorkflow(req, resource, message) {
  let id = inferId(message);
  if (!id) {
    const rows = rowsFrom(await callInternal(req, resource.endpoint));
    id = rows[0]?.id;
  }
  if (!id) return { reply: `No ${resource.label} record is available to route.`, action: 'transition_no_record', view: resource.key };
  const status = /reject|exception/i.test(message) ? 'Exception' : /approve|approved/i.test(message) ? 'Approved' : 'Review';
  const step = status === 'Approved' ? 'Controller approved' : status === 'Exception' ? 'Exception routed' : 'Submitted for review';
  const data = await callInternal(req, `/api/feature-modules/${resource.key}/${id}/transition`, { method: 'POST', body: { status, approval_step: step } });
  return { reply: `${resource.label} record #${id} moved to ${status}.`, action: `transition_${resource.key}`, view: resource.key, data: { record: data } };
}

async function runModuleAi(req, resource, message) {
  let id = inferId(message);
  if (!id) {
    const rows = rowsFrom(await callInternal(req, resource.endpoint));
    id = rows[0]?.id;
  }
  if (!id) return { reply: `No ${resource.label} record is available for AI review.`, action: 'no_record', view: resource.key };
  const data = await callInternal(req, `/api/feature-modules/${resource.key}/${id}/run`, { method: 'POST', body: {} });
  return { reply: `AI review completed for ${resource.label} record #${id}.`, action: `run_ai_${resource.key}`, view: resource.key, data };
}

async function runAiTool(req, tool) {
  try {
    const data = await callInternal(req, tool.endpoint, { method: 'POST', body: tool.payload });
    return { reply: `${tool.label} completed.`, action: `run_${tool.key}`, view: 'ai', data };
  } catch (err) {
    return { reply: `${tool.label} could not run: ${err.message}`, action: `run_${tool.key}_failed`, view: 'ai', data: { error: err.message } };
  }
}

async function dashboardContext() {
  const [customers, contracts, obligations, schedules, invoices, summary, aging] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM customers'),
    pool.query('SELECT COUNT(*)::int AS count, COALESCE(SUM(total_value),0) AS total_value FROM contracts'),
    pool.query('SELECT COUNT(*)::int AS count FROM performance_obligations'),
    pool.query('SELECT COALESCE(SUM(recognized_amount),0) AS recognized, COALESCE(SUM(deferred_amount),0) AS deferred FROM revenue_schedules'),
    pool.query("SELECT COUNT(*)::int AS count, COALESCE(SUM(amount-paid_amount),0) AS outstanding FROM invoices WHERE status NOT IN ('paid','cancelled')"),
    pool.query('SELECT status, COUNT(*)::int AS count FROM contracts GROUP BY status ORDER BY status'),
    pool.query('SELECT status, COUNT(*)::int AS count FROM invoices GROUP BY status ORDER BY status'),
  ]);
  return {
    customers: customers.rows[0].count,
    contracts: contracts.rows[0],
    performance_obligations: obligations.rows[0].count,
    revenue: schedules.rows[0],
    invoices: invoices.rows[0],
    contract_statuses: summary.rows,
    invoice_statuses: aging.rows,
  };
}

async function answerQuestion(message) {
  const context = await dashboardContext();
  const text = normalize(message);
  if (/deferred/.test(text)) return { reply: `Deferred revenue is ${Number(context.revenue.deferred || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}.`, action: 'answer_deferred_revenue', data: context };
  if (/recognized|recognised/.test(text)) return { reply: `Recognized revenue is ${Number(context.revenue.recognized || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}.`, action: 'answer_recognized_revenue', data: context };
  if (/how many|count|total/.test(text)) {
    return { reply: `Current counts: ${context.customers} customers, ${context.contracts.count} contracts, ${context.performance_obligations} obligations, and ${context.invoices.count} invoices.`, action: 'answer_counts', data: context };
  }
  if (/outstanding|aging|\bar\b|receivable/.test(text)) return { reply: `Outstanding invoice balance is ${Number(context.invoices.outstanding || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}.`, action: 'answer_ar', data: context };

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      reply: 'I can operate the app and answer from current revenue context. Ask for counts, recognized revenue, deferred revenue, outstanding AR, list/create/update/delete records, or run an AI module.',
      action: 'help',
      data: { context },
    };
  }
  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You are an ASC 606 revenue recognition app copilot. Use the supplied app context. Return concise JSON with summary, findings, recommended_actions.' },
        { role: 'user', content: `Question: ${message}\nContext: ${JSON.stringify(context)}` },
      ],
    }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
    const content = response.data.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content);
    return { reply: parsed.summary || 'I analyzed the current revenue context.', action: 'ai_answer', data: { analysis: parsed, context } };
  } catch (err) {
    return { reply: `AI answer failed: ${err.message}`, action: 'ai_answer_failed', data: { context } };
  }
}

router.get('/capabilities', (_req, res) => {
  res.json({
    pages: pages.map(({ key, label }) => ({ key, label })),
    resources: [...coreResources, ...featureModules].map(({ key, label, ai }) => ({ key, label, ai: Boolean(ai) })),
    ai_tools: aiTools.map(({ key, label }) => ({ key, label })),
    examples: [
      'Show dashboard counts',
      'Show outstanding AR',
      'Open contracts',
      'List invoices',
      'Create contract for new SaaS customer',
      'Create invoice for delayed billing review',
      'Create notification for delayed approval',
      'Approve first approval workflow',
      'Route first approval workflow to exception',
      'Test ERP connector',
      'Test NetSuite connection',
      'Test SAP connection',
      'Test Salesforce connection',
      'Run AI review on contract documents',
      'Run AI review on evidence completeness',
      'Run revenue forecast',
      'Run audit readiness',
      'Export contracts csv',
      'Export audit package',
      'Export audit binder PDF',
      'Send first notification',
      'Run ERP sync',
      'Sync NetSuite',
      'Sync SAP',
      'Sync Salesforce',
      'Run file intelligence',
      'Show AI governance metrics',
      'Run background job',
      'Show configuration readiness',
      'Export backup',
      'What is deferred revenue?',
      'Delete invoice 12',
    ],
  });
});

router.post('/message', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.json({ reply: 'Ask me to open pages, list records, create/update/delete records, run AI tools, or answer revenue questions.' });
  const text = normalize(message);
  try {
    if (/\bexport|download\b/i.test(message)) return res.json(await exportData(message));
    if (/\bconfig|configuration|readiness|env\b/i.test(message) && /\bshow|check|review|readiness\b/i.test(message)) return res.json(await configReadiness(req));

    const page = match(pages, text);
    if (page && /\b(open|go to|navigate|show page)\b/i.test(message)) {
      return res.json({ reply: `Opening ${page.label}.`, action: 'navigate', view: page.key });
    }

    const resource = match([...coreResources, ...featureModules], text);
    if (resource) {
      if (/\b(delete|remove)\b/i.test(message)) return res.json(await deleteResource(req, resource, message));
      if (/\b(create|add|new)\b/i.test(message)) return res.json(await createResource(req, resource, message));
      if (resource.key === 'erp-connectors' && /\b(test|check|validate)\b/i.test(message)) {
        const providerResult = await testProviderConnector(req, message);
        return res.json(providerResult || await testConnector(req, resource, message));
      }
      if ((resource.key === 'erp-connectors' || resource.key === 'live-erp-integrations') && /\b(sync|pull|push)\b/i.test(message)) return res.json(await syncConnector(req, resource, message));
      if ((resource.key === 'notifications' || resource.key === 'notification-delivery') && /\b(send|deliver|notify)\b/i.test(message)) return res.json(await sendNotification(req, resource, message));
      if (resource.key === 'file-intelligence' && /\b(run|analy[sz]e|extract|intelligence)\b/i.test(message)) return res.json(await runFileIntelligence(req, message));
      if (resource.key === 'ai-governance' && /\b(metrics|cost|usage|governance)\b/i.test(message)) return res.json(await governanceMetrics(req));
      if (resource.key === 'background-jobs' && /\b(run|start|execute)\b/i.test(message)) return res.json(await runBackgroundJob(req, message));
      if (resource.key === 'approval-workflows' && /\b(submit|route|approve|approved|reject|exception)\b/i.test(message)) return res.json(await transitionWorkflow(req, resource, message));
      if (/\b(run ai|ai review|analy[sz]e|review with ai)\b/i.test(message)) return res.json(await runModuleAi(req, resource, message));
      if (/\b(update|mark|set|approve|approved|close|complete|review|start|reopen)\b/i.test(message)) return res.json(await updateResource(req, resource, message));
      if (/\b(list|show|load|records|rows|table)\b/i.test(message)) return res.json(await listResource(req, resource));
    }

    if (/\b(test|check|validate)\b/i.test(message) && inferProvider(message)) {
      const providerResult = await testProviderConnector(req, message);
      if (providerResult) return res.json(providerResult);
    }

    if (/\b(sync|pull|push)\b/i.test(message) && inferProvider(message)) {
      return res.json(await syncConnector(req, { key: 'live-erp-integrations', label: 'Live ERP Integrations', endpoint: '/api/feature-modules/live-erp-integrations' }, message));
    }

    const tool = match(aiTools, text);
    if (tool && /\b(run|analy[sz]e|generate|forecast|check|suggest)\b/i.test(message)) {
      return res.json(await runAiTool(req, tool));
    }

    return res.json(await answerQuestion(message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
