'use strict';

const modules = [
  { key: 'document-repository', label: 'Contract Document Repository', category: 'Document Ops', ai: true },
  { key: 'erp-connectors', label: 'ERP Connectors', category: 'Integrations', ai: false },
  { key: 'approval-workflows', label: 'Approval Workflows', category: 'Workflow', ai: true },
  { key: 'period-close', label: 'Period Close Orchestration', category: 'Close Ops', ai: true },
  { key: 'fx-rates', label: 'Multicurrency FX Rates', category: 'Treasury', ai: false },
  { key: 'notifications', label: 'Controller Notifications', category: 'Communications', ai: false },
  { key: 'export-center', label: 'Export Center', category: 'Reporting', ai: false },
  { key: 'permissions', label: 'Roles & Permissions', category: 'Security', ai: false },
  { key: 'live-erp-integrations', label: 'Live ERP Integration Config', category: 'Integrations', ai: true },
  { key: 'notification-delivery', label: 'Notification Delivery', category: 'Communications', ai: true },
  { key: 'rbac-enforcement', label: 'RBAC Enforcement', category: 'Security', ai: true },
  { key: 'file-intelligence', label: 'File Intelligence', category: 'Document Ops', ai: true },
  { key: 'migration-center', label: 'Migration Center', category: 'Platform', ai: false },
  { key: 'background-jobs', label: 'Background Jobs', category: 'Platform', ai: true },
  { key: 'automated-tests', label: 'Automated Tests', category: 'Quality', ai: false },
  { key: 'production-hardening', label: 'Production Hardening', category: 'Platform', ai: true },
  { key: 'ai-governance', label: 'AI Governance', category: 'AI Governance', ai: true },
  { key: 'change-history', label: 'Change History', category: 'Audit', ai: true },
  { key: 'ai-contract-extraction', label: 'AI Contract Extraction', category: 'AI', ai: true },
  { key: 'ai-obligation-identifier', label: 'AI Obligation Identifier', category: 'AI', ai: true },
  { key: 'ai-schedule-generator', label: 'AI Schedule Generator', category: 'AI', ai: true },
  { key: 'ai-disclosure-drafting', label: 'AI Disclosure Drafting', category: 'AI', ai: true },
  { key: 'ai-close-anomalies', label: 'AI Close Anomaly Dashboard', category: 'AI', ai: true },
  { key: 'ai-leakage-monitor', label: 'AI Revenue Leakage Monitor', category: 'AI', ai: true },
  { key: 'ai-approval-risk', label: 'AI Approval Risk Reviewer', category: 'AI', ai: true },
  { key: 'ai-customer-risk', label: 'AI Customer Risk', category: 'AI', ai: true },
  { key: 'ai-evidence-completeness', label: 'AI Evidence Completeness', category: 'AI', ai: true },
];

const owners = ['Revenue Controller', 'Technical Accounting', 'Revenue Operations', 'Finance Systems', 'Audit Manager'];
const statuses = ['Open', 'In Progress', 'Review', 'Approved', 'Exception', 'Queued'];
const priorities = ['High', 'Medium', 'Low', 'Urgent'];
const systems = ['NetSuite', 'SAP', 'Oracle', 'Salesforce', 'Workday', 'Revenue Subledger'];

function seedRows(moduleDef, count = 16) {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      module_key: moduleDef.key,
      reference: `${moduleDef.key.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 18)}-${String(n).padStart(3, '0')}`,
      title: `${moduleDef.label} ${['readiness review', 'exception queue', 'approval task', 'evidence packet', 'controller action'][index % 5]}`,
      category: moduleDef.category,
      status: statuses[index % statuses.length],
      owner: owners[index % owners.length],
      priority: priorities[index % priorities.length],
      due_date: `2026-${String(9 + Math.floor(index / 12)).padStart(2, '0')}-${String(3 + (index % 12)).padStart(2, '0')}`,
      summary: `${moduleDef.label} record for ASC 606 operations, audit readiness, close control, and revenue compliance follow-up.`,
      amount: index % 3 === 0 ? 125000 + index * 17500 : null,
      source_system: systems[index % systems.length],
      risk_level: ['Low', 'Medium', 'High', 'Critical'][index % 4],
      ai_enabled: moduleDef.ai,
      last_action: moduleDef.ai ? 'Ready for AI review' : 'Ready for controller review',
    };
  });
}

module.exports = { modules, seedRows };
