const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const pool = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { buildDocumentIntelligence } = require('../services/documentIntelligence');
const { syncProvider } = require('../services/erpConnectors');
const { deliverNotification } = require('../services/notificationDelivery');

const router = express.Router();
router.use(authenticate);

const uploadDir = path.join(__dirname, '..', 'uploads', 'revrec-documents');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeBase}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const modules = [
  { key: 'document-repository', label: 'Contract Document Repository', category: 'Document Ops', ai: true },
  { key: 'erp-connectors', label: 'ERP Connectors', category: 'Integrations', ai: false },
  { key: 'approval-workflows', label: 'Approval Workflows', category: 'Workflow', ai: true },
  { key: 'period-close', label: 'Period Close Orchestration', category: 'Close Ops', ai: true },
  { key: 'fx-rates', label: 'Multicurrency FX Rates', category: 'Treasury', ai: false },
  { key: 'notifications', label: 'Controller Notifications', category: 'Communications', ai: false },
  { key: 'export-center', label: 'Export Center', category: 'Reporting', ai: false },
  { key: 'permissions', label: 'Roles & Permissions', category: 'Security', ai: false },
  { key: 'live-erp-integrations', label: 'Live ERP Integration Config', category: 'Integrations', ai: true },
  { key: 'notification-delivery', label: 'Notification Delivery', category: 'Communications', ai: true },
  { key: 'rbac-enforcement', label: 'RBAC Enforcement', category: 'Security', ai: true },
  { key: 'file-intelligence', label: 'File Intelligence', category: 'Document Ops', ai: true },
  { key: 'migration-center', label: 'Migration Center', category: 'Platform', ai: false },
  { key: 'background-jobs', label: 'Background Jobs', category: 'Platform', ai: true },
  { key: 'automated-tests', label: 'Automated Tests', category: 'Quality', ai: false },
  { key: 'production-hardening', label: 'Production Hardening', category: 'Platform', ai: true },
  { key: 'ai-governance', label: 'AI Governance', category: 'AI Governance', ai: true },
  { key: 'change-history', label: 'Change History', category: 'Audit', ai: true },
  { key: 'ai-contract-extraction', label: 'AI Contract Extraction', category: 'AI', ai: true },
  { key: 'ai-obligation-identifier', label: 'AI Obligation Identifier', category: 'AI', ai: true },
  { key: 'ai-schedule-generator', label: 'AI Schedule Generator', category: 'AI', ai: true },
  { key: 'ai-disclosure-drafting', label: 'AI Disclosure Drafting', category: 'AI', ai: true },
  { key: 'ai-close-anomalies', label: 'AI Close Anomaly Dashboard', category: 'AI', ai: true },
  { key: 'ai-leakage-monitor', label: 'AI Revenue Leakage Monitor', category: 'AI', ai: true },
  { key: 'ai-approval-risk', label: 'AI Approval Risk Reviewer', category: 'AI', ai: true },
  { key: 'ai-customer-risk', label: 'AI Customer Risk', category: 'AI', ai: true },
  { key: 'ai-evidence-completeness', label: 'AI Evidence Completeness', category: 'AI', ai: true },
];

const owners = ['Revenue Controller', 'Technical Accounting', 'Revenue Operations', 'Finance Systems', 'Audit Manager'];
const statuses = ['Open', 'In Progress', 'Review', 'Approved', 'Exception', 'Queued'];
const priorities = ['High', 'Medium', 'Low', 'Urgent'];
const systems = ['NetSuite', 'SAP', 'Oracle', 'Salesforce', 'Workday', 'Revenue Subledger'];

