# 사진 첨부 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-18-media-attachment.md`

**Goal:** 사용자가 자신의 레시피·브루잉 로그에 사진을 최대 4장 첨부할 수 있게 된다. 클라이언트가 OCI Object Storage에 PAR(Pre-Authenticated Request)로 직접 업로드하고, 백엔드는 업로드 URL 발급·메타데이터 확정·목록 조회·삭제 4개 엔드포인트만 담당한다.

**Architecture:** 새 도메인 `media`를 만든다(`backend/CLAUDE.md`에 이미 자리가 잡혀 있다). OCI 호출은 `ObjectStorageClient` 인터페이스로 격리한다 — 프로덕션은 OCI Java SDK로 구현한 `OciObjectStorageClient`(`@Profile("!test")`)를, 테스트는 `FakeObjectStorageClient`(`@Profile("test")`)를 스프링이 자동으로 골라 쓴다. 인가는 media 도메인이 직접 판정하지 않는다 — `RecipeService`·`BrewLogService`에 `requireOwned`/`requireViewable` public 메서드를 새로 추가하고, `AttachmentService`가 `targetType`에 따라 둘 중 하나로 라우팅한다(도메인 간 ID 참조 원칙 유지 — media는 `Recipe`/`BrewLog` 엔티티를 직접 참조하지 않는다).

**작업 위치:** `backend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-MEDIA-01 | RECIPE 소유자가 업로드 URL을 발급받는다 | Task 3 | API 테스트 |
| AC-MEDIA-02 | BREW_LOG 소유자가 업로드 URL을 발급받는다 | Task 3 | API 테스트 |
| AC-MEDIA-03 | expiresAt은 발급 시각으로부터 정확히 10분 뒤다 | Task 3 | API 테스트 |
| AC-MEDIA-04 | content-type마다 확장자가 다르게 붙는다 | Task 3 | API 테스트 |
| AC-MEDIA-05 | 허용 밖 content-type은 400이다 | Task 3 | API 테스트 |
| AC-MEDIA-06 | 없는 대상은 404다 | Task 3 | API 테스트 |
| AC-MEDIA-07 | 소프트 삭제된 레시피는 404다 | Task 3 | API 테스트 |
| AC-MEDIA-08 | 소유자가 아니면 403이다 (발급) | Task 3 | API 테스트 |
| AC-MEDIA-09 | 이미 4장이면 400이다 | Task 3 | API 테스트 |
| AC-MEDIA-10 | 3장까지는 정상 발급된다 (경계값) | Task 3 | API 테스트 |
| AC-MEDIA-11 | 토큰 없이 요청하면 401이다 (발급) | Task 3 | API 테스트 |
| AC-MEDIA-12 | 정상 확정하면 201과 AttachmentResponse를 반환한다 | Task 4 | API 테스트 |
| AC-MEDIA-13 | 두 번째 확정의 sortOrder는 2다 | Task 4 | API 테스트 |
| AC-MEDIA-14 | content_type은 클라이언트 값이 아니라 OCI HEAD 응답 값이 저장된다 | Task 4 | API 테스트 |
| AC-MEDIA-15 | width·height가 없으면 400이다 | Task 4 | API 테스트 |
| AC-MEDIA-16 | OCI에 파일이 없으면(HEAD 실패) 404다 | Task 4 | API 테스트 |
| AC-MEDIA-17 | 10MB를 초과하면 OCI 객체를 지우고 400을 반환한다 | Task 4 | API 테스트 |
| AC-MEDIA-18 | 정확히 10MB는 통과한다 (경계값 포함) | Task 4 | API 테스트 |
| AC-MEDIA-19 | 같은 objectKey로 중복 확정하면 400이다 | Task 4 | API 테스트 |
| AC-MEDIA-20 | 소유자가 아니면 403이다 (확정) | Task 4 | API 테스트 |
| AC-MEDIA-21 | 토큰 없이 확정하면 401이다 | Task 4 | API 테스트 |
| AC-MEDIA-22 | 소유자는 PRIVATE 대상의 첨부를 sortOrder 오름차순으로 본다 | Task 5 | API 테스트 |
| AC-MEDIA-23 | 타인은 PUBLIC 대상의 첨부를 본다 | Task 5 | API 테스트 |
| AC-MEDIA-24 | 상호 팔로우면 FRIENDS 대상의 첨부를 본다 | Task 5 | API 테스트 |
| AC-MEDIA-25 | 타인의 PRIVATE 대상은 403이다 | Task 5 | API 테스트 |
| AC-MEDIA-26 | 첨부가 없으면 빈 배열을 반환한다 | Task 5 | API 테스트 |
| AC-MEDIA-27 | 없는 대상은 404다 (목록) | Task 5 | API 테스트 |
| AC-MEDIA-28 | 토큰 없이 조회하면 401이다 | Task 5 | API 테스트 |
| AC-MEDIA-29 | 소유자가 삭제하면 204이고 DB 행과 OCI 객체가 모두 사라진다 | Task 6 | API 테스트 |
| AC-MEDIA-30 | 소유자가 아니면 403이다 (삭제) | Task 6 | API 테스트 |
| AC-MEDIA-31 | 없는 첨부를 삭제하면 404다 | Task 6 | API 테스트 |
| AC-MEDIA-32 | 토큰 없이 삭제하면 401이다 | Task 6 | API 테스트 |

**32개 전부 매핑됨** (Task 1·2는 인프라 태스크라 직접 매핑된 AC가 없다 — Task 3~6이 32개를 나눠 담당).

---

## Global Constraints

- **새 마이그레이션은 `V9__create_attachments_table.sql` 하나뿐.** 기존 파일은 절대 수정하지 않는다.
- **`ObjectStorageClient` 인터페이스로 OCI 의존성을 격리한다.** 테스트는 항상 `FakeObjectStorageClient`(`@Profile("test")`)를 쓴다. `AttachmentControllerTest`가 HEAD 응답(`Content-Length`·`Content-Type`)을 테스트마다 다르게 스텁할 수 있어야 AC-MEDIA-14·17을 검증할 수 있다.
- **content-type 허용 목록은 `image/jpeg`·`image/png`·`image/webp` 3개뿐이다.** 그 외(`image/gif` 등)는 전부 `INVALID_REQUEST`(400).
- **대상당 첨부는 최대 4장.** `sortOrder`는 서버가 확정 순서대로 1부터 자동 부여한다. 재정렬 API는 만들지 않는다(스펙 비목표).
- **confirm 시점의 `content_type`은 요청 본문이 아니라 OCI HEAD 응답을 신뢰한다.** 요청 DTO에 `contentType` 필드 자체를 두지 않는다.
- **업로드 URL의 만료는 발급 시각 + 정확히 600초(10분).**
- **10,485,760바이트(10MB) 초과 시 OCI 객체를 삭제하고 400을 반환한다.** 정확히 10MB는 통과한다.
- **인가는 media 도메인이 직접 판정하지 않는다.** `RecipeService.requireOwned`/`requireViewable`, `BrewLogService.requireOwned`/`requireViewable`(이번에 신설)로 위임한다. `AttachmentService`는 `TargetType`으로 라우팅만 한다.
- **새 `ErrorCode` 없음.** `NOT_FOUND`(404)·`FORBIDDEN`(403)·`INVALID_REQUEST`(400)만 쓴다. 401은 `SecurityConfig`의 `anyRequest().authenticated()`가 자동 처리한다 — `/api/v1/attachments/**`에 별도 `permitAll` 설정을 추가하지 않는다.
- **버킷은 public-read다.** 응답의 `url`은 인증 없이 접근 가능한 고정 URL이다(스펙에서 이미 감안하고 진행하기로 결정된 사항 — 재론하지 않는다).
- **실제 OCI 연동(자격증명으로 실제 PAR 발급·업로드)의 수동 검증은 배포 이후로 미룬다.** 이 계획의 완료 기준에는 포함하지 않는다(스펙의 "수동 확인" 항목 그대로).

---

## File Structure

```
backend/src/main/java/com/kaldinote/media/
├── domain/
│   ├── TargetType.java                        (Create — RECIPE, BREW_LOG)
│   └── Attachment.java                         (Create)
├── infrastructure/
│   ├── AttachmentRepository.java                (Create)
│   ├── ObjectStorageClient.java                 (Create — 인터페이스)
│   ├── ObjectHead.java                          (Create — record)
│   ├── FakeObjectStorageClient.java             (Create — @Profile("test"))
│   ├── OciProperties.java                       (Create — @ConfigurationProperties)
│   ├── OciConfig.java                           (Create)
│   └── OciObjectStorageClient.java              (Create — @Profile("!test"), 실제 OCI SDK)
├── application/
│   └── AttachmentService.java                   (Create — Task 3, Modify — Task 4·5·6)
└── presentation/
    ├── AttachmentController.java                (Create — Task 3, Modify — Task 4·5·6)
    └── dto/
        ├── UploadUrlRequest.java                (Create)
        ├── UploadUrlResponse.java                (Create)
        ├── ConfirmAttachmentRequest.java         (Create — Task 4)
        └── AttachmentResponse.java               (Create — Task 4)

backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java
                                                    (Modify — Task 3: requireOwned / Task 5: requireViewable)
backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java
                                                    (Modify — Task 3: requireOwned / Task 5: requireViewable)

backend/src/main/resources/db/migration/V9__create_attachments_table.sql   (Create — Task 1)
backend/build.gradle.kts                                                    (Modify — Task 2: OCI SDK 의존성)
backend/src/main/resources/application.yml            (Modify — Task 2: kaldi.oci.*)
backend/src/main/resources/application-local.yml       (Modify — Task 2: dummy 기본값)
backend/src/test/resources/application-test.yml        (Modify — Task 2: dummy 기본값)

backend/src/test/java/com/kaldinote/media/
├── infrastructure/
│   ├── AttachmentRepositoryTest.java            (Create — Task 1)
│   └── FakeObjectStorageClientTest.java          (Create — Task 2)
└── presentation/
    └── AttachmentControllerTest.java             (Create — Task 3, Modify — Task 4·5·6)
```

---

## Task 1: 스키마 + Attachment 엔티티 + 리포지토리

**Files:**
- Create: `backend/src/main/resources/db/migration/V9__create_attachments_table.sql`
- Create: `backend/src/main/java/com/kaldinote/media/domain/TargetType.java`
- Create: `backend/src/main/java/com/kaldinote/media/domain/Attachment.java`
- Create: `backend/src/main/java/com/kaldinote/media/infrastructure/AttachmentRepository.java`
- Test: `backend/src/test/java/com/kaldinote/media/infrastructure/AttachmentRepositoryTest.java`

**Covers:** 없음 (인프라 — Task 3~6이 이 위에서 AC를 검증한다)

**Interfaces:**
- Consumes: 없음 (선행 태스크 없음)
- Produces: `Attachment.create(Long ownerUserId, TargetType targetType, Long targetId, String objectKey, String contentType, Integer width, Integer height, Integer sortOrder): Attachment`, `AttachmentRepository`(`countByTargetTypeAndTargetId`, `existsByObjectKey`, `findByTargetTypeAndTargetIdOrderBySortOrderAsc`)

- [x] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/media/infrastructure/AttachmentRepositoryTest.java`

```java
package com.kaldinote.media.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.media.domain.Attachment;
import com.kaldinote.media.domain.TargetType;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class AttachmentRepositoryTest extends AbstractIntegrationTest {

  @Autowired private AttachmentRepository attachmentRepository;
  @Autowired private UserRepository userRepository;

  private Long ownerId() {
    return userRepository.save(User.create(null, "첨부테스터", null)).getId();
  }

  @Test
  void 저장하고_조회한다() {
    Long owner = ownerId();
    Attachment saved =
        attachmentRepository.save(
            Attachment.create(
                owner, TargetType.RECIPE, 1L, "k-" + owner, "image/jpeg", 100, 100, 1));

    Attachment found = attachmentRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getTargetType()).isEqualTo(TargetType.RECIPE);
    assertThat(found.getSortOrder()).isEqualTo(1);
  }

  @Test
  void objectKey는_유니크_제약이_있다() {
    Long owner = ownerId();
    String key = "dup-" + owner;
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 1L, key, "image/jpeg", 100, 100, 1));
    attachmentRepository.flush();

    assertThatThrownBy(
            () -> {
              attachmentRepository.save(
                  Attachment.create(owner, TargetType.RECIPE, 2L, key, "image/jpeg", 100, 100, 1));
              attachmentRepository.flush();
            })
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void countByTargetTypeAndTargetId는_대상별로_센다() {
    Long owner = ownerId();
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 10L, "a-" + owner, "image/jpeg", 100, 100, 1));
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 10L, "b-" + owner, "image/jpeg", 100, 100, 2));
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 11L, "c-" + owner, "image/jpeg", 100, 100, 1));

    assertThat(attachmentRepository.countByTargetTypeAndTargetId(TargetType.RECIPE, 10L))
        .isEqualTo(2);
    assertThat(attachmentRepository.countByTargetTypeAndTargetId(TargetType.RECIPE, 11L))
        .isEqualTo(1);
  }

  @Test
  void findByTargetTypeAndTargetIdOrderBySortOrderAsc는_정렬순으로_돌려준다() {
    Long owner = ownerId();
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 20L, "x-" + owner, "image/jpeg", 100, 100, 2));
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 20L, "y-" + owner, "image/jpeg", 100, 100, 1));

    var found =
        attachmentRepository.findByTargetTypeAndTargetIdOrderBySortOrderAsc(TargetType.RECIPE, 20L);

    assertThat(found).hasSize(2);
    assertThat(found.get(0).getSortOrder()).isEqualTo(1);
    assertThat(found.get(1).getSortOrder()).isEqualTo(2);
  }

  @Test
  void existsByObjectKey는_존재_여부를_확인한다() {
    Long owner = ownerId();
    String key = "exists-" + owner;
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 30L, key, "image/jpeg", 100, 100, 1));

    assertThat(attachmentRepository.existsByObjectKey(key)).isTrue();
    assertThat(attachmentRepository.existsByObjectKey("no-such-key")).isFalse();
  }
}
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*AttachmentRepositoryTest'`
Expected: FAIL — 컴파일 실패(`Attachment`·`TargetType`·`AttachmentRepository`가 없음).

**실측:** 예측과 정확히 일치. `compileTestJava` 단계에서 3개 컴파일 오류(`package com.kaldinote.media.domain does not exist` 등)로 실패.

- [x] **Step 3: 마이그레이션·엔티티·리포지토리 구현**

`backend/src/main/resources/db/migration/V9__create_attachments_table.sql`

```sql
CREATE TABLE attachments (
    id              BIGSERIAL PRIMARY KEY,
    owner_user_id   BIGINT       NOT NULL REFERENCES users (id),
    target_type     VARCHAR(20)  NOT NULL,
    target_id       BIGINT       NOT NULL,
    object_key      VARCHAR(500) NOT NULL UNIQUE,
    content_type    VARCHAR(50)  NOT NULL,
    width           INTEGER      NOT NULL,
    height          INTEGER      NOT NULL,
    sort_order      INTEGER      NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_attachment_width_positive  CHECK (width > 0),
    CONSTRAINT chk_attachment_height_positive CHECK (height > 0)
);

CREATE INDEX idx_attachments_target ON attachments (target_type, target_id);
```

`backend/src/main/java/com/kaldinote/media/domain/TargetType.java`

```java
package com.kaldinote.media.domain;

public enum TargetType {
  RECIPE,
  BREW_LOG
}
```

`backend/src/main/java/com/kaldinote/media/domain/Attachment.java`

```java
package com.kaldinote.media.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * updated_at이 없다 — 첨부는 확정 이후 수정되지 않고 삭제만 된다. 삭제 인가는 대상을 다시 조회하지 않고
 * ownerUserId로 직접 판정한다(대상이 소프트 삭제돼도 소유자는 여전히 지울 수 있다).
 */
