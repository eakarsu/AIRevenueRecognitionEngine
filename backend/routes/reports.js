const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/reports/revenue-summary
router.get('/revenue-summary', async (req, res) => {
  try {
    const totalRevenue = await pool.query(
      `SELECT COALESCE(SUM(recognized_amount), 0) as total_recognized,
              COALESCE(SUM(deferred_amount), 0) as total_deferred
       FROM revenue_schedules`
    );

    const byPeriod = await pool.query(
      `SELECT TO_CHAR(period_start, 'YYYY-MM') as period,
              SUM(recognized_amount) as recognized,
              SUM(deferred_amount) as deferred
       FROM revenue_schedules
       GROUP BY TO_CHAR(period_start, 'YYYY-MM')
       ORDER BY period DESC
       LIMIT 12`
    );

    const byStatus = await pool.query(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(recognized_amount), 0) as total_amount
       FROM revenue_schedules
       GROUP BY status`
    );

    const contractSummary = await pool.query(
      `SELECT c.status, COUNT(*) as count, COALESCE(SUM(c.total_value), 0) as total_value
       FROM contracts c
       GROUP BY c.status`
    );

    res.json({
      total_recognized: totalRevenue.rows[0].total_recognized,
      total_deferred: totalRevenue.rows[0].total_deferred,
      by_period: byPeriod.rows,
      by_status: byStatus.rows,
      contract_summary: contractSummary.rows,
    });
  } catch (err) {
    console.error('Revenue summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/compliance-status
router.get('/compliance-status', async (req, res) => {
  try {
    const totalContracts = await pool.query('SELECT COUNT(*) as count FROM contracts');

    const contractsWithObligations = await pool.query(
      `SELECT COUNT(DISTINCT contract_id) as count FROM performance_obligations`
    );

    const contractsWithSchedules = await pool.query(
      `SELECT COUNT(DISTINCT contract_id) as count FROM revenue_schedules`
    );

    const satisfiedObligations = await pool.query(
      `SELECT COUNT(*) as count FROM performance_obligations WHERE status = 'satisfied'`
    );

    const totalObligations = await pool.query(
      `SELECT COUNT(*) as count FROM performance_obligations`
    );

    const activeContracts = await pool.query(
      `SELECT COUNT(*) as count FROM contracts WHERE status = 'active'`
    );

    res.json({
      total_contracts: parseInt(totalContracts.rows[0].count),
      contracts_with_obligations: parseInt(contractsWithObligations.rows[0].count),
      contracts_with_schedules: parseInt(contractsWithSchedules.rows[0].count),
      active_contracts: parseInt(activeContracts.rows[0].count),
      satisfied_obligations: parseInt(satisfiedObligations.rows[0].count),
      total_obligations: parseInt(totalObligations.rows[0].count),
      compliance_rate: totalObligations.rows[0].count > 0
        ? ((satisfiedObligations.rows[0].count / totalObligations.rows[0].count) * 100).toFixed(1)
        : 0,
    });
  } catch (err) {
    console.error('Compliance status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/aging
router.get('/aging', async (req, res) => {
  try {
    const aging = await pool.query(
      `SELECT aging_bucket,
              COUNT(*) as invoice_count,
              COALESCE(SUM(outstanding_amount), 0) as outstanding_amount
       FROM (
         SELECT
           CASE
             WHEN due_date >= CURRENT_DATE THEN 'Current'
             WHEN due_date >= CURRENT_DATE - INTERVAL '30 days' THEN '1-30 days'
             WHEN due_date >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60 days'
             WHEN due_date >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90 days'
             ELSE '90+ days'
           END as aging_bucket,
           amount - paid_amount as outstanding_amount
         FROM invoices
         WHERE status NOT IN ('paid', 'cancelled')
       ) aged
       GROUP BY aging_bucket
       ORDER BY
         CASE aging_bucket
           WHEN 'Current' THEN 1
           WHEN '1-30 days' THEN 2
           WHEN '31-60 days' THEN 3
           WHEN '61-90 days' THEN 4
           ELSE 5
         END`
    );

    const totalOutstanding = await pool.query(
      `SELECT COALESCE(SUM(amount - paid_amount), 0) as total
       FROM invoices WHERE status NOT IN ('paid', 'cancelled')`
    );

    res.json({
      aging_buckets: aging.rows,
      total_outstanding: totalOutstanding.rows[0].total,
    });
  } catch (err) {
    console.error('Aging report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
