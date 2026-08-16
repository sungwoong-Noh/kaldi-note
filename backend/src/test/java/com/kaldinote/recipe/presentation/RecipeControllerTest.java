package com.kaldinote.recipe.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RecipeControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private GrinderModelRepository grinderRepository;

  private String token() {
    User user = userRepository.save(User.create(null, "테스터", null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private String otherUserToken() {
    User other = userRepository.save(User.create(null, "다른사람", null));
    return "Bearer " + tokenProvider.createAccessToken(other.getId(), other.getRole());
  }

  private Long grinderId(String brand, String name) {
    return grinderRepository.findByBrandAndName(brand, name).orElseThrow().getId();
  }

  private ResultActions createRecipe(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/recipes")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  @Test
  @DisplayName("AC-RECIPE-01 · 최소 입력만으로 레시피가 생성된다")
  void 최소_입력만으로_레시피가_생성된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"아침 레시피","doseG":15.0,"waterG":250.0}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.visibility").value("PRIVATE"))
        .andExpect(jsonPath("$.sourceType").value("USER"))
        .andExpect(jsonPath("$.brewMethod").value("POUR_OVER"));
  }

  @Test
  @DisplayName("AC-RECIPE-02 · 스텝이 0개면 물량 합계 검증을 건너뛴다")
  void 스텝이_0개면_물량_검증을_건너뛴다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"빈 스텝","doseG":15.0,"waterG":250.0,"steps":[]}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.steps.length()").value(0));
  }

  @Test
  @DisplayName("AC-RECIPE-03 · 스텝 물량 합계가 총 물량과 같으면 생성된다")
  void 스텝_물량_합계가_같으면_생성된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"Kasuya","doseG":20.0,"waterG":300.0,"steps":[
          {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":45,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":90,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":135,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":165,"durationSeconds":10,"waterG":60.0}
        ]}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.steps.length()").value(5));
  }

  @Test
  @DisplayName("AC-RECIPE-04 · stepOrder는 서버가 배열 순서로 1부터 부여한다")
  void stepOrder는_배열_순서로_부여된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"순서 확인","doseG":15.0,"waterG":180.0,"steps":[
          {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":40,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":80,"durationSeconds":10,"waterG":60.0}
        ]}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.steps[0].stepOrder").value(1))
        .andExpect(jsonPath("$.steps[1].stepOrder").value(2))
        .andExpect(jsonPath("$.steps[2].stepOrder").value(3));
  }

  @Test
  @DisplayName("AC-RECIPE-07 · 마이크론 스냅샷을 서버가 계산해 저장한다")
  void 마이크론_스냅샷을_서버가_계산한다() throws Exception {
    Long c40 = grinderId("Comandante", "C40 MK4");
    createRecipe(
            token(),
            """
        {"title":"C40 레시피","doseG":15.0,"waterG":250.0,
         "grinderModelId":%d,"grindSettingValue":22,"grindSettingUnit":"CLICK"}
        """
                .formatted(c40))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grindMicronEstimated").value(660));
  }

  @Test
  @DisplayName("AC-RECIPE-08 · 무단계 그라인더는 스냅샷이 null이고 레시피는 생성된다")
  void 무단계_그라인더는_스냅샷이_null이다() throws Exception {
    Long wilfa = grinderId("Wilfa", "Uniform");
    createRecipe(
            token(),
            """
        {"title":"Wilfa 레시피","doseG":15.0,"waterG":250.0,
         "grinderModelId":%d,"grindSettingValue":5,"grindSettingUnit":"NUMBER"}
        """
                .formatted(wilfa))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grindMicronEstimated").doesNotExist());
  }

  @Test
  @DisplayName("AC-RECIPE-09 · unit이 MICRON이면 그라인더 없이도 값을 그대로 스냅샷에 넣는다")
  void unit이_MICRON이면_그라인더_없이_그대로_스냅샷에_넣는다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"마이크론 직접 입력","doseG":15.0,"waterG":250.0,
         "grindSettingValue":800,"grindSettingUnit":"MICRON"}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grindMicronEstimated").value(800))
        .andExpect(jsonPath("$.grinderModelId").doesNotExist());
  }

  @Test
  @DisplayName("AC-RECIPE-41 · unit=MICRON에서 100은 허용된다")
  void MICRON_100은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"하한","doseG":15.0,"waterG":250.0,"grindSettingValue":100,"grindSettingUnit":"MICRON"}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grindMicronEstimated").value(100));
  }

  @Test
  @DisplayName("AC-RECIPE-42 · unit=MICRON에서 99는 거부된다")
  void MICRON_99는_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"하한 아래","doseG":15.0,"waterG":250.0,"grindSettingValue":99,"grindSettingUnit":"MICRON"}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-43 · unit=MICRON에서 2000은 허용된다")
  void MICRON_2000은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"상한","doseG":15.0,"waterG":250.0,"grindSettingValue":2000,"grindSettingUnit":"MICRON"}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grindMicronEstimated").value(2000));
  }

  @Test
  @DisplayName("AC-RECIPE-44 · unit=MICRON에서 2001은 거부된다")
  void MICRON_2001은_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"상한 위","doseG":15.0,"waterG":250.0,"grindSettingValue":2001,"grindSettingUnit":"MICRON"}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-54 · 존재하지 않는 grinderModelId는 404다")
  void 존재하지_않는_그라인더_ID는_404다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"없는 그라인더","doseG":15.0,"waterG":250.0,
         "grinderModelId":999999,"grindSettingValue":22,"grindSettingUnit":"CLICK"}
        """)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-RECIPE-55 · 그라인더 범위를 벗어난 설정값은 거부된다")
  void 그라인더_범위_밖은_거부된다() throws Exception {
    Long c40 = grinderId("Comandante", "C40 MK4");
    createRecipe(
            token(),
            """
        {"title":"범위 밖","doseG":15.0,"waterG":250.0,
         "grinderModelId":%d,"grindSettingValue":51,"grindSettingUnit":"CLICK"}
        """
                .formatted(c40))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("GRIND_SETTING_OUT_OF_RANGE"));
  }

  @Test
  @DisplayName("AC-RECIPE-56 · unit이 CLICK인데 그라인더가 없으면 거부된다")
  void CLICK인데_그라인더가_없으면_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"그라인더 없음","doseG":15.0,"waterG":250.0,
         "grindSettingValue":22,"grindSettingUnit":"CLICK"}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-60 · 인증 없이 생성할 수 없다")
  void 인증_없이_생성할_수_없다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/recipes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"익명","doseG":15.0,"waterG":250.0}
                    """))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-RECIPE-20 · doseG 1.0은 허용된다")
  void doseG_1_0은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"하한","doseG":1.0,"waterG":250.0}
        """)
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-21 · doseG 0.9는 거부된다")
  void doseG_0_9는_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"하한 아래","doseG":0.9,"waterG":250.0}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-22 · doseG 200.0은 허용된다")
  void doseG_200_0은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"상한","doseG":200.0,"waterG":3000.0}
        """)
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-23 · doseG 200.1은 거부된다")
  void doseG_200_1은_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"상한 위","doseG":200.1,"waterG":3000.0}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-24 · waterG 10.0은 허용된다")
  void waterG_10_0은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"하한","doseG":15.0,"waterG":10.0}
        """)
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-25 · waterG 9.9는 거부된다")
  void waterG_9_9는_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"하한 아래","doseG":15.0,"waterG":9.9}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-26 · waterG 3000.0은 허용된다")
  void waterG_3000_0은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"상한","doseG":200.0,"waterG":3000.0}
        """)
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-27 · waterG 3000.1은 거부된다")
  void waterG_3000_1은_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"상한 위","doseG":200.0,"waterG":3000.1}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-28 · waterTempC 60.0은 허용된다")
  void waterTempC_60_0은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"하한","doseG":15.0,"waterG":250.0,"waterTempC":60.0}
        """)
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-29 · waterTempC 59.9는 거부된다")
  void waterTempC_59_9는_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"하한 아래","doseG":15.0,"waterG":250.0,"waterTempC":59.9}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-30 · waterTempC 100.0은 허용된다")
  void waterTempC_100_0은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"상한","doseG":15.0,"waterG":250.0,"waterTempC":100.0}
        """)
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-31 · waterTempC 100.1은 거부된다")
  void waterTempC_100_1은_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"상한 위","doseG":15.0,"waterG":250.0,"waterTempC":100.1}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-32 · totalTimeSeconds 3600은 허용된다")
  void totalTimeSeconds_3600은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"상한","doseG":15.0,"waterG":250.0,"totalTimeSeconds":3600}
        """)
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-33 · totalTimeSeconds 3601은 거부된다")
  void totalTimeSeconds_3601은_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"상한 위","doseG":15.0,"waterG":250.0,"totalTimeSeconds":3601}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  private static String stepsJson(int count) {
    StringBuilder sb = new StringBuilder("[");
    for (int i = 0; i < count; i++) {
      if (i > 0) {
        sb.append(',');
      }
      int startAt = i * 10;
      sb.append(
          """
          {"stepType":"POUR","startAtSeconds":%d,"durationSeconds":10,"waterG":10.0}
          """
              .formatted(startAt)
              .strip());
    }
    return sb.append(']').toString();
  }

  @Test
  @DisplayName("AC-RECIPE-34 · 스텝 30개는 허용된다")
  void 스텝_30개는_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"스텝 상한","doseG":20.0,"waterG":300.0,"steps":%s}
        """
                .formatted(stepsJson(30)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.steps.length()").value(30));
  }

  @Test
  @DisplayName("AC-RECIPE-35 · 스텝 31개는 거부된다")
  void 스텝_31개는_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"스텝 상한 위","doseG":20.0,"waterG":310.0,"steps":%s}
        """
                .formatted(stepsJson(31)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-36 · title 100자는 허용된다")
  void title_100자는_허용된다() throws Exception {
    String title = "가".repeat(100);
    createRecipe(
            token(),
            """
        {"title":"%s","doseG":15.0,"waterG":250.0}
        """
                .formatted(title))
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-37 · title 101자는 거부된다")
  void title_101자는_거부된다() throws Exception {
    String title = "가".repeat(101);
    createRecipe(
            token(),
            """
        {"title":"%s","doseG":15.0,"waterG":250.0}
        """
                .formatted(title))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-38 · 공백만인 title은 거부된다")
  void 공백만인_title은_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"   ","doseG":15.0,"waterG":250.0}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-39 · description 2000자는 허용된다")
  void description_2000자는_허용된다() throws Exception {
    String description = "가".repeat(2000);
    createRecipe(
            token(),
            """
        {"title":"설명 상한","doseG":15.0,"waterG":250.0,"description":"%s"}
        """
                .formatted(description))
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-40 · description 2001자는 거부된다")
  void description_2001자는_거부된다() throws Exception {
    String description = "가".repeat(2001);
    createRecipe(
            token(),
            """
        {"title":"설명 상한 위","doseG":15.0,"waterG":250.0,"description":"%s"}
        """
                .formatted(description))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-45 · 앞 스텝이 끝나는 순간 다음 스텝이 시작하면 허용된다")
  void 경계_접촉은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"경계 접촉","doseG":15.0,"waterG":120.0,"steps":[
          {"stepType":"POUR","startAtSeconds":0,"durationSeconds":30,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":30,"durationSeconds":10,"waterG":60.0}
        ]}
        """)
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-46 · 1초라도 겹치면 거부된다")
  void 일초_겹치면_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"겹침","doseG":15.0,"waterG":120.0,"steps":[
          {"stepType":"POUR","startAtSeconds":0,"durationSeconds":30,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":29,"durationSeconds":10,"waterG":60.0}
        ]}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RECIPE_STEP_OVERLAP"));
  }

  @Test
  @DisplayName("AC-RECIPE-47 · 스텝 사이의 빈 구간은 허용된다")
  void 빈_구간은_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"빈 구간","doseG":15.0,"waterG":120.0,"steps":[
          {"stepType":"POUR","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":45,"durationSeconds":10,"waterG":60.0}
        ]}
        """)
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-48 · totalTimeSeconds가 마지막 스텝 종료보다 작아도 허용된다")
  void totalTime이_스텝_종료보다_작아도_허용된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"짧은 목표시간","doseG":15.0,"waterG":60.0,"totalTimeSeconds":160,"steps":[
          {"stepType":"POUR","startAtSeconds":165,"durationSeconds":10,"waterG":60.0}
        ]}
        """)
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-50 · 스텝 물량 합계가 총 물량과 다르면 거부된다")
  void 스텝_물량_합계가_다르면_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"합계 불일치","doseG":15.0,"waterG":300.0,"steps":[
          {"stepType":"POUR","startAtSeconds":0,"durationSeconds":10,"waterG":290.0}
        ]}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RECIPE_STEP_WATER_MISMATCH"));
  }

  @Test
  @DisplayName("AC-RECIPE-51 · 붓지 않는 스텝에 물량이 있으면 거부된다")
  void 붓지_않는_스텝에_물량이_있으면_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"잘못된 SWIRL","doseG":15.0,"waterG":50.0,"steps":[
          {"stepType":"SWIRL","startAtSeconds":0,"durationSeconds":5,"waterG":50.0}
        ]}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RECIPE_STEP_WATER_INVALID"));
  }

  @Test
  @DisplayName("AC-RECIPE-52 · 붓는 스텝에 물량이 0이면 거부된다")
  void 붓는_스텝_물량이_0이면_거부된다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"물량 0인 POUR","doseG":15.0,"waterG":15.0,"steps":[
          {"stepType":"POUR","startAtSeconds":0,"durationSeconds":5,"waterG":0}
        ]}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RECIPE_STEP_WATER_INVALID"));
  }

  @Test
  @DisplayName("AC-RECIPE-53 · 존재하지 않는 brewerId는 404다")
  void 존재하지_않는_brewerId는_404다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"없는 브루어","doseG":15.0,"waterG":250.0,"brewerId":999999}
        """)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-RECIPE-57 · 일반 API로 CURATED 레시피를 만들 수 없다")
  void CURATED_레시피는_만들_수_없다() throws Exception {
    createRecipe(
            token(),
            """
        {"title":"관리자용","doseG":15.0,"waterG":250.0,"sourceType":"CURATED"}
        """)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  private String createAndGetLocation(String token, String body) throws Exception {
    String response =
        createRecipe(token, body)
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return com.jayway.jsonpath.JsonPath.read(response, "$.id").toString();
  }

  @Test
  @DisplayName("AC-RECIPE-05 · 조회 응답의 ratio는 waterG ÷ doseG를 소수 1자리로 반올림한 값이다")
  void ratio는_소수_1자리로_반올림된다() throws Exception {
    String token = token();
    String id =
        createAndGetLocation(
            token,
            """
            {"title":"비율 확인","doseG":18.0,"waterG":300.0}
            """);

    mockMvc
        .perform(get("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ratio").value(16.7));
  }

  @Test
  @DisplayName("AC-RECIPE-06 · 조회 응답의 스텝별 cumulativeWaterG가 누적합이다")
  void cumulativeWaterG는_누적합이다() throws Exception {
    String token = token();
    String id =
        createAndGetLocation(
            token,
            """
            {"title":"누적 물량","doseG":20.0,"waterG":300.0,"steps":[
              {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":45,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":90,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":135,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":165,"durationSeconds":10,"waterG":60.0}
            ]}
            """);

    mockMvc
        .perform(get("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.steps[0].cumulativeWaterG").value(60.0))
        .andExpect(jsonPath("$.steps[1].cumulativeWaterG").value(120.0))
        .andExpect(jsonPath("$.steps[2].cumulativeWaterG").value(180.0))
        .andExpect(jsonPath("$.steps[3].cumulativeWaterG").value(240.0))
        .andExpect(jsonPath("$.steps[4].cumulativeWaterG").value(300.0));
  }

  @Test
  @DisplayName("AC-RECIPE-61 · 존재하지 않는 레시피 조회는 404다")
  void 존재하지_않는_레시피_조회는_404다() throws Exception {
    mockMvc
        .perform(get("/api/v1/recipes/999999").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }
}
