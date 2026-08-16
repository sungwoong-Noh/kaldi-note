package com.kaldinote.recipe.presentation;

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
}
