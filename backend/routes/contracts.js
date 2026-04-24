const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/contracts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, cu.name as customer_name
       FROM contracts c
       LEFT JOIN customers cu ON c.customer_id = cu.id
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get contracts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contracts/:id
router.get('/:id', async (req, res) => {
  try {
    const contractResult = await pool.query(
      `SELECT c.*, cu.name as customer_name
       FROM contracts c
       LEFT JOIN customers cu ON c.customer_id = cu.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const obligationsResult = await pool.query(
      'SELECT * FROM performance_obligations WHERE contract_id = $1 ORDER BY id',
      [req.params.id]
    );

    res.json({
      ...contractResult.rows[0],
      performance_obligations: obligationsResult.rows,
    });
  } catch (err) {
    console.error('Get contract error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contracts
router.post('/', async (req, res) => {
  try {
    const { customer_id, contract_number, title, description, start_date, end_date, total_value, status, payment_terms } = req.body;
    const result = await pool.query(
      `INSERT INTO contracts (customer_id, contract_number, title, description, start_date, end_date, total_value, status, payment_terms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [customer_id, contract_number, title, description, start_date, end_date, total_value, status || 'draft', payment_terms]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create contract error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/contracts/:id
router.put('/:id', async (req, res) => {
  try {
    const { customer_id, contract_number, title, description, start_date, end_date, total_value, status, payment_terms } = req.body;
    const result = await pool.query(
      `UPDATE contracts SET customer_id = $1, contract_number = $2, title = $3, description = $4,
       start_date = $5, end_date = $6, total_value = $7, status = $8, payment_terms = $9, updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [customer_id, contract_number, title, description, start_date, end_date, total_value, status, payment_terms, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update contract error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/contracts/:id (cascade delete performance_obligations)
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM performance_obligations WHERE contract_id = $1', [req.params.id]);
    const result = await client.query('DELETE FROM contracts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Contract not found' });
    }
    await client.query('COMMIT');
    res.json({ message: 'Contract deleted', contract: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete contract error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
