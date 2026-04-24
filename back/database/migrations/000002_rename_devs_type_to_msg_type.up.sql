ALTER TABLE simulation_events RENAME COLUMN devs_type TO msg_type;
ALTER TABLE simulation_events ADD COLUMN relative_event_timestamp BIGINT DEFAULT NULL;

