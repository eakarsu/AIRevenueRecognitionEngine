import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API_BASE = '/api'

const resources = [
  { key: 'customers', label: 'Customers', endpoint: '/customers' },
  { key: 'contracts', label: 'Contracts', endpoint: '/contracts' },
  { key: 'performance-obligations', label: 'Performance Obligations', endpoint: '/performance-obligations' },
  { key: 'revenue-schedules', label: 'Revenue Schedules', endpoint: '/revenue-schedules' },
  { key: 'journal-entries', label: 'Journal Entries', endpoint: '/journal-entries' },
  { key: 'invoices', label: 'Invoices', endpoint: '/invoices' },
  { key: 'audit-trail', label: 'Audit Trail', endpoint: '/audit-trail' },
]

const featureModules = [
  { key: 'document-repository', label: 'Contract Documents', endpoint: '/feature-modules/document-repository', moduleKey: 'document-repository', aiEnabled: true },
  { key: 'erp-connectors', label: 'ERP Connectors', endpoint: '/feature-modules/erp-connectors', moduleKey: 'erp-connectors' },
  { key: 'approval-workflows', label: 'Approval Workflows', endpoint: '/feature-modules/approval-workflows', moduleKey: 'approval-workflows', aiEnabled: true },
  { key: 'period-close', label: 'Period Close', endpoint: '/feature-modules/period-close', moduleKey: 'period-close', aiEnabled: true },
  { key: 'fx-rates', label: 'FX Rates', endpoint: '/feature-modules/fx-rates', moduleKey: 'fx-rates' },
  { key: 'notifications', label: 'Notifications', endpoint: '/feature-modules/notifications', moduleKey: 'notifications' },
  { key: 'export-center', label: 'Export Center', endpoint: '/feature-modules/export-center', moduleKey: 'export-center' },
  { key: 'permissions', label: 'Roles & Permissions', endpoint: '/feature-modules/permissions', moduleKey: 'permissions' },
  { key: 'live-erp-integrations', label: 'Live ERP Integrations', endpoint: '/feature-modules/live-erp-integrations', moduleKey: 'live-erp-integrations', aiEnabled: true },
  { key: 'notification-delivery', label: 'Notification Delivery', endpoint: '/feature-modules/notification-delivery', moduleKey: 'notification-delivery', aiEnabled: true },
  { key: 'rbac-enforcement', label: 'RBAC Enforcement', endpoint: '/feature-modules/rbac-enforcement', moduleKey: 'rbac-enforcement', aiEnabled: true },
  { key: 'file-intelligence', label: 'File Intelligence', endpoint: '/feature-modules/file-intelligence', moduleKey: 'file-intelligence', aiEnabled: true },
  { key: 'migration-center', label: 'Migration Center', endpoint: '/feature-modules/migration-center', moduleKey: 'migration-center' },
  { key: 'background-jobs', label: 'Background Jobs', endpoint: '/feature-modules/background-jobs', moduleKey: 'background-jobs', aiEnabled: true },
  { key: 'automated-tests', label: 'Automated Tests', endpoint: '/feature-modules/automated-tests', moduleKey: 'automated-tests' },
  { key: 'production-hardening', label: 'Production Hardening', endpoint: '/feature-modules/production-hardening', moduleKey: 'production-hardening', aiEnabled: true },
  { key: 'ai-governance', label: 'AI Governance', endpoint: '/feature-modules/ai-governance', moduleKey: 'ai-governance', aiEnabled: true },
  { key: 'change-history', label: 'Change History', endpoint: '/feature-modules/change-history', moduleKey: 'change-history', aiEnabled: true },
  { key: 'ai-contract-extraction', label: 'AI Contract Extraction', endpoint: '/feature-modules/ai-contract-extraction', moduleKey: 'ai-contract-extraction', aiEnabled: true },
  { key: 'ai-obligation-identifier', label: 'AI Obligation Identifier', endpoint: '/feature-modules/ai-obligation-identifier', moduleKey: 'ai-obligation-identifier', aiEnabled: true },
  { key: 'ai-schedule-generator', label: 'AI Schedule Generator', endpoint: '/feature-modules/ai-schedule-generator', moduleKey: 'ai-schedule-generator', aiEnabled: true },
  { key: 'ai-disclosure-drafting', label: 'AI Disclosure Drafting', endpoint: '/feature-modules/ai-disclosure-drafting', moduleKey: 'ai-disclosure-drafting', aiEnabled: true },
  { key: 'ai-close-anomalies', label: 'AI Close Anomalies', endpoint: '/feature-modules/ai-close-anomalies', moduleKey: 'ai-close-anomalies', aiEnabled: true },
  { key: 'ai-leakage-monitor', label: 'AI Leakage Monitor', endpoint: '/feature-modules/ai-leakage-monitor', moduleKey: 'ai-leakage-monitor', aiEnabled: true },
  { key: 'ai-approval-risk', label: 'AI Approval Risk', endpoint: '/feature-modules/ai-approval-risk', moduleKey: 'ai-approval-risk', aiEnabled: true },
  { key: 'ai-customer-risk', label: 'AI Customer Risk', endpoint: '/feature-modules/ai-customer-risk', moduleKey: 'ai-customer-risk', aiEnabled: true },
  { key: 'ai-evidence-completeness', label: 'AI Evidence Completeness', endpoint: '/feature-modules/ai-evidence-completeness', moduleKey: 'ai-evidence-completeness', aiEnabled: true },
]

