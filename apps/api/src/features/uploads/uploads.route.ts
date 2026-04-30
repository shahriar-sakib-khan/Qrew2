import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { UploadsController } from './uploads.controller'
import { requireAuth } from '../../infra/middleware/auth'

const uploadsRouter = new Hono()

// Block unauthenticated access
uploadsRouter.use('*', requireAuth)

uploadsRouter.post('/presigned-avatar',
  zValidator('json', z.object({
    contentType: z.string()
  })),
  UploadsController.getAvatarUploadUrl
)

export { uploadsRouter }
