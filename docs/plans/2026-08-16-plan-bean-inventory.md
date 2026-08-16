# 원두 카탈로그와 개인 재고 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-16-bean-inventory.md`

**Goal:** 사용자가 로스터·원두 상품(싱글오리진/블렌드, 산지 포함)을 공용 카탈로그에 등록하고, 실제로 구매한 원두를 개인 재고(배치)로 기록·수정·삭제할 수 있다. 재고 조회 응답은 로스팅 후 경과일과 디게싱 권장 상태를 서버가 매번 계산해 함께 내려준다.

**Architecture:** `Roaster`·`BeanProduct`·`BeanOrigin`은 `catalog` 패키지에, `BeanBatch`는 `inventory` 패키지에 둔다(`backend/CLAUDE.md` 프로젝트 구조에 이미 명시된 배치). `BeanOrigin`은 `BeanProduct`와 생명주기를 완전히 공유하는 자식이므로 `Recipe`↔`RecipeStep`과 같은 `@OneToMany` 직접 연관관계를 쓰고 별도 리포지토리를 두지 않는다. `BeanProduct→Roaster`, `BeanOrigin→Variety/CoffeeProcess`, `BeanBatch→BeanProduct`는 전부 ID(`Long`) 참조로만 연결한다(엔티티 직접 참조 없음, `Recipe`가 `brewerId`/`grinderModelId`를 다루는 방식과 동일). 로스터·원두 상품 생성 로직은 기존 `CatalogService`(품종·가공법)와 별도로 `BeanCatalogService`를 새로 만든다 — 원두 상품 생성은 mix/ratio 검증과 다중 FK 체크가 얽혀 있어 기존 서비스에 얹으면 책임이 흐려진다.

**작업 위치:** `backend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-BEAN-01 | 최소 입력으로 로스터 생성, isSystem=false·createdByUserId=호출자 | Task 2 | API 테스트 |
| AC-BEAN-02 | 로스터 목록 이름순 전체 반환 | Task 2 | API 테스트 |
| AC-BEAN-20 | 로스터 name 100자 허용 | Task 2 | API 테스트 |
| AC-BEAN-21 | 로스터 name 101자 거부 | Task 2 | API 테스트 |
| AC-BEAN-40 | 로스터 이름 중복 → 409 | Task 2 | API 테스트 |
| AC-BEAN-41 | 인증 없이 로스터 생성 → 401 | Task 2 | API 테스트 |
| AC-BEAN-03 | 싱글오리진 최소 입력 생성 | Task 3 | API 테스트 |
| AC-BEAN-04 | 블렌드 ratio 합계 100 → 생성 | Task 3 | API 테스트 |
| AC-BEAN-05 | 싱글오리진 ratio는 서버가 100.0 고정 | Task 3 | API 테스트 |
| AC-BEAN-06 | 원두 상품 목록 이름순 전체 반환 | Task 3 | API 테스트 |
| AC-BEAN-07 | 원두 상품 단건 조회는 origins 포함 | Task 3 | API 테스트 |
| AC-BEAN-22 | 원두 상품 name 100자 허용 | Task 4 | API 테스트 |
| AC-BEAN-23 | 원두 상품 name 101자 거부 | Task 4 | API 테스트 |
| AC-BEAN-42 | 존재하지 않는 roasterId → 404 | Task 4 | API 테스트 |
| AC-BEAN-43 | 같은 로스터 내 이름 중복 → 409 | Task 4 | API 테스트 |
| AC-BEAN-44 | roastLevel 없으면 → 400 | Task 4 | API 테스트 |
| AC-BEAN-45 | SINGLE_ORIGIN인데 origins 2개 → 400 | Task 4 | API 테스트 |
| AC-BEAN-46 | BLEND인데 origins 1개 → 400 | Task 4 | API 테스트 |
| AC-BEAN-47 | 블렌드 ratio 합계≠100 → 400 | Task 4 | API 테스트 |
| AC-BEAN-48 | origins의 country 없음 → 400 | Task 4 | API 테스트 |
| AC-BEAN-49 | 존재하지 않는 varietyId → 404 | Task 4 | API 테스트 |
| AC-BEAN-50 | 존재하지 않는 processId → 404 | Task 4 | API 테스트 |
| AC-BEAN-51 | 인증 없이 원두 상품 생성 → 401 | Task 4 | API 테스트 |
| AC-BEAN-52 | 존재하지 않는 원두 상품 조회 → 404 | Task 4 | API 테스트 |
| AC-BEAN-08 | 최소 입력으로 재고 생성, remainingG 자동 초기화 | Task 5 | API 테스트 |
| AC-BEAN-15 | daysOffRoast는 roastedAt부터 오늘까지 일수 | Task 5 | API 테스트 |
| AC-BEAN-24 | weightG 10.0 허용 | Task 5 | API 테스트 |
| AC-BEAN-25 | weightG 9.9 거부 | Task 5 | API 테스트 |
| AC-BEAN-26 | weightG 5000.0 허용 | Task 5 | API 테스트 |
| AC-BEAN-27 | weightG 5000.1 거부 | Task 5 | API 테스트 |
| AC-BEAN-28 | price 0 허용 | Task 5 | API 테스트 |
| AC-BEAN-29 | price -1 거부 | Task 5 | API 테스트 |
| AC-BEAN-30 | price 1000000 허용 | Task 5 | API 테스트 |
| AC-BEAN-31 | price 1000001 거부 | Task 5 | API 테스트 |
| AC-BEAN-32 | 경과 2일 → TOO_FRESH | Task 5 | API 테스트 |
| AC-BEAN-33 | 경과 3일 → IDEAL | Task 5 | API 테스트 |
| AC-BEAN-34 | 경과 14일 → IDEAL | Task 5 | API 테스트 |
| AC-BEAN-35 | 경과 15일 → PAST_PEAK | Task 5 | API 테스트 |
| AC-BEAN-53 | 존재하지 않는 beanProductId → 404 | Task 5 | API 테스트 |
| AC-BEAN-54 | roastedAt 미래 날짜 → 400 | Task 5 | API 테스트 |
| AC-BEAN-55 | 인증 없이 재고 생성 → 401 | Task 5 | API 테스트 |
| AC-BEAN-09 | 재고 목록은 소진분 포함 본인 것 전부 | Task 6 | API 테스트 |
| AC-BEAN-56 | 남의 재고 조회 → 403 | Task 6 | API 테스트 |
| AC-BEAN-59 | 존재하지 않는 재고 조회 → 404 | Task 6 | API 테스트 |
| AC-BEAN-10 | remainingG를 PATCH로 갱신 | Task 7 | API 테스트 |
| AC-BEAN-11 | finished를 PATCH로 토글 | Task 7 | API 테스트 |
| AC-BEAN-12 | frozen=true → frozenAt 기록 | Task 7 | API 테스트 |
| AC-BEAN-13 | frozen=false → frozenAt=null | Task 7 | API 테스트 |
| AC-BEAN-57 | 남의 재고 수정 → 403 | Task 7 | API 테스트 |
| AC-BEAN-60 | remainingG가 weightG 초과 → 400 | Task 7 | API 테스트 |
| AC-BEAN-61 | remainingG 음수 → 400 | Task 7 | API 테스트 |
| AC-BEAN-14 | 삭제하면 소유자도 조회 불가(404) | Task 8 | API 테스트 |
| AC-BEAN-58 | 남의 재고 삭제 → 403 | Task 8 | API 테스트 |
| AC-BEAN-62 | 이미 삭제된 재고 재삭제 → 404 | Task 8 | API 테스트 |

**54개 전부 매핑됨** (6 + 5 + 13 + 17 + 3 + 7 + 3 = 54, 스펙과 동일).

---

## Global Constraints

- 측정값은 전부 `BigDecimal`. `double`/`float` 금지. `ratioPercent`·`weightG`·`remainingG`는 스케일 1, HALF_UP(`backend/CLAUDE.md` 반올림 규칙).
- `BeanOrigin`은 `BeanProduct`의 자식 — `@OneToMany(cascade = ALL, orphanRemoval = true)` 직접 연관관계를 쓴다. `BeanOrigin` 전용 리포지토리는 만들지 않는다(수정·삭제 API가 없어 `RecipeStepRepository.deleteAllByRecipe` 같은 별도 쿼리가 필요 없다).
- `BeanProduct.roasterId`, `BeanOrigin.varietyId`/`processId`, `BeanBatch.beanProductId`는 전부 `Long` 컬럼이다. FK 존재 검증은 서비스 계층에서 `existsById`로 한다 — JPA 연관관계로 즉시 로딩하지 않는다.
- `daysOffRoast`·`degassingStatus`는 저장하지 않는다. 응답 매핑 시점(`BeanBatchResponse.from`)마다 `LocalDate.now()` 기준으로 계산한다.
- 검증 순서는 스펙이 명시한 대로 구현한다: 카탈로그(로스터·원두 상품)는 `401→404→409→400`, 재고는 `401→404→403→400`. 단, Bean Validation(`@Valid`)이 잡는 조건(`@NotBlank`, `@DecimalMin` 등)은 컨트롤러 진입 전에 걸려 항상 가장 먼저 400을 반환한다 — 이는 서비스 계층에서만 판단 가능한 조건(FK 존재, 중복, mix/ratio 정합성)의 순서와는 별개이며, 레시피 스펙 구현 때와 동일한 전례를 따른다.
- 컨트롤러는 스펙이 정의한 리소스별 top-level 경로를 그대로 따라 셋으로 나눈다: `RoasterController`(`/api/v1/roasters`), `BeanProductController`(`/api/v1/bean-products`), `BeanBatchController`(`/api/v1/bean-batches`). `GearController`처럼 하나의 공통 prefix 아래 여러 리소스를 묶지 않는다 — 스펙 API 표가 세 경로를 이미 독립된 top-level로 정의했기 때문이다.
- API 테스트는 스펙이 지정한 클래스명 `BeanControllerTest` 하나로 모은다(컨트롤러가 3개로 나뉘어도 마찬가지). `RecipeControllerTest`처럼 Task 2부터 Task 8까지 같은 파일에 메서드를 점진적으로 추가한다.
- `AuthenticatedUser` 컨트롤러 파라미터는 `@AuthenticationPrincipal` 없이 타입만으로 받는다(Task 11에서 확인된 실동작).
- `BeanBatchPatchRequest`는 인수 조건이 있는 필드(`remainingG`·`finished`·`frozen`)만 받는다. `memo`·`openedAt`·`purchasedAt`·`price` 수정은 이 스펙의 AC 범위 밖이라 필드를 두지 않는다.

---

## File Structure

```
backend/src/main/resources/db/migration/
└── V7__create_bean_tables.sql

