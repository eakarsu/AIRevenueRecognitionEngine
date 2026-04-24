const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get customer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  try {
    const { name, industry, contact_email, contact_phone, address, credit_rating } = req.body;
    const result = await pool.query(
      `INSERT INTO customers (name, industry, contact_email, contact_phone, address, credit_rating)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, industry, contact_email, contact_phone, address, credit_rating]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, industry, contact_email, contact_phone, address, credit_rating } = req.body;
    const result = await pool.query(
      `UPDATE customers SET name = $1, industry = $2, contact_email = $3, contact_phone = $4,
       address = $5, credit_rating = $6, updated_at = NOW() WHERE id = $7 RETURNING *`,
      [name, industry, contact_email, contact_phone, address, credit_rating, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted', customer: result.rows[0] });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