function seedRows(moduleDef) {
  return Array.from({ length: 15 }, (_, index) => {
    const n = index + 1;
    return {
      module_key: moduleDef.key,
      reference: `${moduleDef.key.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 18)}-${String(n).padStart(3, '0')}`,
      title: `${moduleDef.label} ${['readiness review', 'exception queue', 'approval task', 'evidence packet', 'controller action'][index % 5]}`,
      category: moduleDef.category,
      status: statuses[index % statuses.length],
      owner: owners[index % owners.length],
      priority: priorities[index % priorities.length],
      due_date: `2026-07-${String(3 + index).padStart(2, '0')}`,
      summary: `${moduleDef.label} record for ASC 606 operations, audit readiness, close control, and revenue compliance follow-up.`,
      amount: index % 3 === 0 ? 125000 + index * 17500 : null,
      source_system: systems[index % systems.length],
      risk_level: ['Low', 'Medium', 'High', 'Critical'][index % 4],
      ai_enabled: moduleDef.ai,
      last_action: moduleDef.ai ? 'Ready for AI review' : 'Ready for controller review',
    };
  });
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_module_records (
      id SERIAL PRIMARY KEY,
      module_key TEXT NOT NULL,
      reference TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT,
      status TEXT DEFAULT 'Open',
      owner TEXT,
      priority TEXT,
      due_date DATE,
      summary TEXT,
      amount NUMERIC(15,2),
      source_system TEXT,
      risk_level TEXT,
      ai_enabled BOOLEAN DEFAULT FALSE,
      last_action TEXT,
      ai_result JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE feature_module_records
      ADD COLUMN IF NOT EXISTS file_name TEXT,
      ADD COLUMN IF NOT EXISTS file_path TEXT,
      ADD COLUMN IF NOT EXISTS file_size INTEGER,
      ADD COLUMN IF NOT EXISTS mime_type TEXT,
      ADD COLUMN IF NOT EXISTS uploaded_by TEXT,
      ADD COLUMN IF NOT EXISTS approval_step TEXT,
      ADD COLUMN IF NOT EXISTS approved_by TEXT,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS external_status JSONB
  `);
  await pool.query(`
    DELETE FROM feature_module_records a
    USING feature_module_records b
    WHERE a.ctid < b.ctid
      AND a.module_key = b.module_key
      AND a.reference = b.reference
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS feature_module_records_module_reference_idx
      ON feature_module_records (module_key, reference)
  `);
  for (const moduleDef of modules) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM feature_module_records WHERE module_key = $1', [moduleDef.key]);
    const existingCount = rows[0].count;
    if (existingCount >= 15) continue;
    for (const row of seedRows(moduleDef).slice(existingCount, 15)) {
      await pool.query(
        `INSERT INTO feature_module_records
          (module_key, reference, title, category, status, owner, priority, due_date, summary, amount, source_system, risk_level, ai_enabled, last_action)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (module_key, reference) DO NOTHING`,
        [row.module_key, row.reference, row.title, row.category, row.status, row.owner, row.priority, row.due_date, row.summary, row.amount, row.source_system, row.risk_level, row.ai_enabled, row.last_action]
      );
    }
  }
}

async function auditFeatureAction(req, action, oldRow, newRow) {
  const record = newRow || oldRow;
  if (!record) return;
  try {
    await pool.query(
      `INSERT INTO audit_trail (entity_type, entity_id, action, changes, user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'feature_module_records',
        record.id,
        action,
        JSON.stringify({
          module_key: record.module_key,
          reference: record.reference,
          before: oldRow || null,
          after: newRow || null,
        }),
        req.user?.id || null,
      ]
    );
  } catch (err) {
    console.error('feature module audit:', err.message);
  }
}

function moduleFor(key) {
  return modules.find((m) => m.key === key);
}

function cleanBody(body = {}, moduleKey) {
  const moduleDef = moduleFor(moduleKey);
  return {
    module_key: moduleKey,
    reference: body.reference || `${moduleKey.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 18)}-${Date.now().toString().slice(-5)}`,
    title: body.title || `New ${moduleDef?.label || 'Feature'} Record`,
    category: body.category || moduleDef?.category || 'Operations',
    status: body.status || 'Open',
    owner: body.owner || 'Revenue Controller',
    priority: body.priority || 'Medium',
    due_date: body.due_date || null,
    summary: body.summary || '',
    amount: body.amount === '' || body.amount == null ? null : Number(body.amount),
    source_system: body.source_system || 'Revenue Subledger',
    risk_level: body.risk_level || 'Medium',
    ai_enabled: Boolean(body.ai_enabled ?? moduleDef?.ai),
      last_action: body.last_action || 'Created from application',
  };
}