@Entity
@Table(name = "attachments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Attachment {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "owner_user_id", nullable = false)
  private Long ownerUserId;

  @Enumerated(EnumType.STRING)
  @Column(name = "target_type", nullable = false, length = 20)
  private TargetType targetType;

  @Column(name = "target_id", nullable = false)
  private Long targetId;

  @Column(name = "object_key", nullable = false, unique = true, length = 500)
  private String objectKey;

  @Column(name = "content_type", nullable = false, length = 50)
  private String contentType;

  @Column(nullable = false)
  private Integer width;

  @Column(nullable = false)
  private Integer height;

  @Column(name = "sort_order", nullable = false)
  private Integer sortOrder;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  private Attachment(
      Long ownerUserId,
      TargetType targetType,
      Long targetId,
      String objectKey,
      String contentType,
      Integer width,
      Integer height,
      Integer sortOrder) {
    this.ownerUserId = ownerUserId;
    this.targetType = targetType;
    this.targetId = targetId;
    this.objectKey = objectKey;
    this.contentType = contentType;
    this.width = width;
    this.height = height;
    this.sortOrder = sortOrder;
    this.createdAt = Instant.now();
  }

  public static Attachment create(
      Long ownerUserId,
      TargetType targetType,
      Long targetId,
      String objectKey,
      String contentType,
      Integer width,
      Integer height,
      Integer sortOrder) {
    return new Attachment(
        ownerUserId, targetType, targetId, objectKey, contentType, width, height, sortOrder);
  }

  public boolean isOwnedBy(Long userId) {
    return this.ownerUserId != null && this.ownerUserId.equals(userId);
  }
}
```

`backend/src/main/java/com/kaldinote/media/infrastructure/AttachmentRepository.java`

```java
package com.kaldinote.media.infrastructure;

import com.kaldinote.media.domain.Attachment;
import com.kaldinote.media.domain.TargetType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

  long countByTargetTypeAndTargetId(TargetType targetType, Long targetId);

  boolean existsByObjectKey(String objectKey);

  List<Attachment> findByTargetTypeAndTargetIdOrderBySortOrderAsc(
      TargetType targetType, Long targetId);
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*AttachmentRepositoryTest'`
Expected: PASS, 5 tests

