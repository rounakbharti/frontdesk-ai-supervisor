import { Kafka } from 'kafkajs';
import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const esClient = new Client({
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200'
});

const kafka = new Kafka({
    clientId: 'kb-indexer',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'kb-indexer-group' });

async function bootstrap() {
    await consumer.connect();
    // Only listen for successfully answered requests to map into Knowledge Base
    await consumer.subscribe({ topic: 'supervisor_answered', fromBeginning: true });

    console.log('[KB-Indexer] Connected and listening for supervisor answers to learn...');

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            if (!message.value) return;
            const data = JSON.parse(message.value.toString());
            
            try {
                await esClient.index({
                    index: 'knowledge_base',
                    document: {
                        question: data.question,
                        answer: data.answer,
                        created_at: new Date().toISOString()
                    }
                });
                console.log(`[KB-Indexer] Successfully vectorized and indexed new QA pair into Elasticsearch!`);
            } catch (err) {
                console.error('[KB-Indexer] Failed to index to ES:', err);
            }
        },
    });
}

bootstrap().catch(console.error);