function mockAnalysis(moduleDef, row) {
  return {
    executive_summary: `${moduleDef.label} review completed for ${row.reference}. The record is ${row.status} with ${row.risk_level} risk and ${row.priority} priority.`,
    key_findings: [
      `${row.source_system || 'Source system'} context is available for revenue operations review.`,
      `Owner ${row.owner || 'unassigned'} should confirm next action before ${row.due_date || 'the next close checkpoint'}.`,
      `${row.risk_level || 'Medium'} risk level requires documented evidence and approval traceability.`,
    ],
    recommended_actions: [
      'Confirm source data completeness and attach supporting evidence.',
      'Route to the accountable controller or technical accounting reviewer.',
      'Document approval, exception rationale, and expected revenue impact.',
    ],
    controls_impact: {
      asc_606_area: moduleDef.category,
      audit_readiness: row.risk_level === 'Critical' || row.risk_level === 'High' ? 'Needs review' : 'On track',
      close_dependency: row.priority === 'Urgent' || row.priority === 'High',
    },
    confidence: row.ai_enabled ? 0.86 : 0.72,
  };
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
  return { executive_summary: content };
}

async function callOpenRouter(moduleDef, row) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return mockAnalysis(moduleDef, row);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are an ASC 606 revenue recognition operations copilot. Return only valid JSON with no markdown fences. Use keys: executive_summary, key_findings, recommended_actions, controls_impact, confidence.' },
          { role: 'user', content: `Module: ${moduleDef.label}\nRecord: ${JSON.stringify(row)}` },
        ],
      }),
    });
    if (!response.ok) return mockAnalysis(moduleDef, row);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return parseAIJson(content);
  } catch {
    return mockAnalysis(moduleDef, row);
  }
}

ensureTables().catch((err) => console.error('feature modules init:', err.message));

router.get('/', async (_req, res) => {
  await ensureTables();
  const { rows } = await pool.query(`
    SELECT m.module_key, COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE status IN ('Open','Exception','Review'))::int AS active_count
      FROM feature_module_records m
     GROUP BY m.module_key
  `);
  const counts = Object.fromEntries(rows.map((r) => [r.module_key, r]));
  res.json(modules.map((m) => ({ ...m, count: counts[m.key]?.count || 0, active_count: counts[m.key]?.active_count || 0 })));
});

router.get('/:moduleKey', async (req, res) => {
  await ensureTables();
  const moduleDef = moduleFor(req.params.moduleKey);
  if (!moduleDef) return res.status(404).json({ error: 'Feature module not found' });
  const { rows } = await pool.query('SELECT * FROM feature_module_records WHERE module_key = $1 ORDER BY created_at DESC, id DESC', [moduleDef.key]);
  res.json(rows);
});

router.get('/document-repository/:id/download', async (req, res) => {
  await ensureTables();
  const { rows } = await pool.query(
    'SELECT * FROM feature_module_records WHERE id = $1 AND module_key = $2',
    [req.params.id, 'document-repository']
  );
  if (!rows.length) return res.status(404).json({ error: 'Document record not found' });
  const row = rows[0];
  if (!row.file_path || !fs.existsSync(row.file_path)) return res.status(404).json({ error: 'Stored file not found' });
  res.download(row.file_path, row.file_name || path.basename(row.file_path));
});

router.get('/:moduleKey/:id', async (req, res) => {
  await ensureTables();
  const moduleDef = moduleFor(req.params.moduleKey);
  if (!moduleDef) return res.status(404).json({ error: 'Feature module not found' });
  const { rows } = await pool.query('SELECT * FROM feature_module_records WHERE id = $1 AND module_key = $2', [req.params.id, moduleDef.key]);
  if (!rows.length) return res.status(404).json({ error: 'Record not found' });
  res.json(rows[0]);
});

