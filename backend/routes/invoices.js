const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, c.title as contract_title, c.contract_number
       FROM invoices i
       LEFT JOIN contracts c ON i.contract_id = c.id
       ORDER BY i.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/invoices
router.post('/', async (req, res) => {
  try {
    const { contract_id, invoice_number, issue_date, due_date, amount, paid_amount, status } = req.body;
    const result = await pool.query(
      `INSERT INTO invoices (contract_id, invoice_number, issue_date, due_date, amount, paid_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [contract_id, invoice_number, issue_date, due_date, amount, paid_amount || 0, status || 'draft']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/invoices/:id
router.put('/:id', async (req, res) => {
  try {
    const { contract_id, invoice_number, issue_date, due_date, amount, paid_amount, status } = req.body;
    const result = await pool.query(
      `UPDATE invoices SET contract_id = $1, invoice_number = $2, issue_date = $3, due_date = $4,
       amount = $5, paid_amount = $6, status = $7 WHERE id = $8 RETURNING *`,
      [contract_id, invoice_number, issue_date, due_date, amount, paid_amount, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM invoices WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ message: 'Invoice deleted', invoice: result.rows[0] });
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
