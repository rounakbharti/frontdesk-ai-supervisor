import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const kafka = new Kafka({
    clientId: 'help-request-service',
    brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')]
});

export const kafkaProducer = kafka.producer();
export const kafkaConsumer = kafka.consumer({ groupId: 'help-request-group' });
