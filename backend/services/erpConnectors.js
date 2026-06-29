const axios = require('axios');
const pool = require('../db');

const providerConfigs = {
  netsuite: {
    label: 'NetSuite',
    env: {
      baseUrl: 'NETSUITE_BASE_URL',
      token: 'NETSUITE_ACCESS_TOKEN',
      accountId: 'NETSUITE_ACCOUNT_ID',
      restletScriptId: 'NETSUITE_RESTLET_SCRIPT_ID',
      restletDeployId: 'NETSUITE_RESTLET_DEPLOY_ID',
    },
  },
  sap: {
    label: 'SAP',
    env: {
      baseUrl: 'SAP_ODATA_BASE_URL',
      token: 'SAP_BEARER_TOKEN',
      client: 'SAP_CLIENT',
      companyCode: 'SAP_COMPANY_CODE',
    },
  },
  salesforce: {
    label: 'Salesforce',
    env: {
      baseUrl: 'SALESFORCE_INSTANCE_URL',
      token: 'SALESFORCE_ACCESS_TOKEN',
      apiVersion: 'SALESFORCE_API_VERSION',
    },
  },
};

function providerKeys() {
  return Object.keys(providerConfigs);
}

function getProviderConfig(provider) {
  const key = String(provider || '').toLowerCase();
  const definition = providerConfigs[key];
  if (!definition) return null;
  const values = Object.fromEntries(Object.entries(definition.env).map(([name, envName]) => [name, process.env[envName] || '']));
  const missing = Object.entries(definition.env)
    .filter(([name]) => !values[name])
    .map(([, envName]) => envName);
  return {
    key,
    label: definition.label,
    values,
    missing,
    configured: missing.length === 0,
  };
}

function configuredProviders() {
  return providerKeys().map((key) => {
    const config = getProviderConfig(key);
    return {
      key,
      label: config.label,
      configured: config.configured,
      missing_env: config.missing,
      supported_objects: ['customers', 'contracts', 'invoices', 'revenue_schedules'],
    };
  });
}

function authHeaders(config) {
  if (!config.values.token) return {};
  return { Authorization: `Bearer ${config.values.token}` };
}

function providerEndpoint(config, action) {
  const base = config.values.baseUrl?.replace(/\/+$/, '');
  if (!base) return '';
  if (config.key === 'netsuite') {
    const script = encodeURIComponent(config.values.restletScriptId);
    const deploy = encodeURIComponent(config.values.restletDeployId);
    return `${base}/app/site/hosting/restlet.nl?script=${script}&deploy=${deploy}&action=${action}`;
  }
  if (config.key === 'sap') {
    return `${base}/sap/opu/odata/sap/API_REVENUE_RECOGNITION_SRV/${action}`;
  }
  const version = config.values.apiVersion || 'v60.0';
  return `${base}/services/data/${version}/composite`;
}

async function revenuePayload(limit = 10) {
  const [customers, contracts, invoices, schedules] = await Promise.all([
    pool.query('SELECT * FROM customers ORDER BY id LIMIT $1', [limit]),
    pool.query('SELECT * FROM contracts ORDER BY id LIMIT $1', [limit]),
    pool.query('SELECT * FROM invoices ORDER BY id LIMIT $1', [limit]),
    pool.query('SELECT * FROM revenue_schedules ORDER BY id LIMIT $1', [limit]),
  ]);
  return {
    customers: customers.rows,
    contracts: contracts.rows,
    invoices: invoices.rows,
    revenue_schedules: schedules.rows,
  };
}

function simulatedResult(config, action, payload = {}) {
  return {
    provider: config.key,
    label: config.label,
    mode: 'not_configured',
    status: 'ready_for_credentials',
    action,
    missing_env: config.missing,
    supported_objects: ['customers', 'contracts', 'invoices', 'revenue_schedules'],
    payload_counts: Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])),
    next_steps: [
      `Add ${config.label} connection values to .env.`,
      `Run ${config.label} test connection.`,
      `Run ${config.label} sync and review reconciliation output.`,
    ],
    checked_at: new Date().toISOString(),
  };
}

async function testProvider(provider) {
  const config = getProviderConfig(provider);
  if (!config) {
    const error = new Error('Unsupported ERP provider');
    error.status = 404;
    throw error;
  }
  if (!config.configured) return simulatedResult(config, 'test');
  const endpoint = providerEndpoint(config, 'health');
  try {
    const response = await axios.get(endpoint, { headers: authHeaders(config), timeout: 10000 });
    return {
      provider: config.key,
      label: config.label,
      mode: 'live',
      status: 'connected',
      endpoint,
      response_status: response.status,
      checked_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      provider: config.key,
      label: config.label,
      mode: 'live',
      status: 'failed',
      endpoint,
      error: err.response?.data || err.message,
      checked_at: new Date().toISOString(),
    };
  }
}

async function syncProvider(provider, options = {}) {
  const config = getProviderConfig(provider);
  if (!config) {
    const error = new Error('Unsupported ERP provider');
    error.status = 404;
    throw error;
  }
  const payload = await revenuePayload(options.limit || 10);
  if (!config.configured) return simulatedResult(config, 'sync', payload);
  const endpoint = providerEndpoint(config, 'sync');
  try {
    const response = await axios.post(endpoint, { source: 'AIRevenueRecognitionEngine', payload }, {
      headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
      timeout: 15000,
    });
    return {
      provider: config.key,
      label: config.label,
      mode: 'live',
      status: 'synced',
      endpoint,
      response_status: response.status,
      synced_counts: Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value.length])),
      checked_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      provider: config.key,
      label: config.label,
      mode: 'live',
      status: 'failed',
      endpoint,
      error: err.response?.data || err.message,
      checked_at: new Date().toISOString(),
    };
  }
}

module.exports = {
  configuredProviders,
  getProviderConfig,
  providerKeys,
  syncProvider,
  testProvider,
};