**실측:** 5개 전부 PASS. `./gradlew clean check` 전체도 통과(회귀 없음). `spotlessApply`가 `Attachment.java` Javadoc 줄바꿈만 자동 정리(로직 변경 없음).

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(media): attachments 스키마 + 엔티티 + 리포지토리" && cd backend
```

---

## Task 2: ObjectStorageClient 인터페이스 + 가짜 구현 + OCI Java SDK 실제 구현

**Files:**
- Modify: `backend/build.gradle.kts`
- Create: `backend/src/main/java/com/kaldinote/media/infrastructure/ObjectStorageClient.java`
- Create: `backend/src/main/java/com/kaldinote/media/infrastructure/ObjectHead.java`
- Create: `backend/src/main/java/com/kaldinote/media/infrastructure/FakeObjectStorageClient.java`
- Create: `backend/src/main/java/com/kaldinote/media/infrastructure/OciProperties.java`
- Create: `backend/src/main/java/com/kaldinote/media/infrastructure/OciConfig.java`
- Create: `backend/src/main/java/com/kaldinote/media/infrastructure/OciObjectStorageClient.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/resources/application-local.yml`
- Modify: `backend/src/test/resources/application-test.yml`
- Test: `backend/src/test/java/com/kaldinote/media/infrastructure/FakeObjectStorageClientTest.java`

**Covers:** 없음 (인프라 — AC는 검증하지 않지만, 이 위에서 Task 3~6이 전부 동작한다)

**Interfaces:**
- Consumes: 없음
- Produces: `ObjectStorageClient`(인터페이스 — `issueUploadUrl`, `head`, `delete`, `publicUrl`), `ObjectHead(long contentLength, String contentType)`, `FakeObjectStorageClient.stubUploaded(String, long, String)` / `wasDeleted(String): boolean` / `reset()`(테스트 전용, `@Profile("test")`로 스프링이 자동 주입)

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/media/infrastructure/FakeObjectStorageClientTest.java`

```java
package com.kaldinote.media.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class FakeObjectStorageClientTest {

  private final FakeObjectStorageClient client = new FakeObjectStorageClient();

  @Test
  void stub한_객체는_head로_조회된다() {
    client.stubUploaded("k1", 12345L, "image/jpeg");

    ObjectHead head = client.head("k1").orElseThrow();

    assertThat(head.contentLength()).isEqualTo(12345L);
    assertThat(head.contentType()).isEqualTo("image/jpeg");
  }

  @Test
  void stub하지_않은_객체는_head가_비어있다() {
    assertThat(client.head("no-such-key")).isEmpty();
  }

  @Test
  void delete하면_head가_다시_비어있고_삭제로_기록된다() {
    client.stubUploaded("k2", 100L, "image/png");

    client.delete("k2");

    assertThat(client.head("k2")).isEmpty();
    assertThat(client.wasDeleted("k2")).isTrue();
  }

  @Test
  void issueUploadUrl과_publicUrl은_objectKey를_포함한_URL을_돌려준다() {
    String uploadUrl = client.issueUploadUrl("k3", "image/jpeg", Instant.now().plusSeconds(600));
    String publicUrl = client.publicUrl("k3");

    assertThat(uploadUrl).contains("k3");
    assertThat(publicUrl).contains("k3");
  }
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*FakeObjectStorageClientTest'`
Expected: FAIL — 컴파일 실패(`FakeObjectStorageClient`·`ObjectHead`가 없음).

- [ ] **Step 3: 인터페이스·가짜 구현 작성**

`backend/src/main/java/com/kaldinote/media/infrastructure/ObjectStorageClient.java`

```java
package com.kaldinote.media.infrastructure;

import java.time.Instant;
import java.util.Optional;

/**
 * OCI Object Storage 접근을 추상화한다. 실제 구현({@link OciObjectStorageClient})은 프로덕션에서,
 * {@link FakeObjectStorageClient}는 테스트에서 쓴다 — 스프링 프로필로 갈린다.
 */
public interface ObjectStorageClient {

  /** ObjectWrite 권한의 PAR을 발급하고 업로드용 URL을 돌려준다. */
  String issueUploadUrl(String objectKey, String contentType, Instant expiresAt);

  /** 객체 존재 여부와 메타데이터를 확인한다. 없으면 빈 Optional. */
  Optional<ObjectHead> head(String objectKey);

  /** 객체를 삭제한다. */
  void delete(String objectKey);

  /** 버킷이 public-read이므로 인증 없이 접근 가능한 고정 URL을 돌려준다. */
  String publicUrl(String objectKey);
}
```

`backend/src/main/java/com/kaldinote/media/infrastructure/ObjectHead.java`

```java
package com.kaldinote.media.infrastructure;

public record ObjectHead(long contentLength, String contentType) {}
```

`backend/src/main/java/com/kaldinote/media/infrastructure/FakeObjectStorageClient.java`

```java
package com.kaldinote.media.infrastructure;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** 테스트 전용 가짜 구현. HEAD 응답을 테스트마다 다르게 스텁할 수 있어야 AC-MEDIA-14·17을 검증할 수 있다. */
@Component
@Profile("test")
public class FakeObjectStorageClient implements ObjectStorageClient {

  private final Map<String, ObjectHead> heads = new ConcurrentHashMap<>();
  private final Set<String> deletedKeys = ConcurrentHashMap.newKeySet();

  @Override
  public String issueUploadUrl(String objectKey, String contentType, Instant expiresAt) {
    return "https://fake-oci.local/p/test-token/n/test-ns/b/test-bucket/o/" + objectKey;
  }

  @Override
  public Optional<ObjectHead> head(String objectKey) {
    return Optional.ofNullable(heads.get(objectKey));
  }

  @Override
  public void delete(String objectKey) {
    heads.remove(objectKey);
    deletedKeys.add(objectKey);
  }

  @Override
  public String publicUrl(String objectKey) {
    return "https://fake-oci.local/n/test-ns/b/test-bucket/o/" + objectKey;
  }

  /** 테스트에서 "실제 업로드까지 마쳤다"를 재현한다. */
  public void stubUploaded(String objectKey, long contentLength, String contentType) {
    heads.put(objectKey, new ObjectHead(contentLength, contentType));
  }

  public boolean wasDeleted(String objectKey) {
    return deletedKeys.contains(objectKey);
  }

  /** 테스트 간 상태 누수를 막는다. */
  public void reset() {
    heads.clear();
    deletedKeys.clear();
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*FakeObjectStorageClientTest'`
Expected: PASS, 4 tests

- [ ] **Step 5: OCI Java SDK 의존성 + 설정 + 실제 구현 추가, 컴파일 확인**

`backend/build.gradle.kts` (Modify — `dependencies` 블록에 2줄 추가)

```kotlin
	implementation("com.oracle.oci.sdk:oci-java-sdk-objectstorage:3.80.3")
	implementation("com.oracle.oci.sdk:oci-java-sdk-common-httpclient-jersey3:3.80.3")
```

`backend/src/main/resources/application.yml` (Modify — `kaldi:` 아래에 추가)

```yaml
  oci:
    tenancy-id: ${OCI_TENANCY_ID}
    user-id: ${OCI_USER_ID}
    fingerprint: ${OCI_FINGERPRINT}
    private-key: ${OCI_PRIVATE_KEY}
    region: ${OCI_REGION:ap-chuncheon-1}
    namespace: ${OCI_NAMESPACE}
    bucket-name: ${OCI_BUCKET_NAME}
```

`backend/src/main/resources/application-local.yml` (Modify — `kaldi:` 아래에 추가. OAuth와 같은 이유로 dummy 기본값을 둔다 — 실기 검증 없이 `bootRun`이 항상 뜨게 하기 위함)

```yaml
  oci:
    tenancy-id: ${OCI_TENANCY_ID:dummy}
    user-id: ${OCI_USER_ID:dummy}
    fingerprint: ${OCI_FINGERPRINT:dummy}
    private-key: ${OCI_PRIVATE_KEY:dummy}
    region: ${OCI_REGION:ap-chuncheon-1}
    namespace: ${OCI_NAMESPACE:dummy}
    bucket-name: ${OCI_BUCKET_NAME:dummy}
```

`backend/src/test/resources/application-test.yml` (Modify — `kaldi:` 아래에 추가. `OciObjectStorageClient` 빈은 `@Profile("!test")`라 테스트에서 만들어지지 않지만, `application.yml`의 기본값 없는 플레이스홀더(`${OCI_TENANCY_ID}` 등)가 그대로 남으면 환경변수가 없을 때 컨텍스트 기동 자체가 실패한다 — OAuth와 동일한 함정)

```yaml
  oci:
    tenancy-id: ${OCI_TENANCY_ID:dummy}
    user-id: ${OCI_USER_ID:dummy}
    fingerprint: ${OCI_FINGERPRINT:dummy}
    private-key: ${OCI_PRIVATE_KEY:dummy}
    region: ${OCI_REGION:ap-chuncheon-1}
    namespace: ${OCI_NAMESPACE:dummy}
    bucket-name: ${OCI_BUCKET_NAME:dummy}
```

