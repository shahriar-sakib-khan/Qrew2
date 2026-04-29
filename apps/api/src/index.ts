// apps/api/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

// The moment you import this, Node reads lib/auth.ts, which imports lib/redis.ts
// and @starter/db, triggering all of your environment guards.
import { auth } from './lib/auth';

const app = new Hono();

app.get('/', (c) => {
  return c.text('API is running!');
});

const port = 3001;
console.log(`🚀 API Server is starting on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