backend/src/main/java/com/kaldinote/catalog/
├── domain/
│   ├── Roaster.java
│   ├── BeanMix.java
│   ├── RoastLevel.java
│   ├── BeanProduct.java
│   └── BeanOrigin.java
├── infrastructure/
│   ├── RoasterRepository.java
│   └── BeanProductRepository.java
├── application/
│   └── BeanCatalogService.java
└── presentation/
    ├── RoasterController.java
    ├── BeanProductController.java
    └── dto/
        ├── RoasterCreateRequest.java
        ├── RoasterResponse.java
        ├── BeanProductCreateRequest.java
        ├── OriginRequest.java
        ├── BeanProductResponse.java
        └── BeanOriginResponse.java

backend/src/main/java/com/kaldinote/inventory/
├── domain/
│   ├── BeanBatch.java
│   └── DegassingStatus.java
├── infrastructure/
│   └── BeanBatchRepository.java
├── application/
│   └── BeanBatchService.java
└── presentation/
    ├── BeanBatchController.java
    └── dto/
        ├── BeanBatchCreateRequest.java
        ├── BeanBatchPatchRequest.java
        └── BeanBatchResponse.java

backend/src/main/java/com/kaldinote/common/error/ErrorCode.java   (Modify — Task 4, Task 7)

backend/src/test/java/com/kaldinote/catalog/
├── infrastructure/BeanCatalogRepositoryTest.java
└── presentation/BeanControllerTest.java
```

---

## Task 1: 원두 스키마 · 엔티티 · 리포지토리 (기반)

**Files:**
- Create: `backend/src/main/resources/db/migration/V7__create_bean_tables.sql`
- Create: `backend/src/main/java/com/kaldinote/catalog/domain/Roaster.java`, `BeanMix.java`, `RoastLevel.java`, `BeanProduct.java`, `BeanOrigin.java`
- Create: `backend/src/main/java/com/kaldinote/catalog/infrastructure/RoasterRepository.java`, `BeanProductRepository.java`
- Create: `backend/src/main/java/com/kaldinote/inventory/domain/BeanBatch.java`, `DegassingStatus.java`
- Create: `backend/src/main/java/com/kaldinote/inventory/infrastructure/BeanBatchRepository.java`
- Test: `backend/src/test/java/com/kaldinote/catalog/infrastructure/BeanCatalogRepositoryTest.java`

**Covers:** (없음 — 후속 태스크가 딛고 설 기반)

**Interfaces:**
- Consumes: `BaseTimeEntity`, `users(id)`/`varieties(id)`/`coffee_processes(id)` FK
- Produces:
  - `Roaster.createByUser(name, country, website, userId)`
  - `BeanProduct.createByUser(roasterId, name, beanMix, roastLevel, roastLevelAgtron, roastLevelCustom, decaf, productUrl, description, userId)`, `BeanProduct#attachOrigins(List<BeanOrigin>)`
  - `BeanOrigin.of(country, region, farm, altitudeMinM, altitudeMaxM, varietyId, processId, ratioPercent)`
  - `BeanBatch.create(userId, beanProductId, roastedAt, purchasedAt, weightG, price, memo)`, `BeanBatch#applyPatch(remainingG, finished, frozen)`, `BeanBatch#softDelete()`, `BeanBatch#isOwnedBy(Long)`
  - `RoasterRepository#findByName`, `RoasterRepository#findAllByOrderByNameAsc`
  - `BeanProductRepository#findByRoasterIdAndName`, `BeanProductRepository#findAllByOrderByNameAsc`
  - `BeanBatchRepository#findByIdAndDeletedAtIsNull`, `BeanBatchRepository#findAllByUserIdAndDeletedAtIsNull`

- [x] **Step 1: 스키마 마이그레이션 작성**

`V7__create_bean_tables.sql`:

```sql
CREATE TABLE roasters (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    country            VARCHAR(100),
    website            VARCHAR(500),
    is_system          BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_roasters_name UNIQUE (name)
);

CREATE TABLE bean_products (
    id                 BIGSERIAL PRIMARY KEY,
    roaster_id         BIGINT       NOT NULL REFERENCES roasters (id),
    name               VARCHAR(100) NOT NULL,
    bean_mix           VARCHAR(20)  NOT NULL,
    roast_level        VARCHAR(20)  NOT NULL,
    roast_level_agtron SMALLINT,
    roast_level_custom VARCHAR(100),
    decaf              BOOLEAN      NOT NULL DEFAULT false,
    product_url        VARCHAR(500),
    description        VARCHAR(2000),
    verified           BOOLEAN      NOT NULL DEFAULT false,
    created_by_user_id BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_bean_products_roaster_name UNIQUE (roaster_id, name)
);
CREATE INDEX idx_bean_products_roaster ON bean_products (roaster_id);

CREATE TABLE bean_origins (
    id              BIGSERIAL PRIMARY KEY,
    bean_product_id BIGINT       NOT NULL REFERENCES bean_products (id) ON DELETE CASCADE,
    country         VARCHAR(100) NOT NULL,
    region          VARCHAR(100),
    farm            VARCHAR(100),
    altitude_min_m  SMALLINT,
    altitude_max_m  SMALLINT,
    variety_id      BIGINT       REFERENCES varieties (id),
    process_id      BIGINT       REFERENCES coffee_processes (id),
    ratio_percent   NUMERIC(4,1) NOT NULL
);
CREATE INDEX idx_bean_origins_product ON bean_origins (bean_product_id);

CREATE TABLE bean_batches (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users (id),
    bean_product_id BIGINT       NOT NULL REFERENCES bean_products (id),
    roasted_at      DATE         NOT NULL,
    purchased_at    DATE,
    opened_at       DATE,
    weight_g        NUMERIC(6,1) NOT NULL,
    remaining_g     NUMERIC(6,1) NOT NULL,
    price           INTEGER,
    frozen          BOOLEAN      NOT NULL DEFAULT false,
    frozen_at       TIMESTAMPTZ,
    finished        BOOLEAN      NOT NULL DEFAULT false,
    memo            VARCHAR(500),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT chk_bean_batches_weight_positive CHECK (weight_g > 0),
    CONSTRAINT chk_bean_batches_remaining_range CHECK (remaining_g >= 0 AND remaining_g <= weight_g)
);
CREATE INDEX idx_bean_batches_user    ON bean_batches (user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bean_batches_product ON bean_batches (bean_product_id);

ALTER TABLE recipes ADD COLUMN bean_product_id BIGINT REFERENCES bean_products (id);
```

- [x] **Step 2: 실패하는 리포지토리 테스트 작성**

`backend/src/test/java/com/kaldinote/catalog/infrastructure/BeanCatalogRepositoryTest.java`:

```java
package com.kaldinote.catalog.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanOrigin;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.infrastructure.BeanBatchRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BeanCatalogRepositoryTest extends AbstractIntegrationTest {

  @Autowired private RoasterRepository roasterRepository;
  @Autowired private BeanProductRepository beanProductRepository;
  @Autowired private BeanBatchRepository beanBatchRepository;
  @Autowired private UserRepository userRepository;

  private Long userId() {
    return userRepository.save(User.create(null, "테스터", null)).getId();
  }

  private Long roasterId() {
    return roasterRepository.save(Roaster.createByUser("프릳츠커피컴퍼니", "KR", null, userId())).getId();
  }

  @Test
  void 원두_상품과_산지를_함께_저장하고_조회한다() {
    BeanProduct product =
        BeanProduct.createByUser(
            roasterId(), "예가체프 내추럴", BeanMix.SINGLE_ORIGIN, RoastLevel.LIGHT,
            null, null, false, null, null, userId());
    product.attachOrigins(
        List.of(BeanOrigin.of("ET", "예가체프", null, null, null, null, null, new BigDecimal("100.0"))));

    BeanProduct saved = beanProductRepository.save(product);

    BeanProduct found = beanProductRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getOrigins()).hasSize(1);
    assertThat(found.getOrigins().get(0).getRatioPercent()).isEqualByComparingTo("100.0");
  }

  @Test
  void 재고를_저장하면_remainingG가_weightG로_초기화된다() {
    Long uid = userId();
    Long productId =
        beanProductRepository
            .save(
                BeanProduct.createByUser(
                    roasterId(), "시그니처 블렌드", BeanMix.BLEND, RoastLevel.MEDIUM_DARK,
                    null, null, false, null, null, uid))
            .getId();

    BeanBatch batch =
        BeanBatch.create(uid, productId, LocalDate.now(), null, new BigDecimal("200.0"), null, null);
    BeanBatch saved = beanBatchRepository.save(batch);

    BeanBatch found = beanBatchRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getRemainingG()).isEqualByComparingTo("200.0");
    assertThat(found.isFinished()).isFalse();
    assertThat(found.isFrozen()).isFalse();
    assertThat(found.getFrozenAt()).isNull();
  }
}
```

- [x] **Step 3: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BeanCatalogRepositoryTest'`
Expected: FAIL — 컴파일 에러(엔티티·리포지토리 클래스가 존재하지 않음).

