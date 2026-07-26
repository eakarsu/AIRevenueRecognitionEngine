'use strict';

const jwt = require('jsonwebtoken');
const pool = require('../db');

function secret() {
  const value = String(process.env.JWT_SECRET || '');
  if (value.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return value;
}

async function authenticate(req, res, next) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const claims = jwt.verify(header.slice(7), secret(), {
      issuer: 'revenue-recognition-engine',
    });
    const membership = await pool.query(
      'SELECT role FROM revrec_memberships WHERE tenant_id=$1 AND user_id=$2 AND active=TRUE',
      [claims.tenantId, claims.id],
    );
    if (!membership.rows[0]) {
      return res.status(403).json({ error: 'Active tenant membership required' });
    }
    req.user = { ...claims, role: membership.rows[0].role };
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

const rolePermissions = {
  admin: ['read', 'create', 'update', 'delete', 'export', 'ai_run', 'governance_approve'],
  controller: ['read', 'create', 'update', 'export', 'ai_run', 'governance_approve'],
  revrec_accountant: ['read', 'create', 'update', 'export', 'ai_run'],
  posting_operator: ['read', 'update'],
  auditor: ['read', 'export'],
  viewer: ['read'],
  user: ['read', 'create', 'update'],
};

const requirePermission = (permission) => (req, res, next) => {
  const role = req.user?.role || 'user';
  const allowed = rolePermissions[role] || rolePermissions.user;
  if (!allowed.includes(permission)) {
    return res.status(403).json({ error: `Role ${role} lacks ${permission} permission` });
  }
  return next();
};

module.exports = { authenticate, secret, requirePermission, rolePermissions };
