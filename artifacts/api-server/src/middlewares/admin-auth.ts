import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/admin-jwt.js';
import { verifyCsrfToken } from '../utils/admin-csrf.js';

/**
 * The forced "must change password" gate has been removed. New tokens
 * are no longer issued with the `mpc` claim, and admins are never
 * blocked from the panel because of it. The SPA now surfaces an
 * OPTIONAL post-login popup driven by the `defaultCredentials` flag on
 * the admin row, which is sent back with every auth response.
 *
 * This middleware is kept as a no-op shim so any legacy import sites
 * keep compiling. It is safe to delete once all references are gone.
 */
export function enforceMustChangePassword(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  return next();
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Populated by either `authenticateAdmin` (admin-auth-v2) or the legacy
       * `adminAuth` middleware. Includes a denormalised `adminId` alias so
       * legacy callsites that read `req.admin.adminId` keep working.
       */
      admin?: Partial<AccessTokenPayload> & {
        sessionId?: string;
        adminId?: string | null;
        permissions?: string[];
      };
    }
  }
}

/**
 * Authenticate admin requests using JWT bearer token
 * Extracts token from Authorization: Bearer <token> header
 */
export function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  try {
    const payload = verifyAccessToken(token);
    req.admin = payload;
    // The forced `mpc` (must-change-password) gate has been removed. The
    // SPA now drives the OPTIONAL credentials popup via the
    // `defaultCredentials` flag returned with every auth response.
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Invalid or expired token',
      code: 'AUTH_EXPIRED',
    });
    return;
  }
}

/**
 * CSRF protection middleware
 * Validates CSRF tokens for state-changing requests (POST, PUT, DELETE, PATCH)
 * GET, HEAD, OPTIONS requests skip CSRF check
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'] as string;
  const cookieToken = req.cookies.csrf_token as string;

  if (!headerToken || !cookieToken) {
    res.status(403).json({
      error: 'Missing CSRF token',
      code: 'CSRF_MISSING',
    });
    return;
  }

  // Header token should match cookie token (double-submit cookie pattern)
  if (headerToken !== cookieToken) {
    res.status(403).json({
      error: 'CSRF token mismatch',
      code: 'CSRF_INVALID',
    });
    return;
  }

  try {
    verifyCsrfToken(cookieToken);
    next();
  } catch (err) {
    res.status(403).json({
      error: 'Invalid or expired CSRF token',
      code: 'CSRF_EXPIRED',
    });
    return;
  }
}

/**
 * Optional admin check - doesn't fail, just populates req.admin if valid
 */
export function optionalAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token);
      req.admin = payload;
    } catch (err) {
      // Silently fail - continue without auth
    }
  }

  next();
}
