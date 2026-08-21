
INSERT INTO varieties (name, name_ko, is_system) VALUES
    ('Geisha', '게이샤', true),
    ('Bourbon', '버번', true),
    ('Typica', '티피카', true),
    ('Caturra', '카투라', true),
    ('Catuai', '카투아이', true),
    ('SL28', 'SL28', true),
    ('SL34', 'SL34', true),
    ('Pacamara', '파카마라', true),
    ('Maragogipe', '마라고지페', true),
    ('Mundo Novo', '문도노보', true),
    ('Castillo', '카스티요', true),
    ('Pink Bourbon', '핑크버번', true),
    ('Wush Wush', '우쉬우쉬', true),
    ('Ethiopian Heirloom', '에티오피아 재래종', true),
    ('Java', '자바', true);

INSERT INTO coffee_processes (name, name_ko, category, is_system) VALUES
    ('Washed',              '워시드',           'WASHED',    true),
    ('Natural',             '내추럴',           'NATURAL',   true),
    ('White Honey',         '화이트 허니',      'HONEY',     true),
    ('Yellow Honey',        '옐로우 허니',      'HONEY',     true),
    ('Red Honey',           '레드 허니',        'HONEY',     true),
    ('Black Honey',         '블랙 허니',        'HONEY',     true),
    ('Anaerobic Natural',   '무산소 내추럴',    'FERMENTED', true),
    ('Anaerobic Washed',    '무산소 워시드',    'FERMENTED', true),
    ('Carbonic Maceration', '카보닉 마세라시옹','FERMENTED', true),
    ('Lactic',              '락틱',             'FERMENTED', true),
    ('Thermal Shock',       '써멀 쇼크',        'FERMENTED', true),
    ('Wet Hulled',          '웻 헐드',          'OTHER',     true),
    ('Swiss Water Decaf',   '스위스워터 디카페인','OTHER',   true);

-- SCA Flavor Wheel 1단계 (9개 대분류)
INSERT INTO flavor_notes (name_en, name_ko, parent_id, level) VALUES
    ('Fruity',           '과일',        NULL, 1),
    ('Sour/Fermented',   '신맛/발효',   NULL, 1),
    ('Green/Vegetative', '풀/채소',     NULL, 1),
    ('Other',            '기타',        NULL, 1),
    ('Roasted',          '로스팅',      NULL, 1),
    ('Spices',           '향신료',      NULL, 1),
    ('Nutty/Cocoa',      '견과/코코아', NULL, 1),
    ('Sweet',            '단맛',        NULL, 1),
    ('Floral',           '꽃',          NULL, 1);

-- 2단계 (자주 쓰는 것 중심. 나머지는 쓰면서 마이그레이션으로 보탠다)
INSERT INTO flavor_notes (name_en, name_ko, parent_id, level)
SELECT v.name_en, v.name_ko, p.id, 2
FROM (VALUES
    ('Berry',        '베리',        'Fruity'),
    ('Dried Fruit',  '건과일',      'Fruity'),
    ('Citrus Fruit', '시트러스',    'Fruity'),
    ('Other Fruit',  '기타 과일',   'Fruity'),
    ('Winey',        '와인',        'Sour/Fermented'),
    ('Cocoa',        '코코아',      'Nutty/Cocoa'),
    ('Nutty',        '견과',        'Nutty/Cocoa'),
    ('Brown Sugar',  '흑설탕',      'Sweet'),
    ('Vanilla',      '바닐라',      'Sweet'),
    ('Honey',        '꿀',          'Sweet'),
    ('Black Tea',    '홍차',        'Floral'),
    ('Floral',       '꽃향',        'Floral'),
    ('Cereal',       '곡물',        'Roasted'),
    ('Burnt',        '탄내',        'Roasted')
) AS v(name_en, name_ko, parent_name)
JOIN flavor_notes p ON p.name_en = v.parent_name AND p.level = 1;
