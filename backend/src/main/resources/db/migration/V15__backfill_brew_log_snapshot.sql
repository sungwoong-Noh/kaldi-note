UPDATE brew_logs bl
SET recipe_snapshot = jsonb_build_object(
  'title', r.title,
  'authorName', COALESCE(r.author_name, u.nickname),
  'doseG', r.dose_g,
  'waterG', r.water_g,
  'temperatureC', r.water_temp_c,
  'grinder', gm.name,
  'grindValue', jsonb_build_object('value', r.grind_setting_value, 'unit', r.grind_setting_unit),
  'steps', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'type', rs.step_type,
      'waterG', rs.water_g,
      'seconds', rs.duration_seconds,
      'note', rs.note
    ) order by rs.step_order), '[]'::jsonb)
    from recipe_steps rs where rs.recipe_id = r.id
  )
)
FROM recipes r
LEFT JOIN users u ON u.id = r.owner_user_id
LEFT JOIN grinder_models gm ON gm.id = r.grinder_model_id
WHERE bl.recipe_id = r.id
  AND bl.recipe_snapshot IS NULL;

ALTER TABLE brew_logs ALTER COLUMN recipe_snapshot SET NOT NULL;
