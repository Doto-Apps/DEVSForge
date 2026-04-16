CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE model_type AS ENUM ('atomic', 'coupled');
CREATE TYPE model_language AS ENUM ('go', 'python');
CREATE TYPE simulation_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    fullname VARCHAR(255),
    refresh_token VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_ai_settings (
    user_id UUID PRIMARY KEY,
    api_url TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    api_model VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_user_ai_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS libraries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_libraries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    lib_id UUID,
    name VARCHAR(255) NOT NULL,
    type model_type NOT NULL,
    language model_language NOT NULL DEFAULT 'python',
    description TEXT NOT NULL,
    code TEXT NOT NULL,
    ports JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    connections JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_models_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_models_library FOREIGN KEY (lib_id) REFERENCES libraries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS experimental_frames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    target_model_id UUID NOT NULL,
    frame_model_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_experimental_frames_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_experimental_frames_target FOREIGN KEY (target_model_id) REFERENCES models(id) ON DELETE CASCADE,
    CONSTRAINT fk_experimental_frames_frame FOREIGN KEY (frame_model_id) REFERENCES models(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    model_id UUID NOT NULL,
    status simulation_status NOT NULL DEFAULT 'pending',
    manifest JSONB NOT NULL,
    results JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_simulations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_simulations_model FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS simulation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    simulation_time DOUBLE PRECISION,
    devs_type VARCHAR(100) NOT NULL,
    sender VARCHAR(100),
    target VARCHAR(100),
    payload JSONB NOT NULL,
    CONSTRAINT fk_simulation_events_simulation FOREIGN KEY (simulation_id) REFERENCES simulations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS web_app_deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    model_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL DEFAULT '',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    contract JSONB NOT NULL,
    ui_schema JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_web_app_deployments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_web_app_deployments_model FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_libraries_user_id ON libraries(user_id);
CREATE INDEX IF NOT EXISTS idx_libraries_deleted_at ON libraries(deleted_at);
CREATE INDEX IF NOT EXISTS idx_models_user_id ON models(user_id);
CREATE INDEX IF NOT EXISTS idx_models_lib_id ON models(lib_id);
CREATE INDEX IF NOT EXISTS idx_models_deleted_at ON models(deleted_at);
CREATE INDEX IF NOT EXISTS idx_experimental_frames_user_id ON experimental_frames(user_id);
CREATE INDEX IF NOT EXISTS idx_experimental_frames_target_model_id ON experimental_frames(target_model_id);
CREATE INDEX IF NOT EXISTS idx_experimental_frames_frame_model_id ON experimental_frames(frame_model_id);
CREATE INDEX IF NOT EXISTS idx_experimental_frames_deleted_at ON experimental_frames(deleted_at);
CREATE INDEX IF NOT EXISTS idx_simulations_user_id ON simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_simulations_model_id ON simulations(model_id);
CREATE INDEX IF NOT EXISTS idx_simulation_events_simulation_id ON simulation_events(simulation_id);
CREATE INDEX IF NOT EXISTS idx_simulation_events_time ON simulation_events(simulation_id, simulation_time);
CREATE INDEX IF NOT EXISTS idx_web_app_deployments_user_id ON web_app_deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_web_app_deployments_model_id ON web_app_deployments(model_id);