const allResources = [...resources, ...featureModules]

const readOnlyFields = new Set([
  'id',
  'created_at',
  'updated_at',
  'customer_name',
  'contract_title',
  'contract_number',
])

const longTextFields = new Set([
  'description',
  'notes',
  'payment_terms',
  'changes',
])

const moneyFields = new Set([
  'total_value',
  'standalone_selling_price',
  'allocated_price',
  'recognized_amount',
  'deferred_amount',
  'amount',
  'paid_amount',
])

const dateFields = new Set([
  'start_date',
  'end_date',
  'period_start',
  'period_end',
  'entry_date',
  'issue_date',
  'due_date',
  'created_at',
  'updated_at',
])

const structuredReportFields = new Set([
  'ai_result',
  'external_status',
])

const hiddenDetailFields = new Set([
  'ai_result',
  'file_path',
])

const reports = [
  { key: 'revenue-summary', label: 'Revenue Summary', endpoint: '/reports/revenue-summary' },
  { key: 'compliance-status', label: 'Compliance Status', endpoint: '/reports/compliance-status' },
  { key: 'aging', label: 'Invoice Aging', endpoint: '/reports/aging' },
]

const aiTools = [
  { key: 'compliance-check', label: 'ASC 606 Compliance Check', endpoint: '/ai/compliance-check', payload: { contract: { title: 'Enterprise Cloud Platform License', total_value: 2500000, obligations: ['license', 'support', 'migration'], term: '12 months' } } },
  { key: 'transaction-price-allocation', label: 'Transaction Price Allocation', endpoint: '/ai/transaction-price-allocation', payload: { total_price: 2500000, performance_obligations: [{ obligation: 'License', standalone_selling_price: 1500000 }, { obligation: 'Support', standalone_selling_price: 600000 }, { obligation: 'Migration', standalone_selling_price: 400000 }] } },
  { key: 'variable-consideration', label: 'Variable Consideration', endpoint: '/ai/variable-consideration', payload: { contract_terms: 'SaaS subscription with 10% performance bonus and usage-based overage fees.', variable_elements: ['performance bonus', 'usage overage'] } },
  { key: 'contract-modification', label: 'Contract Modification', endpoint: '/ai/contract-modification', payload: { original_contract: { value: 1800000, term: '12 months' }, modification: { added_services: 'premium support', added_price: 250000 } } },
  { key: 'risk-assessment', label: 'Revenue Risk Assessment', endpoint: '/ai/risk-assessment', payload: { contract: { title: 'Multi-element SaaS arrangement', variable_consideration: true, custom_services: true, credit_rating: 'BBB' } } },
  { key: 'revenue-forecast', label: 'Revenue Forecast', endpoint: '/ai/revenue-forecast', payload: { historical_data: [{ period: '2026-01', revenue: 1200000 }, { period: '2026-02', revenue: 1350000 }, { period: '2026-03', revenue: 1420000 }], forecast_periods: 6 } },
  { key: 'journal-entry-suggestion', label: 'Journal Entry Suggestion', endpoint: '/ai/journal-entry-suggestion', payload: { revenue_event: { contract_value: 900000, recognized_amount: 75000, period: 'June 2026', event: 'monthly recognition' } } },
  { key: 'multi-element-arrangement', label: 'Multi-Element Arrangement', endpoint: '/ai/multi-element-arrangement', payload: { arrangement: { total_value: 3200000, deliverables: ['software license', 'implementation', 'training', 'support'] } } },
  { key: 'customer-credit-analysis', label: 'Customer Credit Analysis', endpoint: '/ai/customer-credit-analysis', payload: { customer: { name: 'Atlas Manufacturing Inc', credit_rating: 'BBB', payment_history: 'mixed', open_ar: 340000 } } },
  { key: 'invoice-anomaly-detection', label: 'Invoice Anomaly Detection', endpoint: '/ai/invoice-anomaly-detection', payload: { invoices: [{ invoice_number: 'INV-1001', amount: 125000, status: 'sent' }, { invoice_number: 'INV-1002', amount: 875000, status: 'overdue' }] } },
  { key: 'revenue-leakage-detection', label: 'Revenue Leakage Detection', endpoint: '/ai/revenue-leakage-detection', payload: { contracts: [{ value: 2500000, status: 'active' }], invoices: [{ amount: 200000, paid_amount: 0 }], revenue_schedules: [{ recognized_amount: 150000, deferred_amount: 350000 }] } },
  { key: 'audit-readiness', label: 'Audit Readiness', endpoint: '/ai/audit-readiness', payload: { company_data: { contracts: 20, revenue_schedules: 25, journal_entries: 25, evidence_status: 'partial' } } },
  { key: 'disclosure-generator', label: 'Disclosure Generator', endpoint: '/ai/disclosure-generator', payload: { revenue_data: { recognized: 12500000, deferred: 4100000 }, contracts_summary: { active_contracts: 14 }, accounting_policies: 'ASC 606 five-step model' } },
  { key: 'ssp-estimator', label: 'SSP Estimator', endpoint: '/ai/ssp-estimator', payload: { product_or_service: 'Premium SaaS support', market_data: 'Enterprise customers pay 15-25% of license value', cost_data: { support_cost: 180000 } } },
  { key: 'period-close', label: 'Period Close Workflow', endpoint: '/ai/period-close', payload: { period: '2026-06' } },
]

