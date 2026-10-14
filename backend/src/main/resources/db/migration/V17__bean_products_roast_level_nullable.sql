-- 크롤러가 가져온 원두는 배전도를 알 수 없을 수 있다(모모스는 상세에 배전도 텍스트가 없다).
-- 모르는 값은 지어내지 않고 null로 둔다. docs/specs/2026-10-14-bean-crawler.md
ALTER TABLE bean_products ALTER COLUMN roast_level DROP NOT NULL;
