package com.kaldinote.recipe.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.infrastructure.RecipeRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/**
 * users·recipes·recipe_steps·follows에 실제로 쓰므로 클래스 레벨 @Transactional이 필수다. 빠뜨리면 UserRepositoryTest 등
 * 건수 단언이 깨진다(docs/JOURNAL.md 2026-08-17 패턴).
 */
@Transactional
class RecipeForkControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private GrinderModelRepository grinderRepository;
  @Autowired private RecipeRepository recipeRepository;
  @PersistenceContext private EntityManager entityManager;

  private User newUser(String nickname) {
    return userRepository.save(User.create(null, nickname, null));
  }

  private String tokenOf(User user) {
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private Long grinderId(String brand, String name) {
    return grinderRepository.findByBrandAndName(brand, name).orElseThrow().getId();
  }

  private Long createdId(ResultActions actions) throws Exception {
    String response =
        actions.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    return ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();
  }

  private ResultActions createRecipe(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/recipes")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  /** visibility를 지정해 스텝 없는 레시피를 만들고 id를 돌려준다. */
  private Long recipeWith(String token, String visibility) throws Exception {
    return createdId(
        createRecipe(
            token,
            """
            {"title":"포크 원본","doseG":15.0,"waterG":250.0,"visibility":"%s"}
            """
                .formatted(visibility)));
  }

  /** 스텝 5개(총 물량 300g)짜리 PUBLIC 레시피를 만들고 id를 돌려준다. */
  private Long recipeWithFiveSteps(String token) throws Exception {
    return createdId(
        createRecipe(
            token,
            """
            {"title":"포크 원본","doseG":20.0,"waterG":300.0,"visibility":"PUBLIC","steps":[
              {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":45,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":90,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":135,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":165,"durationSeconds":10,"waterG":60.0}
            ]}
            """));
  }

  private ResultActions getRecipe(String token, Long recipeId) throws Exception {
    return mockMvc.perform(
        get("/api/v1/recipes/{id}", recipeId).header(HttpHeaders.AUTHORIZATION, token));
  }

  private ResultActions forkRecipe(String token, Long recipeId) throws Exception {
    return mockMvc.perform(
        post("/api/v1/recipes/{id}/fork", recipeId).header(HttpHeaders.AUTHORIZATION, token));
  }

  /** title/doseG/waterG는 고정, visibility만 바꿔 PUT한다. */
  private void putVisibility(String token, Long recipeId, String visibility) throws Exception {
    mockMvc
        .perform(
            put("/api/v1/recipes/{id}", recipeId)
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"포크 원본","doseG":15.0,"waterG":250.0,"visibility":"%s"}
                    """
                        .formatted(visibility)))
        .andExpect(status().isOk());
  }

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

  /** owner_user_id를 null로 만든다. 탈퇴자 유기물·CURATED 시드와 같은 상태를 재현한다. */
  private void orphan(Long recipeId) {
    entityManager
        .createNativeQuery("update recipes set owner_user_id = null where id = :id")
        .setParameter("id", recipeId)
        .executeUpdate();
    entityManager.flush();
    entityManager.clear();
  }

  private void setSourceType(Long recipeId, String sourceType) {
    entityManager
        .createNativeQuery("update recipes set source_type = :t where id = :id")
        .setParameter("t", sourceType)
        .setParameter("id", recipeId)
        .executeUpdate();
    entityManager.flush();
    entityManager.clear();
  }

  private void setSourceFields(
      Long recipeId, String authorName, String sourceUrl, String sourceNote) {
    entityManager
        .createNativeQuery(
            "update recipes set author_name = :a, source_url = :u, source_note = :n where id = :id")
        .setParameter("a", authorName)
        .setParameter("u", sourceUrl)
        .setParameter("n", sourceNote)
        .setParameter("id", recipeId)
        .executeUpdate();
    entityManager.flush();
    entityManager.clear();
  }

  private record ForkChain(String cToken, Long r1, Long r2, Long r3) {}

  /** R1(A, PUBLIC) → B가 포크해 R2 → R2를 PUBLIC으로 바꿈 → C가 포크해 R3. AC-FORK-06·07이 공유한다. */
  private ForkChain threeStepForkChain(String suffix) throws Exception {
    User a = newUser("fork-chain-a-" + suffix);
    User b = newUser("fork-chain-b-" + suffix);
    User c = newUser("fork-chain-c-" + suffix);
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");
    Long r2 = createdId(forkRecipe(tokenOf(b), r1));
    putVisibility(tokenOf(b), r2, "PUBLIC");
    Long r3 = createdId(forkRecipe(tokenOf(c), r2));
    return new ForkChain(tokenOf(c), r1, r2, r3);
  }

  // ---------- 생성과 계보 ----------

  @Test
  @DisplayName("AC-FORK-01 · 포크하면 새 레시피가 생긴다")
  void 포크하면_새_레시피가_생긴다() throws Exception {
    User a = newUser("fork-01a");
    User b = newUser("fork-01b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");

    Long forkedId =
        createdId(
            forkRecipe(tokenOf(b), r1)
                .andExpect(jsonPath("$.title").value("포크 원본"))
                .andExpect(jsonPath("$.doseG").value(15.0)));

    assertThat(forkedId).isNotEqualTo(r1);
  }

  @Test
  @DisplayName("AC-FORK-02 · 포크본의 소유자는 포크한 사용자다")
  void 포크본의_소유자는_포크한_사용자다() throws Exception {
    User a = newUser("fork-02a");
    User b = newUser("fork-02b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");

    forkRecipe(tokenOf(b), r1).andExpect(jsonPath("$.ownerUserId").value(b.getId()));
  }

  @Test
  @DisplayName("AC-FORK-03 · 포크본의 공개범위는 PRIVATE이다")
  void 포크본의_공개범위는_PRIVATE이다() throws Exception {
    User a = newUser("fork-03a");
    User b = newUser("fork-03b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");

    forkRecipe(tokenOf(b), r1).andExpect(jsonPath("$.visibility").value("PRIVATE"));
  }

  @Test
  @DisplayName("AC-FORK-04 · 포크본의 parentRecipeId는 원본 id다")
  void 포크본의_parentRecipeId는_원본_id다() throws Exception {
    User a = newUser("fork-04a");
    User b = newUser("fork-04b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");

    forkRecipe(tokenOf(b), r1).andExpect(jsonPath("$.parentRecipeId").value(r1));
  }

  @Test
  @DisplayName("AC-FORK-05 · 원본이 포크가 아니면 forkRootId는 원본 id다")
  void 원본이_포크가_아니면_forkRootId는_원본_id다() throws Exception {
    User a = newUser("fork-05a");
    User b = newUser("fork-05b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");

    forkRecipe(tokenOf(b), r1).andExpect(jsonPath("$.forkRootId").value(r1));
  }

  @Test
  @DisplayName("AC-FORK-06 · 3단계 체인에서 forkRootId는 최초 원본을 가리킨다")
  void 체인에서_forkRootId는_최초_원본을_가리킨다() throws Exception {
    ForkChain chain = threeStepForkChain("06");

    getRecipe(chain.cToken(), chain.r3()).andExpect(jsonPath("$.forkRootId").value(chain.r1()));
  }

  @Test
  @DisplayName("AC-FORK-07 · 3단계 체인에서 parentRecipeId는 직전 원본을 가리킨다")
  void 체인에서_parentRecipeId는_직전_원본을_가리킨다() throws Exception {
    ForkChain chain = threeStepForkChain("07");

    getRecipe(chain.cToken(), chain.r3()).andExpect(jsonPath("$.parentRecipeId").value(chain.r2()));
    assertThat(chain.r2()).isNotEqualTo(chain.r1());
  }

  // ---------- 깊은 복사 ----------

  @Test
  @DisplayName("AC-FORK-08 · 스텝 개수와 순서가 복사된다")
  void 스텝_개수와_순서가_복사된다() throws Exception {
    User a = newUser("fork-08a");
    User b = newUser("fork-08b");
    Long r1 = recipeWithFiveSteps(tokenOf(a));

    forkRecipe(tokenOf(b), r1)
        .andExpect(jsonPath("$.steps.length()").value(5))
        .andExpect(jsonPath("$.steps[0].stepOrder").value(1))
        .andExpect(jsonPath("$.steps[4].stepOrder").value(5));
  }

  @Test
  @DisplayName("AC-FORK-09 · 스텝의 값이 그대로 복사된다")
  void 스텝의_값이_그대로_복사된다() throws Exception {
    User a = newUser("fork-09a");
    User b = newUser("fork-09b");
    Long r1 = recipeWithFiveSteps(tokenOf(a));

    forkRecipe(tokenOf(b), r1)
        .andExpect(jsonPath("$.steps[0].stepType").value("BLOOM"))
        .andExpect(jsonPath("$.steps[0].startAtSeconds").value(0))
        .andExpect(jsonPath("$.steps[0].durationSeconds").value(10))
        .andExpect(jsonPath("$.steps[0].waterG").value(60.0));
  }

  @Test
  @DisplayName("AC-FORK-10 · 스텝이 0개여도 포크된다")
  void 스텝이_0개여도_포크된다() throws Exception {
    User a = newUser("fork-10a");
    User b = newUser("fork-10b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");

    forkRecipe(tokenOf(b), r1)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.steps.length()").value(0));
  }

  @Test
  @DisplayName("AC-FORK-11 · 원본을 수정해도 포크본은 변하지 않는다")
  void 원본을_수정해도_포크본은_변하지_않는다() throws Exception {
    User a = newUser("fork-11a");
    User b = newUser("fork-11b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");
    Long r2 = createdId(forkRecipe(tokenOf(b), r1));

    mockMvc
        .perform(
            put("/api/v1/recipes/{id}", r1)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"포크 원본","doseG":20.0,"waterG":250.0,"visibility":"PUBLIC"}
                    """))
        .andExpect(status().isOk());

    getRecipe(tokenOf(b), r2).andExpect(jsonPath("$.doseG").value(15.0));
  }

  @Test
  @DisplayName("AC-FORK-12 · 원본의 스텝을 지워도 포크본의 스텝은 남는다")
  void 원본의_스텝을_지워도_포크본의_스텝은_남는다() throws Exception {
    User a = newUser("fork-12a");
    User b = newUser("fork-12b");
    Long r1 = recipeWithFiveSteps(tokenOf(a));
    Long r2 = createdId(forkRecipe(tokenOf(b), r1));

    mockMvc
        .perform(
            put("/api/v1/recipes/{id}", r1)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"포크 원본","doseG":20.0,"waterG":300.0,"visibility":"PUBLIC","steps":[]}
                    """))
        .andExpect(status().isOk());

    getRecipe(tokenOf(b), r2).andExpect(jsonPath("$.steps.length()").value(5));
  }

  @Test
  @DisplayName("AC-FORK-13 · 마이크론 스냅샷이 원본 값 그대로 복사된다")
  void 마이크론_스냅샷이_원본_값_그대로_복사된다() throws Exception {
    User a = newUser("fork-13a");
    User b = newUser("fork-13b");
    Long c40 = grinderId("Comandante", "C40 MK4");
    Long r1 =
        createdId(
            createRecipe(
                tokenOf(a),
                """
                {"title":"포크 원본","doseG":15.0,"waterG":250.0,"visibility":"PUBLIC",
                 "grinderModelId":%d,"grindSettingValue":22,"grindSettingUnit":"CLICK"}
                """
                    .formatted(c40)));

    forkRecipe(tokenOf(b), r1).andExpect(jsonPath("$.grindMicronEstimated").value(660));
  }

  // ---------- 출처와 타입 ----------

  @Test
  @DisplayName("AC-FORK-14 · CURATED를 포크하면 sourceType은 USER다")
  void CURATED를_포크하면_sourceType은_USER다() throws Exception {
    User a = newUser("fork-14a");
    User b = newUser("fork-14b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");
    setSourceType(r1, "CURATED");

    forkRecipe(tokenOf(b), r1).andExpect(jsonPath("$.sourceType").value("USER"));
  }

  @Test
  @DisplayName("AC-FORK-15 · 출처 3필드는 원본에서 승계된다")
  void 출처_3필드는_원본에서_승계된다() throws Exception {
    User a = newUser("fork-15a");
    User b = newUser("fork-15b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");
    setSourceFields(r1, "Tetsu Kasuya", "https://example.com/46", "4:6 메서드");

    Long r2 = createdId(forkRecipe(tokenOf(b), r1));

    Recipe fork = recipeRepository.findById(r2).orElseThrow();
    assertThat(fork.getAuthorName()).isEqualTo("Tetsu Kasuya");
    assertThat(fork.getSourceUrl()).isEqualTo("https://example.com/46");
    assertThat(fork.getSourceNote()).isEqualTo("4:6 메서드");
  }

  @Test
  @DisplayName("AC-FORK-16 · 주인 없는 PUBLIC 레시피도 포크된다")
  void 주인_없는_PUBLIC_레시피도_포크된다() throws Exception {
    User owner = newUser("fork-16owner");
    User b = newUser("fork-16b");
    Long r1 = recipeWith(tokenOf(owner), "PUBLIC");
    orphan(r1);

    forkRecipe(tokenOf(b), r1)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.ownerUserId").value(b.getId()))
        .andExpect(jsonPath("$.parentRecipeId").value(r1));
  }

  // ---------- 중복 ----------

  @Test
  @DisplayName("AC-FORK-17 · 같은 원본을 두 번 포크할 수 있다")
  void 같은_원본을_두_번_포크할_수_있다() throws Exception {
    User a = newUser("fork-17a");
    User b = newUser("fork-17b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");

    Long fork1 = createdId(forkRecipe(tokenOf(b), r1));
    Long fork2 = createdId(forkRecipe(tokenOf(b), r1));

    assertThat(fork1).isNotEqualTo(fork2);
    getRecipe(tokenOf(b), fork1).andExpect(jsonPath("$.parentRecipeId").value(r1));
    getRecipe(tokenOf(b), fork2).andExpect(jsonPath("$.parentRecipeId").value(r1));
  }

  @Test
  @DisplayName("AC-FORK-18 · 자기 레시피를 자기가 포크할 수 있다")
  void 자기_레시피를_자기가_포크할_수_있다() throws Exception {
    User a = newUser("fork-18a");
    Long r1 = recipeWith(tokenOf(a), "PRIVATE");

    forkRecipe(tokenOf(a), r1)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.ownerUserId").value(a.getId()))
        .andExpect(jsonPath("$.parentRecipeId").value(r1));
  }

  // ---------- 인가 ----------

  @Test
  @DisplayName("AC-FORK-19 · 상호 팔로우면 FRIENDS 레시피를 포크할 수 있다")
  void 상호_팔로우면_FRIENDS_레시피를_포크할_수_있다() throws Exception {
    User a = newUser("fork-19a");
    User b = newUser("fork-19b");
    Long r1 = recipeWith(tokenOf(a), "FRIENDS");
    mutualFollow(a, b);

    forkRecipe(tokenOf(b), r1).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-FORK-20 · 타인의 PRIVATE 레시피는 포크할 수 없다")
  void 타인의_PRIVATE_레시피는_포크할_수_없다() throws Exception {
    User a = newUser("fork-20a");
    User b = newUser("fork-20b");
    Long r1 = recipeWith(tokenOf(a), "PRIVATE");
    mutualFollow(a, b);

    forkRecipe(tokenOf(b), r1)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-FORK-21 · 단방향 팔로우면 FRIENDS 레시피를 포크할 수 없다")
  void 단방향_팔로우면_FRIENDS_레시피를_포크할_수_없다() throws Exception {
    User a = newUser("fork-21a");
    User b = newUser("fork-21b");
    Long r1 = recipeWith(tokenOf(a), "FRIENDS");
    follow(b, a);

    forkRecipe(tokenOf(b), r1)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  // ---------- 에러 ----------

  @Test
  @DisplayName("AC-FORK-22 · 없는 레시피를 포크하면 404다")
  void 없는_레시피를_포크하면_404다() throws Exception {
    User b = newUser("fork-22b");

    forkRecipe(tokenOf(b), 999999L)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-FORK-23 · 소프트 삭제된 레시피를 포크하면 404다")
  void 소프트_삭제된_레시피를_포크하면_404다() throws Exception {
    User a = newUser("fork-23a");
    User b = newUser("fork-23b");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");
    mockMvc
        .perform(delete("/api/v1/recipes/{id}", r1).header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNoContent());

    forkRecipe(tokenOf(b), r1)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-FORK-24 · 토큰 없이 포크하면 401이다")
  void 토큰_없이_포크하면_401이다() throws Exception {
    User a = newUser("fork-24a");
    Long r1 = recipeWith(tokenOf(a), "PUBLIC");

    mockMvc.perform(post("/api/v1/recipes/{id}/fork", r1)).andExpect(status().isUnauthorized());
  }
}
