ALTER TABLE simulation_events RENAME COLUMN msg_type TO devs_type;
ALTER TABLE simulation_events DROP COLUMN IF EXISTS relative_event_timestamp;

