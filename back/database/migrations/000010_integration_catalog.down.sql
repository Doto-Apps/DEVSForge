DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM models m JOIN integrations i ON i.id=m.integration_id AND i.version=m.integration_version WHERE i.language NOT IN ('python','go','java')) THEN
 RAISE EXCEPTION 'Cannot downgrade: models use languages unavailable in the old schema';
 END IF;
 IF EXISTS (SELECT 1 FROM models WHERE integration_id IS NOT NULL AND (integration_id NOT IN ('xdevs-python','xdevs-go','xdevs-java') OR integration_version <> '1.0.0')) THEN
 RAISE EXCEPTION 'Cannot downgrade: integration information would be lost';
 END IF;
END $$;
CREATE TYPE model_language AS ENUM ('go','python','java');
ALTER TABLE models ADD COLUMN language model_language NOT NULL DEFAULT 'python';
UPDATE models m SET language=i.language::model_language FROM integrations i WHERE i.id=m.integration_id AND i.version=m.integration_version;
ALTER TABLE models DROP CONSTRAINT models_integration_type, DROP CONSTRAINT models_integration_fk;
ALTER TABLE models DROP COLUMN integration_id, DROP COLUMN integration_version;
DROP TABLE integrations;
