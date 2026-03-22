import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { pool } from './db';
import { redisClient } from './redis';
import { kafkaProducer } from './kafka';

// Load variables from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
app.use(express.json());

app.post('/api/requests', async (req, res) => {
    try {
        const { caller_phone, question, context } = req.body;

        if (!caller_phone || !question) {
            return res.status(400).json({ error: 'caller_phone and question are required' });
        }

        // 1. Transactional Write to Postgres
        const result = await pool.query(
            `INSERT INTO help_requests (caller_phone, question) VALUES ($1, $2) RETURNING id, status, created_at`,
            [caller_phone, question]
        );
        const requestRecord = result.rows[0];

        // 2. Set strict TTL state in Redis (5 min timeout for supervisor)
        await redisClient.setEx(`request:${requestRecord.id}:status`, 300, 'PENDING');

        // 3. Decoupled emit to Kafka Event Bus
        await kafkaProducer.send({
            topic: 'help_requests',
            messages: [
                {
                    key: requestRecord.id,
                    value: JSON.stringify({
                        id: requestRecord.id,
                        caller_phone,
                        question,
                        context,
                        timestamp: requestRecord.created_at
                    })
                }
            ]
        });

        res.status(201).json({
            message: 'Help request initiated successfully',
            request: requestRecord
        });
    } catch (error) {
        console.error('[HelpRequestService] Error creating request:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/requests', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM help_requests ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/supervisor/answer', async (req, res) => {
    try {
        const { help_request_id, question, answer } = req.body;
        
        // Update Help Request Status synchronously
        const updateRes = await pool.query(
            `UPDATE help_requests SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING caller_phone`,
            [help_request_id]
        );
        
        if (updateRes.rowCount === 0) return res.status(404).json({ error: 'Request not found' });
        const caller_phone = updateRes.rows[0].caller_phone;

        // Log the definitive supervisor answer
        await pool.query(
            `INSERT INTO supervisor_responses (help_request_id, answer) VALUES ($1, $2)`,
            [help_request_id, answer]
        );

        // Emit the critical Event Bus notification which triggers the KB Vector Indexer and SMS Worker
        await kafkaProducer.send({
            topic: 'supervisor_answered',
            messages: [{
                key: help_request_id,
                value: JSON.stringify({ help_request_id, question, answer, caller_phone })
            }]
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[HelpRequestService] Error answering request:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const PORT = process.env.HELP_REQUEST_SERVICE_PORT || 3001;

async function bootstrap() {
    console.log('[HelpRequestService] Connecting to backing services...');
    await redisClient.connect();
    await kafkaProducer.connect();
    
    app.listen(PORT, () => {
        console.log(`[HelpRequestService] Online and listening on port ${PORT}`);
    });
}

bootstrap().catch(console.error);
