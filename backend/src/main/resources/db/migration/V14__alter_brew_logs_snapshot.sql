ALTER TABLE brew_logs
  ALTER COLUMN recipe_id DROP NOT NULL,
  ADD COLUMN recipe_snapshot JSONB;
