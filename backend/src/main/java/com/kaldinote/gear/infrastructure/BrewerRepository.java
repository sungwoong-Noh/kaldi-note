package com.kaldinote.gear.infrastructure;

import com.kaldinote.gear.domain.Brewer;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewerRepository extends JpaRepository<Brewer, Long> {

  List<Brewer> findAllByOrderByBrandAscNameAsc();

  Optional<Brewer> findByBrandAndName(String brand, String name);

  /** "V60"은 Hario의 제품 라인명이라 브랜드가 아니라 이름으로 찾는다(AC-RECIPESBREWS-08). */
  List<Brewer> findByNameStartingWithIgnoreCase(String namePrefix);

  List<Brewer> findByBrandIgnoreCase(String brand);
}
