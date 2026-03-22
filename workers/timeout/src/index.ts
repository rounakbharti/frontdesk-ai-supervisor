import { Pool } from 'pg';
import cron from 'node-cron';
import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'admin',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'frontdesk',
    password: process.env.POSTGRES_PASSWORD || 'admin_password',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

const kafka = new Kafka({
    clientId: 'timeout-worker',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});
const producer = kafka.producer();

// Scans DB absolutely every single minute
cron.schedule('* * * * *', async () => {
    console.log('[TimeoutWorker] Scanning for unhandled conversational help requests...');
    try {
        const result = await pool.query(`
            UPDATE help_requests 
            SET status = 'UNRESOLVED', resolved_at = CURRENT_TIMESTAMP
            WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '5 minutes'
            RETURNING id, caller_phone, question;
        `);

        if (result.rowCount && result.rowCount > 0 && producer) {
            console.log(`[TimeoutWorker] Marked ${result.rowCount} abandoned requests as UNRESOLVED.`);
            
            for (const row of result.rows) {
                await producer.send({
                    topic: 'supervisor_timeout',
                    messages: [
                        { key: row.id, value: JSON.stringify(row) }
                    ]
                });
            }
        }
    } catch (err) {
        console.error('[TimeoutWorker] Error during sweep:', err);
    }
});

async function start() {
    await producer.connect();
    console.log('[TimeoutWorker] Initialized Cron job scheduler permanently.');
}

start().catch(console.error);
