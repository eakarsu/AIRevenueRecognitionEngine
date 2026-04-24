const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/journal-entries
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM journal_entries ORDER BY entry_date DESC, id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get journal entries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/journal-entries/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM journal_entries WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get journal entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/journal-entries
router.post('/', async (req, res) => {
  try {
    const { entry_date, description, debit_account, credit_account, amount, contract_id, status, created_by } = req.body;
    const result = await pool.query(
      `INSERT INTO journal_entries (entry_date, description, debit_account, credit_account, amount, contract_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [entry_date, description, debit_account, credit_account, amount, contract_id || null, status || 'draft', created_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create journal entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/journal-entries/:id
router.put('/:id', async (req, res) => {
  try {
    const { entry_date, description, debit_account, credit_account, amount, contract_id, status, created_by } = req.body;
    const result = await pool.query(
      `UPDATE journal_entries SET entry_date = $1, description = $2, debit_account = $3,
       credit_account = $4, amount = $5, contract_id = $6, status = $7, created_by = $8
       WHERE id = $9 RETURNING *`,
      [entry_date, description, debit_account, credit_account, amount, contract_id, status, created_by, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update journal entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/journal-entries/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM journal_entries WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    res.json({ message: 'Journal entry deleted', journal_entry: result.rows[0] });
  } catch (err) {
    console.error('Delete journal entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
