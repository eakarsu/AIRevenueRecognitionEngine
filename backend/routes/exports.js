const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(requirePermission('export'));

const resources = {
  customers: 'SELECT * FROM customers ORDER BY id',
  contracts: 'SELECT * FROM contracts ORDER BY id',
  invoices: 'SELECT * FROM invoices ORDER BY id',
  'revenue-schedules': 'SELECT * FROM revenue_schedules ORDER BY id',
  'journal-entries': 'SELECT * FROM journal_entries ORDER BY id',
  'performance-obligations': 'SELECT * FROM performance_obligations ORDER BY id',
  'feature-modules': 'SELECT * FROM feature_module_records ORDER BY module_key, id',
  'audit-trail': 'SELECT * FROM audit_trail ORDER BY created_at DESC',
};

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    columns.map(csvEscape).join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n');
}

router.get('/csv/:resource', async (req, res) => {
  const sql = resources[req.params.resource];
  if (!sql) return res.status(404).json({ error: 'Export resource not found' });
  const { rows } = await pool.query(sql);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.resource}.csv"`);
  res.send(toCsv(rows));
});

router.get('/audit-package', async (_req, res) => {
  const [
    revenueSummary,
    compliance,
    aging,
    auditTrail,
    moduleRecords,
    contracts,
    invoices,
  ] = await Promise.all([
    pool.query('SELECT COALESCE(SUM(recognized_amount),0) AS recognized, COALESCE(SUM(deferred_amount),0) AS deferred FROM revenue_schedules'),
    pool.query(`SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total_value),0) AS total_value FROM contracts GROUP BY status ORDER BY status`),
    pool.query(`SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount - paid_amount),0) AS outstanding FROM invoices GROUP BY status ORDER BY status`),
    pool.query('SELECT * FROM audit_trail ORDER BY created_at DESC LIMIT 50'),
    pool.query('SELECT * FROM feature_module_records ORDER BY updated_at DESC LIMIT 100'),
    pool.query('SELECT * FROM contracts ORDER BY created_at DESC LIMIT 50'),
    pool.query('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 50'),
  ]);
  const payload = {
    generated_at: new Date().toISOString(),
    package_type: 'ASC 606 audit evidence package',
    revenue_summary: revenueSummary.rows[0],
    contract_status: compliance.rows,
    invoice_status: aging.rows,
    recent_audit_trail: auditTrail.rows,
    feature_module_records: moduleRecords.rows,
    contracts: contracts.rows,
    invoices: invoices.rows,
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="revrec-audit-package.json"');
  res.json(payload);
});

router.get('/audit-binder.pdf', async (_req, res) => {
  const [summary, contracts, schedules, invoices, auditTrail, moduleRecords] = await Promise.all([
    pool.query('SELECT COALESCE(SUM(recognized_amount),0) AS recognized, COALESCE(SUM(deferred_amount),0) AS deferred FROM revenue_schedules'),
    pool.query('SELECT contract_number, title, status, total_value FROM contracts ORDER BY total_value DESC LIMIT 20'),
    pool.query('SELECT period_start, period_end, recognized_amount, deferred_amount, status FROM revenue_schedules ORDER BY period_start DESC LIMIT 20'),
    pool.query('SELECT invoice_number, amount, paid_amount, status, due_date FROM invoices ORDER BY due_date DESC LIMIT 20'),
    pool.query('SELECT entity_type, entity_id, action, created_at FROM audit_trail ORDER BY created_at DESC LIMIT 20'),
    pool.query('SELECT module_key, reference, title, status, risk_level, last_action FROM feature_module_records ORDER BY updated_at DESC LIMIT 30'),
  ]);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="revrec-audit-binder.pdf"');

  const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
  doc.pipe(res);
  doc.fontSize(20).text('ASC 606 Revenue Recognition Audit Binder', { underline: true });
  doc.moveDown(0.5).fontSize(10).fillColor('#555').text(`Generated: ${new Date().toISOString()}`);
  doc.moveDown().fillColor('#111').fontSize(14).text('Executive Summary');
  doc.fontSize(11).text(`Recognized revenue: $${Number(summary.rows[0].recognized || 0).toLocaleString()}`);
  doc.text(`Deferred revenue: $${Number(summary.rows[0].deferred || 0).toLocaleString()}`);

  function section(title, rows, formatter) {
    doc.addPage().fillColor('#111').fontSize(16).text(title);
    doc.moveDown(0.5).fontSize(9);
    rows.forEach((row, index) => {
      doc.fillColor('#111').text(`${index + 1}. ${formatter(row)}`, { continued: false });
      if (doc.y > 700) doc.addPage();
    });
  }

  section('Top Contracts', contracts.rows, (r) => `${r.contract_number} | ${r.title} | ${r.status} | $${Number(r.total_value || 0).toLocaleString()}`);
  section('Revenue Schedules', schedules.rows, (r) => `${r.period_start?.toISOString?.().slice(0, 10) || r.period_start} to ${r.period_end?.toISOString?.().slice(0, 10) || r.period_end} | recognized $${Number(r.recognized_amount || 0).toLocaleString()} | deferred $${Number(r.deferred_amount || 0).toLocaleString()} | ${r.status}`);
  section('Invoices', invoices.rows, (r) => `${r.invoice_number} | ${r.status} | amount $${Number(r.amount || 0).toLocaleString()} | paid $${Number(r.paid_amount || 0).toLocaleString()}`);
  section('Audit Trail', auditTrail.rows, (r) => `${r.created_at?.toISOString?.() || r.created_at} | ${r.action} | ${r.entity_type} #${r.entity_id}`);
  section('Operational Evidence', moduleRecords.rows, (r) => `${r.module_key} | ${r.reference} | ${r.status} | ${r.risk_level || 'n/a'} | ${r.last_action || ''}`);
  doc.end();
});

module.exports = router;
