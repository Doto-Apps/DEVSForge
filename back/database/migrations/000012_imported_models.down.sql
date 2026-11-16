-- Preserve imported data: refuse rollback while unsupported atomic models exist.
ALTER TABLE models DROP CONSTRAINT models_integration_type;
ALTER TABLE models ADD CONSTRAINT models_integration_type CHECK (
 (type='atomic' AND integration_id IS NOT NULL AND integration_version IS NOT NULL) OR
 (type='coupled' AND integration_id IS NULL AND integration_version IS NULL)
);
DROP TABLE model_imports;
ALTER TABLE models DROP COLUMN import_source;
