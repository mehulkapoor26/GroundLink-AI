/**
 * Lightweight session identity for GroundLink.
 *
 * The app uses sessionStorage names (no login system), so we derive an
 * identity from a custom header the frontend sends.  This is consistent
 * with the existing architecture where `sessionStorage.getItem('groundlink-name')`
 * is the user's identity.
 */

export function identifyUser(req, res, next) {
  const name = (req.headers['x-groundlink-user'] || '').trim().slice(0, 32);
  req.glUser = name || null;
  next();
}

/**
 * Require that a user identity header is present.
 */
export function requireUser(req, res, next) {
  if (!req.glUser) return res.status(401).json({ error: 'User identity required' });
  next();
}
