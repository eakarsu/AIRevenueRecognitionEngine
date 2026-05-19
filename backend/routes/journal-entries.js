const express=require('express');const router=express.Router();const pool=require('../db');
const{authenticate}=require('../middleware/auth');const{body,validationResult}=require('express-validator');
router.use(authenticate);
router.get('/',async(req,res)=>{
try{const page=Math.max(1,parseInt(req.query.page)||1);const limit=20;const offset=(page-1)*limit;
const[r,c]=await Promise.all([pool.query('SELECT * FROM journal_entries ORDER BY entry_date DESC,id DESC LIMIT $1 OFFSET $2',[limit,offset]),pool.query('SELECT COUNT(*) FROM journal_entries')]);
const total=parseInt(c.rows[0].count);res.json({data:r.rows,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
}catch(e){console.error(e);res.status(500).json({error:'Internal server error'});}
});
router.get('/:id',async(req,res)=>{
try{const r=await pool.query('SELECT * FROM journal_entries WHERE id=$1',[req.params.id]);
if(!r.rows.length)return res.status(404).json({error:'Not found'});res.json(r.rows[0]);}catch(e){res.status(500).json({error:'Internal server error'});}
});
// POST with double-entry validation
router.post('/',[
body('amount').isNumeric().withMessage('Amount must be numeric').custom(v=>parseFloat(v)>0).withMessage('Amount must be positive'),
body('debit_account').notEmpty().withMessage('Debit account required'),
body('credit_account').notEmpty().withMessage('Credit account required'),
body('debit_account').custom((v,{req})=>{if(v===req.body.credit_account)throw new Error('Debit and credit accounts must differ');return true;})
],async(req,res)=>{
const errors=validationResult(req);if(!errors.isEmpty())return res.status(400).json({errors:errors.array()});
try{const{entry_date,description,debit_account,credit_account,amount,contract_id,status,created_by}=req.body;
// Double-entry check: amounts must balance (1:1 for simple entries)
const debitAmount=parseFloat(amount);const creditAmount=parseFloat(amount);
if(Math.abs(debitAmount-creditAmount)>0.001)return res.status(400).json({error:'Double-entry imbalance: debit and credit amounts must be equal'});
const r=await pool.query('INSERT INTO journal_entries (entry_date,description,debit_account,credit_account,amount,contract_id,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[entry_date,description,debit_account,credit_account,amount,contract_id||null,status||'draft',created_by||req.user.email]);
res.status(201).json(r.rows[0]);}catch(e){console.error(e);res.status(500).json({error:'Internal server error'});}
});
router.put('/:id',async(req,res)=>{
try{const{entry_date,description,debit_account,credit_account,amount,contract_id,status,created_by}=req.body;
const r=await pool.query('UPDATE journal_entries SET entry_date=$1,description=$2,debit_account=$3,credit_account=$4,amount=$5,contract_id=$6,status=$7,created_by=$8 WHERE id=$9 RETURNING *',[entry_date,description,debit_account,credit_account,amount,contract_id,status,created_by,req.params.id]);
if(!r.rows.length)return res.status(404).json({error:'Not found'});res.json(r.rows[0]);}catch(e){res.status(500).json({error:'Internal server error'});}
});
router.delete('/:id',async(req,res)=>{
try{const r=await pool.query('DELETE FROM journal_entries WHERE id=$1 RETURNING *',[req.params.id]);
if(!r.rows.length)return res.status(404).json({error:'Not found'});res.json({message:'Deleted',journal_entry:r.rows[0]});}catch(e){res.status(500).json({error:'Internal server error'});}
});
// Validate balance endpoint
router.post('/validate-balance',async(req,res)=>{
const{entries}=req.body;if(!Array.isArray(entries))return res.status(400).json({error:'entries array required'});
const totalDebits=entries.reduce((sum,e)=>sum+(parseFloat(e.debit_amount)||parseFloat(e.amount)||0),0);
const totalCredits=entries.reduce((sum,e)=>sum+(parseFloat(e.credit_amount)||parseFloat(e.amount)||0),0);
const balanced=Math.abs(totalDebits-totalCredits)<0.01;
res.json({balanced,total_debits:totalDebits.toFixed(2),total_credits:totalCredits.toFixed(2),difference:(totalDebits-totalCredits).toFixed(2),message:balanced?'Journal entries are balanced':'IMBALANCE: Debits and credits do not match'});
});
module.exports=router;
