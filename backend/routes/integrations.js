const express = require('express');
const pool = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { configuredProviders, syncProvider, testProvider } = require('../services/erpConnectors');

const router = express.Router();
router.use(authenticate);

async function audit(req, provider, action, result) {
  try {
    await pool.query(
      `INSERT INTO audit_trail (entity_type, entity_id, action, changes, user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      ['erp_integration', null, action, JSON.stringify({ provider, result }), req.user?.id || null]
    );
  } catch (err) {
    console.error('integration audit:', err.message);
  }
}

router.get('/providers', (_req, res) => {
  res.json({
    providers: configuredProviders(),
    env_help: {
      netsuite: ['NETSUITE_BASE_URL', 'NETSUITE_ACCESS_TOKEN', 'NETSUITE_ACCOUNT_ID', 'NETSUITE_RESTLET_SCRIPT_ID', 'NETSUITE_RESTLET_DEPLOY_ID'],
      sap: ['SAP_ODATA_BASE_URL', 'SAP_BEARER_TOKEN', 'SAP_CLIENT', 'SAP_COMPANY_CODE'],
      salesforce: ['SALESFORCE_INSTANCE_URL', 'SALESFORCE_ACCESS_TOKEN', 'SALESFORCE_API_VERSION'],
    },
  });
});

router.post('/:provider/test', requirePermission('update'), async (req, res) => {
  try {
    const result = await testProvider(req.params.provider);
    await audit(req, req.params.provider, 'ERP_PROVIDER_TEST', result);
    res.json({ success: true, result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:provider/sync', requirePermission('update'), async (req, res) => {
  try {
    const result = await syncProvider(req.params.provider, req.body || {});
    await audit(req, req.params.provider, 'ERP_PROVIDER_SYNC', result);
    res.json({ success: true, result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
