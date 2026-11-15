-- 관리자가 숨긴 원두와 손으로 고친 원두를 크롤러가 되살리거나 덮어쓰지 않도록 플래그를 둔다.
-- 기존 행은 둘 다 false로 시작한다. docs/specs/2026-11-15-bean-detail.md 「데이터」
ALTER TABLE bean_products
    ADD COLUMN hidden          BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN manually_edited BOOLEAN NOT NULL DEFAULT false;
