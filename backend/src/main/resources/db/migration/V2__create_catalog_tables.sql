CREATE TABLE varieties (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    name_ko            VARCHAR(100),
    description        TEXT,
    is_system          BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_varieties_name UNIQUE (name)
);

CREATE TABLE coffee_processes (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    name_ko            VARCHAR(100),
    category           VARCHAR(30)  NOT NULL,
    description        TEXT,
    is_system          BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_processes_name UNIQUE (name)
);

-- SCA Flavor Wheel 기반 계층 구조
CREATE TABLE flavor_notes (
    id        BIGSERIAL PRIMARY KEY,
    name_en   VARCHAR(100) NOT NULL,
    name_ko   VARCHAR(100) NOT NULL,
    parent_id BIGINT REFERENCES flavor_notes (id) ON DELETE CASCADE,
    level     SMALLINT     NOT NULL,
    CONSTRAINT uq_flavor_note_name UNIQUE (name_en, parent_id)
);
CREATE INDEX idx_flavor_notes_parent ON flavor_notes (parent_id);
