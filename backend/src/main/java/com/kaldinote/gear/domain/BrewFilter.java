package com.kaldinote.gear.domain;

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
@Table(name = "brew_filters")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewFilter extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 100)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private FilterMaterial material;

  @Column(length = 30)
  private String shape;

  @Column(name = "is_system", nullable = false)
  private boolean isSystem;

  @Column(name = "created_by_user_id")
  private Long createdByUserId;

  private BrewFilter(String name, FilterMaterial material, String shape, Long createdByUserId) {
    this.name = name;
    this.material = material;
    this.shape = shape;
    this.isSystem = false;
    this.createdByUserId = createdByUserId;
  }

  public static BrewFilter createByUser(
      String name, FilterMaterial material, String shape, Long userId) {
    return new BrewFilter(name, material, shape, userId);
  }
}
