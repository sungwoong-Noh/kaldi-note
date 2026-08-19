-- 브루잉 로그 소프트 삭제. recipes·bean_batches와 같은 패턴이다.
ALTER TABLE brew_logs
    ADD COLUMN deleted_at TIMESTAMPTZ;

-- 목록 조회는 항상 살아 있는 행만 훑고 brewed_at DESC, id DESC로 정렬한다.
-- 동점 시 id를 2차 기준으로 두지 않으면 페이지를 넘길 때 중복·누락이 생긴다.
CREATE INDEX idx_brew_logs_alive
    ON brew_logs (brewed_at DESC, id DESC)
    WHERE deleted_at IS NULL;

-- 레시피 목록도 같은 형태의 정렬을 쓴다.
CREATE INDEX idx_recipes_alive
    ON recipes (created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
