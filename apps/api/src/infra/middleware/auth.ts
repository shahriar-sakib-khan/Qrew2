import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import { auth } from '../lib/auth'

/**
 * Hono context variable types.
 * Declaring these here lets TypeScript know what shape
 * c.get('user') and c.get('session') will be throughout
 * the app — no casting needed in route handlers.
 */
export type AuthVariables = {
  user: typeof auth.$Infer.Session.user
  session: typeof auth.$Infer.Session.session
}

/**
 * requireAuth middleware
 *
 * Verifies the session on every request it wraps.
 * Attach this to any route or router that needs authentication.
 *
 * Usage on a single route:
 *   app.get('/me', requireAuth, (c) => { ... })
 *
 * Usage on a group of routes:
 *   const protected = new Hono()
 *   protected.use(requireAuth)
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c: Context, next: Next) => {
    // Ask Better Auth to verify the session from the incoming request.
    // It checks the cookie, validates against Redis/Postgres,
    // and returns the session + user if valid.
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    if (!session) {
      return c.json(
        { error: 'Unauthorized', message: 'Valid session required.' },
        401
      )
    }

    // Attach user and session to context so route handlers
    // can access them via c.get('user') and c.get('session').
    c.set('user', session.user)
    c.set('session', session.session)

    await next()
  }
)
