import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

// Local Development: SQLite database connection using better-sqlite3. This is suitable for local development and testing,
// Change the dialect to 'd1/drizzle-orm' and update the connection method when deploying to Cloudflare D1. schema.ts file should remain the same,
// only the connection method changes when deploying to D1.
const sqlite = new Database('local.db')
export const db = drizzle(sqlite, { schema })
