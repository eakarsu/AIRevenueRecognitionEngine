-- Platform operations, background jobs, migration registry, and AI governance support.

CREATE TABLE IF NOT EXISTS ai_runs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  endpoint VARCHAR(255),
  input_data TEXT,
  result TEXT,
  model_used VARCHAR(100),
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS background_jobs (
  id SERIAL PRIMARY KEY,
  job_key TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  payload JSONB,
  result JSONB,
  run_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_key TEXT UNIQUE NOT NULL,
  description TEXT,
  applied_at TIMESTAMP DEFAULT NOW()
);