`backend/src/main/java/com/kaldinote/media/infrastructure/OciProperties.java`

```java
package com.kaldinote.media.infrastructure;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kaldi.oci")
public record OciProperties(
    String tenancyId,
    String userId,
    String fingerprint,
    String privateKey,
    String region,
    String namespace,
    String bucketName) {}
```

`backend/src/main/java/com/kaldinote/media/infrastructure/OciConfig.java`

```java
package com.kaldinote.media.infrastructure;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(OciProperties.class)
public class OciConfig {}
```

`backend/src/main/java/com/kaldinote/media/infrastructure/OciObjectStorageClient.java`

```java
package com.kaldinote.media.infrastructure;

import com.oracle.bmc.auth.SimpleAuthenticationDetailsProvider;
import com.oracle.bmc.model.BmcException;
import com.oracle.bmc.objectstorage.model.CreatePreauthenticatedRequestDetails;
import com.oracle.bmc.objectstorage.model.PreauthenticatedRequest;
import com.oracle.bmc.objectstorage.requests.CreatePreauthenticatedRequestRequest;
import com.oracle.bmc.objectstorage.requests.DeleteObjectRequest;
import com.oracle.bmc.objectstorage.requests.HeadObjectRequest;
import com.oracle.bmc.objectstorage.responses.CreatePreauthenticatedRequestResponse;
import com.oracle.bmc.objectstorage.responses.HeadObjectResponse;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * OCI Object Storage 실제 연동. PAR 발급·HEAD·삭제 3개만 쓴다. 로컬·테스트는 이 빈이 아니라
 * {@link FakeObjectStorageClient}를 쓴다 — 실제 자격증명으로 하는 검증은 배포 이후로 미룬다(스펙의 수동 확인 항목).
 */
@Component
@Profile("!test")
public class OciObjectStorageClient implements ObjectStorageClient {

  private final com.oracle.bmc.objectstorage.ObjectStorageClient client;
  private final OciProperties properties;

  public OciObjectStorageClient(OciProperties properties) {
    this.properties = properties;
    Supplier<InputStream> privateKeySupplier =
        () -> new ByteArrayInputStream(properties.privateKey().getBytes(StandardCharsets.UTF_8));
    SimpleAuthenticationDetailsProvider provider =
        SimpleAuthenticationDetailsProvider.builder()
            .tenantId(properties.tenancyId())
            .userId(properties.userId())
            .fingerprint(properties.fingerprint())
            .privateKeySupplier(privateKeySupplier)
            .build();
    this.client =
        com.oracle.bmc.objectstorage.ObjectStorageClient.builder()
            .region(properties.region())
            .build(provider);
  }

  @Override
  public String issueUploadUrl(String objectKey, String contentType, Instant expiresAt) {
    CreatePreauthenticatedRequestDetails details =
        CreatePreauthenticatedRequestDetails.builder()
            .name("upload-" + objectKey)
            .objectName(objectKey)
            .accessType(CreatePreauthenticatedRequestDetails.AccessType.ObjectWrite)
            .timeExpires(Date.from(expiresAt))
            .build();

    CreatePreauthenticatedRequestResponse response =
        client.createPreauthenticatedRequest(
            CreatePreauthenticatedRequestRequest.builder()
                .namespaceName(properties.namespace())
                .bucketName(properties.bucketName())
                .createPreauthenticatedRequestDetails(details)
                .build());

    PreauthenticatedRequest par = response.getPreauthenticatedRequest();
    return "https://objectstorage." + properties.region() + ".oraclecloud.com" + par.getAccessUri();
  }

  @Override
  public Optional<ObjectHead> head(String objectKey) {
    try {
      HeadObjectResponse response =
          client.headObject(
              HeadObjectRequest.builder()
                  .namespaceName(properties.namespace())
                  .bucketName(properties.bucketName())
                  .objectName(objectKey)
                  .build());
      return Optional.of(new ObjectHead(response.getContentLength(), response.getContentType()));
    } catch (BmcException e) {
      if (e.getStatusCode() == 404) {
        return Optional.empty();
      }
      throw e;
    }
  }

  @Override
  public void delete(String objectKey) {
    client.deleteObject(
        DeleteObjectRequest.builder()
            .namespaceName(properties.namespace())
            .bucketName(properties.bucketName())
            .objectName(objectKey)
            .build());
  }

  @Override
  public String publicUrl(String objectKey) {
    return "https://objectstorage."
        + properties.region()
        + ".oraclecloud.com/n/"
        + properties.namespace()
        + "/b/"
        + properties.bucketName()
        + "/o/"
        + objectKey;
  }
}
```

Run: `./gradlew clean check`
Expected: 컴파일 성공, 기존 테스트 전부 PASS(회귀 없음), `FakeObjectStorageClientTest` 4개 PASS. **OCI Java SDK의 정확한 API 표면(클래스·메서드명)은 문서 검색으로 확인했지 컴파일해보지 않았다 — 여기서 처음 컴파일된다.** 이름이 다르면(예: `Region` 처리 방식, 빌더 메서드명) 실제 해석된 시그니처로 고친다. `ObjectStorageClient`(우리 인터페이스)와 `OciObjectStorageClient`의 다른 태스크(3~6)는 이 SDK 세부사항과 무관하므로 영향받지 않는다.

- [ ] **Step 6: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(media): ObjectStorageClient 인터페이스 + 가짜/OCI 구현" && cd backend
```

---

## Task 3: 업로드 URL 발급 API

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Create: `backend/src/main/java/com/kaldinote/media/presentation/dto/UploadUrlRequest.java`
- Create: `backend/src/main/java/com/kaldinote/media/presentation/dto/UploadUrlResponse.java`
- Create: `backend/src/main/java/com/kaldinote/media/application/AttachmentService.java`
- Create: `backend/src/main/java/com/kaldinote/media/presentation/AttachmentController.java`
- Test: `backend/src/test/java/com/kaldinote/media/presentation/AttachmentControllerTest.java`

**Covers:** AC-MEDIA-01 ~ AC-MEDIA-11 (11개)

**Interfaces:**
- Consumes: `AttachmentRepository`(Task 1), `ObjectStorageClient`(Task 2), `RecipeService.requireOwned(Long, Long): void`(신설), `BrewLogService.requireOwned(Long, Long): void`(신설)
- Produces: `AttachmentService.issueUploadUrl(Long userId, UploadUrlRequest): UploadUrlResponse`, `AttachmentService`의 private `requireOwned(TargetType, Long, Long)`·`attachmentCount(TargetType, Long)` — Task 4~6이 재사용한다

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/media/presentation/AttachmentControllerTest.java`

