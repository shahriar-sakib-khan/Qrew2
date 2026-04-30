import { Hono } from 'hono'
import { auth } from '../../infra/lib/auth'

const authRouter = new Hono()

/**
 * Auth route handler.
 *
 * Proxies all requests on /api/auth/* directly into Better Auth.
 * Better Auth handles everything internally:
 *
 *   POST /api/auth/sign-in/email
 *   POST /api/auth/sign-up/email
 *   POST /api/auth/sign-in/magic-link
 *   POST /api/auth/sign-out
 *   GET  /api/auth/session
 *   GET  /api/auth/callback/:provider   ← OAuth callbacks (Phase 4)
 *   ...and more added automatically by plugins
 *
 * Never add custom logic here — if you need to do something
 * after sign-in (e.g. update lastLoginAt), use Better Auth's
 * hooks in lib/auth.ts instead.
 */
authRouter.on(['GET', 'POST'], '/*', (c) => {
  return auth.handler(c.req.raw)
})

export { authRouter }
