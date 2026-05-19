# Audit Note — AIRevenueRecognitionEngine

## Original audit recommendations (batch_07.md §18)

**Missing AI endpoints:** `/contract-amendment-impact`, `/revenue-forecast-scenario`, `/performance-obligation-tracking`, `/reporting-quality-check`.

**Missing non-AI features:** contract repository/document management, ERP import, workflow automation, change order management, customer contract repository.

**Custom suggestions:** revenue recognition workflow orchestration, contract clause library, ASC 606 audit workpaper generator, customer portfolio analytics, revenue quality assessment, deferred revenue tracker.

## Implemented this pass (3 mechanical)
1. `POST /api/ai/contract-amendment-impact` — quantifies revenue impact (prospective vs cumulative-catchup) of an amendment, with journal entries.
2. `POST /api/ai/revenue-forecast-scenario` — base/upside/downside scenario projection with sensitivity drivers.
3. `POST /api/ai/performance-obligation-tracking` — per-obligation progress, risk status, blockers, recommended actions.

All three follow the existing one-line `handle(req,res,endpoint,sys,user,inputData)` pattern, persist to `ai_runs`, reuse `parseAIJson` + OpenRouter client. Syntax-checked.

## Backlog (prioritized)
1. `POST /api/ai/reporting-quality-check` — disclosure auditor (mechanical, drafted but deferred to stay within 3-rec limit).
2. Contract repository file storage (NEEDS-PRODUCT-DECISION + storage choice).
3. ERP import (SAP/Oracle/NetSuite) (NEEDS-CREDS).
4. Workflow automation (NEEDS-PRODUCT-DECISION).
5. Customer portfolio analytics dashboard (mechanical follow-up).

## Apply pass 3 (frontend)

All 3 new pass-2 AI endpoints (`/api/ai/contract-amendment-impact`, `/api/ai/revenue-forecast-scenario`, `/api/ai/performance-obligation-tracking`) already have dedicated React components and routes (`AIContractAmendmentImpact`, `AIRevenueForecastScenario`, `AIPerformanceObligationTracking`) registered in `App.js`. JWT Bearer auth handled via `services/api.js`. No FE changes needed.

## Apply pass 4 (mechanical backlog)

LEFT-AS-IS. No code changes.

Both backlog mechanical items (`reporting-quality-check`, `customer-portfolio-analytics`) are already implemented in `backend/routes/ai.js` and fully wired in the FE — `AIReportingQualityCheck.js` and `AICustomerPortfolioAnalytics.js` components, App.js routes `/ai/reporting-quality-check` and `/ai/customer-portfolio-analytics`, plus Layout.js sidebar links. 503-on-missing-key handling is already in place via the shared `handle()` helper in `ai.js` (and the inline catch on `customer-portfolio-analytics`).

Remaining backlog: Contract repository file storage (NEEDS-PRODUCT-DECISION + storage choice), ERP import for SAP/Oracle/NetSuite (NEEDS-CREDS), and workflow automation (NEEDS-PRODUCT-DECISION).