- [x] **Step 4: enum·엔티티·리포지토리 구현**

`catalog/domain/BeanMix.java`:

```java
package com.kaldinote.catalog.domain;

public enum BeanMix {
  SINGLE_ORIGIN,
  BLEND
}
```

`catalog/domain/RoastLevel.java`:

```java
package com.kaldinote.catalog.domain;

public enum RoastLevel {
  LIGHT,
  MEDIUM_LIGHT,
  MEDIUM,
  MEDIUM_DARK,
  DARK
}
```

`catalog/domain/Roaster.java`:

```java
package com.kaldinote.catalog.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "roasters")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Roaster extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(length = 100)
  private String country;

  @Column(length = 500)
  private String website;

  @Column(name = "is_system", nullable = false)
  private boolean isSystem;

  @Column(name = "created_by_user_id")
  private Long createdByUserId;

  private Roaster(String name, String country, String website, Long createdByUserId) {
    this.name = name;
    this.country = country;
    this.website = website;
    this.isSystem = false;
    this.createdByUserId = createdByUserId;
  }

  public static Roaster createByUser(String name, String country, String website, Long userId) {
    return new Roaster(name, country, website, userId);
  }
}
```

`catalog/domain/BeanOrigin.java`:

```java
package com.kaldinote.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "bean_origins")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BeanOrigin {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "bean_product_id")
  private BeanProduct beanProduct;

  @Column(nullable = false, length = 100)
  private String country;

  @Column(length = 100)
  private String region;

  @Column(length = 100)
  private String farm;

  @Column(name = "altitude_min_m")
  private Integer altitudeMinM;

  @Column(name = "altitude_max_m")
  private Integer altitudeMaxM;

  @Column(name = "variety_id")
  private Long varietyId;

  @Column(name = "process_id")
  private Long processId;

  @Column(name = "ratio_percent", nullable = false, precision = 4, scale = 1)
  private BigDecimal ratioPercent;

  private BeanOrigin(
      String country,
      String region,
      String farm,
      Integer altitudeMinM,
      Integer altitudeMaxM,
      Long varietyId,
      Long processId,
      BigDecimal ratioPercent) {
    this.country = country;
    this.region = region;
    this.farm = farm;
    this.altitudeMinM = altitudeMinM;
    this.altitudeMaxM = altitudeMaxM;
    this.varietyId = varietyId;
    this.processId = processId;
    this.ratioPercent = ratioPercent;
  }

  public static BeanOrigin of(
      String country,
      String region,
      String farm,
      Integer altitudeMinM,
      Integer altitudeMaxM,
      Long varietyId,
      Long processId,
      BigDecimal ratioPercent) {
    return new BeanOrigin(
        country, region, farm, altitudeMinM, altitudeMaxM, varietyId, processId, ratioPercent);
  }

  void assignTo(BeanProduct product) {
    this.beanProduct = product;
  }
}
```

`catalog/domain/BeanProduct.java`:

```java
package com.kaldinote.catalog.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "bean_products")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BeanProduct extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "roaster_id", nullable = false)
  private Long roasterId;

  @Column(nullable = false, length = 100)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "bean_mix", nullable = false, length = 20)
  private BeanMix beanMix;

  @Enumerated(EnumType.STRING)
  @Column(name = "roast_level", nullable = false, length = 20)
  private RoastLevel roastLevel;

  @Column(name = "roast_level_agtron")
  private Integer roastLevelAgtron;

  @Column(name = "roast_level_custom", length = 100)
  private String roastLevelCustom;

  @Column(nullable = false)
  private boolean decaf;

  @Column(name = "product_url", length = 500)
  private String productUrl;

  @Column(length = 2000)
  private String description;

  @Column(nullable = false)
  private boolean verified;

  @Column(name = "created_by_user_id")
  private Long createdByUserId;

  @OneToMany(mappedBy = "beanProduct", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<BeanOrigin> origins = new ArrayList<>();

  private BeanProduct(
      Long roasterId,
      String name,
      BeanMix beanMix,
      RoastLevel roastLevel,
      Integer roastLevelAgtron,
      String roastLevelCustom,
      boolean decaf,
      String productUrl,
      String description,
      Long createdByUserId) {
    this.roasterId = roasterId;
    this.name = name;
    this.beanMix = beanMix;
    this.roastLevel = roastLevel;
    this.roastLevelAgtron = roastLevelAgtron;
    this.roastLevelCustom = roastLevelCustom;
    this.decaf = decaf;
    this.productUrl = productUrl;
    this.description = description;
    this.verified = false;
    this.createdByUserId = createdByUserId;
  }

  public static BeanProduct createByUser(
      Long roasterId,
      String name,
      BeanMix beanMix,
      RoastLevel roastLevel,
      Integer roastLevelAgtron,
      String roastLevelCustom,
      boolean decaf,
      String productUrl,
      String description,
      Long createdByUserId) {
    return new BeanProduct(
        roasterId,
        name,
        beanMix,
        roastLevel,
        roastLevelAgtron,
        roastLevelCustom,
        decaf,
        productUrl,
        description,
        createdByUserId);
  }

  public void attachOrigins(List<BeanOrigin> newOrigins) {
    newOrigins.forEach(o -> o.assignTo(this));
    this.origins.clear();
    this.origins.addAll(newOrigins);
  }
}
```

`inventory/domain/DegassingStatus.java`:

```java
package com.kaldinote.inventory.domain;

public enum DegassingStatus {
  TOO_FRESH,
  IDEAL,
  PAST_PEAK;

  public static DegassingStatus of(long daysOffRoast) {
    if (daysOffRoast <= 2) {
      return TOO_FRESH;
    }
    if (daysOffRoast <= 14) {
      return IDEAL;
    }
    return PAST_PEAK;
  }
}
```

`inventory/domain/BeanBatch.java`:

```java
package com.kaldinote.inventory.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "bean_batches")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BeanBatch extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "bean_product_id", nullable = false)
  private Long beanProductId;

  @Column(name = "roasted_at", nullable = false)
  private LocalDate roastedAt;

  @Column(name = "purchased_at")
  private LocalDate purchasedAt;

  @Column(name = "opened_at")
  private LocalDate openedAt;

  @Column(name = "weight_g", nullable = false, precision = 6, scale = 1)
  private BigDecimal weightG;

  @Column(name = "remaining_g", nullable = false, precision = 6, scale = 1)
  private BigDecimal remainingG;

  private Integer price;

  @Column(nullable = false)
  private boolean frozen;

  @Column(name = "frozen_at")
  private Instant frozenAt;

  @Column(nullable = false)
  private boolean finished;

  @Column(length = 500)
  private String memo;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  private BeanBatch(
      Long userId,
      Long beanProductId,
      LocalDate roastedAt,
      LocalDate purchasedAt,
      BigDecimal weightG,
      Integer price,
      String memo) {
    this.userId = userId;
    this.beanProductId = beanProductId;
    this.roastedAt = roastedAt;
    this.purchasedAt = purchasedAt;
    this.weightG = weightG;
    this.remainingG = weightG;
    this.price = price;
    this.frozen = false;
    this.finished = false;
    this.memo = memo;
  }

  public static BeanBatch create(
      Long userId,
      Long beanProductId,
      LocalDate roastedAt,
      LocalDate purchasedAt,
      BigDecimal weightG,
      Integer price,
      String memo) {
    return new BeanBatch(userId, beanProductId, roastedAt, purchasedAt, weightG, price, memo);
  }

  public void applyPatch(BigDecimal remainingG, Boolean finished, Boolean frozen) {
    if (remainingG != null) {
      this.remainingG = remainingG;
    }
    if (finished != null) {
      this.finished = finished;
    }
    if (frozen != null && frozen != this.frozen) {
      this.frozen = frozen;
      this.frozenAt = frozen ? Instant.now() : null;
    }
  }

  public void softDelete() {
    this.deletedAt = Instant.now();
  }

  public boolean isOwnedBy(Long userId) {
    return this.userId != null && this.userId.equals(userId);
  }
}
```

리포지토리:

```java
// catalog/infrastructure/RoasterRepository.java
package com.kaldinote.catalog.infrastructure;

import com.kaldinote.catalog.domain.Roaster;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoasterRepository extends JpaRepository<Roaster, Long> {
  Optional<Roaster> findByName(String name);

  List<Roaster> findAllByOrderByNameAsc();
}
```

```java
// catalog/infrastructure/BeanProductRepository.java
package com.kaldinote.catalog.infrastructure;

import com.kaldinote.catalog.domain.BeanProduct;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BeanProductRepository extends JpaRepository<BeanProduct, Long> {
  Optional<BeanProduct> findByRoasterIdAndName(Long roasterId, String name);

  List<BeanProduct> findAllByOrderByNameAsc();
}
```

```java
// inventory/infrastructure/BeanBatchRepository.java
package com.kaldinote.inventory.infrastructure;

import com.kaldinote.inventory.domain.BeanBatch;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BeanBatchRepository extends JpaRepository<BeanBatch, Long> {
  Optional<BeanBatch> findByIdAndDeletedAtIsNull(Long id);

  List<BeanBatch> findAllByUserIdAndDeletedAtIsNull(Long userId);
}
```

- [x] **Step 5: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BeanCatalogRepositoryTest'`
Expected: PASS, 2 tests.

- [x] **Step 6: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(bean): 원두·재고 스키마와 엔티티, 리포지토리 추가" && cd backend
```

---

## Task 2: 로스터 API (생성 + 목록)

**Files:**
- Create: `backend/src/main/java/com/kaldinote/catalog/application/BeanCatalogService.java`
- Create: `backend/src/main/java/com/kaldinote/catalog/presentation/RoasterController.java`
- Create: `backend/src/main/java/com/kaldinote/catalog/presentation/dto/RoasterCreateRequest.java`, `RoasterResponse.java`
- Test: `backend/src/test/java/com/kaldinote/catalog/presentation/BeanControllerTest.java` (신규 생성)

**Covers:** AC-BEAN-01, 02, 20, 21, 40, 41

**Interfaces:**
- Consumes: Task 1의 `Roaster.createByUser(...)`, `RoasterRepository`
- Produces: `BeanCatalogService#createRoaster(name, country, website, userId)`, `#findAllRoasters()` — Task 3이 같은 서비스 클래스에 원두 상품 메서드를 추가한다

