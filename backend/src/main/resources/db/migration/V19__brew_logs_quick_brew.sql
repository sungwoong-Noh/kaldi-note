-- 빠른 기록(docs/specs/2026-11-14-quick-brew.md, ADR 0011): 기록의 필수값은 원두량·물량뿐이다.
-- 원두는 봉투(bean_batches) 없이 기록에 직접 남긴다 — 카탈로그 상품 id 또는 직접 입력한 이름, 그리고 로스팅 날짜.
-- 기존 행은 값을 바꾸지 않는다(새 컬럼은 null).
ALTER TABLE brew_logs
  ADD COLUMN bean_product_id BIGINT REFERENCES bean_products (id),
  ADD COLUMN bean_name       VARCHAR(100),
  ADD COLUMN roasted_at      DATE,
  ALTER COLUMN bean_batch_id              DROP NOT NULL,
  ALTER COLUMN recipe_snapshot            DROP NOT NULL,
  ALTER COLUMN actual_water_temp_c        DROP NOT NULL,
  ALTER COLUMN user_grinder_id            DROP NOT NULL,
  ALTER COLUMN actual_grind_setting_value DROP NOT NULL,
  ALTER COLUMN days_off_roast             DROP NOT NULL,
  ALTER COLUMN degassing_status           DROP NOT NULL;

CREATE INDEX idx_brew_logs_bean_product ON brew_logs (bean_product_id);
