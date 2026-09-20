import { db } from './src/index';
import { sql } from 'drizzle-orm';
db.execute(sql`ALTER TYPE entity_type ADD VALUE 'staff'`)
  .then(() => { console.log('done'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
