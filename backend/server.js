const express=require('express');const cors=require('cors');const helmet=require('helmet');
require('dotenv').config({path:require('path').join(__dirname,'..', '.env')});
const app=express();const PORT=process.env.PORT||3001;const CLIENT_URL=process.env.CLIENT_URL||'http://localhost:3000';
const pool=require('./db');
app.use(helmet());app.use(cors({origin:CLIENT_URL,credentials:true}));app.use(express.json());
const{generalLimiter}=require('./middleware/rateLimiter');app.use(generalLimiter);
// Init DB tables
pool.query(`CREATE TABLE IF NOT EXISTS ai_runs (id SERIAL PRIMARY KEY, user_id INTEGER, endpoint VARCHAR(255), input_data TEXT, result TEXT, model_used VARCHAR(100), duration_ms INTEGER, created_at TIMESTAMP DEFAULT NOW())`).catch(e=>console.error('ai_runs table:',e.message));
const authRoutes=require('./routes/auth');const customersRoutes=require('./routes/customers');const contractsRoutes=require('./routes/contracts');const performanceObligationsRoutes=require('./routes/performance-obligations');const revenueSchedulesRoutes=require('./routes/revenue-schedules');const journalEntriesRoutes=require('./routes/journal-entries');const invoicesRoutes=require('./routes/invoices');const auditTrailRoutes=require('./routes/audit-trail');const reportsRoutes=require('./routes/reports');const aiRoutes=require('./routes/ai');
app.use('/api/auth',authRoutes);app.use('/api/customers',customersRoutes);app.use('/api/contracts',contractsRoutes);app.use('/api/performance-obligations',performanceObligationsRoutes);app.use('/api/revenue-schedules',revenueSchedulesRoutes);app.use('/api/journal-entries',journalEntriesRoutes);app.use('/api/invoices',invoicesRoutes);app.use('/api/audit-trail',auditTrailRoutes);app.use('/api/reports',reportsRoutes);app.use('/api/ai',aiRoutes);
// Custom Views: ASC 606 RevRec specialized views (must be BEFORE 404 handler)
app.use('/api/custom-views', require('./routes/customViews'));
app.use('/api', require('./routes/production-readiness'));
app.get('/api/health',(req,res)=>res.json({status:'ok',timestamp:new Date().toISOString()}));
app.use((err,req,res,next)=>{console.error('Error:',err);res.status(err.status||500).json({error:err.message||'Internal server error'});});
app.listen(PORT,()=>console.log(`Revenue Recognition Engine API on port ${PORT}`));
module.exports=app;

// AI feature mount: amendment-impact
app.use('/api/ai/amendment-impact', require('./routes/ai-amendment-impact'));
// === Batch 07 Gaps & Frontend Mounts ===
app.use('/api/gap-no-contractamendmentimpact-recognition-delta', require('./routes/gap-no-contractamendmentimpact-recognition-delta'));
app.use('/api/gap-no-revenueforecastscenario-whatif-analysis', require('./routes/gap-no-revenueforecastscenario-whatif-analysis'));
app.use('/api/gap-no-performanceobligationtracking-ai-progress', require('./routes/gap-no-performanceobligationtracking-ai-progress'));
app.use('/api/gap-no-reportingqualitycheck-autoaudit-disclosur', require('./routes/gap-no-reportingqualitycheck-autoaudit-disclosur'));
app.use('/api/gap-no-customer-churnretention-risk-ai', require('./routes/gap-no-customer-churnretention-risk-ai'));
app.use('/api/gap-no-contract-document-repository-file-upload', require('./routes/gap-no-contract-document-repository-file-upload'));
app.use('/api/gap-no-erp-connectors-sap-oracle-netsuite-salesf', require('./routes/gap-no-erp-connectors-sap-oracle-netsuite-salesf'));
app.use('/api/gap-no-workflow-automation-approval-routing', require('./routes/gap-no-workflow-automation-approval-routing'));
app.use('/api/gap-no-changeorder-management', require('./routes/gap-no-changeorder-management'));
app.use('/api/gap-no-notificationsalerts-to-controllers', require('./routes/gap-no-notificationsalerts-to-controllers'));
app.use('/api/gap-no-multicurrency-fx-rate-management', require('./routes/gap-no-multicurrency-fx-rate-management'));
app.use('/api/gap-no-periodclose-orchestration-ui', require('./routes/gap-no-periodclose-orchestration-ui'));
// === End Batch 07 ===
