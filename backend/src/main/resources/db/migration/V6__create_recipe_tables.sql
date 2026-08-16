CREATE TABLE recipes (
    id                      BIGSERIAL PRIMARY KEY,
    owner_user_id           BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    source_type             VARCHAR(20)  NOT NULL DEFAULT 'USER',
    author_name             VARCHAR(100),
    source_url              VARCHAR(500),
    source_note             VARCHAR(500),
    title                   VARCHAR(100) NOT NULL,
    description             VARCHAR(2000),
    brew_method             VARCHAR(20)  NOT NULL DEFAULT 'POUR_OVER',
    visibility              VARCHAR(20)  NOT NULL DEFAULT 'PRIVATE',
    parent_recipe_id        BIGINT       REFERENCES recipes (id),
    fork_root_id            BIGINT       REFERENCES recipes (id),
    dose_g                  NUMERIC(5,1) NOT NULL,
    water_g                 NUMERIC(6,1) NOT NULL,
    water_temp_c            NUMERIC(4,1),
    total_time_seconds      INTEGER,
    brewer_id               BIGINT       REFERENCES brewers (id),
    filter_id               BIGINT       REFERENCES brew_filters (id),
    grinder_model_id        BIGINT       REFERENCES grinder_models (id),
    grind_setting_value     NUMERIC(7,1),
    grind_setting_unit      VARCHAR(10),
    grind_micron_estimated  NUMERIC(6,0),
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT chk_recipe_dose_positive  CHECK (dose_g > 0),
    CONSTRAINT chk_recipe_water_positive CHECK (water_g > 0)
);

CREATE INDEX idx_recipes_owner   ON recipes (owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_recipes_brewer  ON recipes (brewer_id);
CREATE INDEX idx_recipes_filter  ON recipes (filter_id);
CREATE INDEX idx_recipes_grinder ON recipes (grinder_model_id);
CREATE INDEX idx_recipes_parent  ON recipes (parent_recipe_id);

CREATE TABLE recipe_steps (
    id                BIGSERIAL PRIMARY KEY,
    recipe_id         BIGINT      NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
    step_order        INTEGER     NOT NULL,
    step_type         VARCHAR(20) NOT NULL,
    start_at_seconds  INTEGER     NOT NULL,
    duration_seconds  INTEGER     NOT NULL,
    water_g           NUMERIC(6,1),
    pour_technique    VARCHAR(20),
    agitation         VARCHAR(20),
    note              VARCHAR(500),
    CONSTRAINT uq_recipe_steps_order UNIQUE (recipe_id, step_order)
);
CREATE INDEX idx_recipe_steps_recipe ON recipe_steps (recipe_id);
