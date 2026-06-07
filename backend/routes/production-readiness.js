const express = require('express');
const router = express.Router();

const missingFeatures = [
  'Contract Amendment Impact',
  'Revenue Forecast Scenario',
  'Performance Obligation Progress',
  'Reporting Quality Check',
  'Customer Churn Retention Risk',
  'Contract Document Repository',
  'ERP Connector Operations',
  'Workflow Approval Routing',
  'Change Order Management',
  'Controller Notification Ledger',
  'Multicurrency FX Management',
  'Period Close Orchestration',
  'Audit Evidence Export',
  'Disclosure Draft Review',
  'Revenue Leakage Monitor',
];

function recordsFor(feature) {
  const statuses = ['Open', 'Review', 'Queued', 'Approval pending', 'Urgent', 'Exception', 'Completed'];
  return [
    'intake review',
    'ASC 606 policy validation',
    'evidence check',
    'missing documentation request',
    'approval routing',
    'ERP connector follow-up',
    'close SLA escalation',
    'risk exception review',
    'controller update task',
    'readiness check',
    'credential or source blocker',
    'audit evidence packet',
    'financial impact review',
    'manager signoff',
    'completed sample',
  ].map((suffix, index) => ({
    id: `${feature.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
    name: `${feature} ${suffix}`,
    status: statuses[index % statuses.length],
    owner: index % 5 === 0 ? 'Revenue Controller' : index % 3 === 0 ? 'Technical Accounting Reviewer' : 'Revenue Operations Analyst',
    dueDate: `2026-06-${String(7 + index).padStart(2, '0')}`,
    priority: ['High', 'Medium', 'Low', 'Urgent'][index % 4],
  }));
}

router.get('/missing-features', (req, res) => {
  res.json({
    app: 'AI Revenue Recognition Engine',
    model: 'ai-prior-authorization-operations-hub feature/work-queue pattern',
    features: missingFeatures.map((feature) => ({
      title: feature,
      summary: `${feature} workflow with records, approvals, evidence, audit, reporting, and AI-assisted review.`,
      records: recordsFor(feature),
    })),
  });
});

router.get('/production-readiness', (req, res) => {
  const controls = [
    'Enterprise identity access',
    'ERP connector operations',
    'Audit export center',
    'Notification delivery ledger',
    'Observability runbook',
    'Release test harness',
    'Production gap workspace',
    'Credential readiness',
    'Role mapping',
    'Webhook retry queue',
    'Data retention control',
    'Evidence packet export',
    'API smoke check',
    'Database backup check',
    'Launch approval gate',
  ];

  res.json({
    app: 'AI Revenue Recognition Engine',
    controls: controls.map((name, index) => ({
      id: `revrec-ready-${index + 1}`,
      name,
      status: index % 7 === 0 ? 'Blocked' : index % 5 === 0 ? 'Needs setup' : index % 3 === 0 ? 'Queued' : 'Done',
      owner: index % 4 === 0 ? 'Platform Lead' : 'Revenue Operations Lead',
      evidence: `${name} evidence packet ${index + 1}`,
      nextAction: index % 7 === 0 ? 'Add production credentials or owner approval' : 'Keep evidence current and monitor exceptions',
    })),
  });
});

module.exports = router;
