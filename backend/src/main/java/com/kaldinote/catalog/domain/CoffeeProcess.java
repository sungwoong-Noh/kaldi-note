package com.kaldinote.catalog.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "coffee_processes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CoffeeProcess extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(name = "name_ko", length = 100)
  private String nameKo;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private ProcessCategory category;

  @Column(columnDefinition = "text")
  private String description;

  @Column(name = "is_system", nullable = false)
  private boolean isSystem;

  @Column(name = "created_by_user_id")
  private Long createdByUserId;

  private CoffeeProcess(
      String name, String nameKo, ProcessCategory category, Long createdByUserId) {
    this.name = name;
    this.nameKo = nameKo;
    this.category = category;
    this.isSystem = false;
    this.createdByUserId = createdByUserId;
  }

  public static CoffeeProcess createByUser(
      String name, String nameKo, ProcessCategory category, Long userId) {
    return new CoffeeProcess(name, nameKo, category, userId);
  }
}
