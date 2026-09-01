-- Holzklotz E80 (「변경 후」 사양).
-- microns_per_click은 제조사 스텝-마이크론 대응표에서 그대로 나온다 — 다섯 점이 오차 없이 선형이고
-- 원점을 지나므로 zero_point_offset_clicks가 0이다. 「변경 전」 사양은 별도 모델 행으로 다룬다.
INSERT INTO grinder_models
    (brand, name, adjustment_type, microns_per_click, zero_point_offset_clicks,
     min_setting, max_setting, burr_type, is_system) VALUES
    ('Holzklotz', 'E80', 'CLICK', 22.50, 0, 0, 80, 'CONICAL', true);