function getToken() {
  return localStorage.getItem('revrec_token') || ''
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || data.details || `Request failed with ${response.status}`)
  return data
}

async function downloadFile(path, filename) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API_BASE}${path}`, { headers })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || data.details || `Download failed with ${response.status}`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.features)) return data.features
  return []
}

function currency(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return value ?? ''
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatValue(value) {
  if (value === null || value === undefined) return ''
  const parsed = parseJsonish(value)
  if (parsed !== value && typeof parsed === 'object') return formatValue(parsed)
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString()
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (typeof value === 'object') return Object.entries(value).slice(0, 4).map(([k, v]) => `${titleize(k)}: ${formatValue(v)}`).join(' | ')
  return String(value)
}

function parseJsonish(value) {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text) return value
  const candidates = [
    text,
    text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1],
    text.match(/(\{[\s\S]*\})/)?.[1],
    text.match(/(\[[\s\S]*\])/)?.[1],
  ].filter(Boolean)
  for (const candidate of candidates) {
    try { return JSON.parse(candidate) } catch {}
  }
  return value
}

function normalizeAIValue(value) {
  const parsed = parseJsonish(value)
  if (Array.isArray(parsed)) return parsed.map(normalizeAIValue)
  if (parsed && typeof parsed === 'object') {
    const normalized = Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, normalizeAIValue(item)]))
    if (Object.keys(normalized).length === 1 && typeof normalized.executive_summary === 'object') return normalized.executive_summary
    return normalized
  }
  return parsed
}

function normalizeAIContent(data) {
  const content = data?.analysis || data?.result || data?.ai_result || data
  return normalizeAIValue(content)
}

function hasDetailValue(value) {
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function titleize(value) {
  return String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function recordTitle(row, fallback) {
  return row?.title || row?.name || row?.contract_number || row?.invoice_number || row?.description || `${fallback} #${row?.id || ''}`
}

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function normalizeForSave(form) {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => {
    if (readOnlyFields.has(key)) return [key, value]
    if (value === '') return [key, null]
    if (moneyFields.has(key) || ['customer_id', 'contract_id', 'entity_id', 'user_id', 'satisfaction_progress'].includes(key)) {
      const n = Number(value)
      return [key, Number.isFinite(n) ? n : value]
    }
    return [key, value]
  }))
}

function editableEntries(row) {
  return Object.entries(row || {}).filter(([key, value]) => !readOnlyFields.has(key) && !structuredReportFields.has(key) && typeof value !== 'object')
}

function defaultNewRecord(resource) {
  const today = new Date().toISOString().slice(0, 10)
  if (resource.moduleKey) {
    return {
      reference: `${resource.key.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 18)}-${Date.now().toString().slice(-5)}`,
      title: `New ${resource.label} Record`,
      category: resource.aiEnabled ? 'AI' : 'Operations',
      status: 'Open',
      owner: 'Revenue Controller',
      priority: 'Medium',
      due_date: today,
      summary: `New ${resource.label} item for ASC 606 operations.`,
      amount: '',
      source_system: 'Revenue Subledger',
      risk_level: 'Medium',
      ai_enabled: Boolean(resource.aiEnabled),
      last_action: 'Created from application',
    }
  }
  const defaults = {
    customers: { name: 'New Customer', industry: 'Technology', contact_email: 'customer@example.com', contact_phone: '555-0100', address: '100 Revenue Way', credit_rating: 'A' },
    contracts: { customer_id: 1, contract_number: `CTR-${Date.now().toString().slice(-6)}`, title: 'New Revenue Contract', description: 'Contract created from application.', start_date: today, end_date: today, total_value: 100000, status: 'draft', payment_terms: 'Net 30' },
    'performance-obligations': { contract_id: 1, description: 'New performance obligation', standalone_selling_price: 50000, allocated_price: 50000, satisfaction_method: 'over_time', satisfaction_progress: 0, status: 'pending', start_date: today, end_date: today },
    'revenue-schedules': { contract_id: 1, period_start: today, period_end: today, recognized_amount: 0, deferred_amount: 0, status: 'scheduled', notes: 'Created from application.' },
    'journal-entries': { entry_date: today, description: 'New revenue recognition entry', debit_account: 'Deferred Revenue', credit_account: 'Revenue', amount: 1000, contract_id: 1, status: 'draft', created_by: 'admin@revrec.com' },
    invoices: { contract_id: 1, invoice_number: `INV-${Date.now().toString().slice(-6)}`, issue_date: today, due_date: today, amount: 1000, paid_amount: 0, status: 'draft' },
    'audit-trail': { entity_type: 'manual', entity_id: 1, action: 'CREATE', changes: { source: 'manual entry' }, user_id: 1 },
  }
  return defaults[resource.key] || {}
}

