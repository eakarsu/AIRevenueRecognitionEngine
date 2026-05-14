const express=require('express');const router=express.Router();const pool=require('../db');
const{authenticate}=require('../middleware/auth');
router.use(authenticate);
async function writeAuditTrail(pool,userId,action,tableName,recordId,oldData,newData){
try{await pool.query('INSERT INTO audit_trail (user_id,action,table_name,record_id,old_values,new_values) VALUES ($1,$2,$3,$4,$5,$6)',[userId,action,tableName,recordId,JSON.stringify(oldData),JSON.stringify(newData)]);}catch{}
}
router.get('/',async(req,res)=>{
try{const page=Math.max(1,parseInt(req.query.page)||1);const limit=20;const offset=(page-1)*limit;
const[r,c]=await Promise.all([pool.query(`SELECT c.*,cu.name as customer_name FROM contracts c LEFT JOIN customers cu ON c.customer_id=cu.id ORDER BY c.created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]),pool.query('SELECT COUNT(*) FROM contracts')]);
const total=parseInt(c.rows[0].count);res.json({data:r.rows,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
}catch(e){console.error(e);res.status(500).json({error:'Internal server error'});}
});
router.get('/:id',async(req,res)=>{
try{const[cRes,obRes]=await Promise.all([pool.query(`SELECT c.*,cu.name as customer_name FROM contracts c LEFT JOIN customers cu ON c.customer_id=cu.id WHERE c.id=$1`,[req.params.id]),pool.query('SELECT * FROM performance_obligations WHERE contract_id=$1 ORDER BY id',[req.params.id])]);
if(!cRes.rows.length)return res.status(404).json({error:'Contract not found'});
res.json({...cRes.rows[0],performance_obligations:obRes.rows});}catch(e){res.status(500).json({error:'Internal server error'});}
});
router.post('/',async(req,res)=>{
try{const{customer_id,contract_number,title,description,start_date,end_date,total_value,status,payment_terms}=req.body;
const r=await pool.query('INSERT INTO contracts (customer_id,contract_number,title,description,start_date,end_date,total_value,status,payment_terms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[customer_id,contract_number,title,description,start_date,end_date,total_value,status||'draft',payment_terms]);
await writeAuditTrail(pool,req.user.id,'CREATE','contracts',r.rows[0].id,null,r.rows[0]);
res.status(201).json(r.rows[0]);}catch(e){console.error(e);res.status(500).json({error:'Internal server error'});}
});
router.put('/:id',async(req,res)=>{
try{const old=await pool.query('SELECT * FROM contracts WHERE id=$1',[req.params.id]);
const{customer_id,contract_number,title,description,start_date,end_date,total_value,status,payment_terms}=req.body;
const r=await pool.query('UPDATE contracts SET customer_id=$1,contract_number=$2,title=$3,description=$4,start_date=$5,end_date=$6,total_value=$7,status=$8,payment_terms=$9,updated_at=NOW() WHERE id=$10 RETURNING *',[customer_id,contract_number,title,description,start_date,end_date,total_value,status,payment_terms,req.params.id]);
if(!r.rows.length)return res.status(404).json({error:'Contract not found'});
await writeAuditTrail(pool,req.user.id,'UPDATE','contracts',req.params.id,old.rows[0],r.rows[0]);
res.json(r.rows[0]);}catch(e){console.error(e);res.status(500).json({error:'Internal server error'});}
});
router.delete('/:id',async(req,res)=>{
const client=await pool.connect();
try{await client.query('BEGIN');const old=await client.query('SELECT * FROM contracts WHERE id=$1',[req.params.id]);
await client.query('DELETE FROM performance_obligations WHERE contract_id=$1',[req.params.id]);
const r=await client.query('DELETE FROM contracts WHERE id=$1 RETURNING *',[req.params.id]);
if(!r.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Contract not found'});}
await client.query('COMMIT');
await writeAuditTrail(pool,req.user.id,'DELETE','contracts',req.params.id,old.rows[0],null);
res.json({message:'Contract deleted',contract:r.rows[0]});}catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({error:'Internal server error'});}
finally{client.release();}
});
module.exports=router;
