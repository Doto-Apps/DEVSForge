UPDATE models
SET
    components = jsonb_set(
        components,
        '{0,instanceMetadata,parameters,3,value}',
        '[
            {"daily_consumption": 65, "id": 0, "x": 172, "y": 334},
            {"daily_consumption": 35, "id": 1, "x": 267, "y": 87},
            {"daily_consumption": 58, "id": 2, "x": 148, "y": 433},
            {"daily_consumption": 24, "id": 3, "x": 355, "y": 444},
            {"daily_consumption": 11, "id": 4, "x": 38, "y": 152}
        ]'::jsonb,
        false
    ),
    updated_at = NOW()
WHERE id = '604a54ad-bc31-4a94-917e-ebb49c488452'::uuid
  AND name = 'BasicExperimentalFrame'
  AND language = 'python'::model_language;