- [x] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/catalog/presentation/BeanControllerTest.java` 신규 생성:

```java
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

  @Test
  @DisplayName("AC-BEAN-01 · 최소 입력으로 로스터가 생성된다")
  void 최소_입력으로_로스터가_생성된다() throws Exception {
    String token = token();
    createRoaster(token, """
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
    createRoaster(token, """
        {"name":"프릳츠커피컴퍼니"}
        """).andExpect(status().isCreated());
    createRoaster(token, """
        {"name":"커피리브레"}
        """).andExpect(status().isCreated());

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
    createRoaster(token(), """
        {"name":"%s"}
        """.formatted(name)).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-BEAN-21 · 로스터 name 101자는 거부된다")
  void 로스터_name_101자는_거부된다() throws Exception {
    String name = "가".repeat(101);
    createRoaster(token(), """
        {"name":"%s"}
        """.formatted(name))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BEAN-40 · 로스터 이름이 중복되면 거부된다")
  void 로스터_이름이_중복되면_거부된다() throws Exception {
    String token = token();
    createRoaster(token, """
        {"name":"프릳츠커피컴퍼니"}
        """).andExpect(status().isCreated());

    createRoaster(token, """
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
                .content("""
                {"name":"프릳츠커피컴퍼니"}
                """))
        .andExpect(status().isUnauthorized());
  }
}
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: FAIL — 컴파일 에러(`RoasterController`·`BeanCatalogService`·DTO 없음).

- [x] **Step 3: 최소 구현**

```java
// catalog/presentation/dto/RoasterCreateRequest.java
package com.kaldinote.catalog.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RoasterCreateRequest(
    @NotBlank @Size(max = 100) String name,
    @Size(max = 100) String country,
    @Size(max = 500) String website) {}
```

```java
// catalog/presentation/dto/RoasterResponse.java
package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.Roaster;
import java.time.Instant;

public record RoasterResponse(
    Long id,
    String name,
    String country,
    String website,
    boolean isSystem,
    Long createdByUserId,
    Instant createdAt) {

  public static RoasterResponse from(Roaster r) {
    return new RoasterResponse(
        r.getId(),
        r.getName(),
        r.getCountry(),
        r.getWebsite(),
        r.isSystem(),
        r.getCreatedByUserId(),
        r.getCreatedAt());
  }
}
```

```java
// catalog/application/BeanCatalogService.java
package com.kaldinote.catalog.application;

import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.catalog.presentation.dto.RoasterResponse;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BeanCatalogService {

  private final RoasterRepository roasterRepository;

  public List<RoasterResponse> findAllRoasters() {
    return roasterRepository.findAllByOrderByNameAsc().stream().map(RoasterResponse::from).toList();
  }

  @Transactional
  public RoasterResponse createRoaster(String name, String country, String website, Long userId) {
    if (roasterRepository.findByName(name).isPresent()) {
      throw new BusinessException(ErrorCode.DUPLICATE_NAME);
    }
    Roaster saved = roasterRepository.save(Roaster.createByUser(name, country, website, userId));
    return RoasterResponse.from(saved);
  }
}
```

```java
// catalog/presentation/RoasterController.java
package com.kaldinote.catalog.presentation;

import com.kaldinote.catalog.application.BeanCatalogService;
import com.kaldinote.catalog.presentation.dto.RoasterCreateRequest;
import com.kaldinote.catalog.presentation.dto.RoasterResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/roasters")
@RequiredArgsConstructor
@Tag(name = "로스터", description = "로스터 등록·조회")
public class RoasterController {

  private final BeanCatalogService beanCatalogService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public RoasterResponse create(
      @Valid @RequestBody RoasterCreateRequest request, AuthenticatedUser user) {
    return beanCatalogService.createRoaster(
        request.name(), request.country(), request.website(), user.id());
  }

  @GetMapping
  public List<RoasterResponse> list() {
    return beanCatalogService.findAllRoasters();
  }
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: PASS, 6 tests.

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(bean): 로스터 생성·조회 API 추가" && cd backend
```

---

## Task 3: 원두 상품 API — 정상 동작 (생성 + 목록 + 단건 조회)

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/catalog/application/BeanCatalogService.java`
- Create: `backend/src/main/java/com/kaldinote/catalog/presentation/BeanProductController.java`
- Create: `backend/src/main/java/com/kaldinote/catalog/presentation/dto/BeanProductCreateRequest.java`, `OriginRequest.java`, `BeanProductResponse.java`, `BeanOriginResponse.java`
- Modify: `backend/src/test/java/com/kaldinote/catalog/presentation/BeanControllerTest.java`

**Covers:** AC-BEAN-03, 04, 05, 06, 07

**Interfaces:**
- Consumes: Task 1의 `BeanProduct`·`BeanOrigin`·`BeanProductRepository`, Task 2의 `RoasterRepository`(FK 확인용)
- Produces: `BeanCatalogService#createBeanProduct(userId, request)`, `#findAllBeanProducts()`, `#getBeanProduct(id)` — Task 4가 여기에 검증 로직을 추가한다. `BeanProductResponse`/`BeanOriginResponse`는 이후 태스크가 그대로 재사용한다.

이 태스크는 정상 경로만 만든다. `roasterId`/`varietyId`/`processId` FK 검증과 mix/ratio 오류 처리는 **Task 4**에서 추가한다 — 지금은 항상 유효한 입력만 테스트한다.

- [x] **Step 1: 실패하는 테스트 작성**

`BeanControllerTest`에 로스터·품종·가공법 조회 헬퍼와 아래 테스트를 추가한다:

```java
  @Autowired private com.kaldinote.catalog.infrastructure.RoasterRepository roasterRepository;
  @Autowired private com.kaldinote.catalog.infrastructure.VarietyRepository varietyRepository;
  @Autowired private com.kaldinote.catalog.infrastructure.CoffeeProcessRepository processRepository;

  private Long roasterId(String token) throws Exception {
    String body = createRoaster(token, """
        {"name":"프릳츠커피컴퍼니-%s"}
        """.formatted(java.util.UUID.randomUUID()))
        .andReturn().getResponse().getContentAsString();
    return com.jayway.jsonpath.JsonPath.read(body, "$.id").toString().equals("")
        ? null
        : Long.valueOf(com.jayway.jsonpath.JsonPath.read(body, "$.id").toString());
  }

  private Long varietyId() {
    return varietyRepository.findByName("Geisha").orElseThrow().getId();
  }

  private Long processId() {
    return processRepository.findByName("Washed").orElseThrow().getId();
  }

  private ResultActions createBeanProduct(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/bean-products")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  @Test
  @DisplayName("AC-BEAN-03 · 싱글오리진 원두 상품이 최소 입력으로 생성된다")
  void 싱글오리진_원두_상품이_최소_입력으로_생성된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(token, """
        {"roasterId":%d,"name":"예가체프 내추럴","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT",
         "origins":[{"country":"ET"}]}
        """.formatted(roasterId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.verified").value(false));
  }

  @Test
  @DisplayName("AC-BEAN-04 · 블렌드 산지의 ratioPercent 합계가 100이면 생성된다")
  void 블렌드_ratio_합계가_100이면_생성된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(token, """
        {"roasterId":%d,"name":"시그니처 블렌드","beanMix":"BLEND","roastLevel":"MEDIUM_DARK",
         "origins":[{"country":"ET","ratioPercent":50.0},{"country":"CO","ratioPercent":50.0}]}
        """.formatted(roasterId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.origins.length()").value(2));
  }

  @Test
  @DisplayName("AC-BEAN-05 · 싱글오리진은 ratioPercent를 서버가 100.0으로 고정한다")
  void 싱글오리진은_ratioPercent가_100으로_고정된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(token, """
        {"roasterId":%d,"name":"예가체프 워시드","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT",
         "origins":[{"country":"ET"}]}
        """.formatted(roasterId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.origins[0].ratioPercent").value(100.0));
  }

  @Test
  @DisplayName("AC-BEAN-06 · 원두 상품 목록은 이름순으로 전체 반환된다")
  void 원두_상품_목록은_이름순으로_반환된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(token, """
        {"roasterId":%d,"name":"나 상품","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
        """.formatted(roasterId)).andExpect(status().isCreated());
    createBeanProduct(token, """
        {"roasterId":%d,"name":"가 상품","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}
        """.formatted(roasterId)).andExpect(status().isCreated());

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
    String created = createBeanProduct(token, """
        {"roasterId":%d,"name":"시그니처 블렌드2","beanMix":"BLEND","roastLevel":"MEDIUM_DARK",
         "origins":[{"country":"ET","ratioPercent":50.0},{"country":"CO","ratioPercent":50.0}]}
        """.formatted(roasterId))
        .andReturn().getResponse().getContentAsString();
    Long productId = Long.valueOf(com.jayway.jsonpath.JsonPath.read(created, "$.id").toString());

    mockMvc
        .perform(get("/api/v1/bean-products/" + productId).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.origins.length()").value(2));
  }
```

> `roasterId(token)` 헬퍼는 매 테스트마다 고유한 로스터를 새로 만들어 원두 상품의 `UNIQUE(roaster_id, name)` 제약과 충돌하지 않게 한다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: FAIL — 컴파일 에러(`BeanProductController`·DTO 없음).

- [x] **Step 3: 최소 구현**

