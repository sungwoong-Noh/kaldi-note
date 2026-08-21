-- 시드 CURATED 레시피. 스키마가 아니라 콘텐츠다.
--   * test 프로파일은 이 location을 읽지 않는다 (application-test.yml).
--     기존 목록 조회 테스트가 "레시피가 하나도 없다"를 전제하기 때문이다.
--   * 검증은 SeedCuratedRecipesTest가 이 파일을 @Sql로 직접 적용해 수행한다.
--   * FK id를 하드코딩하지 않는다. BIGSERIAL 값은 환경마다 다를 수 있다.
--   * 분쇄도 4개 컬럼은 NULL이다. 원문이 "medium fine"·"coarse"로만 적어
--     특정 그라인더 클릭 수로 옮기면 추측이 된다 (V5__seed_gear.sql의 원칙).

INSERT INTO recipes
    (owner_user_id, source_type, author_name, source_url, source_note,
     title, description, brew_method, visibility,
     dose_g, water_g, water_temp_c, total_time_seconds,
     brewer_id, filter_id)
VALUES
    (NULL, 'CURATED', 'James Hoffmann',
     'https://honestcoffeeguide.com/brew-recipes/james-hoffmann-v60/',
     '유튜브 "The Ultimate V60 Technique"을 정리한 레시피 페이지',
     'James Hoffmann Ultimate V60',
     '유튜브 "The Ultimate V60 Technique"의 레시피. 1:16.7 비율, 끓는 물로 내린다. 블룸 후 두 번에 나눠 붓고 스터와 스월로 마무리해 균일한 추출을 노린다.',
     'POUR_OVER', 'PUBLIC',
     30.0, 500.0, 100.0, 210,
     (SELECT id FROM brewers      WHERE brand = 'Hario' AND name = 'V60 02'),
     (SELECT id FROM brew_filters WHERE name = 'V60 표백 필터 02')),
    (NULL, 'CURATED', 'Tetsu Kasuya',
     'https://honestcoffeeguide.com/brew-recipes/tetsu-kasuya-4-6-method/',
     '2016 World Brewers Cup 우승 방법론',
     'Tetsu Kasuya 4:6 Method',
     '2016 World Brewers Cup 우승 방법론. 45초 간격으로 다섯 번 나눠 붓는다. 앞 40%가 단맛과 산미의 균형을, 뒤 60%가 농도를 결정한다.',
     'POUR_OVER', 'PUBLIC',
     20.0, 300.0, 92.0, 210,
     (SELECT id FROM brewers      WHERE brand = 'Hario' AND name = 'V60 02'),
     (SELECT id FROM brew_filters WHERE name = 'V60 표백 필터 02'));

-- Hoffmann: 붓는 스텝 합계 60 + 240 + 200 = 500.0 = water_g
INSERT INTO recipe_steps
    (recipe_id, step_order, step_type, start_at_seconds, duration_seconds,
     water_g, pour_technique, agitation, note)
SELECT r.id, v.step_order, v.step_type, v.start_at_seconds, v.duration_seconds,
       v.water_g, v.pour_technique, v.agitation, v.note
FROM recipes r
CROSS JOIN (VALUES
    (1, 'BLOOM',      0, 15,  60.0::numeric, 'SPIRAL'::varchar, 'SWIRL', '중심에서 바깥으로 나선을 그려 가루를 다 적신 뒤, 스월로 덩어리를 푼다'),
    (2, 'WAIT',      15, 30,  NULL,          NULL,              'NONE',  '45초까지 뜸을 들인다'),
    (3, 'POUR',      45, 30, 240.0,          'SPIRAL',          'NONE',  '1분 15초에 누적 300g. 전체 물의 60%를 여기서 넣는다'),
    (4, 'POUR',      75, 30, 200.0,          'SPIRAL',          'NONE',  '1분 45초에 누적 500g. 천천히 이어 붓는다'),
    (5, 'STIR',     105,  5,  NULL,          NULL,              'STIR',  '시계 방향과 반시계 방향으로 한 번씩 저어 벽면 가루를 내린다'),
    (6, 'SWIRL',    110,  5,  NULL,          NULL,              'SWIRL', '가볍게 돌려 커피 베드를 평탄하게 만든다'),
    (7, 'DRAWDOWN', 115, 95,  NULL,          NULL,              'NONE',  '3분 30초에 배출이 끝난다')
) AS v(step_order, step_type, start_at_seconds, duration_seconds,
       water_g, pour_technique, agitation, note)
WHERE r.title = 'James Hoffmann Ultimate V60';

-- Kasuya: 붓는 스텝 합계 50 + 70 + 60 + 60 + 60 = 300.0 = water_g. 푸어 간격 45초 고정
INSERT INTO recipe_steps
    (recipe_id, step_order, step_type, start_at_seconds, duration_seconds,
     water_g, pour_technique, agitation, note)
SELECT r.id, v.step_order, v.step_type, v.start_at_seconds, v.duration_seconds,
       v.water_g, v.pour_technique, v.agitation, v.note
FROM recipes r
CROSS JOIN (VALUES
    (1, 'BLOOM',      0, 10, 50.0::numeric, 'SPIRAL'::varchar, 'NONE', '1푸어. 이 물량이 단맛과 산미의 균형을 결정한다'),
    (2, 'POUR',      45, 10, 70.0,          'SPIRAL',          'NONE', '2푸어. 여기까지 120g으로 전체의 40%를 채운다'),
    (3, 'POUR',      90, 10, 60.0,          'SPIRAL',          'NONE', '3푸어. 여기부터 60%는 농도를 결정한다'),
    (4, 'POUR',     135, 10, 60.0,          'SPIRAL',          'NONE', '4푸어. 누적 240g'),
    (5, 'POUR',     180, 10, 60.0,          'SPIRAL',          'NONE', '5푸어. 누적 300g'),
    (6, 'DRAWDOWN', 190, 20, NULL,          NULL,              'NONE', '3분 30초에 배출이 끝난다')
) AS v(step_order, step_type, start_at_seconds, duration_seconds,
       water_g, pour_technique, agitation, note)
WHERE r.title = 'Tetsu Kasuya 4:6 Method';