```java
package com.kaldinote.media.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.media.domain.Attachment;
import com.kaldinote.media.domain.TargetType;
import com.kaldinote.media.infrastructure.AttachmentRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class AttachmentControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private GrinderModelRepository grinderModelRepository;
  @Autowired private AttachmentRepository attachmentRepository;

  private User newUser(String nickname) {
    return userRepository.save(User.create(null, nickname, null));
  }

  private String tokenOf(User user) {
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private Long createdId(ResultActions actions) throws Exception {
    String body = actions.andReturn().getResponse().getContentAsString();
    return Long.valueOf(JsonPath.read(body, "$.id").toString());
  }

  private Long recipeId(String token, String visibility) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"첨부 테스트","doseG":15.0,"waterG":250.0,"visibility":"%s"}
                    """
                        .formatted(visibility))));
  }

  private Long c40Id() {
    return grinderModelRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow().getId();
  }

  private Long userGrinderId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/gear/user-grinders")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"grinderModelId":%d,"nickname":"첨부 테스트 그라인더"}
                    """
                        .formatted(c40Id()))));
  }

  private Long roasterId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/roasters")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"첨부테스트로스터-%s"}
                    """
                        .formatted(UUID.randomUUID()))));
  }

  private Long beanProductId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/bean-products")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"roasterId":%d,"name":"첨부테스트상품-%s","beanMix":"SINGLE_ORIGIN",
                     "roastLevel":"LIGHT","origins":[{"country":"ET"}]}
                    """
                        .formatted(roasterId(token), UUID.randomUUID()))));
  }

  private Long beanBatchId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/bean-batches")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"beanProductId":%d,"weightG":200.0,"roastedAt":"%s"}
                    """
                        .formatted(beanProductId(token), LocalDate.now().minusDays(3)))));
  }

  /** roaster→beanProduct→beanBatch→userGrinder→recipe(PUBLIC) 체인을 다 태워 브루로그 하나를 만든다. */
  private Long brewLogId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/brew-logs")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
                     "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
                     "userGrinderId":%d,"actualGrindSettingValue":22.0}
                    """
                        .formatted(
                            recipeId(token, "PUBLIC"),
                            beanBatchId(token),
                            Instant.now().minus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS),
                            userGrinderId(token)))));
  }

  private ResultActions issueUploadUrl(
      String token, String targetType, Long targetId, String contentType) throws Exception {
    return mockMvc.perform(
        post("/api/v1/attachments/upload-url")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                """
                {"targetType":"%s","targetId":%d,"contentType":"%s"}
                """
                    .formatted(targetType, targetId, contentType)));
  }

  private void seedAttachment(TargetType targetType, Long targetId, Long ownerId, int sortOrder) {
    attachmentRepository.save(
        Attachment.create(
            ownerId,
            targetType,
            targetId,
            "seed/" + UUID.randomUUID(),
            "image/jpeg",
            100,
            100,
            sortOrder));
  }

  @Test
  @DisplayName("AC-MEDIA-01 · RECIPE 소유자가 업로드 URL을 발급받는다")
  void RECIPE_소유자가_업로드_URL을_발급받는다() throws Exception {
    User owner = newUser("media-01");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/jpeg")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.objectKey", startsWith("attachments/RECIPE/" + r1 + "/")))
        .andExpect(jsonPath("$.objectKey", endsWith(".jpg")))
        .andExpect(jsonPath("$.uploadUrl").exists())
        .andExpect(jsonPath("$.expiresAt").exists());
  }

  @Test
  @DisplayName("AC-MEDIA-02 · BREW_LOG 소유자가 업로드 URL을 발급받는다")
  void BREW_LOG_소유자가_업로드_URL을_발급받는다() throws Exception {
    User owner = newUser("media-02");
    Long l1 = brewLogId(tokenOf(owner));

    issueUploadUrl(tokenOf(owner), "BREW_LOG", l1, "image/png")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.objectKey", startsWith("attachments/BREW_LOG/" + l1 + "/")))
        .andExpect(jsonPath("$.objectKey", endsWith(".png")));
  }

  @Test
  @DisplayName("AC-MEDIA-03 · expiresAt은 발급 시각으로부터 정확히 10분 뒤다")
  void expiresAt은_10분_뒤다() throws Exception {
    User owner = newUser("media-03");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    Instant before = Instant.now();

    String body =
        issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/jpeg")
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Instant expiresAt = Instant.parse((String) JsonPath.read(body, "$.expiresAt"));
    long deltaSeconds = expiresAt.getEpochSecond() - before.getEpochSecond();
    assertThat(deltaSeconds).isBetween(595L, 605L);
  }

  @Test
  @DisplayName("AC-MEDIA-04 · content-type마다 확장자가 다르게 붙는다")
  void 콘텐츠타입마다_확장자가_다르게_붙는다() throws Exception {
    User owner = newUser("media-04");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/webp")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.objectKey", endsWith(".webp")));
  }

  @Test
  @DisplayName("AC-MEDIA-05 · 허용 밖 content-type은 400이다")
  void 허용_밖_콘텐츠타입은_400이다() throws Exception {
    User owner = newUser("media-05");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/gif")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    assertThat(attachmentRepository.countByTargetTypeAndTargetId(TargetType.RECIPE, r1)).isZero();
  }

  @Test
  @DisplayName("AC-MEDIA-06 · 없는 대상은 404다")
  void 없는_대상은_404다() throws Exception {
    User owner = newUser("media-06");

    issueUploadUrl(tokenOf(owner), "RECIPE", 999999L, "image/jpeg")
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-MEDIA-07 · 소프트 삭제된 레시피는 404다")
  void 소프트_삭제된_레시피는_404다() throws Exception {
    User owner = newUser("media-07");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    mockMvc
        .perform(delete("/api/v1/recipes/{id}", r1).header(HttpHeaders.AUTHORIZATION, tokenOf(owner)))
        .andExpect(status().isNoContent());

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/jpeg")
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-MEDIA-08 · 소유자가 아니면 403이다")
  void 발급_소유자가_아니면_403이다() throws Exception {
    User owner = newUser("media-08a");
    User other = newUser("media-08b");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    issueUploadUrl(tokenOf(other), "RECIPE", r1, "image/jpeg")
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-MEDIA-09 · 이미 4장이면 400이다")
  void 이미_4장이면_400이다() throws Exception {
    User owner = newUser("media-09");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    for (int i = 1; i <= 4; i++) {
      seedAttachment(TargetType.RECIPE, r1, owner.getId(), i);
    }

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/jpeg")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-MEDIA-10 · 3장까지는 정상 발급된다 (경계값)")
  void 세장까지는_정상_발급된다() throws Exception {
    User owner = newUser("media-10");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    for (int i = 1; i <= 3; i++) {
      seedAttachment(TargetType.RECIPE, r1, owner.getId(), i);
    }

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/jpeg").andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-MEDIA-11 · 토큰 없이 요청하면 401이다")
  void 토큰_없이_요청하면_401이다() throws Exception {
    User owner = newUser("media-11");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    mockMvc
        .perform(
            post("/api/v1/attachments/upload-url")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"targetType":"RECIPE","targetId":%d,"contentType":"image/jpeg"}
                    """
                        .formatted(r1)))
        .andExpect(status().isUnauthorized());
  }
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*AttachmentControllerTest'`

Expected: FAIL. `AC-MEDIA-11`(미인증)은 `SecurityConfig`의 `anyRequest().authenticated()`가 매핑 여부와 무관하게 먼저 걸려 **처음부터 통과할 수 있다**(포크·공개범위 계획에서 관찰된 패턴). 나머지 10개는 `POST /api/v1/attachments/upload-url` 매핑이 없어 404 또는 500으로 실패한다. 정확한 개수는 실행해서 확인하고 이 항목에 실측값을 남긴다.

- [ ] **Step 3: RecipeService·BrewLogService에 requireOwned 추가, AttachmentService·Controller 구현**

`backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java` (Modify — `fork` 메서드 다음에 추가)

```java
  /** media 도메인이 업로드 권한을 확인할 때 쓴다. 엔티티를 밖으로 내보내지 않는다(도메인 간 ID 참조 원칙). */
  public void requireOwned(Long userId, Long recipeId) {
    findOwned(userId, recipeId);
  }
```

`backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java` (Modify — `get` 메서드 다음에 추가)

```java
  /** media 도메인이 업로드 권한을 확인할 때 쓴다. */
  public void requireOwned(Long userId, Long brewLogId) {
    BrewLog log =
        brewLogRepository
            .findById(brewLogId)
            .orElseThrow(
                () ->
                    new BusinessException(ErrorCode.NOT_FOUND, "브루잉 로그를 찾을 수 없습니다: " + brewLogId));
    if (!log.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 브루잉 로그만 접근할 수 있습니다.");
    }
  }
```

`backend/src/main/java/com/kaldinote/media/presentation/dto/UploadUrlRequest.java`

```java
package com.kaldinote.media.presentation.dto;

import com.kaldinote.media.domain.TargetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UploadUrlRequest(
    @NotNull TargetType targetType, @NotNull Long targetId, @NotBlank String contentType) {}
```

`backend/src/main/java/com/kaldinote/media/presentation/dto/UploadUrlResponse.java`

```java
package com.kaldinote.media.presentation.dto;

import java.time.Instant;

public record UploadUrlResponse(String objectKey, String uploadUrl, Instant expiresAt) {}
```

`backend/src/main/java/com/kaldinote/media/application/AttachmentService.java`

```java
package com.kaldinote.media.application;

import com.kaldinote.brewlog.application.BrewLogService;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.media.domain.TargetType;
import com.kaldinote.media.infrastructure.AttachmentRepository;
import com.kaldinote.media.infrastructure.ObjectStorageClient;
import com.kaldinote.media.presentation.dto.UploadUrlRequest;
import com.kaldinote.media.presentation.dto.UploadUrlResponse;
import com.kaldinote.recipe.application.RecipeService;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AttachmentService {

  private static final Map<String, String> ALLOWED_CONTENT_TYPES =
      Map.of(
          "image/jpeg", "jpg",
          "image/png", "png",
          "image/webp", "webp");
  private static final int MAX_ATTACHMENTS_PER_TARGET = 4;
  private static final long UPLOAD_URL_TTL_SECONDS = 600;

  private final RecipeService recipeService;
  private final BrewLogService brewLogService;
  private final AttachmentRepository attachmentRepository;
  private final ObjectStorageClient objectStorageClient;

  public UploadUrlResponse issueUploadUrl(Long userId, UploadUrlRequest request) {
    requireOwned(request.targetType(), request.targetId(), userId);

    String extension = ALLOWED_CONTENT_TYPES.get(request.contentType());
    if (extension == null) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "지원하지 않는 이미지 형식입니다: " + request.contentType());
    }

    if (attachmentCount(request.targetType(), request.targetId()) >= MAX_ATTACHMENTS_PER_TARGET) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "첨부는 대상당 최대 4장까지입니다.");
    }

    String objectKey =
        "attachments/%s/%d/%s.%s"
            .formatted(request.targetType(), request.targetId(), UUID.randomUUID(), extension);
    Instant expiresAt = Instant.now().plusSeconds(UPLOAD_URL_TTL_SECONDS);
    String uploadUrl =
        objectStorageClient.issueUploadUrl(objectKey, request.contentType(), expiresAt);

    return new UploadUrlResponse(objectKey, uploadUrl, expiresAt);
  }

  private void requireOwned(TargetType targetType, Long targetId, Long userId) {
    switch (targetType) {
      case RECIPE -> recipeService.requireOwned(userId, targetId);
      case BREW_LOG -> brewLogService.requireOwned(userId, targetId);
    }
  }

  private long attachmentCount(TargetType targetType, Long targetId) {
    return attachmentRepository.countByTargetTypeAndTargetId(targetType, targetId);
  }
}
```

