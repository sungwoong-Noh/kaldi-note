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
@Table(name = "brewers")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Brewer extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(length = 50)
  private String brand;

  @Column(nullable = false, length = 100)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private BrewerType type;

  @Column(name = "is_system", nullable = false)
  private boolean isSystem;

  @Column(name = "created_by_user_id")
  private Long createdByUserId;

  private Brewer(String brand, String name, BrewerType type, Long createdByUserId) {
    this.brand = brand;
    this.name = name;
    this.type = type;
    this.isSystem = false;
    this.createdByUserId = createdByUserId;
  }

  public static Brewer createByUser(String brand, String name, BrewerType type, Long userId) {
    return new Brewer(brand, name, type, userId);
  }
}