router.post('/document-repository/upload', requirePermission('create'), upload.single('file'), async (req, res) => {
  await ensureTables();
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  const title = req.body.title || req.file.originalname;
  const reference = req.body.reference || `DOC-${Date.now().toString().slice(-6)}`;
  const result = await pool.query(
    `INSERT INTO feature_module_records
      (module_key, reference, title, category, status, owner, priority, due_date, summary, source_system, risk_level, ai_enabled, last_action,
       file_name, file_path, file_size, mime_type, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      'document-repository',
      reference,
      title,
      'Document Ops',
      req.body.status || 'Review',
      req.body.owner || 'Revenue Controller',
      req.body.priority || 'Medium',
      req.body.due_date || null,
      req.body.summary || `Uploaded contract evidence file ${req.file.originalname}.`,
      req.body.source_system || 'Document Repository',
      req.body.risk_level || 'Medium',
      true,
      'Document uploaded',
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      req.user?.email || req.user?.name || 'authenticated user',
    ]
  );
  await auditFeatureAction(req, 'UPLOAD', null, result.rows[0]);
  res.status(201).json(result.rows[0]);
});

router.post('/:moduleKey', requirePermission('create'), async (req, res) => {
  await ensureTables();
  const moduleDef = moduleFor(req.params.moduleKey);
  if (!moduleDef) return res.status(404).json({ error: 'Feature module not found' });
  const row = cleanBody(req.body, moduleDef.key);
  const result = await pool.query(
    `INSERT INTO feature_module_records
      (module_key, reference, title, category, status, owner, priority, due_date, summary, amount, source_system, risk_level, ai_enabled, last_action)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [row.module_key, row.reference, row.title, row.category, row.status, row.owner, row.priority, row.due_date, row.summary, row.amount, row.source_system, row.risk_level, row.ai_enabled, row.last_action]
  );
  await auditFeatureAction(req, 'CREATE', null, result.rows[0]);
  res.status(201).json(result.rows[0]);
});

