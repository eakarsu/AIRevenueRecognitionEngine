const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/audit-trail
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_trail ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get audit trail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit-trail/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_trail WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get audit entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/audit-trail
router.post('/', async (req, res) => {
  try {
    const { entity_type, entity_id, action, changes, user_id } = req.body;
    const result = await pool.query(
      `INSERT INTO audit_trail (entity_type, entity_id, action, changes, user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [entity_type, entity_id, action, changes ? JSON.stringify(changes) : null, user_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create audit entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/audit-trail/:id
router.put('/:id', async (req, res) => {
  try {
    const { entity_type, entity_id, action, changes, user_id } = req.body;
    const result = await pool.query(
      `UPDATE audit_trail
       SET entity_type = $1, entity_id = $2, action = $3, changes = $4, user_id = $5
       WHERE id = $6 RETURNING *`,
      [entity_type, entity_id, action, changes ? JSON.stringify(changes) : null, user_id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update audit entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/audit-trail/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM audit_trail WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit entry not found' });
    }
    res.json({ message: 'Audit entry deleted', audit_entry: result.rows[0] });
  } catch (err) {
    console.error('Delete audit entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
