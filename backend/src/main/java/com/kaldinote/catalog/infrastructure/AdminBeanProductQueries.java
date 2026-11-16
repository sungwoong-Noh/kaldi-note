package com.kaldinote.catalog.infrastructure;

/**
 * 관리자 원두 목록의 WHERE 조각. 목록 · 개수 · 집계 쿼리가 같은 조건을 써야 하므로 한 곳에 둔다(어긋나면 「보이는 수」와 pill 개수가 다르다). 애노테이션에
 * 넣으려고 컴파일 시점 상수로만 만든다. docs/specs/2026-11-15-admin-beans.md 「목록」.
 */
final class AdminBeanProductQueries {

  private AdminBeanProductQueries() {}

  static final String FROM = " from bean_products bp join roasters r on r.id = bp.roaster_id ";

  /** q · 출처 · 디카페인 · 로스터. counts는 이것만 적용한다. */
  static final String BASE_WHERE =
      " where (cast(:q as text) is null"
          + " or bp.name ilike concat('%', cast(:q as text), '%')"
          + " or r.name ilike concat('%', cast(:q as text), '%'))"
          + " and (cast(:source as text) is null"
          + " or (cast(:source as text) = 'CRAWLER' and bp.created_by_user_id is null)"
          + " or (cast(:source as text) = 'USER' and bp.created_by_user_id is not null))"
          + " and (cast(:decaf as boolean) is null or bp.decaf = cast(:decaf as boolean))"
          + " and (cast(:roasterId as bigint) is null or bp.roaster_id = cast(:roasterId as bigint)) ";

  static final String NO_ORIGIN =
      " not exists (select 1 from bean_origins o where o.bean_product_id = bp.id) ";
  static final String NO_VARIETY =
      " exists (select 1 from bean_origins o where o.bean_product_id = bp.id and o.variety_id is null) ";
  static final String NO_PROCESS =
      " exists (select 1 from bean_origins o where o.bean_product_id = bp.id and o.process_id is null) ";

  /** 「정보 빠짐」 = 배전도 없음 · 산지 0행 · 산지 중 하나라도 품종 또는 가공 없음. */
  static final String MISSING =
      " (bp.roast_level is null or" + NO_ORIGIN + "or" + NO_VARIETY + "or" + NO_PROCESS + ") ";

  /** 상태는 숨김 > 확인됨 > 확인 필요. */
  static final String STATUS_AND_MISSING =
      " and (cast(:status as text) is null"
          + " or (cast(:status as text) = 'HIDDEN' and bp.hidden)"
          + " or (cast(:status as text) = 'VERIFIED' and bp.verified and not bp.hidden)"
          + " or (cast(:status as text) = 'NEEDS_REVIEW' and not bp.verified and not bp.hidden))"
          + " and (cast(:missing as boolean) is null or"
          + MISSING
          + ") ";
}