`backend/src/main/java/com/kaldinote/media/presentation/AttachmentController.java`

```java
package com.kaldinote.media.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.media.application.AttachmentService;
import com.kaldinote.media.presentation.dto.UploadUrlRequest;
import com.kaldinote.media.presentation.dto.UploadUrlResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/attachments")
@RequiredArgsConstructor
@Tag(name = "사진 첨부", description = "레시피·브루잉 로그 사진 업로드·조회·삭제")
public class AttachmentController {

  private final AttachmentService attachmentService;

  @PostMapping("/upload-url")
  public UploadUrlResponse issueUploadUrl(
      @Valid @RequestBody UploadUrlRequest request, AuthenticatedUser user) {
    return attachmentService.issueUploadUrl(user.id(), request);
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*AttachmentControllerTest'`
Expected: PASS, 11 tests

전체도 확인한다: `./gradlew clean check`

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(media): 업로드 URL 발급 API" && cd backend
```

---

## Task 4: 업로드 확정 API

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/media/application/AttachmentService.java`
- Modify: `backend/src/main/java/com/kaldinote/media/presentation/AttachmentController.java`
- Create: `backend/src/main/java/com/kaldinote/media/presentation/dto/ConfirmAttachmentRequest.java`
- Create: `backend/src/main/java/com/kaldinote/media/presentation/dto/AttachmentResponse.java`
- Modify: `backend/src/test/java/com/kaldinote/media/presentation/AttachmentControllerTest.java`

**Covers:** AC-MEDIA-12 ~ AC-MEDIA-21 (10개)

**Interfaces:**
- Consumes: Task 3의 `requireOwned`·`attachmentCount`(private, 같은 클래스 내부 재사용), `ObjectStorageClient.head`·`delete`·`publicUrl`(Task 2)
- Produces: `AttachmentService.confirm(Long userId, ConfirmAttachmentRequest): AttachmentResponse`

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/src/test/java/com/kaldinote/media/presentation/AttachmentControllerTest.java` (Modify — 클래스 상단에 필드·헬퍼 추가, 하단에 테스트 10개 추가)

```java
  // 필드 추가
  @Autowired private com.kaldinote.media.infrastructure.FakeObjectStorageClient fakeObjectStorageClient;

  @org.junit.jupiter.api.BeforeEach
  void resetFake() {
    fakeObjectStorageClient.reset();
  }

  private String objectKeyFor(String token, String targetType, Long targetId, String contentType)
      throws Exception {
    String body =
        issueUploadUrl(token, targetType, targetId, contentType)
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return (String) JsonPath.read(body, "$.objectKey");
  }

  private ResultActions confirm(
      String token, String targetType, Long targetId, String objectKey, Integer width, Integer height)
      throws Exception {
    String widthPart = width == null ? "null" : width.toString();
    String heightPart = height == null ? "null" : height.toString();
    return mockMvc.perform(
        post("/api/v1/attachments")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                """
                {"targetType":"%s","targetId":%d,"objectKey":"%s","width":%s,"height":%s}
                """
                    .formatted(targetType, targetId, objectKey, widthPart, heightPart)));
  }
