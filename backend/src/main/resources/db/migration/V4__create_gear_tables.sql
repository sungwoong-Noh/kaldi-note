CREATE TABLE grinder_models (
    id                      BIGSERIAL PRIMARY KEY,
    brand                   VARCHAR(50)  NOT NULL,
    name                    VARCHAR(100) NOT NULL,
    adjustment_type         VARCHAR(20)  NOT NULL,
    microns_per_click       NUMERIC(6,2),
    zero_point_offset_clicks NUMERIC(6,2) NOT NULL DEFAULT 0,
    min_setting             NUMERIC(6,2),
    max_setting             NUMERIC(6,2),
    burr_type               VARCHAR(20),
    is_system               BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id      BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_grinder_brand_name UNIQUE (brand, name),
    CONSTRAINT chk_microns_positive CHECK (microns_per_click IS NULL OR microns_per_click > 0)
);

CREATE TABLE user_grinders (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    grinder_model_id        BIGINT      NOT NULL REFERENCES grinder_models (id),
    nickname                VARCHAR(50),
    calibration_offset_clicks NUMERIC(6,2) NOT NULL DEFAULT 0,
    is_default              BOOLEAN     NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_grinders_user ON user_grinders (user_id);

CREATE TABLE brewers (
    id                 BIGSERIAL PRIMARY KEY,
    brand              VARCHAR(50),
    name               VARCHAR(100) NOT NULL,
    type               VARCHAR(20)  NOT NULL,
    is_system          BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_brewer_name UNIQUE (name)
);

CREATE TABLE brew_filters (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    material           VARCHAR(30)  NOT NULL,
    shape              VARCHAR(30),
    is_system          BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_filter_name UNIQUE (name)
);
