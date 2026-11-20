import type { CookieOptions, Request, Response } from 'express';
import { SESSION_COOKIE, SESSION_TTL_MS } from './auth.constants.js';

function baseOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}

/** Pose le cookie de session : HttpOnly, SameSite=Lax, Secure en production, 7 jours. */
export function setSessionCookie(res: Response, token: string, secure: boolean) {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(secure), maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res: Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE, baseOptions(secure));
}

export function readSessionToken(req: Request): string | undefined {
  const value: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
