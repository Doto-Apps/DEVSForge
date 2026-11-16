ALTER TABLE models ADD COLUMN import_source JSONB;
ALTER TABLE models DROP CONSTRAINT models_integration_type;
ALTER TABLE models ADD CONSTRAINT models_integration_type CHECK (
 (type='atomic' AND ((integration_id IS NOT NULL AND integration_version IS NOT NULL) OR
  (integration_id IS NULL AND integration_version IS NULL AND import_source IS NOT NULL))) OR
 (type='coupled' AND integration_id IS NULL AND integration_version IS NULL)
);
CREATE TABLE model_imports (
 user_id UUID NOT NULL REFERENCES users(id),
 job_id TEXT NOT NULL,
 result JSONB NOT NULL,
 PRIMARY KEY(user_id,job_id)
);