```java
// catalog/presentation/dto/OriginRequest.java
package com.kaldinote.catalog.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record OriginRequest(
    @NotBlank @Size(max = 100) String country,
    @Size(max = 100) String region,
    @Size(max = 100) String farm,
    Integer altitudeMinM,
    Integer altitudeMaxM,
    Long varietyId,
    Long processId,
    BigDecimal ratioPercent) {}
```

```java
// catalog/presentation/dto/BeanProductCreateRequest.java
package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.RoastLevel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BeanProductCreateRequest(
    @NotNull Long roasterId,
    @NotBlank @Size(max = 100) String name,
    @NotNull BeanMix beanMix,
    @NotNull RoastLevel roastLevel,
    Integer roastLevelAgtron,
    @Size(max = 100) String roastLevelCustom,
    Boolean decaf,
    @Size(max = 500) String productUrl,
    @Size(max = 2000) String description,
    @Valid List<OriginRequest> origins) {

  public BeanProductCreateRequest {
    if (origins == null) {
      origins = List.of();
    }
  }
}
```

```java
// catalog/presentation/dto/BeanOriginResponse.java
package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.BeanOrigin;
import java.math.BigDecimal;
import java.util.List;

public record BeanOriginResponse(
    Long id,
    String country,
    String region,
    String farm,
    Integer altitudeMinM,
    Integer altitudeMaxM,
    Long varietyId,
    Long processId,
    BigDecimal ratioPercent) {

  public static List<BeanOriginResponse> listFrom(List<BeanOrigin> origins) {
    return origins.stream()
        .map(
            o ->
                new BeanOriginResponse(
                    o.getId(),
                    o.getCountry(),
                    o.getRegion(),
                    o.getFarm(),
                    o.getAltitudeMinM(),
                    o.getAltitudeMaxM(),
                    o.getVarietyId(),
                    o.getProcessId(),
                    o.getRatioPercent()))
        .toList();
  }
}
```

```java
// catalog/presentation/dto/BeanProductResponse.java
package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.BeanProduct;
import java.time.Instant;
import java.util.List;

public record BeanProductResponse(
    Long id,
    Long roasterId,
    String name,
    String beanMix,
    String roastLevel,
    Integer roastLevelAgtron,
    String roastLevelCustom,
    boolean decaf,
    String productUrl,
    String description,
    boolean verified,
    List<BeanOriginResponse> origins,
    Instant createdAt) {

  public static BeanProductResponse from(BeanProduct p) {
    return new BeanProductResponse(
        p.getId(),
        p.getRoasterId(),
        p.getName(),
        p.getBeanMix().name(),
        p.getRoastLevel().name(),
        p.getRoastLevelAgtron(),
        p.getRoastLevelCustom(),
        p.isDecaf(),
        p.getProductUrl(),
        p.getDescription(),
        p.isVerified(),
        BeanOriginResponse.listFrom(p.getOrigins()),
        p.getCreatedAt());
  }
}
```

`BeanCatalogService`에 아래를 추가한다(생성자에 `beanProductRepository` 주입 추가):

```java
  private final BeanProductRepository beanProductRepository;

  public List<BeanProductResponse> findAllBeanProducts() {
    return beanProductRepository.findAllByOrderByNameAsc().stream()
        .map(BeanProductResponse::from)
        .toList();
  }

  public BeanProductResponse getBeanProduct(Long id) {
    return BeanProductResponse.from(findBeanProduct(id));
  }

  @Transactional
  public BeanProductResponse createBeanProduct(Long userId, BeanProductCreateRequest request) {
    List<BeanOrigin> origins = buildOrigins(request.beanMix(), request.origins());

    BeanProduct product =
        BeanProduct.createByUser(
            request.roasterId(),
            request.name(),
            request.beanMix(),
            request.roastLevel(),
            request.roastLevelAgtron(),
            request.roastLevelCustom(),
            Boolean.TRUE.equals(request.decaf()),
            request.productUrl(),
            request.description(),
            userId);
    product.attachOrigins(origins);

    return BeanProductResponse.from(beanProductRepository.save(product));
  }

  private BeanProduct findBeanProduct(Long id) {
    return beanProductRepository
        .findById(id)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "원두 상품을 찾을 수 없습니다: " + id));
  }

  private List<BeanOrigin> buildOrigins(BeanMix mix, List<OriginRequest> requests) {
    List<BeanOrigin> origins = new ArrayList<>();
    if (mix == BeanMix.SINGLE_ORIGIN) {
      OriginRequest o = requests.get(0);
      origins.add(
          BeanOrigin.of(
              o.country(), o.region(), o.farm(), o.altitudeMinM(), o.altitudeMaxM(),
              o.varietyId(), o.processId(), new BigDecimal("100.0")));
      return origins;
    }

    for (OriginRequest o : requests) {
      origins.add(
          BeanOrigin.of(
              o.country(), o.region(), o.farm(), o.altitudeMinM(), o.altitudeMaxM(),
              o.varietyId(), o.processId(), o.ratioPercent()));
    }
    return origins;
  }
```

> Task 3은 정상 경로만 다루므로 `buildOrigins`가 `mix`/개수 불일치나 ratio 합계를 아직 검증하지 않는다. **Task 4에서 이 메서드에 검증을 추가한다** — 지금 이 메서드는 최소 구현이다.

```java
// catalog/presentation/BeanProductController.java
package com.kaldinote.catalog.presentation;

import com.kaldinote.catalog.application.BeanCatalogService;
import com.kaldinote.catalog.presentation.dto.BeanProductCreateRequest;
import com.kaldinote.catalog.presentation.dto.BeanProductResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bean-products")
@RequiredArgsConstructor
@Tag(name = "원두 상품", description = "원두 상품 등록·조회")
public class BeanProductController {

  private final BeanCatalogService beanCatalogService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BeanProductResponse create(
      @Valid @RequestBody BeanProductCreateRequest request, AuthenticatedUser user) {
    return beanCatalogService.createBeanProduct(user.id(), request);
  }

  @GetMapping
  public List<BeanProductResponse> list() {
    return beanCatalogService.findAllBeanProducts();
  }

  @GetMapping("/{id}")
  public BeanProductResponse get(@PathVariable Long id) {
    return beanCatalogService.getBeanProduct(id);
  }
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: PASS, 11 tests (Task 2의 6개 + Task 3의 5개).

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(bean): 원두 상품 생성·조회 API 추가" && cd backend
```

---

## Task 4: 원두 상품 API — 경계값 + 에러

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/catalog/application/BeanCatalogService.java`
- Modify: `backend/src/main/java/com/kaldinote/catalog/presentation/dto/BeanProductCreateRequest.java`
- Modify: `backend/src/main/java/com/kaldinote/common/error/ErrorCode.java`
- Modify: `backend/src/test/java/com/kaldinote/catalog/presentation/BeanControllerTest.java`

**Covers:** AC-BEAN-22, 23, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52

**Interfaces:**
- Consumes: Task 3의 `BeanCatalogService#createBeanProduct`, `buildOrigins`
- Produces: `ErrorCode.BEAN_MIX_ORIGIN_MISMATCH`, `ErrorCode.BEAN_ORIGIN_RATIO_MISMATCH` — Task 5는 별도 `BEAN_BATCH_REMAINING_INVALID`를 추가하므로 이 둘과 겹치지 않는다

이 태스크에서 서비스 계층 검증 순서는 스펙이 정한 대로 **404(roasterId/varietyId/processId) → 409(이름 중복) → 400(mix/ratio)** 순으로 구현한다.

- [x] **Step 1: 실패하는 테스트 작성**

대표로 mix/ratio 오류 2개는 전체 코드를 보이고, 나머지 11개는 표의 리터럴 값을 대입해 같은 패턴으로 작성한다. 기본 바디는 `{"roasterId":<유효한 id>,"name":"...","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","origins":[{"country":"ET"}]}`에서 해당 필드만 덮어쓴다.

```java
  @Test
  @DisplayName("AC-BEAN-45 · SINGLE_ORIGIN인데 origins가 2개면 거부된다")
  void SINGLE_ORIGIN인데_origins가_2개면_거부된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(token, """
        {"roasterId":%d,"name":"에러1","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT",
         "origins":[{"country":"ET"},{"country":"CO"}]}
        """.formatted(roasterId))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_MIX_ORIGIN_MISMATCH"));
  }

  @Test
  @DisplayName("AC-BEAN-47 · 블렌드 ratioPercent 합계가 100이 아니면 거부된다")
  void 블렌드_ratio_합계가_100이_아니면_거부된다() throws Exception {
    String token = token();
    Long roasterId = roasterId(token);
    createBeanProduct(token, """
        {"roasterId":%d,"name":"에러2","beanMix":"BLEND","roastLevel":"LIGHT",
         "origins":[{"country":"ET","ratioPercent":30.0},{"country":"CO","ratioPercent":30.0}]}
        """.formatted(roasterId))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_ORIGIN_RATIO_MISMATCH"));
  }
```

나머지 11개는 아래 표대로 작성한다:

| AC ID | 시나리오 | 기대 |
|---|---|---|
| AC-BEAN-22 | `name` 100자 | 201 |
| AC-BEAN-23 | `name` 101자 | 400 INVALID_REQUEST |
| AC-BEAN-42 | `roasterId=999999` | 404 NOT_FOUND |
| AC-BEAN-43 | 같은 `roasterId`·`name`으로 재생성 | 409 DUPLICATE_NAME |
| AC-BEAN-44 | `roastLevel` 생략 | 400 INVALID_REQUEST |
| AC-BEAN-46 | `beanMix="BLEND"`, `origins` 1건 | 400 BEAN_MIX_ORIGIN_MISMATCH |
| AC-BEAN-48 | `origins=[{}]` (country 없음) | 400 INVALID_REQUEST |
| AC-BEAN-49 | `origins=[{"country":"ET","varietyId":999999}]` | 404 NOT_FOUND |
| AC-BEAN-50 | `origins=[{"country":"ET","processId":999999}]` | 404 NOT_FOUND |
| AC-BEAN-51 | Authorization 헤더 없이 생성 | 401 |
| AC-BEAN-52 | `GET /api/v1/bean-products/999999` | 404 NOT_FOUND |

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: FAIL — mix/ratio 오류는 컴파일은 되나 `ErrorCode.BEAN_MIX_ORIGIN_MISMATCH`/`BEAN_ORIGIN_RATIO_MISMATCH`가 없어 컴파일 에러. FK 404 케이스는 지금 구현이 존재 확인을 하지 않아 500 또는 201로 잘못 통과한다.

