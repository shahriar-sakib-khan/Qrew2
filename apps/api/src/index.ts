import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

// --- Core Middleware ---
import type { AuthVariables } from './infra/middleware/auth'
import { rateLimit } from './infra/middleware/rate-limit'

// --- Feature Routes ---
import { authRouter } from './features/auth/auth.route'
import { systemRouter } from './features/system/system.route'
import { uploadsRouter } from './features/uploads/uploads.route'
import { usersRouter } from './features/users/users.route'
import { workspacesRouter } from './features/workspaces/workspaces.route'

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL is not set.')
}

const app = new Hono<{ Variables: AuthVariables }>()

// ---------------------------------------------------------------
// Global Middleware (The Core)
// ---------------------------------------------------------------
app.use('*', logger())
app.use('*', rateLimit(200, 60)) // 200 reqs per minute

app.use(
  '*',
  cors({
    origin: process.env.NEXT_PUBLIC_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
)

// ---------------------------------------------------------------
// Feature Modules (Vertical Slices)
// ---------------------------------------------------------------
app.route('/api/system', systemRouter)
app.route('/api/auth', authRouter)
app.route('/api/uploads', uploadsRouter)
app.route('/api/users', usersRouter)
app.route('/api/workspaces', workspacesRouter)

// ---------------------------------------------------------------
// Fallbacks & Error Handling
// ---------------------------------------------------------------
app.notFound((c) => {
  return c.json(
    { error: 'Not Found', message: `${c.req.method} ${c.req.path} does not exist.` },
    404
  )
})

app.onError((err, c) => {
  console.error('[error]', err)
  const isDev = process.env.NODE_ENV === 'development'

  return c.json(
    {
      error: 'Internal Server Error',
      message: isDev ? err.message : 'Something went wrong.',
    },
    500
  )
})

// ---------------------------------------------------------------
// Server Initialization
// ---------------------------------------------------------------
const PORT = Number(process.env.PORT ?? 3001)

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`[api] running on http://localhost:${info.port}`)
    console.log(`[api] health → http://localhost:${info.port}/api/system/health`)
  }
)
