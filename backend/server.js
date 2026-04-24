const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const customersRoutes = require('./routes/customers');
const contractsRoutes = require('./routes/contracts');
const performanceObligationsRoutes = require('./routes/performance-obligations');
const revenueSchedulesRoutes = require('./routes/revenue-schedules');
const journalEntriesRoutes = require('./routes/journal-entries');
const invoicesRoutes = require('./routes/invoices');
const auditTrailRoutes = require('./routes/audit-trail');
const reportsRoutes = require('./routes/reports');
const aiRoutes = require('./routes/ai');

app.use('/api/auth', authRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/performance-obligations', performanceObligationsRoutes);
app.use('/api/revenue-schedules', revenueSchedulesRoutes);
app.use('/api/journal-entries', journalEntriesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/audit-trail', auditTrailRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`Revenue Recognition Engine API running on port ${PORT}`);
});

module.exports = app;
