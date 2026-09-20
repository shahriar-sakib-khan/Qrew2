import { Context } from 'hono'
import { UploadsService } from './uploads.service'
import type { AuthVariables } from '../../infra/middleware/auth'

export const UploadsController = {
  async getAvatarUploadUrl(c: Context<{ Variables: AuthVariables }>) {
    const user = c.get('user')
    const body = c.req.valid('json' as never) as { contentType: string }

    if (!body.contentType.startsWith('image/')) {
      return c.json({ error: 'Invalid file type. Only images are allowed.' }, 400)
    }

    const result = await UploadsService.generatePresignedPut(
      user.id,
      body.contentType
    )

    return c.json(result, 200)
  }
}