function AIReport({ data }) {
  if (!data) return null
  const content = normalizeAIContent(data)
  if (typeof content === 'string') return <div className="ai-report"><p>{content}</p></div>
  const entries = Object.entries(content || {})
  return (
    <div className="ai-report">
      <div className="ai-heading">
        <span>AI Analysis Report</span>
        {data.raw_response && <small>OpenRouter response parsed into report sections</small>}
      </div>
      <div className="ai-grid">
        {entries.map(([key, value]) => (
          <section key={key}>
            <h4>{titleize(key)}</h4>
            {Array.isArray(value) ? (
              <div className="list-stack">
                {value.map((item, index) => <div className="mini-card" key={index}><AIValue value={item} /></div>)}
              </div>
            ) : typeof value === 'object' && value !== null ? (
              <AIValue value={value} />
            ) : (
              <p>{formatValue(value)}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

function AIValue({ value }) {
  const normalized = normalizeAIValue(value)
  if (Array.isArray(normalized)) {
    return (
      <div className="list-stack">
        {normalized.map((item, index) => <div className="mini-card" key={index}><AIValue value={item} /></div>)}
      </div>
    )
  }
  if (normalized && typeof normalized === 'object') {
    return (
      <dl>
        {Object.entries(normalized).map(([key, item]) => (
          <React.Fragment key={key}>
            <dt>{titleize(key)}</dt>
            <dd>{typeof item === 'object' && item !== null ? <AIValue value={item} /> : formatValue(item)}</dd>
          </React.Fragment>
        ))}
      </dl>
    )
  }
  return <>{formatValue(normalized)}</>
}

function ChatPreview({ data }) {
  if (!data) return null
  if (data.download) {
    return (
      <div className="chat-preview">
        <button className="download-chip" onClick={() => downloadFile(data.download.path.replace(/^\/api/, ''), data.download.filename)}>
          Download {data.download.filename}
        </button>
      </div>
    )
  }
  if (data.analysis || data.result || data.executive_summary) return <AIReport data={data.analysis ? data : { analysis: data }} />
  const rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data) ? data : null
  if (rows) {
    return (
      <div className="chat-preview">
        <strong>{data.total ?? rows.length} records</strong>
        {rows.slice(0, 5).map((row, index) => (
          <div key={row.id || index}>{recordTitle(row, 'Record')}</div>
        ))}
      </div>
    )
  }
  if (data.record) {
    return (
      <div className="chat-preview">
        <strong>{recordTitle(data.record, 'Record')}</strong>
        <div>{formatValue(data.record)}</div>
      </div>
    )
  }
  if (typeof data === 'object') {
    return (
      <div className="chat-preview">
        {Object.entries(data).slice(0, 6).map(([key, value]) => (
          <div key={key}><strong>{titleize(key)}:</strong> {formatValue(value)}</div>
        ))}
      </div>
    )
  }
  return null
}

const chatPromptGroups = [
  {
    label: 'Navigate & Read',
    prompts: [
      'Show dashboard counts',
      'List contracts',
      'List invoices',
      'Show outstanding AR',
      'What is deferred revenue?',
    ],
  },
  {
    label: 'Create Records',
    prompts: [
      'Create contract for new SaaS customer',
      'Create invoice for delayed billing review',
      'Create notification for delayed approval',
      'Create approval workflow for revenue exception',
    ],
  },
  {
    label: 'Run AI',
    prompts: [
      'Run revenue forecast',
      'Run audit readiness',
      'Run AI review on contract documents',
      'Run AI review on evidence completeness',
      'Run AI review on approval workflows',
      'Run file intelligence',
      'Show AI governance metrics',
    ],
  },
  {
    label: 'Operations',
    prompts: [
      'Test ERP connector',
      'Run ERP sync',
      'Test NetSuite connection',
      'Test SAP connection',
      'Test Salesforce connection',
      'Sync NetSuite',
      'Sync SAP',
      'Sync Salesforce',
      'Send first notification',
      'Run background job',
      'Show configuration readiness',
      'Export backup',
      'Approve first approval workflow',
      'Route first approval workflow to exception',
      'Export contracts csv',
      'Export audit package',
      'Export audit binder PDF',
    ],
  },
]

function SystemChat({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Ask me to control this app: list records, create items, update statuses, run AI tools, or answer revenue questions.' },
  ])

  async function send(textOverride) {
    const text = (textOverride || input).trim()
    if (!text || busy) return
    setOpen(true)
    setInput('')
    setBusy(true)
    setMessages(current => [...current, { role: 'user', content: text }])
    try {
      const result = await request('/system-chat/message', { method: 'POST', body: JSON.stringify({ message: text }) })
      if (result.view) onNavigate(result.view)
      setMessages(current => [...current, { role: 'assistant', content: result.reply, action: result.action, data: result.data }])
    } catch (err) {
      setMessages(current => [...current, { role: 'assistant', content: `Chat request failed: ${err.message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="system-chat">
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div><strong>System Chat</strong><span>Controls pages, APIs, records, and AI tools</span></div>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
          <div className="chat-prompts">
            {chatPromptGroups.map(group => (
              <section key={group.label}>
                <span>{group.label}</span>
                <div>
                  {group.prompts.map(prompt => <button key={prompt} onClick={() => send(prompt)} disabled={busy}>{prompt}</button>)}
                </div>
              </section>
            ))}
          </div>
          <div className="chat-body">
            {messages.map((message, index) => (
              <div key={index} className={`chat-message ${message.role}`}>
                <p>{message.content}</p>
                {message.action && <small>{titleize(message.action)}</small>}
                {message.data && <ChatPreview data={message.data} />}
              </div>
            ))}
            {busy && <div className="chat-message assistant"><p>Calling app APIs...</p></div>}
          </div>
          <div className="chat-input-row">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Type any command, or use a prompt above..."
            />
            <button onClick={() => send()} disabled={busy || !input.trim()}>Send</button>
          </div>
        </div>
      )}
      <button className="chat-fab" onClick={() => setOpen(value => !value)}>{open ? '×' : 'AI'}</button>
    </div>
  )
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@revrec.com')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      localStorage.setItem('revrec_token', data.token)
      localStorage.setItem('revrec_user', JSON.stringify(data.user))
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark">ASC 606</div>
        <h1>AI Revenue Recognition Engine</h1>
        <p>Contract revenue, performance obligations, schedules, journal entries, and audit-ready AI analysis.</p>
        {error && <div className="error">{error}</div>}
        <label>Email<input value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        <small>Default login: admin@revrec.com / password123</small>
      </form>
    </div>
  )
}

function Dashboard({ setView }) {
  const [summary, setSummary] = useState(null)
  const [compliance, setCompliance] = useState(null)
  const [aging, setAging] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      request('/reports/revenue-summary'),
      request('/reports/compliance-status'),
      request('/reports/aging'),
    ]).then(([s, c, a]) => { setSummary(s); setCompliance(c); setAging(a) }).catch(err => setError(err.message))
  }, [])

  return (
    <main className="content">
      <div className="page-title">
        <div><h1>Revenue Command Center</h1><p>ASC 606 revenue recognition status across contracts, schedules, invoices, and audit workflows.</p></div>
        <button onClick={() => setView('ai')}>Run AI Tools</button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="metric-grid">
        <Metric label="Recognized Revenue" value={currency(summary?.total_recognized)} />
        <Metric label="Deferred Revenue" value={currency(summary?.total_deferred)} />
        <Metric label="Active Contracts" value={compliance?.active_contracts ?? '-'} />
        <Metric label="Compliance Rate" value={`${compliance?.compliance_rate ?? '-'}%`} />
        <Metric label="Outstanding AR" value={currency(aging?.total_outstanding)} />
      </div>
      <div className="two-col">
        <Panel title="Revenue By Period" rows={summary?.by_period || []} />
        <Panel title="Contract Summary" rows={summary?.contract_summary || []} />
      </div>
    </main>
  )
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

function Panel({ title, rows }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <div className="list-stack">
        {rows.slice(0, 8).map((row, index) => <div className="mini-card" key={index}>{formatValue(row)}</div>)}
      </div>
    </section>
  )
}

function DataPage({ resource }) {
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError('')
    request(resource.endpoint)
      .then(data => setRows(normalizeRows(data)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [resource.endpoint])

  const columns = useMemo(() => Array.from(new Set(rows.flatMap(row => Object.keys(row || {})))).slice(0, 8), [rows])

  function replaceRow(updated) {
    setRows(current => current.map(row => row.id === updated.id ? { ...row, ...updated } : row))
    setSelected(updated)
  }

  function removeRow(deletedId) {
    setRows(current => current.filter(row => row.id !== deletedId))
    setSelected(null)
  }

  function addRow(created) {
    setRows(current => [created, ...current])
    setCreating(false)
    setSelected(created)
  }

  async function uploadDocument(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('title', file.name)
      body.append('summary', `Uploaded evidence file ${file.name}`)
      const created = await request('/feature-modules/document-repository/upload', { method: 'POST', body })
      addRow(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function exportResource(path, filename) {
    setError('')
    try {
      await downloadFile(path, filename)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="content">
      <div className="page-title">
        <div><h1>{resource.label}</h1><p>{rows.length} records loaded from PostgreSQL.</p></div>
        <div className="page-actions">
          {resource.key === 'document-repository' && (
            <label className="file-action">
              {uploading ? 'Uploading...' : 'Upload Document'}
              <input type="file" onChange={uploadDocument} disabled={uploading} />
            </label>
          )}
          {resource.key === 'export-center' && (
            <>
              <button onClick={() => exportResource('/exports/audit-package', 'revrec-audit-package.json')}>Audit Package</button>
              <button onClick={() => exportResource('/exports/audit-binder.pdf', 'revrec-audit-binder.pdf')}>Audit Binder PDF</button>
              <button onClick={() => exportResource('/exports/csv/contracts', 'contracts.csv')}>Contracts CSV</button>
              <button onClick={() => exportResource('/exports/csv/invoices', 'invoices.csv')}>Invoices CSV</button>
            </>
          )}
          <button onClick={() => setCreating(true)}>New {resource.label}</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {loading ? <div className="panel">Loading...</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr>{columns.map(col => <th key={col}>{titleize(col)}</th>)}</tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id || JSON.stringify(row)} onClick={() => setSelected(row)}>
                  {columns.map(col => <td key={col}>{formatValue(row[col])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <DetailModal
          resource={resource}
          row={selected}
          onClose={() => setSelected(null)}
          onSave={replaceRow}
          onDelete={removeRow}
        />
      )}
      {creating && (
        <CreateRecordModal
          resource={resource}
          onClose={() => setCreating(false)}
          onCreate={addRow}
        />
      )}
    </main>
  )
}

function ReportsPage() {
  const [active, setActive] = useState(reports[0])
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    setData(null)
    request(active.endpoint).then(setData).catch(err => setError(err.message))
  }, [active])

  return (
    <main className="content">
      <div className="page-title"><div><h1>Reports</h1><p>Revenue summary, compliance status, and invoice aging.</p></div></div>
      <div className="tabs">{reports.map(r => <button className={active.key === r.key ? 'active' : ''} onClick={() => setActive(r)} key={r.key}>{r.label}</button>)}</div>
      {error && <div className="error">{error}</div>}
      <AIReport data={data || {}} />
    </main>
  )
}

function AIToolsPage() {
  const [active, setActive] = useState(aiTools[0])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run(tool = active) {
    setActive(tool)
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await request(tool.endpoint, { method: 'POST', body: JSON.stringify(tool.payload) })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="content">
      <div className="page-title"><div><h1>AI Workbench</h1><p>Run ASC 606 AI analysis using seeded revenue data examples.</p></div><button onClick={() => run()} disabled={loading}>{loading ? 'Running...' : `Run ${active.label}`}</button></div>
      <div className="tool-grid">
        {aiTools.map(tool => <button className={active.key === tool.key ? 'tool active' : 'tool'} key={tool.key} onClick={() => setActive(tool)}>{tool.label}</button>)}
      </div>
      {error && <div className="error">{error}</div>}
      {result && <AIReport data={result} />}
    </main>
  )
}

function DetailModal({ resource, row, onClose, onSave, onDelete }) {
  const [mode, setMode] = useState('view')
  const [form, setForm] = useState(row)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [aiResult, setAiResult] = useState(row.ai_result || null)
  const title = recordTitle(row, resource.label)
  const detailEntries = Object.entries(row).filter(([key, value]) => !hiddenDetailFields.has(key) && hasDetailValue(value))
  const editable = editableEntries(row)

  useEffect(() => {
    setForm(row)
    setMode('view')
    setError('')
    setAiResult(row.ai_result || null)
  }, [row])

  function updateField(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const updated = await request(`${resource.endpoint}/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify(normalizeForSave(form)),
      })
      onSave(updated)
      setMode('view')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteRecord() {
    const confirmed = window.confirm(`Delete ${title}? This cannot be undone.`)
    if (!confirmed) return
    setBusy(true)
    setError('')
    try {
      await request(`${resource.endpoint}/${row.id}`, { method: 'DELETE' })
      onDelete(row.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function runAiReview() {
    setBusy(true)
    setError('')
    try {
      const result = await request(`/feature-modules/${resource.moduleKey}/${row.id}/run`, { method: 'POST', body: JSON.stringify({}) })
      setAiResult(result.analysis)
      onSave(result.record)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function transition(status, approvalStep) {
    setBusy(true)
    setError('')
    try {
      const updated = await request(`/feature-modules/${resource.moduleKey}/${row.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, approval_step: approvalStep }),
      })
      onSave(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function testConnector(provider = null) {
    setBusy(true)
    setError('')
    try {
      const result = provider
        ? await request(`/integrations/${provider}/test`, { method: 'POST', body: JSON.stringify({}) })
        : await request(`/feature-modules/erp-connectors/${row.id}/test`, { method: 'POST', body: JSON.stringify({}) })
      if (result.record) onSave(result.record)
      setAiResult({
        executive_summary: provider ? `${titleize(provider)} connection test ${result.result.status}.` : `Connector test completed for ${row.reference || title}.`,
        key_findings: provider ? [`Mode: ${result.result.mode}`, `Status: ${result.result.status}`] : result.health.tested_endpoints.map(endpoint => `${titleize(endpoint)} endpoint reachable`),
        recommended_actions: provider && result.result.missing_env ? [`Configure ${result.result.missing_env.join(', ')} in .env.`] : [result.health?.recommendation || 'Review connector result.'],
        connector_health: result.health || result.result,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function syncConnector(provider = null) {
    setBusy(true)
    setError('')
    try {
      const result = provider
        ? await request(`/integrations/${provider}/sync`, { method: 'POST', body: JSON.stringify({}) })
        : await request(`/feature-modules/erp-connectors/${row.id}/sync`, { method: 'POST', body: JSON.stringify({}) })
      if (result.record) onSave(result.record)
      const sync = result.sync || result.result
      setAiResult({
        executive_summary: `${sync.label || 'ERP'} sync ${sync.status}.`,
        sync_result: sync,
        recommended_actions: sync.mode === 'not_configured' || sync.mode === 'simulated'
          ? [`Configure ${(sync.missing_env || sync.required_env || ['provider credentials']).join(', ')} in .env for live sync.`]
          : ['Review sync result and reconcile changed records.'],
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendNotification() {
    setBusy(true)
    setError('')
    try {
      const result = await request(`/feature-modules/notifications/${row.id}/send`, { method: 'POST', body: JSON.stringify({}) })
      onSave(result.record)
      setAiResult({
        executive_summary: `Notification delivery ${result.delivery.status}.`,
        delivery_result: result.delivery,
        recommended_actions: result.delivery.mode === 'simulated'
          ? ['Configure NOTIFICATION_WEBHOOK_URL or SLACK_WEBHOOK_URL in .env for live delivery.']
          : ['Confirm recipients received the alert and close the notification task.'],
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function runFileIntelligence() {
    setBusy(true)
    setError('')
    try {
      const result = await request(`/feature-modules/document-repository/${row.id}/intelligence`, { method: 'POST', body: JSON.stringify({}) })
      onSave(result.record)
      setAiResult({
        executive_summary: 'File intelligence completed.',
        ...result.intelligence,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function governanceReview() {
    setBusy(true)
    setError('')
    try {
      const result = await request(`/feature-modules/${resource.moduleKey}/${row.id}/governance-review`, { method: 'POST', body: JSON.stringify({}) })
      onSave(result.record)
      setAiResult({
        executive_summary: 'AI governance review completed.',
        governance: result.governance,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function downloadDocument() {
    setBusy(true)
    setError('')
    try {
      await downloadFile(`/feature-modules/document-repository/${row.id}/download`, row.file_name || `${title}.download`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-kicker">{resource.label}</div>
            <h2>{title}</h2>
            <p>{mode === 'edit' ? 'Update the record fields below, then save changes.' : 'Review the complete record details from PostgreSQL.'}</p>
          </div>
          <button className="icon-close" onClick={onClose}>Close</button>
        </div>
        {error && <div className="error">{error}</div>}
        {mode === 'view' ? (
          <>
            <div className="record-summary">
              <div><span>Record ID</span><strong>{row.id || '-'}</strong></div>
              <div><span>Status</span><strong>{row.status || row.action || 'Available'}</strong></div>
              <div><span>Primary Value</span><strong>{currency(row.total_value || row.amount || row.recognized_amount || row.allocated_price || 0)}</strong></div>
            </div>
            <div className="detail-card-grid">
              {detailEntries.map(([key, value]) => (
                <div className={longTextFields.has(key) || typeof value === 'object' ? 'detail-card wide' : 'detail-card'} key={key}>
                  <span>{titleize(key)}</span>
                  <strong>{formatValue(value) || '-'}</strong>
                </div>
              ))}
            </div>
            {aiResult && <div className="modal-ai-section"><AIReport data={{ analysis: aiResult }} /></div>}
            {resource.moduleKey && (
              <div className="context-actions">
                {resource.key === 'document-repository' && row.file_name && <button onClick={downloadDocument} disabled={busy}>Download File</button>}
                {resource.key === 'document-repository' && <button onClick={runFileIntelligence} disabled={busy}>{busy ? 'Analyzing...' : 'Analyze File'}</button>}
                {resource.key === 'erp-connectors' && <button onClick={() => testConnector()} disabled={busy}>{busy ? 'Testing...' : 'Test Connector'}</button>}
                {resource.key === 'erp-connectors' && <button onClick={() => syncConnector()} disabled={busy}>{busy ? 'Syncing...' : 'Run ERP Sync'}</button>}
                {(resource.key === 'erp-connectors' || resource.key === 'live-erp-integrations') && <button onClick={() => testConnector('netsuite')} disabled={busy}>Test NetSuite</button>}
                {(resource.key === 'erp-connectors' || resource.key === 'live-erp-integrations') && <button onClick={() => syncConnector('netsuite')} disabled={busy}>Sync NetSuite</button>}
                {(resource.key === 'erp-connectors' || resource.key === 'live-erp-integrations') && <button onClick={() => testConnector('sap')} disabled={busy}>Test SAP</button>}
                {(resource.key === 'erp-connectors' || resource.key === 'live-erp-integrations') && <button onClick={() => syncConnector('sap')} disabled={busy}>Sync SAP</button>}
                {(resource.key === 'erp-connectors' || resource.key === 'live-erp-integrations') && <button onClick={() => testConnector('salesforce')} disabled={busy}>Test Salesforce</button>}
                {(resource.key === 'erp-connectors' || resource.key === 'live-erp-integrations') && <button onClick={() => syncConnector('salesforce')} disabled={busy}>Sync Salesforce</button>}
                {resource.key === 'live-erp-integrations' && <button onClick={() => syncConnector()} disabled={busy}>{busy ? 'Syncing...' : 'Run ERP Sync'}</button>}
                {resource.key === 'notifications' && <button onClick={sendNotification} disabled={busy}>{busy ? 'Sending...' : 'Send Notification'}</button>}
                {resource.key === 'notification-delivery' && <button onClick={sendNotification} disabled={busy}>{busy ? 'Sending...' : 'Send Notification'}</button>}
                {resource.key === 'ai-governance' && <button onClick={governanceReview} disabled={busy}>{busy ? 'Reviewing...' : 'Approve Governance'}</button>}
                {resource.key === 'approval-workflows' && (
                  <>
                    <button onClick={() => transition('Review', 'Submitted for review')} disabled={busy}>Submit Review</button>
                    <button onClick={() => transition('Approved', 'Controller approved')} disabled={busy}>Approve</button>
                    <button onClick={() => transition('Exception', 'Exception routed')} disabled={busy}>Route Exception</button>
                  </>
                )}
              </div>
            )}
            <div className="modal-actions">
              <button className="secondary-action" onClick={onClose}>Cancel</button>
              <button className="danger-action" onClick={deleteRecord} disabled={busy}>Delete</button>
              {resource.aiEnabled && <button className="secondary-action" onClick={runAiReview} disabled={busy}>{busy ? 'Running AI...' : 'Run AI Review'}</button>}
              <button className="primary-action" onClick={() => setMode('edit')}>Edit</button>
            </div>
          </>
        ) : (
          <>
            <div className="edit-form-grid">
              {editable.map(([key, value]) => (
                <label className={longTextFields.has(key) ? 'wide' : ''} key={key}>
                  <span>{titleize(key)}</span>
                  {longTextFields.has(key) ? (
                    <textarea value={form[key] ?? ''} onChange={e => updateField(key, e.target.value)} />
                  ) : (
                    <input
                      type={dateFields.has(key) ? 'date' : moneyFields.has(key) || ['customer_id', 'contract_id', 'entity_id', 'user_id', 'satisfaction_progress'].includes(key) ? 'number' : 'text'}
                      step={moneyFields.has(key) ? '0.01' : undefined}
                      value={dateFields.has(key) ? toDateInput(form[key]) : form[key] ?? ''}
                      onChange={e => updateField(key, e.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="readonly-strip">
              {detailEntries.filter(([key]) => readOnlyFields.has(key)).map(([key, value]) => (
                <div key={key}><span>{titleize(key)}</span><strong>{formatValue(value) || '-'}</strong></div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="secondary-action" onClick={() => { setForm(row); setMode('view'); setError('') }} disabled={busy}>Cancel</button>
              <button className="danger-action" onClick={deleteRecord} disabled={busy}>Delete</button>
              <button className="primary-action" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CreateRecordModal({ resource, onClose, onCreate }) {
  const initial = useMemo(() => defaultNewRecord(resource), [resource])
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editable = editableEntries(form)

  function updateField(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function create() {
    setBusy(true)
    setError('')
    try {
      const created = await request(resource.endpoint, {
        method: 'POST',
        body: JSON.stringify(normalizeForSave(form)),
      })
      onCreate(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-kicker">New Record</div>
            <h2>Create {resource.label}</h2>
            <p>Fill the key fields below. You can edit the complete record after it is created.</p>
          </div>
          <button className="icon-close" onClick={onClose}>Close</button>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="edit-form-grid">
          {editable.map(([key]) => (
            <label className={longTextFields.has(key) ? 'wide' : ''} key={key}>
              <span>{titleize(key)}</span>
              {longTextFields.has(key) ? (
                <textarea value={form[key] ?? ''} onChange={e => updateField(key, e.target.value)} />
              ) : (
                <input
                  type={dateFields.has(key) ? 'date' : moneyFields.has(key) || ['customer_id', 'contract_id', 'entity_id', 'user_id', 'satisfaction_progress'].includes(key) ? 'number' : 'text'}
                  step={moneyFields.has(key) ? '0.01' : undefined}
                  value={dateFields.has(key) ? toDateInput(form[key]) : form[key] ?? ''}
                  onChange={e => updateField(key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button className="secondary-action" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="primary-action" onClick={create} disabled={busy}>{busy ? 'Creating...' : 'Create Record'}</button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('revrec_user') || 'null') } catch { return null }
  })
  const [view, setView] = useState('dashboard')

  if (!user || !getToken()) return <Login onLogin={setUser} />

  const currentResource = allResources.find(r => r.key === view)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><strong>RevRec AI</strong><span>ASC 606 Platform</span></div>
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
        <div className="sidebar-section">Core Revenue</div>
        {resources.map(r => <button className={view === r.key ? 'active' : ''} onClick={() => setView(r.key)} key={r.key}>{r.label}</button>)}
        <div className="sidebar-section">Operations</div>
        {featureModules.filter(r => !r.aiEnabled).map(r => <button className={view === r.key ? 'active' : ''} onClick={() => setView(r.key)} key={r.key}>{r.label}</button>)}
        <div className="sidebar-section">AI Modules</div>
        {featureModules.filter(r => r.aiEnabled).map(r => <button className={view === r.key ? 'active' : ''} onClick={() => setView(r.key)} key={r.key}>{r.label}</button>)}
        <div className="sidebar-section">Analysis</div>
        <button className={view === 'reports' ? 'active' : ''} onClick={() => setView('reports')}>Reports</button>
        <button className={view === 'ai' ? 'active' : ''} onClick={() => setView('ai')}>AI Workbench</button>
        <button className="logout" onClick={() => { localStorage.removeItem('revrec_token'); localStorage.removeItem('revrec_user'); setUser(null) }}>Logout</button>
      </aside>
      {view === 'dashboard' && <Dashboard setView={setView} />}
      {currentResource && <DataPage resource={currentResource} />}
      {view === 'reports' && <ReportsPage />}
      {view === 'ai' && <AIToolsPage />}
      <SystemChat onNavigate={setView} />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
