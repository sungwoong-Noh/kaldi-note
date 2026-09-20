ALTER TABLE recipes
  ADD COLUMN temperature_type      VARCHAR(10) NOT NULL DEFAULT 'HOT',
  ADD COLUMN recommended_roast_level VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN source_author_name    VARCHAR(100);
