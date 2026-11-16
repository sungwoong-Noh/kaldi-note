-- 관리자가 카탈로그로 올린 사용자 원두(모두에게 검색된다). 만든 사람(created_by_user_id)은 그대로 둔다.
-- 크롤러는 기존 원두를 구매 링크로 찾으므로 크롤러 원두끼리 링크가 겹치면 안 된다. 사용자 원두는 제외한다.
-- docs/specs/2026-11-15-admin-beans.md 「데이터」
ALTER TABLE bean_products ADD COLUMN promoted BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX uq_bean_products_crawler_url ON bean_products (product_url)
    WHERE created_by_user_id IS NULL;
