const express = require('express');
const router = express.Router();
const axios = require('axios');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(systemPrompt, userPrompt) {
  const response = await axios.post(OPENROUTER_URL, {
    model: process.env.OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const content = response.data.choices[0].message.content;

  // Try to parse JSON from response
  let parsed = content;
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    }
  } catch (e) {
    // Keep as string if not valid JSON
  }

  return { analysis: parsed, raw_response: content };
}

// POST /api/ai/compliance-check
router.post('/compliance-check', async (req, res) => {
  try {
    const { contract } = req.body;

    const systemPrompt = `You are an expert revenue recognition accountant specializing in ASC 606 (Revenue from Contracts with Customers).
ASC 606 follows a five-step model:
1. Identify the contract with a customer
2. Identify the performance obligations in the contract
3. Determine the transaction price
4. Allocate the transaction price to the performance obligations
5. Recognize revenue when (or as) the entity satisfies a performance obligation

Analyze contracts for compliance with each step and identify any issues, risks, or recommendations.
Respond in JSON format with keys: overall_compliance (percentage), steps (array of {step, status, findings, recommendations}), risks (array), and summary.`;

    const userPrompt = `Analyze the following contract for ASC 606 compliance:\n${JSON.stringify(contract, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Compliance check error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to perform compliance check', details: err.message });
  }
});

// POST /api/ai/transaction-price-allocation
router.post('/transaction-price-allocation', async (req, res) => {
  try {
    const { contract, performance_obligations, total_price } = req.body;

    const systemPrompt = `You are an expert in ASC 606 Step 4: Allocate the Transaction Price.
You must allocate the transaction price to each performance obligation based on relative standalone selling prices.
If standalone selling prices are not directly observable, use estimation methods:
- Adjusted market assessment approach
- Expected cost plus margin approach
- Residual approach (only in specific circumstances)

Respond in JSON format with keys: allocation_method, allocations (array of {obligation, standalone_selling_price, allocated_amount, percentage}), total_allocated, notes, and any adjustments needed.`;

    const userPrompt = `Allocate the transaction price for this contract:
Total Price: $${total_price}
Contract: ${JSON.stringify(contract, null, 2)}
Performance Obligations: ${JSON.stringify(performance_obligations, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Transaction price allocation error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to allocate transaction price', details: err.message });
  }
});

// POST /api/ai/variable-consideration
router.post('/variable-consideration', async (req, res) => {
  try {
    const { contract_terms, variable_elements } = req.body;

    const systemPrompt = `You are an expert in ASC 606 variable consideration estimation.
Variable consideration includes discounts, rebates, refunds, credits, price concessions, incentives, performance bonuses, penalties, and similar items.

Two methods for estimating variable consideration:
1. Expected value method - probability-weighted amount (best when there are many possible outcomes)
2. Most likely amount method - single most likely amount (best when there are only two possible outcomes)

Apply the constraint on variable consideration: include variable consideration only to the extent it is probable that a significant reversal will not occur.

Respond in JSON format with keys: variable_elements_analysis (array), estimation_method, estimated_amount, constraint_assessment, recommended_transaction_price, and reasoning.`;

    const userPrompt = `Estimate variable consideration for this contract:
Contract Terms: ${JSON.stringify(contract_terms, null, 2)}
Variable Elements: ${JSON.stringify(variable_elements, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Variable consideration error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to estimate variable consideration', details: err.message });
  }
});

// POST /api/ai/contract-modification
router.post('/contract-modification', async (req, res) => {
  try {
    const { original_contract, modification } = req.body;

    const systemPrompt = `You are an expert in ASC 606 contract modifications.
A contract modification is a change in scope, price, or both that is approved by the parties.

Three treatments for contract modifications:
1. Separate contract - when modification adds distinct goods/services at standalone selling price
2. Prospective treatment - when remaining goods/services are distinct from those already transferred
3. Cumulative catch-up - when remaining goods/services are NOT distinct (treated as part of original contract)

Analyze the modification and determine the correct treatment.
Respond in JSON format with keys: modification_type, treatment (separate_contract/prospective/cumulative_catch_up), reasoning, impact_on_revenue, accounting_entries_needed, and recommendations.`;

    const userPrompt = `Analyze this contract modification:
Original Contract: ${JSON.stringify(original_contract, null, 2)}
Modification: ${JSON.stringify(modification, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Contract modification error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to analyze contract modification', details: err.message });
  }
});

// POST /api/ai/risk-assessment
router.post('/risk-assessment', async (req, res) => {
  try {
    const { contract } = req.body;

    const systemPrompt = `You are a revenue recognition risk assessment expert.
Assess the following risk categories for the contract:
1. Credit risk - likelihood of customer payment default
2. Performance risk - risk of not fulfilling obligations
3. Regulatory risk - compliance and regulatory exposure
4. Concentration risk - over-reliance on single customer/contract
5. Variable consideration risk - uncertainty in transaction price
6. Timing risk - risk related to revenue recognition timing

Provide an overall risk score from 1-100 (1=lowest risk, 100=highest risk).
Respond in JSON format with keys: overall_risk_score, risk_level (low/medium/high/critical), risk_categories (array of {category, score, description, mitigation}), key_concerns, and recommendations.`;

    const userPrompt = `Assess risks for this contract:\n${JSON.stringify(contract, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Risk assessment error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to assess risks', details: err.message });
  }
});

// POST /api/ai/revenue-forecast
router.post('/revenue-forecast', async (req, res) => {
  try {
    const { historical_data, forecast_periods } = req.body;

    const systemPrompt = `You are a revenue forecasting expert specializing in SaaS and enterprise revenue.
Analyze historical revenue data and provide forecasts with confidence intervals.

Consider:
- Trends and seasonality
- Growth rates
- Contract pipeline
- Churn and renewal rates
- Market conditions

Respond in JSON format with keys: forecast (array of {period, predicted_amount, lower_bound, upper_bound, confidence_level}), methodology, assumptions, growth_rate, key_drivers, and caveats.`;

    const userPrompt = `Forecast revenue based on this historical data:
Historical Data: ${JSON.stringify(historical_data, null, 2)}
Forecast Periods Requested: ${forecast_periods || 6}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Revenue forecast error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to forecast revenue', details: err.message });
  }
});

// POST /api/ai/journal-entry-suggestion
router.post('/journal-entry-suggestion', async (req, res) => {
  try {
    const { revenue_event } = req.body;

    const systemPrompt = `You are an expert accountant specializing in revenue recognition journal entries.
For each revenue event, suggest the proper journal entries following ASC 606 and GAAP.

Common revenue recognition entries include:
- Debit: Accounts Receivable / Credit: Deferred Revenue (upon invoicing)
- Debit: Deferred Revenue / Credit: Revenue (upon satisfaction of performance obligation)
- Debit: Contract Asset / Credit: Revenue (revenue recognized before invoicing)
- Debit: Cash / Credit: Accounts Receivable (upon payment)

Respond in JSON format with keys: journal_entries (array of {date, description, debit_account, credit_account, amount, rationale}), explanation, asc_606_step, and notes.`;

    const userPrompt = `Suggest journal entries for this revenue event:\n${JSON.stringify(revenue_event, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Journal entry suggestion error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to suggest journal entries', details: err.message });
  }
});

// POST /api/ai/multi-element-arrangement
router.post('/multi-element-arrangement', async (req, res) => {
  try {
    const { arrangement } = req.body;

    const systemPrompt = `You are an expert in ASC 606 multi-element arrangements (bundled arrangements).
Analyze bundled arrangements to:
1. Identify separate performance obligations using the "distinct" criteria
   - Customer can benefit from the good/service on its own or with readily available resources
   - The promise is separately identifiable from other promises in the contract
2. Determine if goods/services should be combined into a single performance obligation
3. Recommend standalone selling price estimation for each obligation
4. Suggest allocation methodology

Respond in JSON format with keys: identified_obligations (array of {description, is_distinct, reasoning, satisfaction_method, estimated_ssp}), bundling_recommendations, allocation_approach, total_arrangement_value, and implementation_notes.`;

    const userPrompt = `Analyze this multi-element arrangement:\n${JSON.stringify(arrangement, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Multi-element arrangement error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to analyze multi-element arrangement', details: err.message });
  }
});

// POST /api/ai/customer-credit-analysis
router.post('/customer-credit-analysis', async (req, res) => {
  try {
    const { customer } = req.body;

    const systemPrompt = `You are an expert credit analyst for revenue recognition. Analyze customer creditworthiness for ASC 606 Step 1 (contract existence requires collectibility). Assess credit score, payment probability, recommended credit terms, and whether revenue should be recognized or constrained.
Respond in JSON format with keys: credit_score, credit_grade (A/B/C/D/F), collectibility_assessment, payment_probability, recommended_terms, revenue_impact, recommendations.`;

    const userPrompt = `Analyze the creditworthiness of this customer for revenue recognition purposes:\n${JSON.stringify(customer, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Customer credit analysis error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to perform customer credit analysis', details: err.message });
  }
});

// POST /api/ai/invoice-anomaly-detection
router.post('/invoice-anomaly-detection', async (req, res) => {
  try {
    const { invoices } = req.body;

    const systemPrompt = `You are an expert in invoice analysis and fraud detection for revenue recognition. Detect anomalies like duplicate invoices, unusual amounts, timing irregularities, pattern breaks, potential bill-and-hold arrangements.
Respond in JSON format with keys: anomalies (array of {invoice_id, type, severity, description, recommendation}), risk_summary, total_at_risk_amount, patterns_detected.`;

    const userPrompt = `Analyze the following invoices for anomalies:\n${JSON.stringify(invoices, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Invoice anomaly detection error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to detect invoice anomalies', details: err.message });
  }
});

// POST /api/ai/revenue-leakage-detection
router.post('/revenue-leakage-detection', async (req, res) => {
  try {
    const { contracts, invoices, revenue_schedules } = req.body;

    const systemPrompt = `You are an expert in revenue leakage analysis. Identify gaps between contracted amounts and recognized/billed revenue. Find unbilled revenue, missed escalations, unrecognized obligations, pricing errors.
Respond in JSON format with keys: leakage_items (array of {source, description, estimated_amount, priority}), total_leakage_estimate, root_causes, recommendations.`;

    const userPrompt = `Analyze the following data for revenue leakage:
Contracts: ${JSON.stringify(contracts, null, 2)}
Invoices: ${JSON.stringify(invoices, null, 2)}
Revenue Schedules: ${JSON.stringify(revenue_schedules, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Revenue leakage detection error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to detect revenue leakage', details: err.message });
  }
});

// POST /api/ai/contract-clause-analyzer
router.post('/contract-clause-analyzer', async (req, res) => {
  try {
    const { contract_text, clauses } = req.body;

    const systemPrompt = `You are an expert in contract analysis for revenue recognition impact. Analyze clauses for: right of return, warranties, licensing terms, termination provisions, most-favored-nation clauses, change of control, auto-renewal, price escalation, payment milestones.
Respond in JSON format with keys: clauses_analysis (array of {clause, type, revenue_impact, asc_606_implication, risk_level, recommendation}), key_findings, overall_complexity.`;

    const userPrompt = `Analyze the following contract clauses for revenue recognition impact:
Contract Text: ${contract_text || 'N/A'}
Clauses: ${JSON.stringify(clauses, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Contract clause analyzer error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to analyze contract clauses', details: err.message });
  }
});

// POST /api/ai/audit-readiness
router.post('/audit-readiness', async (req, res) => {
  try {
    const { company_data } = req.body;

    const systemPrompt = `You are an expert auditor for ASC 606 compliance. Assess audit readiness across: documentation completeness, internal controls, policy documentation, judgments and estimates documentation, disclosure readiness, system capabilities.
Respond in JSON format with keys: readiness_score (1-100), readiness_level, categories (array of {area, score, status, gaps, action_items}), priority_actions, estimated_preparation_time.`;

    const userPrompt = `Assess the audit readiness for ASC 606 compliance based on this company data:\n${JSON.stringify(company_data, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Audit readiness error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to assess audit readiness', details: err.message });
  }
});

// POST /api/ai/disclosure-generator
router.post('/disclosure-generator', async (req, res) => {
  try {
    const { revenue_data, contracts_summary, accounting_policies } = req.body;

    const systemPrompt = `You are an expert in ASC 606 financial statement disclosures. Generate required disclosures per ASC 606-10-50 including: disaggregation of revenue, contract balances, performance obligations, significant judgments, practical expedients used.
Respond in JSON format with keys: disclosures (array of {section, title, content}), footnotes, required_tables, management_discussion_points.`;

    const userPrompt = `Generate ASC 606 disclosures based on the following data:
Revenue Data: ${JSON.stringify(revenue_data, null, 2)}
Contracts Summary: ${JSON.stringify(contracts_summary, null, 2)}
Accounting Policies: ${JSON.stringify(accounting_policies, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Disclosure generator error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to generate disclosures', details: err.message });
  }
});

// POST /api/ai/ssp-estimator
router.post('/ssp-estimator', async (req, res) => {
  try {
    const { product_or_service, market_data, cost_data, historical_prices } = req.body;

    const systemPrompt = `You are an expert in standalone selling price estimation per ASC 606. Use three approaches: adjusted market assessment, expected cost plus margin, residual approach. Recommend the best method with justification.
Respond in JSON format with keys: recommended_ssp, estimation_method, analysis (array for each method with {method, estimated_price, confidence, rationale}), supporting_evidence, documentation_notes.`;

    const userPrompt = `Estimate the standalone selling price for the following:
Product/Service: ${JSON.stringify(product_or_service, null, 2)}
Market Data: ${JSON.stringify(market_data, null, 2)}
Cost Data: ${JSON.stringify(cost_data, null, 2)}
Historical Prices: ${JSON.stringify(historical_prices, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('SSP estimator error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to estimate standalone selling price', details: err.message });
  }
});

// POST /api/ai/revenue-waterfall
router.post('/revenue-waterfall', async (req, res) => {
  try {
    const { periods, opening_balances, new_bookings, recognitions, adjustments } = req.body;

    const systemPrompt = `You are an expert in revenue waterfall analysis. Analyze the flow from deferred to recognized revenue across periods. Identify trends, seasonality, acceleration/deceleration patterns, and forecast future waterfalls.
Respond in JSON format with keys: waterfall_analysis (array of {period, opening, additions, recognized, closing, recognition_rate}), trends, seasonality_factors, forecast_next_periods, insights.`;

    const userPrompt = `Analyze the following revenue waterfall data:
Periods: ${JSON.stringify(periods, null, 2)}
Opening Balances: ${JSON.stringify(opening_balances, null, 2)}
New Bookings: ${JSON.stringify(new_bookings, null, 2)}
Recognitions: ${JSON.stringify(recognitions, null, 2)}
Adjustments: ${JSON.stringify(adjustments, null, 2)}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Revenue waterfall error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to analyze revenue waterfall', details: err.message });
  }
});

// POST /api/ai/obligation-identifier
router.post('/obligation-identifier', async (req, res) => {
  try {
    const { contract_description } = req.body;

    const systemPrompt = `You are an expert in identifying performance obligations per ASC 606 Step 2. From contract description, identify all distinct performance obligations. Apply the "distinct" test: (1) customer can benefit on its own or with readily available resources, (2) separately identifiable from other promises. Determine satisfaction method (point-in-time vs over time).
Respond in JSON format with keys: obligations (array of {description, is_distinct, distinct_reasoning, satisfaction_method, satisfaction_criteria, estimated_timeline}), bundling_notes, total_obligations_count.`;

    const userPrompt = `Identify the performance obligations in the following contract description:\n${contract_description}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Obligation identifier error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to identify performance obligations', details: err.message });
  }
});

// POST /api/ai/contract-summarizer
router.post('/contract-summarizer', async (req, res) => {
  try {
    const { contract_text } = req.body;

    const systemPrompt = `You are an expert contract analyst. Summarize the contract focusing on revenue recognition implications: key terms, parties, deliverables, pricing structure, payment terms, variable elements, termination clauses, warranties, and ASC 606 considerations.
Respond in JSON format with keys: summary, key_parties, contract_value, duration, deliverables, payment_structure, variable_elements, termination_terms, warranties, asc_606_considerations, risk_flags.`;

    const userPrompt = `Summarize the following contract for revenue recognition purposes:\n${contract_text}`;

    const result = await callOpenRouter(systemPrompt, userPrompt);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Contract summarizer error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to summarize contract', details: err.message });
  }
});

module.exports = router;
