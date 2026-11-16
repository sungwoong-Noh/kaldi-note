-- 실행마다 생성·갱신된 원두 목록과 변화 없음 건수를 저장한다.
-- docs/specs/2026-11-16-crawl-result.md 「데이터」
ALTER TABLE crawl_runs
    ADD COLUMN imported        JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN unchanged_count INT   NOT NULL DEFAULT 0;
