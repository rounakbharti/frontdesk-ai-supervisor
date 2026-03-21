# Frontdesk Human-in-the-Loop AI Supervisor

## System Architecture

This monorepo contains a scalable microservice architecture for the Frontdesk AI Supervisor system.
It utilizes an Event-Driven architecture powered by Kafka to cleanly decouple request escalation, indexing, and auditing operations.

### Local Infrastructure Setup

To spin up the entire backend locally, you must have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```
   Fill in your `OPENAI_API_KEY`, `LIVEKIT_API_KEY`, etc. inside the newly created `.env`.

2. **Boot the infrastructure:**
   ```bash
   docker-compose up -d
   ```
   This will start: Postgres, Redis, Elasticsearch, Kafka, Sub-Zookeeper, Jaeger, and Prometheus.

3. **Verify the infrastructure:**
   - Postgres is available on port `5432`
   - Redis is available on port `6379`
   - Elasticsearch is available on port `9200`
   - Kafka is available on port `9092`
   - Jaeger UI is available at [http://localhost:16686](http://localhost:16686)
   - Prometheus is available at [http://localhost:9090](http://localhost:9090)
