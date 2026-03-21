import express from 'express';
import dotenv from 'dotenv';
import { pool } from './db';
import { redisClient } from './redis';
import { kafkaProducer } from './kafka';

// Load variables from monorepo root
dotenv.config({ path: '../../.env' });

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
