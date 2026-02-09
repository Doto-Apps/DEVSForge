CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE model_type AS ENUM ('atomic', 'coupled');
CREATE TYPE model_language AS ENUM ('go', 'python');
CREATE TYPE simulation_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Table for simulation events (DEVS messages)
CREATE TABLE IF NOT EXISTS simulation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    simulation_time DOUBLE PRECISION,
    devs_type VARCHAR(100) NOT NULL,
    sender VARCHAR(100),
    target VARCHAR(100),
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sim_events_sim_id ON simulation_events(simulation_id);
CREATE INDEX IF NOT EXISTS idx_sim_events_time ON simulation_events(simulation_id, simulation_time);