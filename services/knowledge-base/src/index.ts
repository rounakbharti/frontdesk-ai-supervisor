import express from 'express';
import dotenv from 'dotenv';
import { Client } from '@elastic/elasticsearch';

dotenv.config({ path: '../../.env' });

const app = express();
app.use(express.json());

const esClient = new Client({
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200'
});

app.post('/api/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'query is required' });
        }

        const result = await esClient.search({
            index: 'knowledge_base',
            query: {
                match: {
                    question: query
                }
            }
        });

        res.json({
            hits: result.hits.hits.map((h: any) => h._source)
        });
    } catch (error) {
        console.error('[KnowledgeBaseService] Error searching Elasticsearch:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const PORT = process.env.KNOWLEDGE_BASE_SERVICE_PORT || 3002;

async function bootstrap() {
    try {
        await esClient.ping();
        console.log('[KnowledgeBaseService] Successfully Connected to Elasticsearch');
    } catch (err) {
        console.error('[KnowledgeBaseService] Failed to connect to Elasticsearch', err);
    }

    app.listen(PORT, () => {
        console.log(`[KnowledgeBaseService] Online and listening on port ${PORT}`);
    });
}

bootstrap();
