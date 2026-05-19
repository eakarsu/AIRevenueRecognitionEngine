// === Custom Views: ASC 606 RevRec Specialized Views ===
// 2 VIZ: revenue waterfall by performance obligation, contract status heatmap
// 2 NON-VIZ: revenue schedule PDF, rev-rec rules editor (CRUD POB allocation/timing)

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

// Per-route limiter (cheap protection): use ipKeyGenerator helper for ipv6 safety
const cvLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req /* , res */) => {
    if (req.user && req.user.id) return `u:${req.user.id}`;
    return `ip:${ipKeyGenerator(req.ip)}`;
  },
  message: { error: 'Too many custom-views requests, please slow down.' },
});

router.use(cvLimiter);

// In-memory store for rev-rec rules (no schema migration required for this view).
// Each rule: { id, name, pob_pattern, allocation_method, timing_method, priority, active, updated_at }
const rulesStore = {
  seq: 4,
  items: [
    { id: 1, name: 'SaaS Subscription Ratable', pob_pattern: 'subscription|saas', allocation_method: 'relative_ssp', timing_method: 'over_time_straight_line', priority: 10, active: true, updated_at: new Date().toISOString() },
    { id: 2, name: 'Implementation Services', pob_pattern: 'implementation|onboarding|setup', allocation_method: 'residual', timing_method: 'point_in_time', priority: 20, active: true, updated_at: new Date().toISOString() },
    { id: 3, name: 'Professional Services Hourly', pob_pattern: 'consulting|professional services|hours', allocation_method: 'relative_ssp', timing_method: 'over_time_input_method', priority: 30, active: true, updated_at: new Date().toISOString() },
  ],
};

// ---------------------------------------------------------------------------
// VIZ 1: GET /api/custom-views/revenue-waterfall-pob
// Aggregates allocated/recognized revenue across performance obligations.
// Returns labels + buckets suitable for a waterfall/bar chart in the UI.
// ---------------------------------------------------------------------------
router.get('/revenue-waterfall-pob', authenticate, async (req, res) => {
  try {
    const obligations = await pool.query(`
      SELECT po.id, po.description, po.allocated_price, po.satisfaction_progress,
             po.satisfaction_method, po.status, c.contract_number, c.title AS contract_title
        FROM performance_obligations po
        LEFT JOIN contracts c ON c.id = po.contract_id
       ORDER BY po.allocated_price DESC NULLS LAST
       LIMIT 25
    `).catch(() => ({ rows: [] }));

    const rows = obligations.rows.map((r) => {
      const allocated = Number(r.allocated_price || 0);
      const progress = Number(r.satisfaction_progress || 0); // 0..100
      const recognized = Math.round(allocated * (progress / 100) * 100) / 100;
      const deferred = Math.round((allocated - recognized) * 100) / 100;
      return {
        id: r.id,
        label: (r.description || `POB #${r.id}`).slice(0, 48),
        contract: r.contract_number || null,
        allocated,
        recognized,
        deferred,
        satisfaction_method: r.satisfaction_method,
        status: r.status,
      };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.allocated += r.allocated;
        acc.recognized += r.recognized;
        acc.deferred += r.deferred;
        return acc;
      },
      { allocated: 0, recognized: 0, deferred: 0 }
    );

    res.json({
      ok: true,
      generated_at: new Date().toISOString(),
      count: rows.length,
      totals,
      obligations: rows,
    });
  } catch (e) {
    console.error('revenue-waterfall-pob error:', e.message);
    res.status(500).json({ error: 'Failed to compute revenue waterfall' });
  }
});

