import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const kafka = new Kafka({
    clientId: 'audit-worker',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'admin',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'frontdesk',
    password: process.env.POSTGRES_PASSWORD || 'admin_password',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

const consumer = kafka.consumer({ groupId: 'audit-group' });

async function bootstrap() {
    await consumer.connect();
    // Catch-all pattern for important events to maintain the Audit Trail in Postgres
    await consumer.subscribe({ topic: 'help_requests', fromBeginning: true });
    await consumer.subscribe({ topic: 'supervisor_answered', fromBeginning: true });
    await consumer.subscribe({ topic: 'supervisor_timeout', fromBeginning: true });

    console.log('[AuditWorker] Connected to Kafka and actively auditing events...');

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            if (!message.value) return;
            const payload = JSON.parse(message.value.toString());
            
            try {
                await pool.query(
                    `INSERT INTO audit_logs (entity_type, entity_id, action, payload) VALUES ($1, $2, $3, $4)`,
                    [topic, payload.id || payload.help_request_id || 'UNKNOWN', 'EVENT_RECEIVED', payload]
                );
                console.log(`[AuditWorker] Logged secure event trace from topic: ${topic}`);
            } catch (err) {
                console.error('[AuditWorker] Failed to persist audit log:', err);
            }
        },
    });
}

bootstrap().catch(console.error);
