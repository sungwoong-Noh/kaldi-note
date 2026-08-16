-- microns_per_click은 출처가 확인된 값만 넣는다.
--   Comandante C40 = 30µm/click, 1Zpresso K-Plus = 22µm/click
-- 확인되지 않은 모델은 NULL로 둔다 → 환산이 거부된다(정상 동작).
-- 추측값은 넣지 않는다. 틀린 환산값은 값이 없는 것보다 해롭다.
INSERT INTO grinder_models
    (brand, name, adjustment_type, microns_per_click, zero_point_offset_clicks,
     min_setting, max_setting, burr_type, is_system) VALUES
    ('Comandante', 'C40 MK4',      'CLICK',    30.00, 0, 0, 50,  'CONICAL', true),
    ('1Zpresso',   'K-Plus',       'NUMBERED', 22.00, 0, 0, 90,  'CONICAL', true),
    ('1Zpresso',   'JX-Pro',       'NUMBERED', NULL,  0, 0, 100, 'CONICAL', true),
    ('1Zpresso',   'J-Max',        'NUMBERED', NULL,  0, 0, 90,  'CONICAL', true),
    ('Kingrinder', 'K6',           'CLICK',    NULL,  0, 0, 240, 'CONICAL', true),
    ('Timemore',   'Chestnut C2',  'CLICK',    NULL,  0, 0, 36,  'CONICAL', true),
    ('Timemore',   'Chestnut C3',  'CLICK',    NULL,  0, 0, 36,  'CONICAL', true),
    ('Fellow',     'Ode Gen 2',    'NUMBERED', NULL,  0, 1, 11,  'FLAT',    true),
    ('Baratza',    'Encore',       'NUMBERED', NULL,  0, 0, 40,  'CONICAL', true),
    ('Wilfa',      'Uniform',      'STEPLESS', NULL,  0, 0, 0,   'FLAT',    true);

INSERT INTO brewers (brand, name, type, is_system) VALUES
    ('Hario',   'V60 01',          'CONE',         true),
    ('Hario',   'V60 02',          'CONE',         true),
    ('Kalita',  'Wave 155',        'FLAT_BOTTOM',  true),
    ('Kalita',  'Wave 185',        'FLAT_BOTTOM',  true),
    ('Origami', 'Dripper S',       'CONE',         true),
    ('Origami', 'Dripper M',       'CONE',         true),
    ('Orea',    'Brewer V4',       'FLAT_BOTTOM',  true),
    ('Chemex',  'Classic 6 Cup',   'CONE',         true),
    ('Melitta', 'Aroma Filter 1x2','WAVE',         true),
    ('Timemore','Crystal Eye',     'CONE',         true);

INSERT INTO brew_filters (name, material, shape, is_system) VALUES
    ('V60 표백 필터 01',      'PAPER_BLEACHED', 'CONE',        true),
    ('V60 표백 필터 02',      'PAPER_BLEACHED', 'CONE',        true),
    ('V60 무표백 필터 02',    'PAPER_NATURAL',  'CONE',        true),
    ('아바카 필터 V60 02',    'ABACA',          'CONE',        true),
    ('칼리타 웨이브 155 필터','PAPER_BLEACHED', 'FLAT_BOTTOM', true),
    ('칼리타 웨이브 185 필터','PAPER_BLEACHED', 'FLAT_BOTTOM', true),
    ('케멕스 본디드 필터',    'PAPER_BLEACHED', 'CONE',        true),
    ('스테인리스 메탈 필터',  'METAL',          'CONE',        true);
