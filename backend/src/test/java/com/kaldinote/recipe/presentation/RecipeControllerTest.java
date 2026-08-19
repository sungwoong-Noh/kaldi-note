package com.kaldinote.recipe.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Map;
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

  @Test
  @DisplayName("AC-RECIPE-10 · PUT은 스텝을 통째로 교체한다")
  void PUT은_스텝을_통째로_교체한다() throws Exception {
    String token = token();
    String id =
        createAndGetLocation(
            token,
            """
            {"title":"교체 전","doseG":20.0,"waterG":300.0,"steps":[
              {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":45,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":90,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":135,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":165,"durationSeconds":10,"waterG":60.0}
            ]}
            """);

    mockMvc
        .perform(
            put("/api/v1/recipes/{id}", id)
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"교체 후","doseG":20.0,"waterG":300.0,"steps":[
                      {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":30,"waterG":150.0},
                      {"stepType":"POUR","startAtSeconds":60,"durationSeconds":30,"waterG":150.0}
                    ]}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.steps.length()").value(2))
        .andExpect(jsonPath("$.steps[0].stepOrder").value(1))
        .andExpect(jsonPath("$.steps[1].stepOrder").value(2));
  }

  @Test
  @DisplayName("AC-RECIPE-58 · 남의 레시피를 수정할 수 없다")
  void 남의_레시피를_수정할_수_없다() throws Exception {
    String ownerToken = token();
    String id =
        createAndGetLocation(
            ownerToken,
            """
            {"title":"A의 레시피","doseG":15.0,"waterG":250.0}
            """);

    mockMvc
        .perform(
            put("/api/v1/recipes/{id}", id)
                .header(HttpHeaders.AUTHORIZATION, otherUserToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"B가 수정 시도","doseG":15.0,"waterG":250.0}
                    """))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-RECIPE-11 · 삭제하면 소유자도 조회할 수 없다")
  void 삭제하면_소유자도_조회할_수_없다() throws Exception {
    String token = token();
    String id =
        createAndGetLocation(
            token,
            """
        {"title":"삭제될 레시피","doseG":15.0,"waterG":250.0}
        """);

    mockMvc
        .perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-RECIPE-12 · 이미 삭제된 레시피를 다시 삭제하면 404다")
  void 이미_삭제된_레시피_재삭제는_404다() throws Exception {
    String token = token();
    String id =
        createAndGetLocation(
            token,
            """
        {"title":"두 번 삭제","doseG":15.0,"waterG":250.0}
        """);
    mockMvc
        .perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-RECIPE-59 · 남의 레시피를 삭제할 수 없다")
  void 남의_레시피를_삭제할_수_없다() throws Exception {
    String ownerToken = token();
    String id =
        createAndGetLocation(
            ownerToken,
            """
        {"title":"A의 레시피","doseG":15.0,"waterG":250.0}
        """);

    mockMvc
        .perform(
            delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, otherUserToken()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  // ===== 공개범위 인가 (AC-VIS-01~17) =====

  @PersistenceContext private EntityManager entityManager;

  /** 팔로우 픽스처를 만들려면 상대의 id가 필요해 User를 그대로 돌려준다. */
  private User newUser(String nickname) {
    return userRepository.save(User.create(null, nickname, null));
  }

  private String tokenOf(User user) {
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private Long createdId(ResultActions actions) throws Exception {
    String response =
        actions.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    return ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();
  }

  /** 팔로우 픽스처는 API로 만든다 — Task 1이 선행인 이유다. */
  private void follow(User follower, User followee) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/users/{id}/follow", followee.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(follower)))
        .andExpect(status().isNoContent());
  }

  private void mutualFollow(User a, User b) throws Exception {
    follow(a, b);
    follow(b, a);
  }

  /** visibility를 지정해 레시피를 만들고 id를 돌려준다. */
  private Long recipeWith(String token, String visibility) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"인가 테스트","doseG":15.0,"waterG":250.0,"visibility":"%s"}
                    """
                        .formatted(visibility))));
  }

  private ResultActions getRecipe(String token, Long recipeId) throws Exception {
    return mockMvc.perform(
        get("/api/v1/recipes/{id}", recipeId).header(HttpHeaders.AUTHORIZATION, token));
  }

  // ===== 목록 조회 (AC-LIST-01~17, 28~33, 35) =====

  private ResultActions listRecipes(String token, String query) throws Exception {
    return mockMvc.perform(get("/api/v1/recipes" + query).header(HttpHeaders.AUTHORIZATION, token));
  }

  /** 제목만 다른 최소 레시피를 만들고 id를 돌려준다. */
  private Long simpleRecipe(String token, String title) throws Exception {
    return createdId(
        createRecipe(
            token,
            """
            {"title":"%s","doseG":15.0,"waterG":250.0}
            """
                .formatted(title)));
  }

  private void createRecipes(String token, int count) throws Exception {
    for (int i = 0; i < count; i++) {
      simpleRecipe(token, "레시피 " + i);
    }
  }

  /** created_at을 같은 값으로 맞춘다. 2차 정렬 기준(id DESC)을 검증하려면 동점을 만들어야 한다. */
  private void sameCreatedAt(Long... recipeIds) {
    for (Long id : recipeIds) {
      entityManager
          .createNativeQuery(
              "update recipes set created_at = timestamptz '2026-08-19 00:00:00+00' where id = :id")
          .setParameter("id", id)
          .executeUpdate();
    }
    entityManager.flush();
    entityManager.clear();
  }

  @Test
  @DisplayName("AC-LIST-01 · size를 생략하면 20개를 반환한다")
  void size를_생략하면_20개를_반환한다() throws Exception {
    String token = token();
    createRecipes(token, 25);

    listRecipes(token, "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(20))
        .andExpect(jsonPath("$.size").value(20))
        .andExpect(jsonPath("$.page").value(0));
  }

  @Test
  @DisplayName("AC-LIST-02 · size=100은 허용한다 (상한 포함)")
  void size_100은_허용한다() throws Exception {
    String token = token();
    createRecipes(token, 3);

    listRecipes(token, "?size=100")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.size").value(100))
        .andExpect(jsonPath("$.content.length()").value(3));
  }

  @Test
  @DisplayName("AC-LIST-03 · size=1은 허용한다 (하한 포함)")
  void size_1은_허용한다() throws Exception {
    String token = token();
    createRecipes(token, 3);

    listRecipes(token, "?size=1")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.totalPages").value(3))
        .andExpect(jsonPath("$.hasNext").value(true));
  }

  @Test
  @DisplayName("AC-LIST-04 · page=0이 첫 페이지다")
  void page_0이_첫_페이지다() throws Exception {
    String token = token();
    simpleRecipe(token, "첫째");
    simpleRecipe(token, "둘째");
    Long last = simpleRecipe(token, "셋째");

    listRecipes(token, "?page=0&size=1")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(last));
  }

  @Test
  @DisplayName("AC-LIST-05 · 47건에서 첫 페이지 봉투 값이 정확하다")
  void 첫_페이지_봉투_값이_정확하다() throws Exception {
    String token = token();
    createRecipes(token, 47);

    listRecipes(token, "?page=0&size=20")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(20))
        .andExpect(jsonPath("$.page").value(0))
        .andExpect(jsonPath("$.size").value(20))
        .andExpect(jsonPath("$.totalElements").value(47))
        .andExpect(jsonPath("$.totalPages").value(3))
        .andExpect(jsonPath("$.hasNext").value(true));
  }

  @Test
  @DisplayName("AC-LIST-06 · 마지막 페이지에서 hasNext가 false다")
  void 마지막_페이지에서_hasNext가_false다() throws Exception {
    String token = token();
    createRecipes(token, 47);

    listRecipes(token, "?page=2&size=20")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(7))
        .andExpect(jsonPath("$.page").value(2))
        .andExpect(jsonPath("$.totalPages").value(3))
        .andExpect(jsonPath("$.hasNext").value(false));
  }

  @Test
  @DisplayName("AC-LIST-07 · 응답 봉투는 여섯 키만 갖는다")
  void 응답_봉투는_여섯_키만_갖는다() throws Exception {
    String token = token();
    simpleRecipe(token, "하나");

    String body =
        listRecipes(token, "")
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(com.jayway.jsonpath.JsonPath.<Map<String, Object>>read(body, "$").keySet())
        .containsExactlyInAnyOrder(
            "content", "page", "size", "totalElements", "totalPages", "hasNext");
  }

  @Test
  @DisplayName("AC-LIST-08 · 내 PRIVATE 레시피는 목록에 포함된다")
  void 내_PRIVATE_레시피는_포함된다() throws Exception {
    String token = token();
    Long id = recipeWith(token, "PRIVATE");

    listRecipes(token, "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(id));
  }

  @Test
  @DisplayName("AC-LIST-09 · 타인의 PRIVATE 레시피는 제외된다")
  void 타인의_PRIVATE_레시피는_제외된다() throws Exception {
    User a = newUser("list-09-a");
    User b = newUser("list-09-b");
    Long id = recipeWith(tokenOf(b), "PRIVATE");

    listRecipes(tokenOf(a), "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.id == " + id + ")]").isEmpty())
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  @Test
  @DisplayName("AC-LIST-10 · 타인의 PUBLIC 레시피는 포함된다")
  void 타인의_PUBLIC_레시피는_포함된다() throws Exception {
    User a = newUser("list-10-a");
    User b = newUser("list-10-b");
    Long id = recipeWith(tokenOf(b), "PUBLIC");

    listRecipes(tokenOf(a), "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(id));
  }

  @Test
  @DisplayName("AC-LIST-11 · 상호 팔로우 상대의 FRIENDS 레시피는 포함된다")
  void 상호_팔로우_상대의_FRIENDS_레시피는_포함된다() throws Exception {
    User a = newUser("list-11-a");
    User b = newUser("list-11-b");
    Long id = recipeWith(tokenOf(b), "FRIENDS");
    mutualFollow(a, b);

    listRecipes(tokenOf(a), "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(id));
  }

  @Test
  @DisplayName("AC-LIST-12 · 단방향 팔로우 상대의 FRIENDS 레시피는 제외된다")
  void 단방향_팔로우_상대의_FRIENDS_레시피는_제외된다() throws Exception {
    User a = newUser("list-12-a");
    User b = newUser("list-12-b");
    Long id = recipeWith(tokenOf(b), "FRIENDS");
    follow(a, b);

    listRecipes(tokenOf(a), "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.id == " + id + ")]").isEmpty());
  }

  @Test
  @DisplayName("AC-LIST-13 · 주인 없는 CURATED 시드 레시피는 포함된다")
  void 주인_없는_CURATED_시드_레시피는_포함된다() throws Exception {
    User a = newUser("list-13-a");
    User b = newUser("list-13-b");
    Long id = recipeWith(tokenOf(b), "PUBLIC");
    orphan(id);

    listRecipes(tokenOf(a), "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(id))
        // non_null 직렬화라 ownerUserId가 null이면 키 자체가 사라진다
        .andExpect(jsonPath("$.content[0].ownerUserId").doesNotExist());
  }

  @Test
  @DisplayName("AC-LIST-14 · 소프트 삭제된 레시피는 제외된다")
  void 소프트_삭제된_레시피는_제외된다() throws Exception {
    String token = token();
    Long id = simpleRecipe(token, "지울 것");
    mockMvc
        .perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNoContent());

    listRecipes(token, "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  @Test
  @DisplayName("AC-LIST-15 · createdAt이 같으면 id 내림차순으로 나온다")
  void createdAt이_같으면_id_내림차순으로_나온다() throws Exception {
    String token = token();
    Long first = simpleRecipe(token, "먼저");
    Long second = simpleRecipe(token, "나중");
    sameCreatedAt(first, second);

    listRecipes(token, "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(second))
        .andExpect(jsonPath("$.content[1].id").value(first));
  }

  @Test
  @DisplayName("AC-LIST-16 · ownerUserId 필터가 소유자를 좁힌다")
  void ownerUserId_필터가_소유자를_좁힌다() throws Exception {
    User a = newUser("list-16-a");
    User b = newUser("list-16-b");
    simpleRecipe(tokenOf(a), "에이 1");
    simpleRecipe(tokenOf(a), "에이 2");
    recipeWith(tokenOf(b), "PUBLIC");

    listRecipes(tokenOf(a), "?ownerUserId=" + a.getId())
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(
            jsonPath("$.content[*].ownerUserId").value(everyItem(equalTo(a.getId().intValue()))));
  }

  @Test
  @DisplayName("AC-LIST-17 · 목록 응답에 steps 키가 없다")
  void 목록_응답에_steps_키가_없다() throws Exception {
    String token = token();
    createRecipe(
            token,
            """
            {"title":"스텝 있는 레시피","doseG":15.0,"waterG":250.0,"steps":%s}
            """
                // stepsJson은 스텝당 10.0g이다. 합계가 waterG와 같아야 통과한다
                .formatted(stepsJson(25)))
        .andExpect(status().isCreated());

    listRecipes(token, "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].steps").doesNotExist())
        .andExpect(jsonPath("$.content[0].title").value("스텝 있는 레시피"))
        .andExpect(jsonPath("$.content[0].doseG").value(15.0));
  }

  @Test
  @DisplayName("AC-LIST-28 · size=101은 400이다")
  void size_101은_400이다() throws Exception {
    listRecipes(token(), "?size=101")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-LIST-29 · size=0은 400이다")
  void size_0은_400이다() throws Exception {
    listRecipes(token(), "?size=0")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-LIST-30 · page=-1은 400이다")
  void page_음수는_400이다() throws Exception {
    listRecipes(token(), "?page=-1")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-LIST-31 · page가 전체 페이지 수를 넘으면 빈 content를 반환한다")
  void page가_범위를_넘으면_빈_content다() throws Exception {
    String token = token();
    createRecipes(token, 47);

    listRecipes(token, "?page=99&size=20")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isEmpty())
        .andExpect(jsonPath("$.totalElements").value(47))
        .andExpect(jsonPath("$.totalPages").value(3))
        .andExpect(jsonPath("$.hasNext").value(false));
  }

  @Test
  @DisplayName("AC-LIST-32 · 볼 수 있는 것이 하나도 없으면 빈 목록을 반환한다")
  void 볼_수_있는_것이_없으면_빈_목록이다() throws Exception {
    listRecipes(token(), "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isEmpty())
        .andExpect(jsonPath("$.totalElements").value(0))
        .andExpect(jsonPath("$.totalPages").value(0))
        .andExpect(jsonPath("$.hasNext").value(false));
  }

  @Test
  @DisplayName("AC-LIST-33 · 존재하지 않는 ownerUserId는 빈 목록이다")
  void 존재하지_않는_ownerUserId는_빈_목록이다() throws Exception {
    String token = token();
    simpleRecipe(token, "내 것");

    listRecipes(token, "?ownerUserId=999999")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isEmpty());
  }

  @Test
  @DisplayName("AC-LIST-35 · JWT 없이 레시피 목록을 부르면 401이다")
  void JWT_없이_레시피_목록은_401이다() throws Exception {
    mockMvc.perform(get("/api/v1/recipes")).andExpect(status().isUnauthorized());
  }

  /** owner_user_id를 null로 만든다. 탈퇴자 유기물·CURATED 시드와 같은 상태를 재현한다. */
  private void orphan(Long recipeId) {
    entityManager
        .createNativeQuery("update recipes set owner_user_id = null where id = :id")
        .setParameter("id", recipeId)
        .executeUpdate();
    entityManager.flush();
    entityManager.clear();
  }

  // ---------- 소유자 ----------

  @Test
  @DisplayName("AC-VIS-01 · 소유자는 PRIVATE 레시피를 본다")
  void 소유자는_PRIVATE_레시피를_본다() throws Exception {
    User a = newUser("vis-01");
    Long id = recipeWith(tokenOf(a), "PRIVATE");

    getRecipe(tokenOf(a), id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.visibility").value("PRIVATE"));
  }

  @Test
  @DisplayName("AC-VIS-02 · 소유자는 FRIENDS 레시피를 본다")
  void 소유자는_FRIENDS_레시피를_본다() throws Exception {
    User a = newUser("vis-02");
    Long id = recipeWith(tokenOf(a), "FRIENDS");

    getRecipe(tokenOf(a), id).andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-VIS-03 · 소유자는 PUBLIC 레시피를 본다")
  void 소유자는_PUBLIC_레시피를_본다() throws Exception {
    User a = newUser("vis-03");
    Long id = recipeWith(tokenOf(a), "PUBLIC");

    getRecipe(tokenOf(a), id).andExpect(status().isOk());
  }

  // ---------- 타인 ----------

  @Test
  @DisplayName("AC-VIS-04 · 타인은 PUBLIC 레시피를 본다")
  void 타인은_PUBLIC_레시피를_본다() throws Exception {
    User a = newUser("vis-04a");
    User b = newUser("vis-04b");
    Long id = recipeWith(tokenOf(a), "PUBLIC");

    getRecipe(tokenOf(b), id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(a.getId()));
  }

  @Test
  @DisplayName("AC-VIS-05 · 상호 팔로우면 타인이 FRIENDS 레시피를 본다")
  void 상호_팔로우면_FRIENDS_레시피를_본다() throws Exception {
    User a = newUser("vis-05a");
    User b = newUser("vis-05b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");
    mutualFollow(a, b);

    getRecipe(tokenOf(b), id).andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-VIS-06 · 타인의 PRIVATE 레시피는 403이다")
  void 타인의_PRIVATE_레시피는_403이다() throws Exception {
    User a = newUser("vis-06a");
    User b = newUser("vis-06b");
    Long id = recipeWith(tokenOf(a), "PRIVATE");
    mutualFollow(a, b);

    getRecipe(tokenOf(b), id)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  // ---------- FRIENDS 경계 ----------

  @Test
  @DisplayName("AC-VIS-07 · 내가 소유자를 팔로우만 한 상태면 FRIENDS는 403이다")
  void 내가_팔로우만_하면_FRIENDS는_403이다() throws Exception {
    User a = newUser("vis-07a");
    User b = newUser("vis-07b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");
    follow(b, a);

    getRecipe(tokenOf(b), id)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-VIS-08 · 소유자가 나를 팔로우만 한 상태면 FRIENDS는 403이다")
  void 소유자가_나를_팔로우만_하면_FRIENDS는_403이다() throws Exception {
    User a = newUser("vis-08a");
    User b = newUser("vis-08b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");
    follow(a, b);

    getRecipe(tokenOf(b), id).andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("AC-VIS-09 · 팔로우 관계가 전혀 없으면 FRIENDS는 403이다")
  void 관계없으면_FRIENDS는_403이다() throws Exception {
    User a = newUser("vis-09a");
    User b = newUser("vis-09b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");

    getRecipe(tokenOf(b), id).andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("AC-VIS-10 · 상호 팔로우가 끊기면 다음 요청부터 403이다")
  void 팔로우가_끊기면_즉시_403이다() throws Exception {
    User a = newUser("vis-10a");
    User b = newUser("vis-10b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");
    mutualFollow(a, b);
    getRecipe(tokenOf(b), id).andExpect(status().isOk());

    mockMvc
        .perform(
            delete("/api/v1/users/{id}/follow", a.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(b)))
        .andExpect(status().isNoContent());

    getRecipe(tokenOf(b), id).andExpect(status().isForbidden());
  }

  // ---------- 주인 없는 레시피 ----------

  @Test
  @DisplayName("AC-VIS-11 · owner가 null이고 PUBLIC이면 누구나 본다")
  void owner가_null이고_PUBLIC이면_누구나_본다() throws Exception {
    User a = newUser("vis-11a");
    User b = newUser("vis-11b");
    Long id = recipeWith(tokenOf(a), "PUBLIC");
    orphan(id);

    getRecipe(tokenOf(b), id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").doesNotExist());
  }

  @Test
  @DisplayName("AC-VIS-12 · owner가 null이고 FRIENDS면 403이다")
  void owner가_null이고_FRIENDS면_403이다() throws Exception {
    User a = newUser("vis-12a");
    User b = newUser("vis-12b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");
    orphan(id);

    getRecipe(tokenOf(b), id).andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("AC-VIS-13 · owner가 null이고 PRIVATE면 403이다")
  void owner가_null이고_PRIVATE면_403이다() throws Exception {
    User a = newUser("vis-13a");
    User b = newUser("vis-13b");
    Long id = recipeWith(tokenOf(a), "PRIVATE");
    orphan(id);

    getRecipe(tokenOf(b), id).andExpect(status().isForbidden());
  }

  // ---------- 쓰기는 소유자 전용 ----------

  @Test
  @DisplayName("AC-VIS-14 · PUBLIC 레시피여도 타인은 수정할 수 없다")
  void PUBLIC이어도_타인은_수정할_수_없다() throws Exception {
    User a = newUser("vis-14a");
    User b = newUser("vis-14b");
    Long id = recipeWith(tokenOf(a), "PUBLIC");
    mutualFollow(a, b);

    mockMvc
        .perform(
            put("/api/v1/recipes/{id}", id)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(b))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"남이 바꾼 제목","doseG":15.0,"waterG":250.0}
                    """))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));

    getRecipe(tokenOf(a), id).andExpect(jsonPath("$.title").value("인가 테스트"));
  }

  @Test
  @DisplayName("AC-VIS-15 · PUBLIC 레시피여도 타인은 삭제할 수 없다")
  void PUBLIC이어도_타인은_삭제할_수_없다() throws Exception {
    User a = newUser("vis-15a");
    User b = newUser("vis-15b");
    Long id = recipeWith(tokenOf(a), "PUBLIC");
    mutualFollow(a, b);

    mockMvc
        .perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, tokenOf(b)))
        .andExpect(status().isForbidden());

    getRecipe(tokenOf(a), id).andExpect(status().isOk());
  }

  // ---------- 없음 / 미인증 ----------

  @Test
  @DisplayName("AC-VIS-16 · 소프트 삭제된 PUBLIC 레시피는 404다")
  void 삭제된_PUBLIC_레시피는_404다() throws Exception {
    User a = newUser("vis-16a");
    User b = newUser("vis-16b");
    Long id = recipeWith(tokenOf(a), "PUBLIC");
    mockMvc
        .perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNoContent());

    getRecipe(tokenOf(b), id)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-VIS-17 · 토큰 없이 PUBLIC 레시피를 조회하면 401이다")
  void 토큰_없이_PUBLIC_조회는_401이다() throws Exception {
    User a = newUser("vis-17");
    Long id = recipeWith(tokenOf(a), "PUBLIC");

    mockMvc.perform(get("/api/v1/recipes/{id}", id)).andExpect(status().isUnauthorized());
  }
}
