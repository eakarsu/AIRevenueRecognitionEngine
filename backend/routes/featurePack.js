'use strict';
// Authenticated tasks, contracts export, and deterministic AI fallbacks.
// The AI endpoints never call a provider: they always return the labelled
// deterministic fallback computed from the caller's own records, so they
// behave identically with provider keys unset (offline verification).

const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const {
  TASKS_TABLE_SQL,
  normalizeTaskInput,
  serializeExport,
  contractPortfolioSummary,
  recognitionReadinessChecklist,
  invoiceAgingSummary,
} = require('../services/featurePack');

const router = express.Router();
router.use(authenticate);
let tasksReady = null;

function ensureTasks() {
  if (!tasksReady) {
    tasksReady = pool.query(TASKS_TABLE_SQL).catch((err) => {
      tasksReady = null;
      throw err;
    });
  }
  return tasksReady;
}

async function listTasks(req) {
  await ensureTasks();
  const params = [];
  const clauses = [];
  if (req.user && req.user.tenantId !== undefined && req.user.tenantId !== null) {
    params.push(String(req.user.tenantId));
    clauses.push(`tenant_id = $${params.length}`);
  }
  const search = String(req.query.search || '').trim();
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }
  const status = String(req.query.status || '').trim();
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  const priority = String(req.query.priority || '').trim();
  if (priority) {
    params.push(priority);
    clauses.push(`priority = $${params.length}`);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM tasks${where} ORDER BY id DESC`, params);
  return result.rows;
}

router.get('/tasks/export', async (req, res) => {
  try {
    const exported = serializeExport(await listTasks(req), req.query.format || 'json');
    if (!exported) return res.status(400).json({ error: 'format must be csv or json' });
    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="tasks.${req.query.format === 'csv' ? 'csv' : 'json'}"`);
    return res.send(exported.body);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    return res.json(await listTasks(req));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const { task, errors } = normalizeTaskInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    await ensureTasks();
    const result = await pool.query(
      `INSERT INTO tasks (title, description, status, priority, due_date, related_type, related_id, owner_id, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [task.title, task.description, task.status, task.priority, task.due_date, task.related_type, task.related_id,
        req.user && req.user.id ? req.user.id : null,
        req.user && req.user.tenantId !== undefined && req.user.tenantId !== null ? String(req.user.tenantId) : null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/tasks/:id', async (req, res) => {
  try {
    const { task, errors } = normalizeTaskInput(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    await ensureTasks();
    const current = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'task not found' });
    const next = { ...current.rows[0], ...task };
    const result = await pool.query(
      `UPDATE tasks SET title=$1, description=$2, status=$3, priority=$4, due_date=$5, related_type=$6, related_id=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [next.title, next.description, next.status, next.priority, next.due_date, next.related_type, next.related_id, req.params.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// CSV/JSON export of the main contracts list, honouring search/status filters.
router.get('/feature-pack/export', async (req, res) => {
  try {
    const params = [];
    const clauses = [];
    const search = String(req.query.search || '').trim();
    if (search) {
      params.push(`%${search}%`);
      clauses.push(`(contract_number ILIKE $${params.length} OR title ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }
    const status = String(req.query.status || '').trim();
    if (status) {
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM contracts${where} ORDER BY id DESC`, params);
    const exported = serializeExport(result.rows, req.query.format || 'json');
    if (!exported) return res.status(400).json({ error: 'format must be csv or json' });
    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="contracts.${req.query.format === 'csv' ? 'csv' : 'json'}"`);
    return res.send(exported.body);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

async function ownRows(sql) {
  try {
    const result = await pool.query(sql);
    return result.rows;
  } catch (_) {
    return [];
  }
}

router.post('/feature-pack/ai/contract-portfolio-summary', async (req, res) => {
  const contracts = await ownRows('SELECT * FROM contracts ORDER BY id DESC LIMIT 200');
  return res.json(contractPortfolioSummary({ contracts }));
});

router.post('/feature-pack/ai/recognition-readiness-checklist', async (req, res) => {
  const [contracts, obligations] = await Promise.all([
    ownRows('SELECT * FROM contracts ORDER BY id DESC LIMIT 200'),
    ownRows('SELECT * FROM performance_obligations ORDER BY id DESC LIMIT 200'),
  ]);
  return res.json(recognitionReadinessChecklist({ contracts, obligations }));
});

router.post('/feature-pack/ai/invoice-aging-summary', async (req, res) => {
  const invoices = await ownRows('SELECT * FROM invoices ORDER BY id DESC LIMIT 200');
  return res.json(invoiceAgingSummary({ invoices }));
});

module.exports = router;
