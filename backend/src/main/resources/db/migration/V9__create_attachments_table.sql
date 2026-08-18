CREATE TABLE attachments (
    id              BIGSERIAL PRIMARY KEY,
    owner_user_id   BIGINT       NOT NULL REFERENCES users (id),
    target_type     VARCHAR(20)  NOT NULL,
    target_id       BIGINT       NOT NULL,
    object_key      VARCHAR(500) NOT NULL UNIQUE,
    content_type    VARCHAR(50)  NOT NULL,
    width           INTEGER      NOT NULL,
    height          INTEGER      NOT NULL,
    sort_order      INTEGER      NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_attachment_width_positive  CHECK (width > 0),
    CONSTRAINT chk_attachment_height_positive CHECK (height > 0)
);

CREATE INDEX idx_attachments_target ON attachments (target_type, target_id);
