const assert = require('assert');
const { rolePermissions } = require('../middleware/auth');
const { configuredProviders, providerKeys } = require('../services/erpConnectors');

assert(rolePermissions.admin.includes('delete'), 'admin should be able to delete');
assert(rolePermissions.admin.includes('governance_approve'), 'admin should approve AI governance');
assert(rolePermissions.controller.includes('ai_run'), 'controller should run AI');
assert(!rolePermissions.auditor.includes('delete'), 'auditor should not delete');
assert(rolePermissions.auditor.includes('export'), 'auditor should export evidence');
assert.deepStrictEqual(providerKeys().sort(), ['netsuite', 'salesforce', 'sap'].sort(), 'ERP providers should be registered');
assert(configuredProviders().every((provider) => Array.isArray(provider.missing_env)), 'providers should expose missing env metadata');

require('../routes/exports');
require('../routes/featureModules');
require('../routes/integrations');
require('../routes/ops');
require('../routes/systemChat');

console.log('Smoke checks passed.');
