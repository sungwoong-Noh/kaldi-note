package com.kaldinote.catalog.infrastructure;

import com.kaldinote.catalog.domain.BeanProduct;
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
   * 원두 검색(docs/specs/2026-11-15-bean-detail.md 「검색」). 숨긴 원두와 남이 만든 사용자 원두는 항상 빠진다. 이름은 로스터 테이블에 있어
   * RecipeRepository.searchPublic과 같은 네이티브 + null-safe {@code (:param IS NULL OR ...)} 패턴을 쓴다.
   */
  @Query(
      value =
          """
          select bp.* from bean_products bp
          join roasters r on r.id = bp.roaster_id
          where bp.hidden = false
            and (bp.created_by_user_id is null or bp.created_by_user_id = :userId)
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
            and (bp.created_by_user_id is null or bp.created_by_user_id = :userId)
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
}
