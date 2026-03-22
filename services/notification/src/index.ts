import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const kafka = new Kafka({
    clientId: 'notification-service',
    brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')]
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

async function bootstrap() {
    await consumer.connect();
    console.log('[NotificationService] Connected to Kafka Event Bus');

    // Make sure the topic exists or allow auto-creation
    await consumer.subscribe({ topic: 'supervisor_answered', fromBeginning: true });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            if (!message.value) return;
            const data = JSON.parse(message.value.toString());
            
            console.log(`\n================================`);
            console.log(`🔔 SMS SIMULATION NOTIFICATION 🔔`);
            console.log(`To Caller: ${data.caller_phone}`);
            console.log(`Message: "Hey! We checked with the supervisor. The answer to your question is: ${data.answer}"`);
            console.log(`================================\n`);
        },
    });

    console.log('[NotificationService] Listening for supervisor answers to send texts...');
}

bootstrap().catch(console.error);
