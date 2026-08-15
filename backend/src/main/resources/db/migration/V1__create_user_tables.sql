CREATE TABLE users (
    id                BIGSERIAL PRIMARY KEY,
    email             VARCHAR(255),
    nickname          VARCHAR(50)  NOT NULL,
    profile_image_url TEXT,
    role              VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 카카오는 이메일 제공 동의가 선택이라 null이 올 수 있다.
-- null이 아닌 값끼리만 유일성을 보장한다.
CREATE UNIQUE INDEX uq_users_email ON users (email) WHERE email IS NOT NULL;

CREATE TABLE user_oauth_accounts (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider         VARCHAR(20)  NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_oauth_provider_user UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_oauth_user_id ON user_oauth_accounts (user_id);

CREATE TABLE refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user_id ON refresh_tokens (user_id);

CREATE TABLE follows (
    follower_user_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    followee_user_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_user_id, followee_user_id),
    CONSTRAINT chk_no_self_follow CHECK (follower_user_id <> followee_user_id)
);
CREATE INDEX idx_follows_followee ON follows (followee_user_id);
