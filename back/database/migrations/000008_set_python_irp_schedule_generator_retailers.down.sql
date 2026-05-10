UPDATE models
SET
    components = jsonb_set(
        components,
        '{0,instanceMetadata,parameters,3,value}',
        '[]'::jsonb,
        false
    ),
    updated_at = NOW()
WHERE id = '604a54ad-bc31-4a94-917e-ebb49c488452'::uuid
  AND name = 'BasicExperimentalFrame'
  AND language = 'python'::model_language;
