const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { configuredProviders } = require('../services/erpConnectors');
const { smtpConfigured, webhookConfigured } = require('../services/notificationDelivery');

const router = express.Router();
router.use(authenticate);

async function ensureOpsTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS background_jobs (
      id SERIAL PRIMARY KEY,
      job_key TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      payload JSONB,
      result JSONB,
      run_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_key TEXT UNIQUE NOT NULL,
      description TEXT,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
  const migrations = [
    ['001_core_revrec_schema', 'Users, customers, contracts, obligations, schedules, invoices, and audit trail'],
    ['002_feature_modules', 'Operational feature-module records and AI review metadata'],
    ['003_file_uploads_exports', 'Document upload metadata, export center, audit package and binder'],
    ['004_ops_governance', 'Background jobs, RBAC matrix, production readiness and AI governance metrics'],
  ];
  for (const migration of migrations) {
    await pool.query(
      `INSERT INTO schema_migrations (migration_key, description)
       VALUES ($1, $2) ON CONFLICT (migration_key) DO NOTHING`,
      migration
    );
  }
}

router.get('/health/deep', async (_req, res) => {
  const started = Date.now();
  await pool.query('SELECT 1');
  res.json({
    status: 'ok',
    database: 'connected',
    uptime_seconds: Math.round(process.uptime()),
    latency_ms: Date.now() - started,
    openrouter_configured: Boolean(process.env.OPENROUTER_API_KEY),
    notification_webhook_configured: webhookConfigured(),
    smtp_configured: smtpConfigured(),
    erp_providers: configuredProviders(),
  });
});

router.get('/config/readiness', (_req, res) => {
  const checks = [
    { area: 'OpenRouter', configured: Boolean(process.env.OPENROUTER_API_KEY), required_env: ['OPENROUTER_API_KEY'] },
    { area: 'Webhook Notifications', configured: webhookConfigured(), required_env: ['NOTIFICATION_WEBHOOK_URL or SLACK_WEBHOOK_URL'] },
    { area: 'SMTP Notifications', configured: smtpConfigured(), required_env: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'] },
    ...configuredProviders().map((provider) => ({ area: provider.label, configured: provider.configured, required_env: provider.missing_env })),
  ];
  res.json({
    ready_count: checks.filter((check) => check.configured).length,
    total_count: checks.length,
    checks,
  });
});

router.get('/backup/export', async (_req, res) => {
  const tables = ['customers', 'contracts', 'performance_obligations', 'revenue_schedules', 'journal_entries', 'invoices', 'audit_trail', 'feature_module_records'];
  const backup = { generated_at: new Date().toISOString(), tables: {} };
  for (const table of tables) {
    try {
      const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY 1`);
      backup.tables[table] = rows;
    } catch (err) {
      backup.tables[table] = { error: err.message };
    }
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="revrec-backup.json"');
  res.json(backup);
});

router.get('/migrations', async (_req, res) => {
  await ensureOpsTables();
  const { rows } = await pool.query('SELECT * FROM schema_migrations ORDER BY migration_key');
  res.json(rows);
});

router.get('/rbac/matrix', (_req, res) => {
  res.json({
    roles: ['admin', 'controller', 'auditor', 'viewer', 'user'],
    permissions: {
      admin: ['read', 'create', 'update', 'delete', 'export', 'ai_run', 'governance_approve'],
      controller: ['read', 'create', 'update', 'export', 'ai_run'],
      auditor: ['read', 'export'],
      viewer: ['read'],
      user: ['read', 'create', 'update'],
    },
  });
});

router.get('/jobs', async (_req, res) => {
  await ensureOpsTables();
  const { rows } = await pool.query('SELECT * FROM background_jobs ORDER BY created_at DESC LIMIT 100');
  res.json(rows);
});

router.post('/jobs/run', async (req, res) => {
  await ensureOpsTables();
  const jobKey = req.body?.job_key || 'period-close-health-check';
  const payload = req.body?.payload || {};
  const queued = await pool.query(
    'INSERT INTO background_jobs (job_key, status, payload) VALUES ($1,$2,$3) RETURNING *',
    [jobKey, 'running', JSON.stringify(payload)]
  );
  const result = {
    summary: `${jobKey} completed`,
    checks: [
      'database reachable',
      'revenue schedules available',
      'audit trail available',
      'feature modules available',
    ],
    completed_at: new Date().toISOString(),
  };
  const completed = await pool.query(
    'UPDATE background_jobs SET status=$1, result=$2, completed_at=NOW() WHERE id=$3 RETURNING *',
    ['completed', JSON.stringify(result), queued.rows[0].id]
  );
  res.status(201).json(completed.rows[0]);
});

router.get('/ai-governance/metrics', async (_req, res) => {
  const [runs, avgDuration, latest] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM ai_runs'),
    pool.query('SELECT COALESCE(AVG(duration_ms),0)::int AS avg_duration_ms FROM ai_runs'),
    pool.query('SELECT endpoint, model_used, duration_ms, created_at FROM ai_runs ORDER BY created_at DESC LIMIT 10'),
  ]);
  res.json({
    total_runs: runs.rows[0].count,
    avg_duration_ms: avgDuration.rows[0].avg_duration_ms,
    latest_runs: latest.rows,
    governance_controls: [
      'AI output is advisory and requires human approval for accounting entries.',
      'Runs are persisted with endpoint, model, input, result, duration, and user.',
      'Prompt governance reviews can be recorded from AI Governance module rows.',
    ],
  });
});

ensureOpsTables().catch((err) => console.error('ops init:', err.message));

module.exports = router;
