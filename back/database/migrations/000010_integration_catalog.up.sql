CREATE TABLE integrations (
 id TEXT NOT NULL,
 version TEXT NOT NULL,
 name TEXT NOT NULL,
 language TEXT NOT NULL,
 framework TEXT NOT NULL,
 digest TEXT NOT NULL DEFAULT '',
 PRIMARY KEY (id, version)
);
INSERT INTO integrations (id, version, name, language, framework) VALUES
 ('xdevs-python','1.0.0','xDEVS Python','python','xDEVS'),
 ('xdevs-go','1.0.0','xDEVS Go','go','xDEVS'),
 ('xdevs-java','1.0.0','xDEVS Java','java','xDEVS');
ALTER TABLE models ADD COLUMN integration_id TEXT, ADD COLUMN integration_version TEXT;
UPDATE models SET integration_id='xdevs-' || language::text, integration_version='1.0.0' WHERE type='atomic';
ALTER TABLE models ADD CONSTRAINT models_integration_fk FOREIGN KEY (integration_id,integration_version) REFERENCES integrations(id,version);
ALTER TABLE models ADD CONSTRAINT models_integration_type CHECK (
 (type='atomic' AND integration_id IS NOT NULL AND integration_version IS NOT NULL) OR
 (type='coupled' AND integration_id IS NULL AND integration_version IS NULL)
);
ALTER TABLE models DROP COLUMN language;
DROP TYPE model_language;
