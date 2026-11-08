ALTER TABLE user_ai_settings
    ADD COLUMN transcription_api_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN transcription_api_key TEXT NOT NULL DEFAULT '',
    ADD COLUMN transcription_api_model TEXT NOT NULL DEFAULT '';