// ---------------------------------------------------------------------------
// VIZ 2: GET /api/custom-views/contract-status-heatmap
// Returns a 2-D heatmap matrix: rows = customer industries, cols = statuses.
// Cell value = contract count and aggregate value.
// ---------------------------------------------------------------------------
router.get('/contract-status-heatmap', authenticate, async (req, res) => {
  try {
    const data = await pool.query(`
      SELECT COALESCE(cu.industry, 'Unknown') AS industry,
             c.status AS status,
             COUNT(c.id)::int AS contract_count,
             COALESCE(SUM(c.total_value), 0)::float AS total_value
        FROM contracts c
        LEFT JOIN customers cu ON cu.id = c.customer_id
       GROUP BY industry, status
       ORDER BY industry, status
    `).catch(() => ({ rows: [] }));

    const statusesSet = new Set();
    const industriesSet = new Set();
    data.rows.forEach((r) => { statusesSet.add(r.status); industriesSet.add(r.industry); });
    const statuses = Array.from(statusesSet).sort();
    const industries = Array.from(industriesSet).sort();

    const matrix = industries.map((ind) => statuses.map((st) => {
      const hit = data.rows.find((r) => r.industry === ind && r.status === st);
      return { count: hit ? hit.contract_count : 0, value: hit ? hit.total_value : 0 };
    }));

    res.json({
      ok: true,
      generated_at: new Date().toISOString(),
      industries,
      statuses,
      matrix,
    });
  } catch (e) {
    console.error('contract-status-heatmap error:', e.message);
    res.status(500).json({ error: 'Failed to compute heatmap' });
  }
});

