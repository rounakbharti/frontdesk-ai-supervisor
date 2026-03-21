CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE request_status AS ENUM ('PENDING', 'RESOLVED', 'UNRESOLVED');

CREATE TABLE help_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_phone VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    status request_status DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE supervisor_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    help_request_id UUID REFERENCES help_requests(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance and quick lookups
CREATE INDEX idx_help_requests_status ON help_requests(status);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
