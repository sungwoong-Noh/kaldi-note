CREATE TABLE roasters (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    country            VARCHAR(100),
    website            VARCHAR(500),
    is_system          BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_roasters_name UNIQUE (name)
);

CREATE TABLE bean_products (
    id                 BIGSERIAL PRIMARY KEY,
    roaster_id         BIGINT       NOT NULL REFERENCES roasters (id),
    name               VARCHAR(100) NOT NULL,
    bean_mix           VARCHAR(20)  NOT NULL,
    roast_level        VARCHAR(20)  NOT NULL,
    roast_level_agtron SMALLINT,
    roast_level_custom VARCHAR(100),
    decaf              BOOLEAN      NOT NULL DEFAULT false,
    product_url        VARCHAR(500),
    description        VARCHAR(2000),
    verified           BOOLEAN      NOT NULL DEFAULT false,
    created_by_user_id BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_bean_products_roaster_name UNIQUE (roaster_id, name)
);
CREATE INDEX idx_bean_products_roaster ON bean_products (roaster_id);

CREATE TABLE bean_origins (
    id              BIGSERIAL PRIMARY KEY,
    bean_product_id BIGINT       NOT NULL REFERENCES bean_products (id) ON DELETE CASCADE,
    country         VARCHAR(100) NOT NULL,
    region          VARCHAR(100),
    farm            VARCHAR(100),
    altitude_min_m  SMALLINT,
    altitude_max_m  SMALLINT,
    variety_id      BIGINT       REFERENCES varieties (id),
    process_id      BIGINT       REFERENCES coffee_processes (id),
    ratio_percent   NUMERIC(4,1) NOT NULL
);
CREATE INDEX idx_bean_origins_product ON bean_origins (bean_product_id);

CREATE TABLE bean_batches (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users (id),
    bean_product_id BIGINT       NOT NULL REFERENCES bean_products (id),
    roasted_at      DATE         NOT NULL,
    purchased_at    DATE,
    opened_at       DATE,
    weight_g        NUMERIC(6,1) NOT NULL,
    remaining_g     NUMERIC(6,1) NOT NULL,
    price           INTEGER,
    frozen          BOOLEAN      NOT NULL DEFAULT false,
    frozen_at       TIMESTAMPTZ,
    finished        BOOLEAN      NOT NULL DEFAULT false,
    memo            VARCHAR(500),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT chk_bean_batches_weight_positive CHECK (weight_g > 0),
    CONSTRAINT chk_bean_batches_remaining_range CHECK (remaining_g >= 0 AND remaining_g <= weight_g)
);
CREATE INDEX idx_bean_batches_user    ON bean_batches (user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bean_batches_product ON bean_batches (bean_product_id);

ALTER TABLE recipes ADD COLUMN bean_product_id BIGINT REFERENCES bean_products (id);
