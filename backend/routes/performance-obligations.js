const express = require('express');
const router = express.Router();
const pool = require('../db');
const{authenticate}=require('../middleware/auth');
router.use(authenticate);
async function auditTrail(pool,userId,action,tableName,recordId,oldData,newData){try{await pool.query('INSERT INTO audit_trail (user_id,action,table_name,record_id,old_values,new_values) VALUES ($1,$2,$3,$4,$5,$6)',[userId,action,tableName,recordId,JSON.stringify(oldData),JSON.stringify(newData)]);}catch{}}

// GET /api/performance-obligations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM performance_obligations ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Get performance obligations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/performance-obligations/contract/:contractId
router.get('/contract/:contractId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM performance_obligations WHERE contract_id = $1 ORDER BY id',
      [req.params.contractId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get obligations by contract error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/performance-obligations/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM performance_obligations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Performance obligation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get performance obligation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/performance-obligations
router.post('/', async (req, res) => {
  try {
    const { contract_id, description, standalone_selling_price, allocated_price, satisfaction_method, satisfaction_progress, status, start_date, end_date } = req.body;
    const result = await pool.query(
      `INSERT INTO performance_obligations (contract_id, description, standalone_selling_price, allocated_price, satisfaction_method, satisfaction_progress, status, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [contract_id, description, standalone_selling_price, allocated_price, satisfaction_method || 'over_time', satisfaction_progress || 0, status || 'pending', start_date, end_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create performance obligation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/performance-obligations/:id
router.put('/:id', async (req, res) => {
  try {
    const { contract_id, description, standalone_selling_price, allocated_price, satisfaction_method, satisfaction_progress, status, start_date, end_date } = req.body;
    const result = await pool.query(
      `UPDATE performance_obligations SET contract_id = $1, description = $2, standalone_selling_price = $3,
       allocated_price = $4, satisfaction_method = $5, satisfaction_progress = $6, status = $7,
       start_date = $8, end_date = $9 WHERE id = $10 RETURNING *`,
      [contract_id, description, standalone_selling_price, allocated_price, satisfaction_method, satisfaction_progress, status, start_date, end_date, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Performance obligation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update performance obligation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/performance-obligations/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM performance_obligations WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Performance obligation not found' });
    }
    res.json({ message: 'Performance obligation deleted', performance_obligation: result.rows[0] });
  } catch (err) {
    console.error('Delete performance obligation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
