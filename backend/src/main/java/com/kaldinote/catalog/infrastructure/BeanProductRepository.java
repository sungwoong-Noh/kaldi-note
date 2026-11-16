package com.kaldinote.catalog.infrastructure;

import com.kaldinote.catalog.domain.BeanProduct;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BeanProductRepository extends JpaRepository<BeanProduct, Long> {
  Optional<BeanProduct> findByRoasterIdAndName(Long roasterId, String name);

  /** 크롤러 매칭 ①. 크롤러 원두끼리는 유일하지만(V22 부분 인덱스) 사용자 원두는 겹칠 수 있어 목록이다. */
  List<BeanProduct> findAllByProductUrl(String productUrl);

  /**
   * 원두 검색(docs/specs/2026-11-15-bean-detail.md 「검색」). 숨긴 원두와 남이 만든 사용자 원두는 항상 빠진다 — 관리자가 올린 사용자
   * 원두(promoted)는 모두에게 나온다(docs/specs/2026-11-15-admin-beans.md 「검색 규칙 변경」). 이름은 로스터 테이블에 있어
   * RecipeRepository.searchPublic과 같은 네이티브 + null-safe {@code (:param IS NULL OR ...)} 패턴을 쓴다.
   */
  @Query(
      value =
          """
          select bp.* from bean_products bp
          join roasters r on r.id = bp.roaster_id
          where bp.hidden = false
            and (bp.created_by_user_id is null or bp.created_by_user_id = :userId or bp.promoted)
            and (cast(:q as text) is null
                 or bp.name ilike concat('%', cast(:q as text), '%')
                 or r.name ilike concat('%', cast(:q as text), '%'))
            and (cast(:roasterId as bigint) is null or bp.roaster_id = cast(:roasterId as bigint))
            and (cast(:roast as text[]) is null or bp.roast_level = any(cast(:roast as text[])))
            and (cast(:decaf as boolean) is null or bp.decaf = cast(:decaf as boolean))
            and (cast(:country as text) is null
                 or exists (select 1 from bean_origins o
                            where o.bean_product_id = bp.id and o.country = cast(:country as text)))
          order by bp.name asc, bp.id asc
          """,
      countQuery =
          """
          select count(*) from bean_products bp
          join roasters r on r.id = bp.roaster_id
          where bp.hidden = false
            and (bp.created_by_user_id is null or bp.created_by_user_id = :userId or bp.promoted)
            and (cast(:q as text) is null
                 or bp.name ilike concat('%', cast(:q as text), '%')
                 or r.name ilike concat('%', cast(:q as text), '%'))
            and (cast(:roasterId as bigint) is null or bp.roaster_id = cast(:roasterId as bigint))
            and (cast(:roast as text[]) is null or bp.roast_level = any(cast(:roast as text[])))
            and (cast(:decaf as boolean) is null or bp.decaf = cast(:decaf as boolean))
            and (cast(:country as text) is null
                 or exists (select 1 from bean_origins o
                            where o.bean_product_id = bp.id and o.country = cast(:country as text)))
          """,
      nativeQuery = true)
  Page<BeanProduct> search(
      @Param("userId") Long userId,
      @Param("q") String q,
      @Param("roasterId") Long roasterId,
      @Param("roast") String[] roast,
      @Param("decaf") Boolean decaf,
      @Param("country") String country,
      Pageable pageable);

  // ── 관리자 원두(docs/specs/2026-11-15-admin-beans.md) ─────────────────────────

  /** 목록 한 페이지의 id. 수정일 내림차순 → id 내림차순. 산지 · 기록 수는 이 id들로 따로 한 번씩 읽는다. */
  @Query(
      value =
          "select bp.id"
              + AdminBeanProductQueries.FROM
              + AdminBeanProductQueries.BASE_WHERE
              + AdminBeanProductQueries.STATUS_AND_MISSING
              + " order by bp.updated_at desc, bp.id desc",
      countQuery =
          "select count(*)"
              + AdminBeanProductQueries.FROM
              + AdminBeanProductQueries.BASE_WHERE
              + AdminBeanProductQueries.STATUS_AND_MISSING,
      nativeQuery = true)
  Page<Long> searchAdminIds(
      @Param("q") String q,
      @Param("source") String source,
      @Param("decaf") Boolean decaf,
      @Param("roasterId") Long roasterId,
      @Param("status") String status,
      @Param("missing") Boolean missing,
      Pageable pageable);

  /** 필터 pill 개수 — 상태 · 정보 빠짐은 적용하지 않는다. */
  interface AdminCounts {
    long getAllCount();

    long getNeedsReview();

    long getVerified();

    long getHidden();

    long getMissing();

    long getMissingRoastLevel();

    long getMissingOrigin();

    long getMissingVariety();

    long getMissingProcess();
  }

  @Query(
      value =
          "select count(*) as \"allCount\","
              + " count(*) filter (where not bp.verified and not bp.hidden) as \"needsReview\","
              + " count(*) filter (where bp.verified and not bp.hidden) as \"verified\","
              + " count(*) filter (where bp.hidden) as \"hidden\","
              + " count(*) filter (where"
              + AdminBeanProductQueries.MISSING
              + ") as \"missing\","
              + " count(*) filter (where bp.roast_level is null) as \"missingRoastLevel\","
              + " count(*) filter (where"
              + AdminBeanProductQueries.NO_ORIGIN
              + ") as \"missingOrigin\","
              + " count(*) filter (where"
              + AdminBeanProductQueries.NO_VARIETY
              + ") as \"missingVariety\","
              + " count(*) filter (where"
              + AdminBeanProductQueries.NO_PROCESS
              + ") as \"missingProcess\""
              + AdminBeanProductQueries.FROM
              + AdminBeanProductQueries.BASE_WHERE,
      nativeQuery = true)
  AdminCounts countAdmin(
      @Param("q") String q,
      @Param("source") String source,
      @Param("decaf") Boolean decaf,
      @Param("roasterId") Long roasterId);

  @Query("select distinct p from BeanProduct p left join fetch p.origins where p.id in :ids")
  List<BeanProduct> findAllWithOriginsByIdIn(@Param("ids") List<Long> ids);

  /**
   * 원두별 기록 수 — 모든 사용자 · 공개 범위 무관, 봉투로 고른 예전 기록 포함(질문 09). brew_logs는 brewlog 도메인 테이블이지만 관리자 집계 한
   * 번이라 여기서 읽는다. 행 = [bean_product_id, count].
   */
  @Query(
      value =
          "select x.pid, count(*) from ("
              + " select coalesce(b.bean_product_id, bb.bean_product_id) as pid from brew_logs b"
              + " left join bean_batches bb on bb.id = b.bean_batch_id"
              + " where b.deleted_at is null) x"
              + " where x.pid in (:ids) group by x.pid",
      nativeQuery = true)
  List<Object[]> countBrewsByBeanProduct(@Param("ids") List<Long> ids);

  /** 이 원두를 뺀, 이름이 같은(대소문자 무시) 크롤러 원두 · 올린 원두 수. 올리기 모달 경고용. */
  @Query(
      value =
          "select count(*) from bean_products where lower(name) = lower(:name) and id <> :id"
              + " and (created_by_user_id is null or promoted)",
      nativeQuery = true)
  long countSameName(@Param("id") Long id, @Param("name") String name);

  /** 이름별 [name, min(id), count]. 수집 실행 상세의 원문 → 원두 연결(이름이 정확히 같은 행이 1개일 때만 잇는다). */
  @Query(
      value =
          "select name, min(id), count(*) from bean_products where name in (:names) group by name",
      nativeQuery = true)
  List<Object[]> countByNames(@Param("names") Collection<String> names);
}
