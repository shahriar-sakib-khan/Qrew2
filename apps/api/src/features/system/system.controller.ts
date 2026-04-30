import { Context } from 'hono'
import { SystemService } from './system.service'

export const SystemController = {
  async checkHealth(c: Context) {
    const health = await SystemService.getSystemHealth()
    return c.json(health, health.status === 'ok' ? 200 : 503)
  },

  async pingEcho(c: Context<any, any, { out: { json: { message: string } } }>) {
    const body = c.req.valid('json')
    return c.json({ message: `Echoing: ${body.message}` })
  }
}
