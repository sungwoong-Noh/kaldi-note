CREATE TABLE brew_logs (
    id                             BIGSERIAL PRIMARY KEY,
    user_id                        BIGINT       NOT NULL REFERENCES users (id),
    recipe_id                      BIGINT       NOT NULL REFERENCES recipes (id),
    bean_batch_id                  BIGINT       NOT NULL REFERENCES bean_batches (id),
    brewed_at                      TIMESTAMPTZ  NOT NULL,
    visibility                     VARCHAR(20)  NOT NULL DEFAULT 'PRIVATE',
    actual_dose_g                  NUMERIC(5,1) NOT NULL,
    actual_water_g                 NUMERIC(6,1) NOT NULL,
    actual_water_temp_c            NUMERIC(4,1) NOT NULL,
    actual_total_time_seconds      INTEGER,
    actual_drawdown_seconds        INTEGER,
    user_grinder_id                BIGINT       NOT NULL REFERENCES user_grinders (id),
    actual_grind_setting_value     NUMERIC(7,1) NOT NULL,
    actual_grind_micron_estimated  NUMERIC(6,0),
    beverage_weight_g              NUMERIC(6,1),
    tds_percent                    NUMERIC(4,2),
    days_off_roast                 INTEGER      NOT NULL,
    degassing_status               VARCHAR(20)  NOT NULL,
    rating                         NUMERIC(2,1),
    acidity                        SMALLINT,
    sweetness                      SMALLINT,
    body                           SMALLINT,
    bitterness                     SMALLINT,
    aftertaste                     SMALLINT,
    overall_note                   VARCHAR(1000),
    created_at                     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_brew_log_dose_positive  CHECK (actual_dose_g > 0),
    CONSTRAINT chk_brew_log_water_positive CHECK (actual_water_g > 0)
);

CREATE INDEX idx_brew_logs_user         ON brew_logs (user_id);
CREATE INDEX idx_brew_logs_recipe       ON brew_logs (recipe_id);
CREATE INDEX idx_brew_logs_bean_batch   ON brew_logs (bean_batch_id);
CREATE INDEX idx_brew_logs_user_grinder ON brew_logs (user_grinder_id);
