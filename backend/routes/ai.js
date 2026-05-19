const express=require('express');const router=express.Router();const axios=require('axios');const pool=require('../db');
const{authenticate}=require('../middleware/auth');const{aiRateLimiter}=require('../middleware/rateLimiter');
const{body,validationResult}=require('express-validator');
// CRITICAL: auth on ALL AI routes
router.use(authenticate);router.use(aiRateLimiter);
const OPENROUTER_URL='https://openrouter.ai/api/v1/chat/completions';
const MODEL='anthropic/claude-3-5-sonnet-20241022';
// 3-strategy JSON parser
function parseAIJson(content){
try{return JSON.parse(content);}catch{}
const md=content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);if(md){try{return JSON.parse(md[1]);}catch{}}
const obj=content.match(/(\{[\s\S]*\})/s);if(obj){try{return JSON.parse(obj[1]);}catch{}}
return{raw:content};
}
async function callAI(systemPrompt,userPrompt){
if(!process.env.OPENROUTER_API_KEY){const err=new Error('OPENROUTER_API_KEY not configured');err.code='NO_API_KEY';throw err;}
const start=Date.now();
const response=await axios.post(OPENROUTER_URL,{model:MODEL,messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}],temperature:0.3},{headers:{'Authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json'}});
const content=response.data.choices[0].message.content;
return{parsed:parseAIJson(content),raw:content,duration:Date.now()-start};
}
async function persistRun(userId,endpoint,inputData,result,duration){
try{await pool.query('INSERT INTO ai_runs (user_id,endpoint,input_data,result,model_used,duration_ms) VALUES ($1,$2,$3,$4,$5,$6)',[userId,endpoint,JSON.stringify(inputData),JSON.stringify(result),MODEL,duration]);}catch{}
}
async function handle(req,res,endpoint,systemPrompt,userPrompt,inputData){
try{
const{parsed,raw,duration}=await callAI(systemPrompt,userPrompt);
await persistRun(req.user.id,endpoint,inputData,parsed,duration);
res.json({success:true,analysis:parsed,raw_response:raw});
}catch(err){if(err.code==='NO_API_KEY')return res.status(503).json({success:false,error:'AI service unavailable: OPENROUTER_API_KEY not configured on server'});console.error(endpoint,err.response?.data||err.message);res.status(500).json({success:false,error:'AI request failed',details:err.message});}
}
// compliance-check
router.post('/compliance-check',async(req,res)=>{const{contract}=req.body;await handle(req,res,'/compliance-check',`You are an ASC 606 expert. Analyze contracts for compliance. Return JSON with: overall_compliance (%), steps (array: {step,status,findings,recommendations}), risks (array), summary.`,`Analyze for ASC 606 compliance:\n${JSON.stringify(contract)}`,{contract});});
// transaction-price-allocation
router.post('/transaction-price-allocation',async(req,res)=>{const{contract,performance_obligations,total_price}=req.body;await handle(req,res,'/transaction-price-allocation',`You are an ASC 606 Step 4 expert. Return JSON with: allocation_method, allocations (array: {obligation,standalone_selling_price,allocated_amount,percentage}), total_allocated, notes.`,`Contract: ${JSON.stringify(contract)}\nObligations: ${JSON.stringify(performance_obligations)}\nTotal Price: $${total_price}`,{total_price});});
// variable-consideration
router.post('/variable-consideration',async(req,res)=>{const{contract_terms,variable_elements}=req.body;await handle(req,res,'/variable-consideration',`You are an ASC 606 variable consideration expert. Return JSON with: variable_elements_analysis (array), estimation_method, estimated_amount, constraint_assessment, recommended_transaction_price, reasoning.`,`Contract: ${JSON.stringify(contract_terms)}\nVariable: ${JSON.stringify(variable_elements)}`,{contract_terms});});
// contract-modification
router.post('/contract-modification',async(req,res)=>{const{original_contract,modification}=req.body;await handle(req,res,'/contract-modification',`You are an ASC 606 contract modification expert. Return JSON with: modification_type, treatment, reasoning, impact_on_revenue, accounting_entries_needed, recommendations.`,`Original: ${JSON.stringify(original_contract)}\nModification: ${JSON.stringify(modification)}`,{});});
// risk-assessment
router.post('/risk-assessment',async(req,res)=>{const{contract}=req.body;await handle(req,res,'/risk-assessment',`You are a revenue recognition risk expert. Return JSON with: overall_risk_score (1-100), risk_level, risk_categories (array: {category,score,description,mitigation}), key_concerns, recommendations.`,`Assess risks:\n${JSON.stringify(contract)}`,{});});
// revenue-forecast
router.post('/revenue-forecast',async(req,res)=>{const{historical_data,forecast_periods}=req.body;await handle(req,res,'/revenue-forecast',`You are a revenue forecasting expert. Return JSON with: forecast (array: {period,predicted_amount,lower_bound,upper_bound,confidence_level}), methodology, assumptions, growth_rate, key_drivers.`,`Historical: ${JSON.stringify(historical_data)}\nPeriods: ${forecast_periods||6}`,{});});
// journal-entry-suggestion
router.post('/journal-entry-suggestion',async(req,res)=>{const{revenue_event}=req.body;await handle(req,res,'/journal-entry-suggestion',`You are an ASC 606 journal entry expert. Return JSON with: journal_entries (array: {date,description,debit_account,credit_account,amount,rationale}), explanation, asc_606_step, balance_check (debits===credits).`,`Revenue event:\n${JSON.stringify(revenue_event)}`,{});});
// multi-element-arrangement
router.post('/multi-element-arrangement',async(req,res)=>{const{arrangement}=req.body;await handle(req,res,'/multi-element-arrangement',`You are an ASC 606 multi-element expert. Return JSON with: identified_obligations (array: {description,is_distinct,distinct_reasoning,satisfaction_method,estimated_ssp}), bundling_recommendations, allocation_approach, total_arrangement_value.`,`Arrangement:\n${JSON.stringify(arrangement)}`,{});});
// customer-credit-analysis
router.post('/customer-credit-analysis',async(req,res)=>{const{customer}=req.body;await handle(req,res,'/customer-credit-analysis',`You are a credit analyst for ASC 606. Return JSON with: credit_score, credit_grade (A/B/C/D/F), collectibility_assessment, payment_probability, recommended_terms, revenue_impact, recommendations.`,`Customer:\n${JSON.stringify(customer)}`,{});});
// invoice-anomaly-detection
router.post('/invoice-anomaly-detection',async(req,res)=>{const{invoices}=req.body;await handle(req,res,'/invoice-anomaly-detection',`You are an invoice fraud detection expert. Return JSON with: anomalies (array: {invoice_id,type,severity,description,recommendation}), risk_summary, total_at_risk_amount, patterns_detected.`,`Invoices:\n${JSON.stringify(invoices)}`,{count:invoices?.length});});
// revenue-leakage-detection
router.post('/revenue-leakage-detection',async(req,res)=>{const{contracts,invoices,revenue_schedules}=req.body;await handle(req,res,'/revenue-leakage-detection',`You are a revenue leakage analyst. Return JSON with: leakage_items (array: {source,description,estimated_amount,priority}), total_leakage_estimate, root_causes, recommendations.`,`Contracts: ${JSON.stringify(contracts)}\nInvoices: ${JSON.stringify(invoices)}\nSchedules: ${JSON.stringify(revenue_schedules)}`,{});});
// contract-clause-analyzer
router.post('/contract-clause-analyzer',async(req,res)=>{const{contract_text,clauses}=req.body;await handle(req,res,'/contract-clause-analyzer',`You are a contract clause analyzer. Return JSON with: clauses_analysis (array: {clause,type,revenue_impact,asc_606_implication,risk_level,recommendation}), key_findings, overall_complexity.`,`Text: ${contract_text||'N/A'}\nClauses: ${JSON.stringify(clauses)}`,{});});
// audit-readiness
router.post('/audit-readiness',async(req,res)=>{const{company_data}=req.body;await handle(req,res,'/audit-readiness',`You are an ASC 606 auditor. Return JSON with: readiness_score (1-100), readiness_level, categories (array: {area,score,status,gaps,action_items}), priority_actions, estimated_preparation_time.`,`Company data:\n${JSON.stringify(company_data)}`,{});});
// disclosure-generator
router.post('/disclosure-generator',async(req,res)=>{const{revenue_data,contracts_summary,accounting_policies}=req.body;await handle(req,res,'/disclosure-generator',`You are an ASC 606 disclosure expert. Return JSON with: disclosures (array: {section,title,content}), footnotes, required_tables, management_discussion_points.`,`Revenue: ${JSON.stringify(revenue_data)}\nContracts: ${JSON.stringify(contracts_summary)}\nPolicies: ${JSON.stringify(accounting_policies)}`,{});});
// ssp-estimator
router.post('/ssp-estimator',async(req,res)=>{const{product_or_service,market_data,cost_data,historical_prices}=req.body;await handle(req,res,'/ssp-estimator',`You are an SSP estimation expert. Return JSON with: recommended_ssp, estimation_method, analysis (array: {method,estimated_price,confidence,rationale}), supporting_evidence, documentation_notes.`,`Product: ${JSON.stringify(product_or_service)}\nMarket: ${JSON.stringify(market_data)}\nCost: ${JSON.stringify(cost_data)}\nHistory: ${JSON.stringify(historical_prices)}`,{});});
// revenue-waterfall
router.post('/revenue-waterfall',async(req,res)=>{const{periods,opening_balances,new_bookings,recognitions,adjustments}=req.body;await handle(req,res,'/revenue-waterfall',`You are a revenue waterfall analyst. Return JSON with: waterfall_analysis (array: {period,opening,additions,recognized,closing,recognition_rate}), trends, seasonality_factors, forecast_next_periods, insights.`,`Periods: ${JSON.stringify(periods)}\nOpenings: ${JSON.stringify(opening_balances)}\nBookings: ${JSON.stringify(new_bookings)}`,{});});
// obligation-identifier
router.post('/obligation-identifier',async(req,res)=>{const{contract_description}=req.body;await handle(req,res,'/obligation-identifier',`You are an ASC 606 Step 2 expert. Return JSON with: obligations (array: {description,is_distinct,distinct_reasoning,satisfaction_method,satisfaction_criteria,estimated_timeline}), bundling_notes, total_obligations_count.`,`Contract: ${contract_description}`,{});});
// contract-summarizer
router.post('/contract-summarizer',async(req,res)=>{const{contract_text}=req.body;await handle(req,res,'/contract-summarizer',`You are a contract analyst. Return JSON with: summary, key_parties, contract_value, duration, deliverables, payment_structure, variable_elements, termination_terms, warranties, asc_606_considerations, risk_flags.`,`Contract:\n${contract_text}`,{});});
// anomaly-detection (for period close)
router.post('/anomaly-detection',async(req,res)=>{
try{const period=req.query.period||req.body.period;
const[je,rs,inv]=await Promise.all([pool.query('SELECT * FROM journal_entries WHERE entry_date >= NOW()-INTERVAL \'3 months\' ORDER BY entry_date DESC LIMIT 50'),pool.query('SELECT * FROM revenue_schedules ORDER BY period_start DESC LIMIT 50'),pool.query('SELECT * FROM invoices ORDER BY issue_date DESC LIMIT 50')]);
await handle(req,res,'/anomaly-detection',`You are a revenue anomaly detector. Analyze journal entries, schedules, and invoices for irregularities. Return JSON with: anomalies (array: {type,description,amount,severity,recommendation}), overall_risk, summary.`,`Journal Entries: ${JSON.stringify(je.rows.slice(0,20))}\nRevenue Schedules: ${JSON.stringify(rs.rows.slice(0,20))}\nInvoices: ${JSON.stringify(inv.rows.slice(0,20))}\nPeriod: ${period||'current'}`,{period});
}catch(e){res.status(500).json({error:e.message});}
});
// Generate revenue schedule for contract (deterministic + AI commentary)
router.post('/generate-schedule/:contractId',async(req,res)=>{
try{
const cRes=await pool.query('SELECT * FROM contracts WHERE id=$1',[req.params.contractId]);
if(!cRes.rows.length)return res.status(404).json({error:'Contract not found'});
const c=cRes.rows[0];
const start=new Date(c.start_date);const end=new Date(c.end_date);
if(!c.start_date||!c.end_date||!c.total_value)return res.status(400).json({error:'Contract must have start_date, end_date, total_value'});
// Compute months
const months=[];let cur=new Date(start);
while(cur<=end){months.push(new Date(cur));cur.setMonth(cur.getMonth()+1);}
const monthlyAmount=parseFloat(c.total_value)/Math.max(months.length,1);
// Insert schedule rows
const inserted=[];
for(const m of months){
const ps=m.toISOString().slice(0,10);
const pe=new Date(m.getFullYear(),m.getMonth()+1,0).toISOString().slice(0,10);
try{const r=await pool.query('INSERT INTO revenue_schedules (contract_id,period_start,period_end,recognized_amount,deferred_amount,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING *',[c.id,ps,pe,monthlyAmount.toFixed(2),0,'scheduled',`AI-generated: ${c.title}`]);if(r.rows.length)inserted.push(r.rows[0]);}catch{}
}
// AI commentary
const{parsed,raw,duration}=await callAI(`You are a revenue recognition expert. Provide commentary on this monthly recognition schedule. Return JSON with: commentary, recognition_method, risk_factors (array), audit_notes (array).`,`Contract: ${JSON.stringify(c)}\nSchedule: ${months.length} monthly periods of $${monthlyAmount.toFixed(2)} each\nTotal: $${c.total_value}`);
await persistRun(req.user.id,'/generate-schedule',{contractId:req.params.contractId},{scheduleCount:inserted.length,...parsed},duration);
res.json({success:true,schedules_created:inserted.length,monthly_amount:monthlyAmount.toFixed(2),periods:months.length,ai_commentary:parsed,schedules:inserted});
}catch(e){res.status(500).json({error:e.message});}
});
// Period-close workflow
router.post('/period-close',async(req,res)=>{
try{const{period}=req.body;const steps=[];
// Step 1: Leakage detection
const[contracts,inv,schedules]=await Promise.all([pool.query('SELECT * FROM contracts LIMIT 20'),pool.query('SELECT * FROM invoices ORDER BY issue_date DESC LIMIT 30'),pool.query('SELECT * FROM revenue_schedules ORDER BY period_start DESC LIMIT 30')]);
const{parsed:leakage,duration:d1}=await callAI(`Revenue leakage analyst. Return JSON: leakage_items (array), total_leakage_estimate, root_causes, recommendations.`,`Contracts:${JSON.stringify(contracts.rows.slice(0,10))}\nInvoices:${JSON.stringify(inv.rows.slice(0,10))}\nSchedules:${JSON.stringify(schedules.rows.slice(0,10))}`);
steps.push({step:'leakage_detection',result:leakage});
await persistRun(req.user.id,'/period-close/leakage',{period},{result:leakage},d1);
// Step 2: Anomaly detection
const je=await pool.query('SELECT * FROM journal_entries ORDER BY entry_date DESC LIMIT 30');
const{parsed:anomalies,duration:d2}=await callAI(`Revenue anomaly detector. Return JSON: anomalies (array: {type,description,amount,severity}), overall_risk, summary.`,`Journal Entries:${JSON.stringify(je.rows.slice(0,15))}\nPeriod:${period||'current'}`);
steps.push({step:'anomaly_detection',result:anomalies});
await persistRun(req.user.id,'/period-close/anomaly',{period},{result:anomalies},d2);
// Step 3: Audit readiness
const{parsed:audit,duration:d3}=await callAI(`ASC 606 auditor. Return JSON: readiness_score (1-100), readiness_level, categories (array: {area,score,status,gaps}), priority_actions.`,`Period: ${period||'current'}\nContracts: ${contracts.rows.length}\nJournal Entries: ${je.rows.length}\nRevenue Schedules: ${schedules.rows.length}`);
steps.push({step:'audit_readiness',result:audit});
await persistRun(req.user.id,'/period-close/audit',{period},{result:audit},d3);
res.json({period_close:period||'current',steps,completed_at:new Date().toISOString(),overall_readiness_score:audit?.readiness_score});
}catch(e){res.status(500).json({error:e.message});}
});
// contract-amendment-impact (what changes if contract modified)
router.post('/contract-amendment-impact',async(req,res)=>{const{original_contract,proposed_amendment,recognition_to_date}=req.body;await handle(req,res,'/contract-amendment-impact',`You are an ASC 606 amendment-impact expert. Compare original vs proposed and quantify the revenue impact. Return JSON: {amendment_type, treatment:"prospective|cumulative_catchup|new_contract|hybrid", obligations_added:[], obligations_removed:[], price_reallocation:{old:[],new:[]}, cumulative_catchup_amount, future_revenue_delta, journal_entries:[{date,debit,credit,amount,rationale}], disclosure_implications:[], summary}.`,`Original:\n${JSON.stringify(original_contract)}\n\nProposed amendment:\n${JSON.stringify(proposed_amendment)}\n\nRecognition to date: ${JSON.stringify(recognition_to_date||{})}`,{});});
// revenue-forecast-scenario (what-if scenarios)
router.post('/revenue-forecast-scenario',async(req,res)=>{const{base_forecast,scenarios,assumptions}=req.body;await handle(req,res,'/revenue-forecast-scenario',`You are a revenue scenario analyst. Project base, upside, downside and custom scenarios with sensitivity. Return JSON: {scenarios:[{name,description,monthly_forecast:[{period,amount}], total, variance_vs_base, key_drivers, sensitivities:[{driver,low,base,high,impact}]}], best_case,worst_case,base_case,recommendation, summary}.`,`Base forecast:\n${JSON.stringify(base_forecast)}\n\nScenarios to model:\n${JSON.stringify(scenarios||['base','upside','downside'])}\n\nAssumptions:\n${JSON.stringify(assumptions||{})}`,{});});
// performance-obligation-tracking (progress toward satisfaction)
router.post('/performance-obligation-tracking',async(req,res)=>{const{obligations,measurement_method}=req.body;await handle(req,res,'/performance-obligation-tracking',`You are a performance-obligation tracking expert. Compute progress per obligation. Return JSON: {obligations:[{obligation_id,description,measurement_method,percent_complete,recognized_to_date,remaining_revenue,expected_completion_date,blockers:[],evidence:[],status:"on_track|at_risk|behind"}], aggregate_progress, at_risk_count, recommended_actions:[], summary}.`,`Obligations:\n${JSON.stringify(obligations||[])}\nMeasurement method preference: ${measurement_method||'mix'}`,{});});
// AI History
router.get('/history',async(req,res)=>{
try{const page=Math.max(1,parseInt(req.query.page)||1);const limit=20;const offset=(page-1)*limit;
const[r,c]=await Promise.all([pool.query('SELECT id,endpoint,model_used,duration_ms,created_at FROM ai_runs WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',[req.user.id,limit,offset]),pool.query('SELECT COUNT(*) FROM ai_runs WHERE user_id=$1',[req.user.id])]);
const total=parseInt(c.rows[0].count);
res.json({data:r.rows,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
}catch(e){res.status(500).json({error:e.message});}
});
router.get('/history/:id',async(req,res)=>{
try{const r=await pool.query('SELECT * FROM ai_runs WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);
if(!r.rows.length)return res.status(404).json({error:'Not found'});res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}
});
// reporting-quality-check (disclosure auditor / financial-statement quality review)
router.post('/reporting-quality-check',async(req,res)=>{const{financial_disclosures,supporting_data,reporting_period}=req.body;await handle(req,res,'/reporting-quality-check',`You are an ASC 606 disclosure auditor. Score the quality of revenue-recognition disclosures and surface gaps. Return JSON: {quality_score (0-100), grade ("A"|"B"|"C"|"D"|"F"), gap_analysis:[{topic,current_disclosure,asc_606_requirement,gap,severity:"critical|high|medium|low"}], missing_disclosures:[], inconsistencies:[{location,issue,recommended_correction}], reviewer_questions:[], suggested_revisions:[{section,original,revised}], audit_workpaper_notes, executive_summary}.`,`Reporting period: ${reporting_period||'current'}\n\nDisclosures:\n${JSON.stringify(financial_disclosures||{})}\n\nSupporting data:\n${JSON.stringify(supporting_data||{})}`,{reporting_period});});
// customer-portfolio-analytics (cross-customer revenue concentration + risk)
router.post('/customer-portfolio-analytics',async(req,res)=>{
try{
const customers=req.body?.customers;const contracts=req.body?.contracts;
let custRows=customers,contractRows=contracts;
if(!custRows){try{const r=await pool.query('SELECT * FROM customers LIMIT 200');custRows=r.rows;}catch{custRows=[];}}
if(!contractRows){try{const r=await pool.query('SELECT * FROM contracts LIMIT 500');contractRows=r.rows;}catch{contractRows=[];}}
const userPrompt=`Customer portfolio analytics request.\n\nCustomers (${(custRows||[]).length}):\n${JSON.stringify((custRows||[]).slice(0,50))}\n\nContracts (${(contractRows||[]).length}):\n${JSON.stringify((contractRows||[]).slice(0,50))}`;
await handle(req,res,'/customer-portfolio-analytics',`You are a revenue portfolio analyst. Identify concentration, churn risk, expansion opportunities and revenue quality across the customer base. Return JSON: {portfolio_summary:{total_customers,total_arr,top10_concentration_pct,hhi_index}, concentration_risk:{level,top_customers:[{customer,arr_share_pct}], notes}, segments:[{name,customers_count,arr,arr_share_pct,risk_level,characteristics:[]}], at_risk_accounts:[{customer,reason,arr,recommended_action}], expansion_opportunities:[{customer,signal,potential_arr_lift,recommended_play}], revenue_quality_score (0-100), action_items:[], executive_summary}.`,userPrompt,{customer_count:(custRows||[]).length,contract_count:(contractRows||[]).length});
}catch(e){if(e.code==='NO_API_KEY')return res.status(503).json({success:false,error:'AI service unavailable: OPENROUTER_API_KEY not configured on server'});res.status(500).json({error:e.message});}
});
module.exports=router;
