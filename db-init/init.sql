CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE model_type AS ENUM ('atomic', 'coupled');