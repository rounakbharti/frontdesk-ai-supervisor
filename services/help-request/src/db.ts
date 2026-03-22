import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const pool = new Pool({
    user: process.env.POSTGRES_USER || 'admin',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'frontdesk',
    password: process.env.POSTGRES_PASSWORD || 'admin_password',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
});
