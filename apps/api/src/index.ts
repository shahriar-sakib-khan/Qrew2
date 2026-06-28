import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as apiLogger } from './infra/lib/logger'

// --- Core Middleware ---
import type { AuthVariables } from './infra/middleware/auth'
import { rateLimit } from './infra/middleware/rate-limit'

// --- Feature Routes ---
import { authRouter } from './features/auth/auth.route'
import { systemRouter } from './features/system/system.route'
import { uploadsRouter } from './features/uploads/uploads.route'
import { usersRouter } from './features/users/users.route'
import { workspacesRouter } from './features/workspaces/workspaces.route'
import { orgConfigsRouter } from './features/org-configs/org-configs.route'
import { expenseCategoriesRouter } from './features/expense-categories/expense-categories.route'
import { requisitionsRouter } from './features/requisitions/requisitions.route'
import { expensesRouter } from './features/expenses/expenses.route'
import { walletRouter } from './features/wallet/wallet.route'
import { invoicesRouter } from './features/invoices/invoices.route'
import { invoiceTemplatesRouter } from './features/invoice-templates/invoice-templates.route'
import { adminRouter } from './features/admin/admin.route'
import { superAdminRouter } from './features/super-admin/super-admin.route'

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL is not set.')
}

const app = new Hono<{ Variables: AuthVariables }>()

// ---------------------------------------------------------------
// Global Middleware (The Core)
// ---------------------------------------------------------------
// Custom Pino request logger — replaces hono/logger with structured JSON
app.use('*', async (c, next) => {
  c.set('logger' as any, apiLogger)
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  apiLogger.info(
    { module: 'http', method: c.req.method, path: c.req.path, status: c.res.status, ms },
    `${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`
  )
})
app.use('*', rateLimit(200, 60)) // 200 reqs per minute

app.use(
  '*',
  cors({
    origin: process.env.NEXT_PUBLIC_APP_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
app.route('/api/org-configs', orgConfigsRouter)
app.route('/api/expense-categories', expenseCategoriesRouter)
app.route('/api/requisitions', requisitionsRouter)
app.route('/api/expenses', expensesRouter)
app.route('/api/wallet', walletRouter)
app.route('/api/invoices', invoicesRouter)
app.route('/api/invoice-templates', invoiceTemplatesRouter)
app.route('/api/admin', adminRouter)
app.route('/api/super-admin', superAdminRouter)

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
  apiLogger.error({ module: 'http', err, path: c.req.path, method: c.req.method }, 'Unhandled exception')
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
    apiLogger.info({ module: 'api', port: info.port }, `running on http://localhost:${info.port}`)
    apiLogger.info({ module: 'api', port: info.port }, `health → http://localhost:${info.port}/api/system/health`)
  }
)
