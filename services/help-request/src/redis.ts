import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';

export const redisClient = createClient({
    url: `redis://${redisHost}:${redisPort}`
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
