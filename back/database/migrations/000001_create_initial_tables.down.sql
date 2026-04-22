DROP INDEX IF EXISTS idx_web_app_deployments_model_id;
DROP INDEX IF EXISTS idx_web_app_deployments_user_id;
DROP INDEX IF EXISTS idx_simulation_events_time;
DROP INDEX IF EXISTS idx_simulation_events_simulation_id;
DROP INDEX IF EXISTS idx_simulations_model_id;
DROP INDEX IF EXISTS idx_simulations_user_id;
DROP INDEX IF EXISTS idx_experimental_frames_deleted_at;
DROP INDEX IF EXISTS idx_experimental_frames_frame_model_id;
DROP INDEX IF EXISTS idx_experimental_frames_target_model_id;
DROP INDEX IF EXISTS idx_experimental_frames_user_id;
DROP INDEX IF EXISTS idx_models_deleted_at;
DROP INDEX IF EXISTS idx_models_lib_id;
DROP INDEX IF EXISTS idx_models_user_id;
DROP INDEX IF EXISTS idx_libraries_deleted_at;
DROP INDEX IF EXISTS idx_libraries_user_id;
DROP INDEX IF EXISTS idx_users_deleted_at;

DROP TABLE IF EXISTS web_app_deployments;
DROP TABLE IF EXISTS simulation_events;
DROP TABLE IF EXISTS simulations;
DROP TABLE IF EXISTS experimental_frames;
DROP TABLE IF EXISTS models;
DROP TABLE IF EXISTS libraries;
DROP TABLE IF EXISTS user_ai_settings;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS simulation_status;
DROP TYPE IF EXISTS model_language;
DROP TYPE IF EXISTS model_type;

DROP EXTENSION IF EXISTS "uuid-ossp";