- [x] **Step 3: ErrorCode 추가 + 서비스 검증 추가**

`ErrorCode.java`에 추가:

```java
  // 원두 카탈로그 — docs/specs/2026-08-16-bean-inventory.md
  BEAN_MIX_ORIGIN_MISMATCH(HttpStatus.BAD_REQUEST, "beanMix와 origins 개수가 맞지 않습니다."),
  BEAN_ORIGIN_RATIO_MISMATCH(HttpStatus.BAD_REQUEST, "블렌드 산지의 ratioPercent 합계가 100이 아닙니다."),
```

`BeanCatalogService#createBeanProduct`를 검증 순서(404→409→400)에 맞춰 고친다:

```java
  private final VarietyRepository varietyRepository;
  private final CoffeeProcessRepository processRepository;

  @Transactional
  public BeanProductResponse createBeanProduct(Long userId, BeanProductCreateRequest request) {
    if (!roasterRepository.existsById(request.roasterId())) {
      throw new BusinessException(ErrorCode.NOT_FOUND, "로스터를 찾을 수 없습니다: " + request.roasterId());
    }
    for (OriginRequest o : request.origins()) {
      requireExists(o.varietyId(), varietyRepository::existsById, "품종");
      requireExists(o.processId(), processRepository::existsById, "가공법");
    }
    if (beanProductRepository.findByRoasterIdAndName(request.roasterId(), request.name()).isPresent()) {
      throw new BusinessException(ErrorCode.DUPLICATE_NAME);
    }

    List<BeanOrigin> origins = buildOrigins(request.beanMix(), request.origins());

    BeanProduct product =
        BeanProduct.createByUser(
            request.roasterId(),
            request.name(),
            request.beanMix(),
            request.roastLevel(),
            request.roastLevelAgtron(),
            request.roastLevelCustom(),
            Boolean.TRUE.equals(request.decaf()),
            request.productUrl(),
            request.description(),
            userId);
    product.attachOrigins(origins);

    return BeanProductResponse.from(beanProductRepository.save(product));
  }

  private void requireExists(Long id, java.util.function.Predicate<Long> existsById, String label) {
    if (id != null && !existsById.test(id)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, label + "를 찾을 수 없습니다: " + id);
    }
  }

  private List<BeanOrigin> buildOrigins(BeanMix mix, List<OriginRequest> requests) {
    if (mix == BeanMix.SINGLE_ORIGIN && requests.size() != 1) {
      throw new BusinessException(ErrorCode.BEAN_MIX_ORIGIN_MISMATCH);
    }
    if (mix == BeanMix.BLEND && requests.size() <= 1) {
      throw new BusinessException(ErrorCode.BEAN_MIX_ORIGIN_MISMATCH);
    }

    List<BeanOrigin> origins = new ArrayList<>();
    if (mix == BeanMix.SINGLE_ORIGIN) {
      OriginRequest o = requests.get(0);
      origins.add(
          BeanOrigin.of(
              o.country(), o.region(), o.farm(), o.altitudeMinM(), o.altitudeMaxM(),
              o.varietyId(), o.processId(), new BigDecimal("100.0")));
      return origins;
    }

    BigDecimal sum = BigDecimal.ZERO;
    for (OriginRequest o : requests) {
      BigDecimal ratio = o.ratioPercent() == null ? BigDecimal.ZERO : o.ratioPercent();
      sum = sum.add(ratio);
      origins.add(
          BeanOrigin.of(
              o.country(), o.region(), o.farm(), o.altitudeMinM(), o.altitudeMaxM(),
              o.varietyId(), o.processId(), ratio));
    }
    if (sum.compareTo(new BigDecimal("100.0")) != 0) {
      throw new BusinessException(ErrorCode.BEAN_ORIGIN_RATIO_MISMATCH);
    }
    return origins;
  }
```

`BeanProductCreateRequest.name`에 `@Size(max = 100)`은 Task 3에서 이미 추가돼 있다 — AC-BEAN-22/23은 별도 변경 없이 이미 통과해야 한다(Step 2에서 실제로 확인).

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: PASS, 24 tests (11 + 13).

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(bean): 원두 상품 경계값 검증과 mix/ratio 에러 추가" && cd backend
```

---

## Task 5: 재고 생성 API (POST)

**Files:**
- Create: `backend/src/main/java/com/kaldinote/inventory/application/BeanBatchService.java`
- Create: `backend/src/main/java/com/kaldinote/inventory/presentation/BeanBatchController.java`
- Create: `backend/src/main/java/com/kaldinote/inventory/presentation/dto/BeanBatchCreateRequest.java`, `BeanBatchResponse.java`
- Modify: `backend/src/test/java/com/kaldinote/catalog/presentation/BeanControllerTest.java`

**Covers:** AC-BEAN-08, 15, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 53, 54, 55

**Interfaces:**
- Consumes: Task 1의 `BeanBatch`·`BeanBatchRepository`·`DegassingStatus`, Task 3의 `BeanProductRepository`(FK 확인용)
- Produces: `BeanBatchService#create(userId, request)`, `BeanBatchResponse` — Task 6~8이 그대로 재사용한다

- [x] **Step 1: 실패하는 테스트 작성**

대표로 정상 생성·경과일 2개는 전체 코드를 보이고, 경계값·에러는 표로 정리한다.

```java
  private Long beanProductId(String token) throws Exception {
    Long roasterId = roasterId(token);
    String body = createBeanProduct(token, """
        {"roasterId":%d,"name":"재고테스트상품-%s","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT",
         "origins":[{"country":"ET"}]}
        """.formatted(roasterId, java.util.UUID.randomUUID()))
        .andReturn().getResponse().getContentAsString();
    return Long.valueOf(com.jayway.jsonpath.JsonPath.read(body, "$.id").toString());
  }

  private ResultActions createBeanBatch(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/bean-batches")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  @Test
  @DisplayName("AC-BEAN-08 · 최소 입력으로 재고가 생성되고 remainingG가 자동 초기화된다")
  void 최소_입력으로_재고가_생성된다() throws Exception {
    String token = token();
    Long productId = beanProductId(token);
    createBeanBatch(token, """
        {"beanProductId":%d,"weightG":200.0,"roastedAt":"%s"}
        """.formatted(productId, java.time.LocalDate.now().minusDays(6)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.remainingG").value(200.0))
        .andExpect(jsonPath("$.finished").value(false))
        .andExpect(jsonPath("$.frozen").value(false))
        .andExpect(jsonPath("$.frozenAt").doesNotExist());
  }

  @Test
  @DisplayName("AC-BEAN-15 · daysOffRoast는 roastedAt부터 오늘까지의 일수다")
  void daysOffRoast는_경과_일수다() throws Exception {
    String token = token();
    Long productId = beanProductId(token);
    createBeanBatch(token, """
        {"beanProductId":%d,"weightG":200.0,"roastedAt":"%s"}
        """.formatted(productId, java.time.LocalDate.now().minusDays(5)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.daysOffRoast").value(5))
        .andExpect(jsonPath("$.degassingStatus").value("IDEAL"));
  }
```

나머지 15개는 기본 바디 `{"beanProductId":<유효id>,"weightG":200.0,"roastedAt":"<오늘>"}`에서 해당 필드만 덮어써 작성한다:

| AC ID | 필드 | 값 | 기대 |
|---|---|---|---|
| AC-BEAN-24 | weightG | `10.0` | 201 |
| AC-BEAN-25 | weightG | `9.9` | 400 INVALID_REQUEST |
| AC-BEAN-26 | weightG | `5000.0` | 201 |
| AC-BEAN-27 | weightG | `5000.1` | 400 INVALID_REQUEST |
| AC-BEAN-28 | price | `0` | 201 |
| AC-BEAN-29 | price | `-1` | 400 INVALID_REQUEST |
| AC-BEAN-30 | price | `1000000` | 201 |
| AC-BEAN-31 | price | `1000001` | 400 INVALID_REQUEST |
| AC-BEAN-32 | roastedAt | 오늘 - 2일 | daysOffRoast=2, degassingStatus="TOO_FRESH" |
| AC-BEAN-33 | roastedAt | 오늘 - 3일 | daysOffRoast=3, degassingStatus="IDEAL" |
| AC-BEAN-34 | roastedAt | 오늘 - 14일 | daysOffRoast=14, degassingStatus="IDEAL" |
| AC-BEAN-35 | roastedAt | 오늘 - 15일 | daysOffRoast=15, degassingStatus="PAST_PEAK" |
| AC-BEAN-53 | beanProductId | `999999` | 404 NOT_FOUND |
| AC-BEAN-54 | roastedAt | 내일 | 400 INVALID_REQUEST |
| AC-BEAN-55 | (Authorization 헤더 없이) | — | 401 |

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: FAIL — 컴파일 에러(`BeanBatchController`·`BeanBatchService`·DTO 없음).

- [x] **Step 3: 최소 구현**

```java
// inventory/presentation/dto/BeanBatchCreateRequest.java
package com.kaldinote.inventory.presentation.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record BeanBatchCreateRequest(
    @NotNull Long beanProductId,
    @NotNull @DecimalMin("10.0") @DecimalMax("5000.0") BigDecimal weightG,
    @NotNull @PastOrPresent LocalDate roastedAt,
    LocalDate purchasedAt,
    @Min(0) @Max(1000000) Integer price,
    @Size(max = 500) String memo) {}
```