// ---------------------------------------------------------------------------
// NON-VIZ 1: GET /api/custom-views/revenue-schedule-pdf?contract_id=...
// Generates a printable ASC 606 revenue schedule report (PDF via minimal
// hand-rolled PDF generator -- no extra deps needed).
// ---------------------------------------------------------------------------
router.get('/revenue-schedule-pdf', authenticate, async (req, res) => {
  try {
    const contractId = req.query.contract_id ? parseInt(req.query.contract_id, 10) : null;

    let contract = null;
    if (contractId) {
      const cRes = await pool.query(
        'SELECT c.*, cu.name AS customer_name FROM contracts c LEFT JOIN customers cu ON cu.id = c.customer_id WHERE c.id=$1',
        [contractId]
      ).catch(() => ({ rows: [] }));
      contract = cRes.rows[0] || null;
    }

    const schedRes = await pool.query(
      contractId
        ? 'SELECT * FROM revenue_schedules WHERE contract_id=$1 ORDER BY period_start ASC LIMIT 60'
        : 'SELECT * FROM revenue_schedules ORDER BY period_start ASC LIMIT 60',
      contractId ? [contractId] : []
    ).catch(() => ({ rows: [] }));

    const lines = [];
    lines.push('AI REVENUE RECOGNITION ENGINE');
    lines.push('ASC 606 Revenue Schedule Report');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    if (contract) {
      lines.push(`Contract: ${contract.contract_number} - ${contract.title}`);
      lines.push(`Customer: ${contract.customer_name || 'N/A'}`);
      lines.push(`Status: ${contract.status}  Total Value: ${Number(contract.total_value || 0).toFixed(2)}`);
      lines.push(`Period: ${contract.start_date || ''} to ${contract.end_date || ''}`);
      lines.push('');
    } else {
      lines.push('Scope: All contracts (up to 60 most recent schedule rows)');
      lines.push('');
    }
    lines.push('Period Start | Period End  | Recognized | Deferred  | Status');
    lines.push('-------------------------------------------------------------');
    let totalRec = 0;
    let totalDef = 0;
    schedRes.rows.forEach((r) => {
      const rec = Number(r.recognized_amount || 0);
      const def = Number(r.deferred_amount || 0);
      totalRec += rec; totalDef += def;
      lines.push(
        `${String(r.period_start || '').padEnd(12)} | ${String(r.period_end || '').padEnd(12)} | ${rec.toFixed(2).padStart(10)} | ${def.toFixed(2).padStart(9)} | ${r.status || ''}`
      );
    });
    lines.push('-------------------------------------------------------------');
    lines.push(`TOTALS: Recognized=${totalRec.toFixed(2)}  Deferred=${totalDef.toFixed(2)}  Rows=${schedRes.rows.length}`);
    lines.push('');
    lines.push('This document is generated for internal ASC 606 review.');

    // Minimal hand-rolled single-page PDF
    const pageWidth = 612;
    const pageHeight = 792;
    const fontSize = 10;
    const lineHeight = 13;
    const topMargin = 50;
    const leftMargin = 40;

    const escapePdf = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

    let textStream = 'BT\n/F1 ' + fontSize + ' Tf\n';
    let y = pageHeight - topMargin;
    lines.forEach((ln) => {
      textStream += `1 0 0 1 ${leftMargin} ${y} Tm (${escapePdf(ln)}) Tj\n`;
      y -= lineHeight;
      if (y < 40) { /* truncate if overflowing single page */ }
    });
    textStream += 'ET';

    const objects = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`);
    objects.push(`<< /Length ${Buffer.byteLength(textStream, 'utf8')} >>\nstream\n${textStream}\nendstream`);
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((obj, i) => {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="revenue_schedule_${contractId || 'all'}.pdf"`);
    res.send(Buffer.from(pdf, 'utf8'));
  } catch (e) {
    console.error('revenue-schedule-pdf error:', e.message);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ---------------------------------------------------------------------------
// NON-VIZ 2: Rev-Rec Rules Editor — CRUD over allocation + timing rules
// GET  /api/custom-views/revrec-rules         -> list
// POST /api/custom-views/revrec-rules         -> create
// PUT  /api/custom-views/revrec-rules/:id     -> update
// DELETE /api/custom-views/revrec-rules/:id   -> delete
// ---------------------------------------------------------------------------
const ALLOCATION_METHODS = ['relative_ssp', 'residual', 'expected_value', 'most_likely_amount'];
const TIMING_METHODS = ['over_time_straight_line', 'over_time_input_method', 'over_time_output_method', 'point_in_time'];

function validateRule(body) {
  const errs = [];
  if (!body.name || typeof body.name !== 'string') errs.push('name required');
  if (body.allocation_method && !ALLOCATION_METHODS.includes(body.allocation_method)) errs.push(`allocation_method must be one of ${ALLOCATION_METHODS.join(',')}`);
  if (body.timing_method && !TIMING_METHODS.includes(body.timing_method)) errs.push(`timing_method must be one of ${TIMING_METHODS.join(',')}`);
  return errs;
}

router.get('/revrec-rules', authenticate, (req, res) => {
  res.json({
    ok: true,
    allocation_methods: ALLOCATION_METHODS,
    timing_methods: TIMING_METHODS,
    rules: rulesStore.items.slice().sort((a, b) => a.priority - b.priority),
  });
});

router.post('/revrec-rules', authenticate, (req, res) => {
  const errs = validateRule(req.body || {});
  if (errs.length) return res.status(400).json({ error: 'validation_failed', details: errs });
  const id = ++rulesStore.seq;
  const rule = {
    id,
    name: req.body.name,
    pob_pattern: req.body.pob_pattern || '',
    allocation_method: req.body.allocation_method || 'relative_ssp',
    timing_method: req.body.timing_method || 'over_time_straight_line',
    priority: Number.isFinite(req.body.priority) ? req.body.priority : 100,
    active: req.body.active !== false,
    updated_at: new Date().toISOString(),
  };
  rulesStore.items.push(rule);
  res.status(201).json({ ok: true, rule });
});

router.put('/revrec-rules/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = rulesStore.items.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  const errs = validateRule({ ...rulesStore.items[idx], ...(req.body || {}) });
  if (errs.length) return res.status(400).json({ error: 'validation_failed', details: errs });
  rulesStore.items[idx] = {
    ...rulesStore.items[idx],
    ...req.body,
    id,
    updated_at: new Date().toISOString(),
  };
  res.json({ ok: true, rule: rulesStore.items[idx] });
});

router.delete('/revrec-rules/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const before = rulesStore.items.length;
  rulesStore.items = rulesStore.items.filter((r) => r.id !== id);
  if (rulesStore.items.length === before) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true, deleted: id });
});

module.exports = router;