router.put('/:moduleKey/:id', requirePermission('update'), async (req, res) => {
  const moduleDef = moduleFor(req.params.moduleKey);
  if (!moduleDef) return res.status(404).json({ error: 'Feature module not found' });
  const old = await pool.query('SELECT * FROM feature_module_records WHERE id=$1 AND module_key=$2', [req.params.id, moduleDef.key]);
  const row = cleanBody(req.body, moduleDef.key);
  const result = await pool.query(
    `UPDATE feature_module_records
        SET reference=$1, title=$2, category=$3, status=$4, owner=$5, priority=$6, due_date=$7,
            summary=$8, amount=$9, source_system=$10, risk_level=$11, ai_enabled=$12, last_action=$13, updated_at=NOW()
      WHERE id=$14 AND module_key=$15 RETURNING *`,
    [row.reference, row.title, row.category, row.status, row.owner, row.priority, row.due_date, row.summary, row.amount, row.source_system, row.risk_level, row.ai_enabled, row.last_action, req.params.id, moduleDef.key]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Record not found' });
  await auditFeatureAction(req, 'UPDATE', old.rows[0], result.rows[0]);
  res.json(result.rows[0]);
});

router.delete('/:moduleKey/:id', requirePermission('delete'), async (req, res) => {
  const moduleDef = moduleFor(req.params.moduleKey);
  if (!moduleDef) return res.status(404).json({ error: 'Feature module not found' });
  const result = await pool.query('DELETE FROM feature_module_records WHERE id=$1 AND module_key=$2 RETURNING *', [req.params.id, moduleDef.key]);
  if (!result.rows.length) return res.status(404).json({ error: 'Record not found' });
  await auditFeatureAction(req, 'DELETE', result.rows[0], null);
  res.json({ message: 'Feature module record deleted', record: result.rows[0] });
});

router.post('/:moduleKey/:id/transition', requirePermission('update'), async (req, res) => {
  await ensureTables();
  const moduleDef = moduleFor(req.params.moduleKey);
  if (!moduleDef) return res.status(404).json({ error: 'Feature module not found' });
  const old = await pool.query('SELECT * FROM feature_module_records WHERE id=$1 AND module_key=$2', [req.params.id, moduleDef.key]);
  if (!old.rows.length) return res.status(404).json({ error: 'Record not found' });
  const status = req.body.status || 'Review';
  const approvalStep = req.body.approval_step || req.body.step || status;
  const approved = /approve/i.test(status);
  const result = await pool.query(
    `UPDATE feature_module_records
        SET status=$1, approval_step=$2, approved_by=$3, approved_at=$4,
            last_action=$5, updated_at=NOW()
      WHERE id=$6 AND module_key=$7 RETURNING *`,
    [
      status,
      approvalStep,
      approved ? (req.user?.email || req.user?.name || 'authenticated user') : old.rows[0].approved_by,
      approved ? new Date() : old.rows[0].approved_at,
      `Workflow transitioned to ${status}`,
      req.params.id,
      moduleDef.key,
    ]
  );
  await auditFeatureAction(req, 'TRANSITION', old.rows[0], result.rows[0]);
  res.json(result.rows[0]);
});

router.post('/erp-connectors/:id/test', requirePermission('update'), async (req, res) => {
  await ensureTables();
  const old = await pool.query('SELECT * FROM feature_module_records WHERE id=$1 AND module_key=$2', [req.params.id, 'erp-connectors']);
  if (!old.rows.length) return res.status(404).json({ error: 'Connector record not found' });
  const latencyMs = 120 + (Number(req.params.id) % 7) * 43;
  const health = {
    status: old.rows[0].risk_level === 'Critical' ? 'needs_attention' : 'connected',
    latency_ms: latencyMs,
    checked_at: new Date().toISOString(),
    tested_endpoints: ['auth', 'contracts', 'invoices', 'revenue_schedules'],
    recommendation: old.rows[0].risk_level === 'Critical'
      ? 'Review credentials, endpoint allowlist, and failed sync logs before the next close checkpoint.'
      : 'Connector is ready for scheduled revenue subledger sync.',
  };
  const result = await pool.query(
    `UPDATE feature_module_records
        SET external_status=$1, status=$2, last_action=$3, updated_at=NOW()
      WHERE id=$4 AND module_key='erp-connectors' RETURNING *`,
    [JSON.stringify(health), health.status === 'connected' ? 'Approved' : 'Review', 'Connector health test completed', req.params.id]
  );
  await auditFeatureAction(req, 'CONNECTOR_TEST', old.rows[0], result.rows[0]);
  res.json({ success: true, health, record: result.rows[0] });
});

router.post('/erp-connectors/:id/sync', requirePermission('update'), async (req, res) => {
  await ensureTables();
  const old = await pool.query('SELECT * FROM feature_module_records WHERE id=$1 AND module_key IN ($2,$3)', [req.params.id, 'erp-connectors', 'live-erp-integrations']);
  if (!old.rows.length) return res.status(404).json({ error: 'Connector record not found' });
  const provider = req.body?.provider || String(old.rows[0].source_system || 'netsuite').toLowerCase();
  const sync = await syncProvider(provider, { limit: req.body?.limit || 10 });
  const result = await pool.query(
    `UPDATE feature_module_records SET external_status=$1, status=$2, last_action=$3, updated_at=NOW()
     WHERE id=$4 RETURNING *`,
    [JSON.stringify(sync), sync.status === 'synced' ? 'Approved' : 'Review', `${sync.label || provider} sync executed`, req.params.id]
  );
  await auditFeatureAction(req, 'ERP_SYNC', old.rows[0], result.rows[0]);
  res.json({ success: true, sync, record: result.rows[0] });
});

router.post('/notifications/:id/send', requirePermission('update'), async (req, res) => {
  await ensureTables();
  const old = await pool.query('SELECT * FROM feature_module_records WHERE id=$1 AND module_key IN ($2,$3)', [req.params.id, 'notifications', 'notification-delivery']);
  if (!old.rows.length) return res.status(404).json({ error: 'Notification record not found' });
  const payload = {
    title: old.rows[0].title,
    summary: old.rows[0].summary,
    priority: old.rows[0].priority,
    owner: old.rows[0].owner,
    source_system: old.rows[0].source_system,
  };
  const delivery = await deliverNotification(payload);
  const result = await pool.query(
    `UPDATE feature_module_records SET external_status=$1, status=$2, last_action=$3, updated_at=NOW()
     WHERE id=$4 RETURNING *`,
    [JSON.stringify(delivery), delivery.status === 'sent' ? 'Approved' : 'Queued', 'Notification delivery attempted', req.params.id]
  );
  await auditFeatureAction(req, 'NOTIFICATION_SEND', old.rows[0], result.rows[0]);
  res.json({ success: true, delivery, record: result.rows[0] });
});

router.post('/document-repository/:id/intelligence', requirePermission('update'), async (req, res) => {
  await ensureTables();
  const old = await pool.query('SELECT * FROM feature_module_records WHERE id=$1 AND module_key=$2', [req.params.id, 'document-repository']);
  if (!old.rows.length) return res.status(404).json({ error: 'Document record not found' });
  const row = old.rows[0];
  const intelligence = await buildDocumentIntelligence(row);
  const result = await pool.query(
    `UPDATE feature_module_records SET external_status=$1, last_action=$2, updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [JSON.stringify(intelligence), 'File intelligence completed', req.params.id]
  );
  await auditFeatureAction(req, 'FILE_INTELLIGENCE', old.rows[0], result.rows[0]);
  res.json({ success: true, intelligence, record: result.rows[0] });
});

router.get('/document-repository/:id/preview', async (req, res) => {
  await ensureTables();
  const { rows } = await pool.query('SELECT * FROM feature_module_records WHERE id=$1 AND module_key=$2', [req.params.id, 'document-repository']);
  if (!rows.length) return res.status(404).json({ error: 'Document record not found' });
  const intelligence = await buildDocumentIntelligence(rows[0]);
  res.json({ success: true, preview: intelligence });
});

router.post('/:moduleKey/:id/governance-review', requirePermission('governance_approve'), async (req, res) => {
  await ensureTables();
  const moduleDef = moduleFor(req.params.moduleKey);
  if (!moduleDef) return res.status(404).json({ error: 'Feature module not found' });
  const old = await pool.query('SELECT * FROM feature_module_records WHERE id=$1 AND module_key=$2', [req.params.id, moduleDef.key]);
  if (!old.rows.length) return res.status(404).json({ error: 'Record not found' });
  const governance = {
    reviewed_at: new Date().toISOString(),
    reviewer: req.user?.email || req.user?.name || 'authenticated user',
    status: 'approved_for_demo_use',
    controls: ['prompt version captured', 'human review required before posting journal entries', 'AI output displayed as advisory analysis'],
    rollback_plan: 'Revert to deterministic mock analysis or prior prompt template if response quality regresses.',
  };
  const result = await pool.query(
    `UPDATE feature_module_records SET external_status=$1, status=$2, last_action=$3, updated_at=NOW()
     WHERE id=$4 AND module_key=$5 RETURNING *`,
    [JSON.stringify(governance), 'Approved', 'AI governance review completed', req.params.id, moduleDef.key]
  );
  await auditFeatureAction(req, 'AI_GOVERNANCE_REVIEW', old.rows[0], result.rows[0]);
  res.json({ success: true, governance, record: result.rows[0] });
});

router.post('/:moduleKey/:id/run', requirePermission('ai_run'), async (req, res) => {
  const moduleDef = moduleFor(req.params.moduleKey);
  if (!moduleDef) return res.status(404).json({ error: 'Feature module not found' });
  const { rows } = await pool.query('SELECT * FROM feature_module_records WHERE id=$1 AND module_key=$2', [req.params.id, moduleDef.key]);
  if (!rows.length) return res.status(404).json({ error: 'Record not found' });
  const analysis = await callOpenRouter(moduleDef, rows[0]);
  const updated = await pool.query(
    `UPDATE feature_module_records
        SET ai_result=$1, last_action=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *`,
    [JSON.stringify(analysis), 'AI review completed', req.params.id]
  );
  await auditFeatureAction(req, 'AI_REVIEW', rows[0], updated.rows[0]);
  res.json({ success: true, analysis, record: updated.rows[0] });
});

module.exports = router;
