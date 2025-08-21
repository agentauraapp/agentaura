// backend/src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { expressjwt } from 'express-jwt';

const useJwks = !!process.env.SUPABASE_JWKS_URL;

let verifier: any;

// RS256 (JWKS)
if (useJwks) {
  verifier = expressjwt({
    algorithms: ['RS256'],
    secret: jwksRsa.expressJwtSecret({
      jwksUri: process.env.SUPABASE_JWKS_URL!,
      cache: true,
      rateLimit: true,
    }),
    audience: undefined,
    issuer: undefined,
    credentialsRequired: true,
  });
} else {
  // HS256
  const secret = process.env.SUPABASE_JWT_SECRET!;
  verifier = (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const payload = jwt.verify(token, secret) as JwtPayload;
      // Supabase puts user id in 'sub'
      (req as any).user = { id: payload.sub };
      return next();
    } catch (e: any) {
      return res.status(401).json({ error: 'Unauthorized', message: e.message });
    }
  };
}

// Final middleware that normalizes req.user for both paths
export function supabaseJwtVerify(req: Request, res: Response, next: NextFunction) {
  if (useJwks) {
    return verifier(req, res, (err?: any) => {
      if (err) return res.status(401).json({ error: 'Unauthorized', message: err.message });
      // express-jwt sets req.auth
      const sub = (req as any).auth?.sub;
      if (!sub) return res.status(401).json({ error: 'Unauthorized' });
      (req as any).user = { id: sub };
      return next();
    });
  }
  return verifier(req, res, next);
}
