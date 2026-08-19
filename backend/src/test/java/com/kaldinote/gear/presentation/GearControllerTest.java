package com.kaldinote.gear.presentation;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.domain.UserRole;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사용자 그라인더 등록 테스트가 users·user_grinders에 실제로 쓰므로 클래스 레벨 롤백이 필요하다. 없으면 커밋된 사용자가 남아 {@code
 * UserRepositoryTest}의 절대 개수 단언이 깨진다.
 */
@Transactional
class GearControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private GrinderModelRepository grinderRepository;
  @Autowired private UserRepository userRepository;

  private String token() {
    return "Bearer " + tokenProvider.createAccessToken(1L, UserRole.USER);
  }

  /**
   * 실제 사용자를 저장하고 그 ID로 토큰을 만든다. {@code user_grinders.user_id}가 {@code users(id)}를 참조하므로 고정 ID를 쓰는
   * {@link #token()}으로는 FK 위반이 난다.
   */
  private String realUserToken() {
    User user = userRepository.save(User.create(null, "그라인더테스터", null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  @Test
  @DisplayName("AC-GRIND-33 · 인증 없이 호출하면 401")
  void 인증_없이_그라인더_목록을_조회하면_401이다() throws Exception {
    mockMvc.perform(get("/api/v1/gear/grinders")).andExpect(status().isUnauthorized());
  }

  @Test
  void 그라인더_목록을_조회한다() throws Exception {
    mockMvc
        .perform(get("/api/v1/gear/grinders").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(greaterThanOrEqualTo(10)))
        .andExpect(jsonPath("$[?(@.name == 'C40 MK4')].convertible").value(hasItem(true)));
  }

  /** 요청 본문을 만든다. 세 필드 모두 필수다. */
  private String body(Long sourceId, String setting, Long targetId) {
    return """
        {"sourceGrinderModelId":%d,"sourceSetting":%s,"targetGrinderModelId":%d}
        """
        .formatted(sourceId, setting, targetId);
  }

  private ResultActions convert(Long sourceId, String setting, Long targetId) throws Exception {
    return mockMvc.perform(
        post("/api/v1/gear/grind-conversions")
            .header(HttpHeaders.AUTHORIZATION, token())
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(sourceId, setting, targetId)));
  }

  private Long id(String brand, String name) {
    return grinderRepository.findByBrandAndName(brand, name).orElseThrow().getId();
  }

  @Test
  @DisplayName("AC-GRIND-07, AC-GRIND-21 · 추정치 경고가 함께 오고 범위 안이면 플래그가 내려간다")
  void 분쇄도를_환산하면_추정치_경고가_함께_온다() throws Exception {
    convert(id("Comandante", "C40 MK4"), "22", id("1Zpresso", "K-Plus"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.micron").value(660))
        .andExpect(jsonPath("$.targetSetting").value(30.0))
        .andExpect(jsonPath("$.targetOutOfRange").value(false))
        .andExpect(jsonPath("$.estimated").value(true))
        .andExpect(jsonPath("$.warning").isNotEmpty());
  }

  @Test
  @DisplayName("AC-GRIND-20 · 결과가 대상 범위를 넘으면 플래그를 세우고 값은 돌려준다")
  void 결과가_대상_범위를_넘으면_플래그가_선다() throws Exception {
    // K-Plus 90클릭 = 1980µm → C40 66.0클릭. C40의 최대는 50이다.
    convert(id("1Zpresso", "K-Plus"), "90", id("Comandante", "C40 MK4"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.targetSetting").value(66.0))
        .andExpect(jsonPath("$.targetOutOfRange").value(true));
  }

  @Test
  @DisplayName("AC-GRIND-10 · 하한값 자체는 허용한다")
  void 하한값은_허용된다() throws Exception {
    convert(id("Comandante", "C40 MK4"), "0", id("1Zpresso", "K-Plus"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.micron").value(0))
        .andExpect(jsonPath("$.targetSetting").value(0.0));
  }

  @Test
  @DisplayName("AC-GRIND-11 · 상한값 자체는 허용한다")
  void 상한값은_허용된다() throws Exception {
    // C40 50클릭 = 1500µm → K-Plus 1500 / 22 = 68.18... → 68.2
    convert(id("Comandante", "C40 MK4"), "50", id("1Zpresso", "K-Plus"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.micron").value(1500))
        .andExpect(jsonPath("$.targetSetting").value(68.2));
  }

  @Test
  @DisplayName("AC-GRIND-12 · 상한을 넘으면 거부한다")
  void 상한을_넘으면_400이다() throws Exception {
    convert(id("Comandante", "C40 MK4"), "51", id("1Zpresso", "K-Plus"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("GRIND_SETTING_OUT_OF_RANGE"));
  }

  @Test
  @DisplayName("AC-GRIND-13 · 하한 아래는 거부한다")
  void 하한_아래는_400이다() throws Exception {
    convert(id("Comandante", "C40 MK4"), "-1", id("1Zpresso", "K-Plus"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("GRIND_SETTING_OUT_OF_RANGE"));
  }

  @Test
  @DisplayName("AC-GRIND-30 · 원본이 환산 불가면 422")
  void 원본이_환산_불가면_422다() throws Exception {
    convert(id("Wilfa", "Uniform"), "22", id("Comandante", "C40 MK4"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("GRIND_NOT_CONVERTIBLE"));
  }

  @Test
  @DisplayName("AC-GRIND-31 · 대상이 환산 불가면 422")
  void 대상이_환산_불가면_422다() throws Exception {
    convert(id("Comandante", "C40 MK4"), "22", id("Wilfa", "Uniform"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("GRIND_NOT_CONVERTIBLE"));
  }

  @Test
  @DisplayName("AC-GRIND-32 · 존재하지 않는 그라인더면 404")
  void 존재하지_않는_그라인더_ID면_404다() throws Exception {
    convert(999999L, "22", 999998L)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-GRIND-34 · 필수 필드가 없으면 400")
  void 필수_필드가_없으면_400이다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/gear/grind-conversions")
                .header(HttpHeaders.AUTHORIZATION, token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sourceGrinderModelId\":1,\"targetGrinderModelId\":2}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
        .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItem("sourceSetting")));
  }

  @Test
  @DisplayName("사용자 그라인더를 최소 입력으로 등록한다")
  void 사용자_그라인더를_등록한다() throws Exception {
    Long c40 = id("Comandante", "C40 MK4");
    mockMvc
        .perform(
            post("/api/v1/gear/user-grinders")
                .header(HttpHeaders.AUTHORIZATION, realUserToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"grinderModelId":%d,"nickname":"내 C40"}
                    """
                        .formatted(c40)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grinderModelId").value(c40))
        .andExpect(jsonPath("$.nickname").value("내 C40"))
        .andExpect(jsonPath("$.calibrationOffsetClicks").value(0))
        .andExpect(jsonPath("$.isDefault").value(false));
  }

  @Test
  @DisplayName("존재하지 않는 grinderModelId로 사용자 그라인더를 등록하면 404다")
  void 존재하지_않는_그라인더로_등록하면_404다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/gear/user-grinders")
                .header(HttpHeaders.AUTHORIZATION, realUserToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"grinderModelId":999999}
                    """))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("인증 없이 사용자 그라인더를 등록할 수 없다")
  void 인증_없이_사용자_그라인더를_등록할_수_없다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/gear/user-grinders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"grinderModelId":1}
                    """))
        .andExpect(status().isUnauthorized());
  }

  // ===== 내 그라인더 목록 (AC-ME-04~07) =====

  private void registerGrinder(String token, Long grinderModelId) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/gear/user-grinders")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"grinderModelId":%d,"nickname":"집 그라인더"}
                    """
                        .formatted(grinderModelId)))
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-ME-04 · 내 그라인더 목록에 모델 정보가 펼쳐진다")
  void 내_그라인더_목록에_모델_정보가_펼쳐진다() throws Exception {
    String token = realUserToken();
    registerGrinder(token, id("Comandante", "C40 MK4"));

    mockMvc
        .perform(get("/api/v1/gear/user-grinders").header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].brand").value("Comandante"))
        .andExpect(jsonPath("$[0].grinderModelName").value("C40 MK4"))
        .andExpect(jsonPath("$[0].micronsPerClick").value(30.00))
        .andExpect(jsonPath("$[0].nickname").value("집 그라인더"))
        // 첫 등록을 기본 그라인더로 만드는 로직은 없다. DB 기본값 그대로 false다
        .andExpect(jsonPath("$[0].isDefault").value(false));
  }

  @Test
  @DisplayName("AC-ME-05 · 타인의 그라인더는 보이지 않는다")
  void 타인의_그라인더는_보이지_않는다() throws Exception {
    String mine = realUserToken();
    String others = realUserToken();
    registerGrinder(mine, id("Comandante", "C40 MK4"));
    registerGrinder(others, id("Comandante", "C40 MK4"));

    mockMvc
        .perform(get("/api/v1/gear/user-grinders").header(HttpHeaders.AUTHORIZATION, mine))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].nickname").value("집 그라인더"));
  }

  @Test
  @DisplayName("AC-ME-06 · 등록한 그라인더가 없으면 빈 배열이다")
  void 등록한_그라인더가_없으면_빈_배열이다() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/gear/user-grinders").header(HttpHeaders.AUTHORIZATION, realUserToken()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$.length()").value(0))
        // 페이지 봉투가 아니라 배열이다
        .andExpect(jsonPath("$.content").doesNotExist());
  }

  @Test
  @DisplayName("AC-ME-07 · JWT 없이 그라인더 목록을 부르면 401이다")
  void JWT_없이_내_그라인더_목록은_401이다() throws Exception {
    mockMvc.perform(get("/api/v1/gear/user-grinders")).andExpect(status().isUnauthorized());
  }
}