```java
// inventory/presentation/dto/BeanBatchResponse.java
package com.kaldinote.inventory.presentation.dto;

import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.domain.DegassingStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record BeanBatchResponse(
    Long id,
    Long beanProductId,
    BigDecimal weightG,
    BigDecimal remainingG,
    LocalDate roastedAt,
    LocalDate purchasedAt,
    LocalDate openedAt,
    Integer price,
    boolean frozen,
    Instant frozenAt,
    boolean finished,
    String memo,
    long daysOffRoast,
    String degassingStatus,
    Instant createdAt,
    Instant updatedAt) {

  public static BeanBatchResponse from(BeanBatch b) {
    long daysOffRoast = ChronoUnit.DAYS.between(b.getRoastedAt(), LocalDate.now());
    return new BeanBatchResponse(
        b.getId(),
        b.getBeanProductId(),
        b.getWeightG(),
        b.getRemainingG(),
        b.getRoastedAt(),
        b.getPurchasedAt(),
        b.getOpenedAt(),
        b.getPrice(),
        b.isFrozen(),
        b.getFrozenAt(),
        b.isFinished(),
        b.getMemo(),
        daysOffRoast,
        DegassingStatus.of(daysOffRoast).name(),
        b.getCreatedAt(),
        b.getUpdatedAt());
  }
}
```

```java
// inventory/application/BeanBatchService.java
package com.kaldinote.inventory.application;

import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.infrastructure.BeanBatchRepository;
import com.kaldinote.inventory.presentation.dto.BeanBatchCreateRequest;
import com.kaldinote.inventory.presentation.dto.BeanBatchResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BeanBatchService {

  private final BeanBatchRepository beanBatchRepository;
  private final BeanProductRepository beanProductRepository;

  @Transactional
  public BeanBatchResponse create(Long userId, BeanBatchCreateRequest request) {
    if (!beanProductRepository.existsById(request.beanProductId())) {
      throw new BusinessException(
          ErrorCode.NOT_FOUND, "원두 상품을 찾을 수 없습니다: " + request.beanProductId());
    }
    BeanBatch batch =
        BeanBatch.create(
            userId,
            request.beanProductId(),
            request.roastedAt(),
            request.purchasedAt(),
            request.weightG(),
            request.price(),
            request.memo());
    return BeanBatchResponse.from(beanBatchRepository.save(batch));
  }
}
```

```java
// inventory/presentation/BeanBatchController.java
package com.kaldinote.inventory.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.inventory.application.BeanBatchService;
import com.kaldinote.inventory.presentation.dto.BeanBatchCreateRequest;
import com.kaldinote.inventory.presentation.dto.BeanBatchResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bean-batches")
@RequiredArgsConstructor
@Tag(name = "원두 재고", description = "개인 원두 재고 등록·조회·수정·삭제")
public class BeanBatchController {

  private final BeanBatchService beanBatchService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BeanBatchResponse create(
      @Valid @RequestBody BeanBatchCreateRequest request, AuthenticatedUser user) {
    return beanBatchService.create(user.id(), request);
  }
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: PASS, 41 tests (24 + 17).

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(bean): 재고 생성 API 추가" && cd backend
```

---

## Task 6: 재고 조회 API (목록 + 단건)

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/inventory/application/BeanBatchService.java`
- Modify: `backend/src/main/java/com/kaldinote/inventory/presentation/BeanBatchController.java`
- Modify: `backend/src/test/java/com/kaldinote/catalog/presentation/BeanControllerTest.java`

**Covers:** AC-BEAN-09, 56, 59

**Interfaces:**
- Consumes: Task 5의 `BeanBatchService#create`, `BeanBatchResponse`
- Produces: `BeanBatchService#findMine(userId)`, `#get(userId, batchId)`, private `findOwned(userId, batchId)` — Task 7·8이 `findOwned`를 그대로 재사용한다(Recipe의 `findOwned`와 동일 패턴)

- [x] **Step 1: 실패하는 테스트 작성**

