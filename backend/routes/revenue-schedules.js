const express = require('express');
const router = express.Router();
const pool = require('../db');
const{authenticate}=require('../middleware/auth');
router.use(authenticate);

// GET /api/revenue-schedules
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rs.*, c.title as contract_title, c.contract_number
       FROM revenue_schedules rs
       LEFT JOIN contracts c ON rs.contract_id = c.id
       ORDER BY rs.period_start DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get revenue schedules error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/revenue-schedules/contract/:contractId
router.get('/contract/:contractId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM revenue_schedules WHERE contract_id = $1 ORDER BY period_start',
      [req.params.contractId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get schedules by contract error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/revenue-schedules/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM revenue_schedules WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Revenue schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get revenue schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/revenue-schedules
router.post('/', async (req, res) => {
  try {
    const { contract_id, period_start, period_end, recognized_amount, deferred_amount, status, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO revenue_schedules (contract_id, period_start, period_end, recognized_amount, deferred_amount, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [contract_id, period_start, period_end, recognized_amount, deferred_amount, status || 'scheduled', notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create revenue schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/revenue-schedules/:id
router.put('/:id', async (req, res) => {
  try {
    const { contract_id, period_start, period_end, recognized_amount, deferred_amount, status, notes } = req.body;
    const result = await pool.query(
      `UPDATE revenue_schedules SET contract_id = $1, period_start = $2, period_end = $3,
       recognized_amount = $4, deferred_amount = $5, status = $6, notes = $7
       WHERE id = $8 RETURNING *`,
      [contract_id, period_start, period_end, recognized_amount, deferred_amount, status, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Revenue schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update revenue schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/revenue-schedules/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM revenue_schedules WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Revenue schedule not found' });
    }
    res.json({ message: 'Revenue schedule deleted', revenue_schedule: result.rows[0] });
  } catch (err) {
    console.error('Delete revenue schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