```

```java
  // 테스트 메서드 10개 추가
  @Test
  @DisplayName("AC-MEDIA-12 · 정상 확정하면 201과 AttachmentResponse를 반환한다")
  void 정상_확정하면_201을_반환한다() throws Exception {
    User owner = newUser("media-12");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 500_000L, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 1200, 900)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.targetType").value("RECIPE"))
        .andExpect(jsonPath("$.targetId").value(r1))
        .andExpect(jsonPath("$.width").value(1200))
        .andExpect(jsonPath("$.height").value(900))
        .andExpect(jsonPath("$.sortOrder").value(1));
  }

  @Test
  @DisplayName("AC-MEDIA-13 · 두 번째 확정의 sortOrder는 2다")
  void 두번째_확정의_sortOrder는_2다() throws Exception {
    User owner = newUser("media-13");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String key1 = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(key1, 100_000L, "image/jpeg");
    confirm(tokenOf(owner), "RECIPE", r1, key1, 100, 100).andExpect(status().isCreated());

    String key2 = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(key2, 100_000L, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, key2, 100, 100)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.sortOrder").value(2));
  }

  @Test
  @DisplayName("AC-MEDIA-14 · content_type은 클라이언트 값이 아니라 OCI HEAD 응답 값이 저장된다")
  void content_type은_HEAD_응답_값이_저장된다() throws Exception {
    User owner = newUser("media-14");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/png");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100)
        .andExpect(jsonPath("$.contentType").value("image/png"));
  }

  @Test
  @DisplayName("AC-MEDIA-15 · width·height가 없으면 400이다")
  void width_height가_없으면_400이다() throws Exception {
    User owner = newUser("media-15");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, null, null)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-MEDIA-16 · OCI에 파일이 없으면(HEAD 실패) 404다")
  void OCI에_파일이_없으면_404다() throws Exception {
    User owner = newUser("media-16");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    assertThat(attachmentRepository.existsByObjectKey(objectKey)).isFalse();
  }

  @Test
  @DisplayName("AC-MEDIA-17 · 10MB를 초과하면 OCI 객체를 지우고 400을 반환한다")
  void 10MB_초과하면_객체를_지우고_400을_반환한다() throws Exception {
    User owner = newUser("media-17");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 10_485_761L, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    assertThat(fakeObjectStorageClient.wasDeleted(objectKey)).isTrue();
    assertThat(attachmentRepository.existsByObjectKey(objectKey)).isFalse();
  }

  @Test
  @DisplayName("AC-MEDIA-18 · 정확히 10MB는 통과한다 (경계값 포함)")
  void 정확히_10MB는_통과한다() throws Exception {
    User owner = newUser("media-18");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 10_485_760L, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-MEDIA-19 · 같은 objectKey로 중복 확정하면 400이다")
  void 같은_objectKey로_중복_확정하면_400이다() throws Exception {
    User owner = newUser("media-19");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/jpeg");
    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100).andExpect(status().isCreated());

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-MEDIA-20 · 소유자가 아니면 403이다")
  void 확정_소유자가_아니면_403이다() throws Exception {
    User owner = newUser("media-20a");
    User other = newUser("media-20b");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/jpeg");

    confirm(tokenOf(other), "RECIPE", r1, objectKey, 100, 100)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-MEDIA-21 · 토큰 없이 확정하면 401이다")
  void 토큰_없이_확정하면_401이다() throws Exception {
    User owner = newUser("media-21");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/jpeg");

    mockMvc
        .perform(
            post("/api/v1/attachments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"targetType":"RECIPE","targetId":%d,"objectKey":"%s","width":100,"height":100}
                    """
                        .formatted(r1, objectKey)))
        .andExpect(status().isUnauthorized());
  }
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*AttachmentControllerTest'`
Expected: 새로 추가된 10개 중 `AC-MEDIA-21`은 처음부터 통과(401은 매핑과 무관), 나머지 9개는 `POST /api/v1/attachments` 매핑이 없어 실패. 기존 11개(Task 3)는 계속 PASS. 실행해서 정확한 개수를 이 항목에 남긴다.

- [ ] **Step 3: confirm 구현**

`backend/src/main/java/com/kaldinote/media/presentation/dto/ConfirmAttachmentRequest.java`

```java
package com.kaldinote.media.presentation.dto;

import com.kaldinote.media.domain.TargetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ConfirmAttachmentRequest(
    @NotNull TargetType targetType,
    @NotNull Long targetId,
    @NotBlank String objectKey,
    @NotNull @Positive Integer width,
    @NotNull @Positive Integer height) {}
```

`backend/src/main/java/com/kaldinote/media/presentation/dto/AttachmentResponse.java`

```java
package com.kaldinote.media.presentation.dto;

import com.kaldinote.media.domain.Attachment;
import java.time.Instant;

public record AttachmentResponse(
    Long id,
    String targetType,
    Long targetId,
    String url,
    String contentType,
    Integer width,
    Integer height,
    Integer sortOrder,
    Instant createdAt) {

  public static AttachmentResponse from(Attachment a, String url) {
    return new AttachmentResponse(
        a.getId(),
        a.getTargetType().name(),
        a.getTargetId(),
        url,
        a.getContentType(),
        a.getWidth(),
        a.getHeight(),
        a.getSortOrder(),
        a.getCreatedAt());
  }
}
```

`backend/src/main/java/com/kaldinote/media/application/AttachmentService.java` (Modify — 클래스 상단에 상수 추가, `issueUploadUrl` 다음에 `confirm` 메서드 추가, 새 import 추가)

```java
  private static final long MAX_BYTES = 10_485_760L;
```

```java
  public com.kaldinote.media.presentation.dto.AttachmentResponse confirm(
      Long userId, com.kaldinote.media.presentation.dto.ConfirmAttachmentRequest request) {
    requireOwned(request.targetType(), request.targetId(), userId);

    if (attachmentRepository.existsByObjectKey(request.objectKey())) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "이미 확정된 objectKey입니다: " + request.objectKey());
    }

    com.kaldinote.media.infrastructure.ObjectHead head =
        objectStorageClient
            .head(request.objectKey())
            .orElseThrow(
                () ->
                    new BusinessException(
                        ErrorCode.NOT_FOUND, "업로드된 파일을 찾을 수 없습니다: " + request.objectKey()));

    if (head.contentLength() > MAX_BYTES) {
      objectStorageClient.delete(request.objectKey());
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "파일 크기가 10MB를 초과합니다.");
    }

    int sortOrder = (int) attachmentCount(request.targetType(), request.targetId()) + 1;

    com.kaldinote.media.domain.Attachment attachment =
        com.kaldinote.media.domain.Attachment.create(
            userId,
            request.targetType(),
            request.targetId(),
            request.objectKey(),
            head.contentType(),
            request.width(),
            request.height(),
            sortOrder);

    com.kaldinote.media.domain.Attachment saved = attachmentRepository.save(attachment);
    return com.kaldinote.media.presentation.dto.AttachmentResponse.from(
        saved, objectStorageClient.publicUrl(saved.getObjectKey()));
  }
```

> 위 두 블록은 완전한 import 없이 FQN으로 썼다 — 실제로 반영할 때는 파일 상단에 `import com.kaldinote.media.domain.Attachment;`, `import com.kaldinote.media.infrastructure.ObjectHead;`, `import com.kaldinote.media.presentation.dto.AttachmentResponse;`, `import com.kaldinote.media.presentation.dto.ConfirmAttachmentRequest;`를 추가하고 본문의 FQN을 단순 클래스명으로 정리한다(스포틀리스가 잡아주지 않는 부분이니 커밋 전에 직접 정리한다).

`backend/src/main/java/com/kaldinote/media/presentation/AttachmentController.java` (Modify — `issueUploadUrl` 메서드 다음에 추가, import 2개 추가)

```java
  @PostMapping
  @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.CREATED)
  public com.kaldinote.media.presentation.dto.AttachmentResponse confirm(
      @Valid @RequestBody com.kaldinote.media.presentation.dto.ConfirmAttachmentRequest request,
      AuthenticatedUser user) {
    return attachmentService.confirm(user.id(), request);
  }
```

(같은 이유로 FQN을 썼다 — 반영 시 `import org.springframework.http.HttpStatus;`, `import org.springframework.web.bind.annotation.ResponseStatus;`, `import com.kaldinote.media.presentation.dto.AttachmentResponse;`, `import com.kaldinote.media.presentation.dto.ConfirmAttachmentRequest;`를 상단에 추가하고 본문을 단순화한다.)

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*AttachmentControllerTest'`
Expected: PASS, 21 tests (Task 3의 11개 + 이번 10개)

전체도 확인한다: `./gradlew clean check`

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(media): 업로드 확정 API" && cd backend
```

---

## Task 5: 목록 조회 API

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/main/java/com/kaldinote/media/application/AttachmentService.java`
- Modify: `backend/src/main/java/com/kaldinote/media/presentation/AttachmentController.java`
- Modify: `backend/src/test/java/com/kaldinote/media/presentation/AttachmentControllerTest.java`

**Covers:** AC-MEDIA-22 ~ AC-MEDIA-28 (7개)

**Interfaces:**
- Consumes: `RecipeService.requireViewable(Long, Long): void`(신설), `BrewLogService.requireViewable(Long, Long): void`(신설), `AttachmentRepository.findByTargetTypeAndTargetIdOrderBySortOrderAsc`(Task 1)
- Produces: `AttachmentService.list(Long userId, TargetType, Long targetId): List<AttachmentResponse>`

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/src/test/java/com/kaldinote/media/presentation/AttachmentControllerTest.java` (Modify — 헬퍼·테스트 7개 추가)

```java
  // 헬퍼 추가
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

  private ResultActions list(String token, String targetType, Long targetId) throws Exception {
    return mockMvc.perform(
        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                "/api/v1/attachments")
            .header(HttpHeaders.AUTHORIZATION, token)
            .param("targetType", targetType)
            .param("targetId", String.valueOf(targetId)));
  }
```

```java
  // 테스트 메서드 7개 추가
  @Test
  @DisplayName("AC-MEDIA-22 · 소유자는 PRIVATE 대상의 첨부를 sortOrder 오름차순으로 본다")
  void 소유자는_PRIVATE_대상의_첨부를_정렬순으로_본다() throws Exception {
    User owner = newUser("media-22");
    Long r1 = recipeId(tokenOf(owner), "PRIVATE");
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 1);
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 2);

    list(tokenOf(owner), "RECIPE", r1)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].sortOrder").value(1))
        .andExpect(jsonPath("$[1].sortOrder").value(2));
  }

  @Test
  @DisplayName("AC-MEDIA-23 · 타인은 PUBLIC 대상의 첨부를 본다")
  void 타인은_PUBLIC_대상의_첨부를_본다() throws Exception {
    User owner = newUser("media-23a");
    User other = newUser("media-23b");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 1);

    list(tokenOf(other), "RECIPE", r1)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));
  }

  @Test
  @DisplayName("AC-MEDIA-24 · 상호 팔로우면 FRIENDS 대상의 첨부를 본다")
  void 상호_팔로우면_FRIENDS_대상의_첨부를_본다() throws Exception {
    User owner = newUser("media-24a");
    User other = newUser("media-24b");
    Long r1 = recipeId(tokenOf(owner), "FRIENDS");
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 1);
    mutualFollow(owner, other);

    list(tokenOf(other), "RECIPE", r1)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));
  }

  @Test
  @DisplayName("AC-MEDIA-25 · 타인의 PRIVATE 대상은 403이다")
  void 타인의_PRIVATE_대상은_403이다() throws Exception {
    User owner = newUser("media-25a");
    User other = newUser("media-25b");
    Long r1 = recipeId(tokenOf(owner), "PRIVATE");

    list(tokenOf(other), "RECIPE", r1)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-MEDIA-26 · 첨부가 없으면 빈 배열을 반환한다")
  void 첨부가_없으면_빈_배열을_반환한다() throws Exception {
    User owner = newUser("media-26");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    list(tokenOf(owner), "RECIPE", r1)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  @DisplayName("AC-MEDIA-27 · 없는 대상은 404다")
  void 목록조회_없는_대상은_404다() throws Exception {
    User owner = newUser("media-27");

    list(tokenOf(owner), "RECIPE", 999999L)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-MEDIA-28 · 토큰 없이 조회하면 401이다")
  void 토큰_없이_조회하면_401이다() throws Exception {
    User owner = newUser("media-28");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                    "/api/v1/attachments")
                .param("targetType", "RECIPE")
                .param("targetId", String.valueOf(r1)))
        .andExpect(status().isUnauthorized());
  }
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*AttachmentControllerTest'`
Expected: 새로 추가된 7개 중 `AC-MEDIA-28`은 처음부터 통과, 나머지 6개는 `GET /api/v1/attachments` 매핑이 없어 실패. 실측값을 남긴다.

- [ ] **Step 3: requireViewable 추가 + list 구현**

`backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java` (Modify — `requireOwned` 다음에 추가)

```java
  /** media 도메인이 조회(첨부 목록) 권한을 확인할 때 쓴다. */
  public void requireViewable(Long userId, Long recipeId) {
    findViewable(userId, recipeId);
  }
```

`backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java` (Modify — `requireOwned` 다음에 추가)

```java
  /** media 도메인이 조회(첨부 목록) 권한을 확인할 때 쓴다. */
  public void requireViewable(Long userId, Long brewLogId) {
    findViewable(userId, brewLogId);
  }
```

`backend/src/main/java/com/kaldinote/media/application/AttachmentService.java` (Modify — `confirm` 다음에 추가, 상단에 `import java.util.List;` 추가)

```java
  public List<com.kaldinote.media.presentation.dto.AttachmentResponse> list(
      Long userId, TargetType targetType, Long targetId) {
    requireViewable(targetType, targetId, userId);
    return attachmentRepository
        .findByTargetTypeAndTargetIdOrderBySortOrderAsc(targetType, targetId)
        .stream()
        .map(
            a ->
                com.kaldinote.media.presentation.dto.AttachmentResponse.from(
                    a, objectStorageClient.publicUrl(a.getObjectKey())))
        .toList();
  }

  private void requireViewable(TargetType targetType, Long targetId, Long userId) {
    switch (targetType) {
      case RECIPE -> recipeService.requireViewable(userId, targetId);
      case BREW_LOG -> brewLogService.requireViewable(userId, targetId);
    }
  }
```

`backend/src/main/java/com/kaldinote/media/presentation/AttachmentController.java` (Modify — `confirm` 다음에 추가, import 2개 추가)

```java
  @org.springframework.web.bind.annotation.GetMapping
  public java.util.List<com.kaldinote.media.presentation.dto.AttachmentResponse> list(
      @org.springframework.web.bind.annotation.RequestParam com.kaldinote.media.domain.TargetType targetType,
      @org.springframework.web.bind.annotation.RequestParam Long targetId,
      AuthenticatedUser user) {
    return attachmentService.list(user.id(), targetType, targetId);
  }
```

(반영 시 `import org.springframework.web.bind.annotation.GetMapping;`, `import org.springframework.web.bind.annotation.RequestParam;`, `import com.kaldinote.media.domain.TargetType;`, `import java.util.List;`, `import com.kaldinote.media.presentation.dto.AttachmentResponse;`를 정리하고 FQN을 단순화한다.)

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*AttachmentControllerTest'`
Expected: PASS, 28 tests

전체도 확인한다: `./gradlew clean check`

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(media): 첨부 목록 조회 API" && cd backend
```

---

## Task 6: 삭제 API

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/media/application/AttachmentService.java`
- Modify: `backend/src/main/java/com/kaldinote/media/presentation/AttachmentController.java`
- Modify: `backend/src/test/java/com/kaldinote/media/presentation/AttachmentControllerTest.java`

**Covers:** AC-MEDIA-29 ~ AC-MEDIA-32 (4개)

**Interfaces:**
- Consumes: `AttachmentRepository.findById`·`delete`(JpaRepository 기본 제공), `ObjectStorageClient.delete`(Task 2)
- Produces: `AttachmentService.delete(Long userId, Long attachmentId): void` — 이 태스크가 마지막이므로 뒤 태스크가 의존할 것 없음

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/src/test/java/com/kaldinote/media/presentation/AttachmentControllerTest.java` (Modify — 테스트 4개 추가)

```java
  @Test
  @DisplayName("AC-MEDIA-29 · 소유자가 삭제하면 204이고 DB 행과 OCI 객체가 모두 사라진다")
  void 소유자가_삭제하면_204이고_모두_사라진다() throws Exception {
    User owner = newUser("media-29");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/jpeg");
    String confirmBody =
        confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100)
            .andReturn()
            .getResponse()
            .getContentAsString();
    Long attachmentId = Long.valueOf(JsonPath.read(confirmBody, "$.id").toString());

    mockMvc
        .perform(
            delete("/api/v1/attachments/{id}", attachmentId)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner)))
        .andExpect(status().isNoContent());

    assertThat(attachmentRepository.findById(attachmentId)).isEmpty();
    assertThat(fakeObjectStorageClient.head(objectKey)).isEmpty();
  }

  @Test
  @DisplayName("AC-MEDIA-30 · 소유자가 아니면 403이다")
  void 삭제_소유자가_아니면_403이다() throws Exception {
    User owner = newUser("media-30a");
    User other = newUser("media-30b");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 1);
    Long attachmentId =
        attachmentRepository
            .findByTargetTypeAndTargetIdOrderBySortOrderAsc(TargetType.RECIPE, r1)
            .get(0)
            .getId();

    mockMvc
        .perform(
            delete("/api/v1/attachments/{id}", attachmentId)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(other)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    assertThat(attachmentRepository.findById(attachmentId)).isPresent();
  }

  @Test
  @DisplayName("AC-MEDIA-31 · 없는 첨부를 삭제하면 404다")
  void 없는_첨부를_삭제하면_404다() throws Exception {
    User owner = newUser("media-31");

    mockMvc
        .perform(
            delete("/api/v1/attachments/{id}", 999999L)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-MEDIA-32 · 토큰 없이 삭제하면 401이다")
  void 토큰_없이_삭제하면_401이다() throws Exception {
    User owner = newUser("media-32");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 1);
    Long attachmentId =
        attachmentRepository
            .findByTargetTypeAndTargetIdOrderBySortOrderAsc(TargetType.RECIPE, r1)
            .get(0)
            .getId();

    mockMvc
        .perform(delete("/api/v1/attachments/{id}", attachmentId))
        .andExpect(status().isUnauthorized());
  }
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*AttachmentControllerTest'`
Expected: `AC-MEDIA-32`는 처음부터 통과, 나머지 3개는 `DELETE /api/v1/attachments/{id}` 매핑이 없어 실패. 실측값을 남긴다.

- [ ] **Step 3: delete 구현**

`backend/src/main/java/com/kaldinote/media/application/AttachmentService.java` (Modify — `list` 다음에 추가)

```java
  public void delete(Long userId, Long attachmentId) {
    com.kaldinote.media.domain.Attachment attachment =
        attachmentRepository
            .findById(attachmentId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "첨부를 찾을 수 없습니다: " + attachmentId));
    if (!attachment.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 첨부만 삭제할 수 있습니다.");
    }
    objectStorageClient.delete(attachment.getObjectKey());
    attachmentRepository.delete(attachment);
  }
```

`backend/src/main/java/com/kaldinote/media/presentation/AttachmentController.java` (Modify — `list` 다음에 추가, import 2개 추가: `DeleteMapping`, `PathVariable`)

```java
  @org.springframework.web.bind.annotation.DeleteMapping("/{id}")
  @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  public void delete(
      @org.springframework.web.bind.annotation.PathVariable Long id, AuthenticatedUser user) {
    attachmentService.delete(user.id(), id);
  }
```

(반영 시 `import org.springframework.web.bind.annotation.DeleteMapping;`, `import org.springframework.web.bind.annotation.PathVariable;`을 정리하고 FQN을 단순화한다. 이 시점에 `AttachmentController.java`·`AttachmentService.java`에 남은 모든 FQN을 일반 import로 정리한다 — `spotlessApply`는 import *추가*는 안 해주지만 미사용 import는 지워준다.)

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*AttachmentControllerTest'`
Expected: PASS, 32 tests

전체도 확인한다: `./gradlew clean check`

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(media): 첨부 삭제 API" && cd backend
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과 (스펙 status를 `구현완료`로 바꾼 뒤 실행)
- [ ] 스펙(`docs/specs/2026-08-18-media-attachment.md`)의 `status`를 `구현완료`로 변경
- [ ] Swagger UI(`/swagger-ui.html`)에서 4개 엔드포인트(`POST /upload-url`, `POST`, `GET`, `DELETE /{id}`)가 등록되어 보인다
- [ ] **실제 OCI 자격증명으로 하는 검증은 이번 계획의 완료 기준에 포함하지 않는다** — 스펙의 "수동 확인" 항목대로 배포 이후로 미룬다

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 32개 중 32개가 태스크에 매핑됨 (Task 3: 11, Task 4: 10, Task 5: 7, Task 6: 4. Task 1·2는 인프라라 0).

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음. 모든 Step에 붙여넣을 수 있는 실제 코드가 있다(Task 4~6의 일부 코드 블록은 파일이 이미 존재하는 상태에서의 부분 삽입이라 FQN을 썼다 — 반영 방법을 각 블록 아래에 명시했다).

**타입 일관성:** `ObjectStorageClient`의 4개 메서드 시그니처가 `FakeObjectStorageClient`·`OciObjectStorageClient`·`AttachmentService` 호출부에서 동일하게 쓰인다. `AttachmentService.requireOwned/requireViewable`이 호출하는 `RecipeService`·`BrewLogService`의 신설 메서드 이름·시그니처가 각 Modify 블록에서 일치한다. `AttachmentResponse.from(Attachment, String)`이 Task 4(confirm)·Task 5(list) 양쪽에서 같은 시그니처로 쓰인다.

**검증되지 않은 가정:**
- **OCI Java SDK 3.80.3의 정확한 API 표면**(`SimpleAuthenticationDetailsProvider.builder()`의 필수/선택 필드, `ObjectStorageClient.builder().region(String)` 오버로드, `PreauthenticatedRequest.getAccessUri()` 등)은 공식 문서 검색으로 확인했지 실제로 컴파일해보지 않았다. Task 2 Step 5에서 처음 컴파일되며, 이름이 다르면 그 자리에서 실제 시그니처로 고친다 — `ObjectStorageClient` 인터페이스와 Task 3~6은 이 SDK 세부사항과 무관하므로 영향받지 않는다.
- **`oci-java-sdk-objectstorage:3.80.3`이 실행 시점에도 최신인지는 확인하지 않았다.** 더 최신 버전이 있으면 그걸 써도 무방하다(메이저 버전대가 같으면 API 호환성 문제가 거의 없다).
- **RED 단계의 정확한 실패 개수·상태 코드**(404 vs 500, 매핑 없는 라우트)는 포크·공개범위 계획에서 관찰된 패턴을 근거로 추정했다. 실행해서 확인하고 각 Task의 Step 2에 실측값을 남긴다.
- **`SimpleAuthenticationDetailsProvider`가 `region`을 필수로 요구하는지**는 확인하지 못했다. 컴파일이나 런타임에서 요구하면 `OciProperties.region()`을 `com.oracle.bmc.Region`으로 변환해 provider builder에도 넘긴다(변환 방법은 SDK의 `Region` 클래스 정적 팩토리 메서드를 그 자리에서 확인한다).
- **content-type 허용 목록(jpeg/png/webp)은 스펙 예시(AC-01·02·04)에서 역산했다.** 스펙이 "이 3개만"이라고 명시적으로 못박지는 않았지만 AC-05가 gif를 거부 예시로 든 것과 일치한다.
