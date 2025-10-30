import { Context, Next } from 'hono';
import { Bindings } from '../types/bindings';

/**
 * Authentication middleware for protected routes
 * Checks for ADMIN_TOKEN in Authorization header or query parameter
 */
export async function authMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const adminToken = c.env.ADMIN_TOKEN;

  // Allow access if no admin token is configured (development mode)
  if (!adminToken) {
    console.warn('ADMIN_TOKEN not configured - authentication disabled');
    return next();
  }

  // Check Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === adminToken) {
      return next();
    }
  }

  // Check query parameter (for easier form submission)
  const tokenParam = c.req.query('token');
  if (tokenParam === adminToken) {
    return next();
  }

  // Unauthorized
  return c.json({ error: 'Unauthorized - valid token required' }, 401);
}
