'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { authenticate, secret } = require('./middleware/auth');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
secret();

const origins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!origins.length) throw new Error('ALLOWED_ORIGINS is required');

const app = express();
app.use(helmet());
app.use(cors({
  credentials: true,
  origin: (origin, callback) => (
    !origin || origins.includes(origin)
      ? callback(null, true)
      : callback(new Error('origin not allowed'))
  ),
}));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'governed-revenue-recognition' });
});

// Public authentication routes.
app.use('/api/auth', require('./routes/auth'));

// Authenticated application routes used by the React workspace.
app.use('/api/customers', authenticate, require('./routes/customers'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/performance-obligations', require('./routes/performance-obligations'));
app.use('/api/revenue-schedules', require('./routes/revenue-schedules'));
app.use('/api/journal-entries', require('./routes/journal-entries'));
app.use('/api/invoices', authenticate, require('./routes/invoices'));
app.use('/api/audit-trail', authenticate, require('./routes/audit-trail'));
app.use('/api/reports', authenticate, require('./routes/reports'));
app.use('/api/ai', authenticate, require('./routes/ai'));
app.use('/api/feature-modules', require('./routes/featureModules'));
app.use('/api/system-chat', require('./routes/systemChat'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/custom-views', require('./routes/customViews'));
app.use('/api/ops', require('./routes/ops'));

// Governed revenue endpoints remain separate from the legacy operational views.
app.use('/api/governed-revenue', require('./routes/governedRevenue')(authenticate));
app.use('/api/governed-revenue/ai', authenticate, require('./routes/governedRevenueAi'));

// Readiness routes intentionally mount at /api because they define their own paths.
app.use('/api', authenticate, require('./routes/production-readiness'));

// This must remain last so registered application routes can be reached.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message);
  res.status(error.status || 500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`Governed revenue API listening on ${port}`));

module.exports = app;
