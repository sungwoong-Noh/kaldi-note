package com.kaldinote.catalog.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
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
class BeanControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;

  private Long userIdRef;

  private String token() {
    User user = userRepository.save(User.create(null, "테스터", null));
    userIdRef = user.getId();
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private String otherUserToken() {
    User other = userRepository.save(User.create(null, "다른사람", null));
    return "Bearer " + tokenProvider.createAccessToken(other.getId(), other.getRole());
  }

  private ResultActions createRoaster(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/roasters")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private Long roasterId(String token) throws Exception {
    String body =
        createRoaster(
                token,
                """
        {"name":"프릳츠커피컴퍼니-%s"}
        """
                    .formatted(java.util.UUID.randomUUID()))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return Long.valueOf(com.jayway.jsonpath.JsonPath.read(body, "$.id").toString());
  }

  private ResultActions createBeanProduct(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/bean-products")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  @Test
  @DisplayName("AC-BEAN-01 · 최소 입력으로 로스터가 생성된다")
  void 최소_입력으로_로스터가_생성된다() throws Exception {
    String token = token();
    createRoaster(
            token,
            """
        {"name":"프릳츠커피컴퍼니"}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.isSystem").value(false))
        .andExpect(jsonPath("$.createdByUserId").value(userIdRef));
  }

  @Test
  @DisplayName("AC-BEAN-02 · 로스터 목록은 이름순으로 전체 반환된다")
  void 로스터_목록은_이름순으로_반환된다() throws Exception {
    String token = token();
    createRoaster(
            token,
            """
        {"name":"프릳츠커피컴퍼니"}
        """)
        .andExpect(status().isCreated());
    createRoaster(
            token,
            """
        {"name":"커피리브레"}
        """)
        .andExpect(status().isCreated());

    mockMvc
        .perform(get("/api/v1/roasters").header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("커피리브레"))
        .andExpect(jsonPath("$[1].name").value("프릳츠커피컴퍼니"));
  }

  @Test
  @DisplayName("AC-BEAN-20 · 로스터 name 100자는 허용된다")
  void 로스터_name_100자는_허용된다() throws Exception {
    String name = "가".repeat(100);
    createRoaster(
            token(),
            """
        {"name":"%s"}
        """
                .formatted(name))
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-BEAN-21 · 로스터 name 101자는 거부된다")
  void 로스터_name_101자는_거부된다() throws Exception {
    String name = "가".repeat(101);
    createRoaster(
            token(),
            """
        {"name":"%s"}
        """
                .formatted(name))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BEAN-40 · 로스터 이름이 중복되면 거부된다")
  void 로스터_이름이_중복되면_거부된다() throws Exception {
    String token = token();
    createRoaster(
            token,
            """
        {"name":"프릳츠커피컴퍼니"}
        """)
        .andExpect(status().isCreated());

    createRoaster(
            token,
            """
        {"name":"프릳츠커피컴퍼니"}
        """)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DUPLICATE_NAME"));
  }

  @Test
  @DisplayName("AC-BEAN-41 · 인증 없이 로스터를 생성할 수 없다")
  void 인증_없이_로스터를_생성할_수_없다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/roasters")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                {"name":"프릳츠커피컴퍼니"}
                """))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-BEAN-03 · 싱글오리진 원두 상품이 최소 입력으로 생성된다")
  void 싱글오리진_원두_상품이_최소_입력으로_생성된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"예가체프 내추럴","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT",
         "origins":[{"country":"ET"}]}
        """
                .formatted(roasterId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.verified").value(false));
  }

  @Test
  @DisplayName("AC-BEAN-04 · 블렌드 산지의 ratioPercent 합계가 100이면 생성된다")
  void 블렌드_ratio_합계가_100이면_생성된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"시그니처 블렌드","beanMix":"BLEND","roastLevel":"MEDIUM_DARK",
         "origins":[{"country":"ET","ratioPercent":50.0},{"country":"CO","ratioPercent":50.0}]}
        """
                .formatted(roasterId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.origins.length()").value(2));
  }

  @Test
  @DisplayName("AC-BEAN-05 · 싱글오리진은 ratioPercent를 서버가 100.0으로 고정한다")
  void 싱글오리진은_ratioPercent가_100으로_고정된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"예가체프 워시드","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT",
         "origins":[{"country":"ET"}]}
        """
                .formatted(roasterId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.origins[0].ratioPercent").value(100.0));
  }

  @Test
  @DisplayName("AC-BEAN-06 · 원두 상품 목록은 이름순으로 전체 반환된다")
  void 원두_상품_목록은_이름순으로_반환된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"나 상품","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
        """
                .formatted(roasterId))
        .andExpect(status().isCreated());
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"가 상품","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
        """
                .formatted(roasterId))
        .andExpect(status().isCreated());

    mockMvc
        .perform(get("/api/v1/bean-products").header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("가 상품"))
        .andExpect(jsonPath("$[1].name").value("나 상품"));
  }

  @Test
  @DisplayName("AC-BEAN-07 · 원두 상품 단건 조회는 산지를 포함한다")
  void 원두_상품_단건_조회는_산지를_포함한다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    String created =
        createBeanProduct(
                token,
                """
        {"roasterId":%d,"name":"시그니처 블렌드2","beanMix":"BLEND","roastLevel":"MEDIUM_DARK",
         "origins":[{"country":"ET","ratioPercent":50.0},{"country":"CO","ratioPercent":50.0}]}
        """
                    .formatted(roasterId))
            .andReturn()
            .getResponse()
            .getContentAsString();
    Long productId = Long.valueOf(com.jayway.jsonpath.JsonPath.read(created, "$.id").toString());

    mockMvc
        .perform(get("/api/v1/bean-products/" + productId).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.origins.length()").value(2));
  }

  @Test
  @DisplayName("AC-BEAN-45 · SINGLE_ORIGIN인데 origins가 2개면 거부된다")
  void SINGLE_ORIGIN인데_origins가_2개면_거부된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"에러1","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT",
         "origins":[{"country":"ET"},{"country":"CO"}]}
        """
                .formatted(roasterId))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_MIX_ORIGIN_MISMATCH"));
  }

  @Test
  @DisplayName("AC-BEAN-47 · 블렌드 ratioPercent 합계가 100이 아니면 거부된다")
  void 블렌드_ratio_합계가_100이_아니면_거부된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"에러2","beanMix":"BLEND","roastLevel":"LIGHT",
         "origins":[{"country":"ET","ratioPercent":30.0},{"country":"CO","ratioPercent":30.0}]}
        """
                .formatted(roasterId))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_ORIGIN_RATIO_MISMATCH"));
  }

  @Test
  @DisplayName("AC-BEAN-22 · 원두 상품 name 100자는 허용된다")
  void 원두_상품_name_100자는_허용된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    String name = "가".repeat(100);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"%s","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
        """
                .formatted(roasterId, name))
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-BEAN-23 · 원두 상품 name 101자는 거부된다")
  void 원두_상품_name_101자는_거부된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    String name = "가".repeat(101);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"%s","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
        """
                .formatted(roasterId, name))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BEAN-42 · 존재하지 않는 roasterId는 404다")
  void 존재하지_않는_roasterId는_404다() throws Exception {
    createBeanProduct(
            token(),
            """
        {"roasterId":999999,"name":"에러3","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
        """)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BEAN-43 · 같은 로스터 안에서 상품 이름이 중복되면 거부된다")
  void 같은_로스터_안에서_상품_이름이_중복되면_거부된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"예가체프 내추럴","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
        """
                .formatted(roasterId))
        .andExpect(status().isCreated());

    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"예가체프 내추럴","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
        """
                .formatted(roasterId))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DUPLICATE_NAME"));
  }

  @Test
  @DisplayName("AC-BEAN-44 · roastLevel이 없으면 거부된다")
  void roastLevel이_없으면_거부된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"에러4","beanMix":"SINGLE_ORIGIN","origins":[{"country":"ET"}]}
        """
                .formatted(roasterId))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BEAN-46 · BLEND인데 origins가 1개면 거부된다")
  void BLEND인데_origins가_1개면_거부된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"에러5","beanMix":"BLEND","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
        """
                .formatted(roasterId))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_MIX_ORIGIN_MISMATCH"));
  }

  @Test
  @DisplayName("AC-BEAN-48 · origins의 country가 없으면 거부된다")
  void origins의_country가_없으면_거부된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"에러6","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{}]}
        """
                .formatted(roasterId))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BEAN-49 · 존재하지 않는 varietyId는 404다")
  void 존재하지_않는_varietyId는_404다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"에러7","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT",
         "origins":[{"country":"ET","varietyId":999999}]}
        """
                .formatted(roasterId))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BEAN-50 · 존재하지 않는 processId는 404다")
  void 존재하지_않는_processId는_404다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(
            token,
            """
        {"roasterId":%d,"name":"에러8","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT",
         "origins":[{"country":"ET","processId":999999}]}
        """
                .formatted(roasterId))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BEAN-51 · 인증 없이 원두 상품을 생성할 수 없다")
  void 인증_없이_원두_상품을_생성할_수_없다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/bean-products")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                {"roasterId":1,"name":"에러9","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
                """))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-BEAN-52 · 존재하지 않는 원두 상품 조회는 404다")
  void 존재하지_않는_원두_상품_조회는_404다() throws Exception {
    mockMvc
        .perform(get("/api/v1/bean-products/999999").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }
}
