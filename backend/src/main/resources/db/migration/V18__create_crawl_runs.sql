-- 원두 크롤러 실행 기록. 관리자 화면이 상태·결과를 보여줄 수 있게 남긴다.
-- docs/specs/2026-10-14-bean-crawler.md
CREATE TABLE crawl_runs (
    id                   BIGSERIAL PRIMARY KEY,
    source               VARCHAR(50)  NOT NULL,
    status               VARCHAR(20)  NOT NULL,
    triggered_by_user_id BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    started_at           TIMESTAMPTZ  NOT NULL,
    finished_at          TIMESTAMPTZ,
    created_count        INTEGER      NOT NULL DEFAULT 0,
    updated_count        INTEGER      NOT NULL DEFAULT 0,
    skipped              JSONB        NOT NULL DEFAULT '[]',
    unmapped             JSONB        NOT NULL DEFAULT '[]',
    error_message        VARCHAR(500)
);
CREATE INDEX idx_crawl_runs_source_started ON crawl_runs (source, started_at DESC);
-- 같은 소스는 동시에 하나만 돈다. 앱의 사전 검사를 뚫는 동시 요청도 여기서 막힌다.
CREATE UNIQUE INDEX uq_crawl_runs_running ON crawl_runs (source) WHERE status = 'RUNNING';
