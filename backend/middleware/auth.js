const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'revenue-recognition-secret-key-2024';

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const rolePermissions = {
  admin: ['read', 'create', 'update', 'delete', 'export', 'ai_run', 'governance_approve'],
  controller: ['read', 'create', 'update', 'export', 'ai_run'],
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
  next();
};

module.exports = { authenticate, JWT_SECRET, requirePermission, rolePermissions };
