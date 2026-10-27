'use strict';

/* Server-side gate for the builder, dashboard, admin page and the scripts that
   power them. Hiding buttons is not security; these files are simply not sent
   to anyone who is not allowed to have them. See utils/pathGuard.js for which
   paths are covered. */

const { resolveUser } = require('./auth');
const { clearAuthCookie } = require('../utils/token');
const { normalise, classify } = require('../utils/pathGuard');

module.exports = async function pageGate(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const clean = normalise(req.path);
  if (clean === null) return res.status(400).send('Bad request');

  const level = classify(clean);
  if (!level) return next();
  const isPage = clean.endsWith('.html');

  try {
    const { user, reason } = await resolveUser(req);
    res.set('Cache-Control', 'private, no-store');

    if (!user) {
      if (reason !== 'missing') clearAuthCookie(res);
      if (isPage) {
        return res.redirect(302, '/auth.html?next=' + encodeURIComponent(req.originalUrl));
      }
      return res.status(401).type('text/plain').send('Authentication required');
    }
    if (level === 'admin' && user.role !== 'admin') {
      if (isPage) return res.redirect(302, '/dashboard.html');
      return res.status(403).type('text/plain').send('Forbidden');
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};
