UPDATE simulation_events
SET msg_type = COALESCE(msg_type, payload ->> 'messageType', 'Unknown');

ALTER TABLE simulation_events ALTER COLUMN msg_type SET NOT NULL;
