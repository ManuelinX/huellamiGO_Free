import pg from "pg";
import { config } from "./config.js";


const { Pool } = pg;

export const db = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false
});
