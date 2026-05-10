ALTER TABLE models ALTER COLUMN language DROP DEFAULT;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM models WHERE language::text = 'java') THEN
        RAISE EXCEPTION 'Cannot remove model_language value "java" while models still use it';
    END IF;
END $$;

CREATE TYPE model_language_without_java AS ENUM ('go', 'python');

ALTER TABLE models
    ALTER COLUMN language TYPE model_language_without_java
    USING language::text::model_language_without_java;

DROP TYPE model_language;
ALTER TYPE model_language_without_java RENAME TO model_language;

ALTER TABLE models ALTER COLUMN language SET DEFAULT 'python';
