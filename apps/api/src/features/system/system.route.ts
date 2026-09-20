import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { SystemController } from './system.controller'

const systemRouter = new Hono()

systemRouter.get('/health', SystemController.checkHealth)

// Example of strict boundary validation for a future route
systemRouter.post('/ping',
  zValidator('json', z.object({
    message: z.string().min(1).max(100)
  })),
  SystemController.pingEcho
)

export { systemRouter }
