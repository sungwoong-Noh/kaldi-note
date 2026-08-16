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