```java
  private ResultActions getBeanBatch(String token, Long id) throws Exception {
    return mockMvc.perform(get("/api/v1/bean-batches/" + id).header(HttpHeaders.AUTHORIZATION, token));
  }

  private Long beanBatchId(String token, Long productId) throws Exception {
    String body = createBeanBatch(token, """
        {"beanProductId":%d,"weightG":200.0,"roastedAt":"%s"}
        """.formatted(productId, java.time.LocalDate.now()))
        .andReturn().getResponse().getContentAsString();
    return Long.valueOf(com.jayway.jsonpath.JsonPath.read(body, "$.id").toString());
  }

  @Test
  @DisplayName("AC-BEAN-09 · 재고 목록은 소진된 배치도 포함해 본인 것 전부를 반환한다")
  void 재고_목록은_본인_것_전부를_반환한다() throws Exception {
    String tokenA = token();
    Long productId = beanProductId(tokenA);
    beanBatchId(tokenA, productId);
    beanBatchId(tokenA, productId);

    String tokenB = otherUserToken();
    createBeanBatch(tokenB, """
        {"beanProductId":%d,"weightG":200.0,"roastedAt":"%s"}
        """.formatted(productId, java.time.LocalDate.now())).andExpect(status().isCreated());

    mockMvc
        .perform(get("/api/v1/bean-batches").header(HttpHeaders.AUTHORIZATION, tokenA))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2));
  }

  @Test
  @DisplayName("AC-BEAN-56 · 남의 재고를 조회할 수 없다")
  void 남의_재고를_조회할_수_없다() throws Exception {
    String owner = token();
    Long productId = beanProductId(owner);
    Long batchId = beanBatchId(owner, productId);

    getBeanBatch(otherUserToken(), batchId)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-BEAN-59 · 존재하지 않는 재고 조회는 404다")
  void 존재하지_않는_재고_조회는_404다() throws Exception {
    getBeanBatch(token(), 999999L)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: FAIL — `GET /api/v1/bean-batches`·`GET /api/v1/bean-batches/{id}` 엔드포인트가 없어 404(경로 없음).

- [x] **Step 3: 최소 구현**

`BeanBatchService`에 추가:

```java
  public List<BeanBatchResponse> findMine(Long userId) {
    return beanBatchRepository.findAllByUserIdAndDeletedAtIsNull(userId).stream()
        .map(BeanBatchResponse::from)
        .toList();
  }

  public BeanBatchResponse get(Long userId, Long batchId) {
    return BeanBatchResponse.from(findOwned(userId, batchId));
  }

  private BeanBatch findOwned(Long userId, Long batchId) {
    BeanBatch batch =
        beanBatchRepository
            .findByIdAndDeletedAtIsNull(batchId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: " + batchId));
    if (!batch.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 재고만 접근할 수 있습니다.");
    }
    return batch;
  }
```

`BeanBatchController`에 추가:

```java
  @GetMapping
  public List<BeanBatchResponse> list(AuthenticatedUser user) {
    return beanBatchService.findMine(user.id());
  }

  @GetMapping("/{id}")
  public BeanBatchResponse get(@PathVariable Long id, AuthenticatedUser user) {
    return beanBatchService.get(user.id(), id);
  }
```

(`GetMapping`, `PathVariable`, `List` import 추가)

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: PASS, 44 tests (41 + 3).

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(bean): 재고 목록·단건 조회 API 추가" && cd backend
```

---

## Task 7: 재고 수정 API (PATCH)

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/inventory/domain/BeanBatch.java`
- Create: `backend/src/main/java/com/kaldinote/inventory/presentation/dto/BeanBatchPatchRequest.java`
- Modify: `backend/src/main/java/com/kaldinote/inventory/application/BeanBatchService.java`
- Modify: `backend/src/main/java/com/kaldinote/inventory/presentation/BeanBatchController.java`
- Modify: `backend/src/main/java/com/kaldinote/common/error/ErrorCode.java`
- Modify: `backend/src/test/java/com/kaldinote/catalog/presentation/BeanControllerTest.java`

**Covers:** AC-BEAN-10, 11, 12, 13, 57, 60, 61

**Interfaces:**
- Consumes: Task 6의 `BeanBatchService#findOwned`
- Produces: `BeanBatch#applyPatch(remainingG, finished, frozen)`(Task 1에서 이미 정의), `BeanBatchService#patch(userId, batchId, request)`

- [x] **Step 1: 실패하는 테스트 작성**

```java
  private ResultActions patchBeanBatch(String token, Long id, String body) throws Exception {
    return mockMvc.perform(
        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                "/api/v1/bean-batches/" + id)
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  @Test
  @DisplayName("AC-BEAN-10 · remainingG를 PATCH로 갱신할 수 있다")
  void remainingG를_PATCH로_갱신할_수_있다() throws Exception {
    String token = token();
    Long batchId = beanBatchId(token, beanProductId(token));

    patchBeanBatch(token, batchId, """
        {"remainingG":120.0}
        """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.remainingG").value(120.0));
  }

  @Test
  @DisplayName("AC-BEAN-11 · finished를 PATCH로 토글할 수 있다")
  void finished를_PATCH로_토글할_수_있다() throws Exception {
    String token = token();
    Long batchId = beanBatchId(token, beanProductId(token));

    patchBeanBatch(token, batchId, """
        {"finished":true}
        """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.finished").value(true));
  }

  @Test
  @DisplayName("AC-BEAN-12 · frozen을 true로 바꾸면 frozenAt이 서버 시각으로 기록된다")
  void frozen을_true로_바꾸면_frozenAt이_기록된다() throws Exception {
    String token = token();
    Long batchId = beanBatchId(token, beanProductId(token));

    patchBeanBatch(token, batchId, """
        {"frozen":true}
        """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.frozen").value(true))
        .andExpect(jsonPath("$.frozenAt").exists());
  }

  @Test
  @DisplayName("AC-BEAN-13 · frozen을 false로 되돌리면 frozenAt이 null로 초기화된다")
  void frozen을_false로_되돌리면_frozenAt이_초기화된다() throws Exception {
    String token = token();
    Long batchId = beanBatchId(token, beanProductId(token));
    patchBeanBatch(token, batchId, """
        {"frozen":true}
        """).andExpect(status().isOk());

    patchBeanBatch(token, batchId, """
        {"frozen":false}
        """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.frozenAt").doesNotExist());
  }

  @Test
  @DisplayName("AC-BEAN-57 · 남의 재고를 수정할 수 없다")
  void 남의_재고를_수정할_수_없다() throws Exception {
    String owner = token();
    Long batchId = beanBatchId(owner, beanProductId(owner));

    patchBeanBatch(otherUserToken(), batchId, """
        {"finished":true}
        """)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-BEAN-60 · remainingG가 weightG를 초과하면 거부된다")
  void remainingG가_weightG를_초과하면_거부된다() throws Exception {
    String token = token();
    Long batchId = beanBatchId(token, beanProductId(token));

    patchBeanBatch(token, batchId, """
        {"remainingG":200.1}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_BATCH_REMAINING_INVALID"));
  }

  @Test
  @DisplayName("AC-BEAN-61 · remainingG가 음수면 거부된다")
  void remainingG가_음수면_거부된다() throws Exception {
    String token = token();
    Long batchId = beanBatchId(token, beanProductId(token));

    patchBeanBatch(token, batchId, """
        {"remainingG":-0.1}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_BATCH_REMAINING_INVALID"));
  }
```

> `beanBatchId(token, productId)` 헬퍼가 만드는 배치는 `weightG=200.0`으로 고정돼 있다(Task 5의 `beanProductId` 헬퍼와 짝을 이루는 기존 헬퍼 재사용).

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: FAIL — `PATCH /api/v1/bean-batches/{id}` 엔드포인트가 없어 404(경로 없음), `BEAN_BATCH_REMAINING_INVALID`가 없어 컴파일 에러.

- [x] **Step 3: 최소 구현**

`ErrorCode.java`에 추가:

```java
  BEAN_BATCH_REMAINING_INVALID(HttpStatus.BAD_REQUEST, "remainingG가 0 미만이거나 weightG를 초과합니다."),
```

```java
// inventory/presentation/dto/BeanBatchPatchRequest.java
package com.kaldinote.inventory.presentation.dto;

import java.math.BigDecimal;

public record BeanBatchPatchRequest(BigDecimal remainingG, Boolean finished, Boolean frozen) {}
```

`BeanBatchService`에 추가:

```java
  @Transactional
  public BeanBatchResponse patch(Long userId, Long batchId, BeanBatchPatchRequest request) {
    BeanBatch batch = findOwned(userId, batchId);
    if (request.remainingG() != null
        && (request.remainingG().compareTo(BigDecimal.ZERO) < 0
            || request.remainingG().compareTo(batch.getWeightG()) > 0)) {
      throw new BusinessException(ErrorCode.BEAN_BATCH_REMAINING_INVALID);
    }
    batch.applyPatch(request.remainingG(), request.finished(), request.frozen());
    return BeanBatchResponse.from(batch);
  }
```

`BeanBatchController`에 추가:

```java
  @PatchMapping("/{id}")
  public BeanBatchResponse patch(
      @PathVariable Long id,
      @RequestBody BeanBatchPatchRequest request,
      AuthenticatedUser user) {
    return beanBatchService.patch(user.id(), id, request);
  }
```

(`PatchMapping` import 추가. `remainingG`의 범위는 배치마다 다른 `weightG`에 의존하므로 정적 Bean Validation이 아니라 서비스에서 검증한다 — `@Valid` 없이 받는다.)

`BeanBatch.applyPatch`는 Task 1에서 이미 구현돼 있다 — 변경 없음.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: PASS, 51 tests (44 + 7).

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(bean): 재고 수정(PATCH) API 추가" && cd backend
```

---

## Task 8: 재고 삭제 API (DELETE)

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/inventory/application/BeanBatchService.java`
- Modify: `backend/src/main/java/com/kaldinote/inventory/presentation/BeanBatchController.java`
- Modify: `backend/src/test/java/com/kaldinote/catalog/presentation/BeanControllerTest.java`
- Modify: `docs/specs/2026-08-16-bean-inventory.md` (`status` 전환)

**Covers:** AC-BEAN-14, 58, 62

**Interfaces:**
- Consumes: Task 6의 `BeanBatchService#findOwned`, Task 1의 `BeanBatch#softDelete()`

- [x] **Step 1: 실패하는 테스트 작성**

```java
  @Test
  @DisplayName("AC-BEAN-14 · 삭제하면 소유자도 조회할 수 없다")
  void 삭제하면_소유자도_조회할_수_없다() throws Exception {
    String token = token();
    Long batchId = beanBatchId(token, beanProductId(token));

    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                    "/api/v1/bean-batches/" + batchId)
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNoContent());

    getBeanBatch(token, batchId)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BEAN-58 · 남의 재고를 삭제할 수 없다")
  void 남의_재고를_삭제할_수_없다() throws Exception {
    String owner = token();
    Long batchId = beanBatchId(owner, beanProductId(owner));

    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                    "/api/v1/bean-batches/" + batchId)
                .header(HttpHeaders.AUTHORIZATION, otherUserToken()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-BEAN-62 · 이미 삭제된 재고를 다시 삭제하면 404다")
  void 이미_삭제된_재고를_다시_삭제하면_404다() throws Exception {
    String token = token();
    Long batchId = beanBatchId(token, beanProductId(token));

    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                    "/api/v1/bean-batches/" + batchId)
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                    "/api/v1/bean-batches/" + batchId)
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: FAIL — `DELETE /api/v1/bean-batches/{id}` 엔드포인트가 없어 404(경로 없음, AC-BEAN-14의 첫 DELETE 단계부터 실패).

- [x] **Step 3: 최소 구현**

`BeanBatchService`에 추가:

```java
  @Transactional
  public void delete(Long userId, Long batchId) {
    findOwned(userId, batchId).softDelete();
  }
```

`BeanBatchController`에 추가:

```java
  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id, AuthenticatedUser user) {
    beanBatchService.delete(user.id(), id);
  }
```

(`DeleteMapping` import 추가)

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BeanControllerTest'`
Expected: PASS, 54 tests (51 + 3).

- [x] **Step 5: 스펙 status 전환 + 전체 검증**

```bash
./gradlew clean check
cd .. && ./scripts/check-spec-coverage.sh
```

`docs/specs/2026-08-16-bean-inventory.md`의 frontmatter `status: 초안`을 `status: 구현완료`로 바꾼다.

- [x] **Step 6: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(bean): 재고 삭제 API 추가, 원두 스펙 구현완료 전환" && cd backend
```

---

## 완료 기준

- [x] `cd backend && ./gradlew clean check` 통과
- [x] `./scripts/check-spec-coverage.sh` 통과 — `docs/specs/2026-08-16-bean-inventory.md` AC 54개 전부 확인
- [x] 스펙의 `status`를 `구현완료`로 변경
- [x] Swagger UI(`http://localhost:8080/swagger-ui.html`)에서 실제 로스터·블렌드 원두 상품을 등록하고 재고를 만들어 `daysOffRoast`·`degassingStatus`가 오늘 날짜 기준으로 맞는지 확인(스펙의 「수동 확인」 항목)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 54개 중 54개가 태스크에 매핑됨.

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음.

**타입 일관성:** `BeanCatalogService`(Task 2~4)와 `BeanBatchService`(Task 5~8)는 각각 한 클래스 안에서 점진적으로 메서드를 추가하지만, `BeanProductResponse`/`BeanOriginResponse`/`RoasterResponse`/`BeanBatchResponse`는 Task 2·3·5에서 확정되면 이후 태스크가 필드를 바꾸지 않고 그대로 재사용한다. `BeanBatch.applyPatch`는 Task 1에서 미리 정의해두고 Task 7에서 처음 호출한다 — Recipe의 `softDelete`/`isOwnedBy`를 Task 1에서 먼저 만들고 후속 태스크가 쓰는 패턴과 동일하다.

**검증되지 않은 가정:**
- `BeanProductCreateRequest.origins`가 요청에서 완전히 생략됐을 때 컴팩트 생성자가 `null`을 받아 `List.of()`로 대체되는지는 Task 3에서 실제로 확인해야 한다. `CreateRecipeRequest.steps`와 같은 패턴이라 Plan 2의 레시피 태스크에서 이미 한 번 검증됐지만, 이 레코드에서 다시 확인한다.
- `@PastOrPresent LocalDate`가 `AbstractIntegrationTest`의 Testcontainers 환경에서 서버 시스템 시계 기준으로 정확히 "오늘까지 허용, 내일부터 거부"로 동작하는지는 AC-BEAN-54·32~35 테스트 자체가 검증한다. 타임존 차이로 자정 근처에 실패한다면 `Clock`을 주입하는 방식으로 바꿔야 할 수 있다.
- Task 3의 `roasterId(token)` 테스트 헬퍼가 매번 `UUID`를 이름에 섞어 고유 로스터를 만드는 방식이 `@Transactional` 롤백과 맞물려 테스트 간 실제로 격리되는지는 Task 2 Step 4에서 이미 확인된 `@Transactional` 클래스 패턴(Recipe·Auth와 동일)을 그대로 신뢰한다 — 별도 재확인 불필요.
- `BeanCatalogService`에 `VarietyRepository`/`CoffeeProcessRepository`를 주입하면 기존 `CatalogService`와 리포지토리 빈을 공유하게 된다. Spring이 인터페이스 기반 리포지토리를 싱글턴으로 관리하므로 충돌은 없어야 하지만, Task 4 Step 4에서 컨텍스트 로딩 자체가 실패하지 않는지 확인한다.
