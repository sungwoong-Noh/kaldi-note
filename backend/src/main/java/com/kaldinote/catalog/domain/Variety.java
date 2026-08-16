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
@Table(name = "varieties")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Variety extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(name = "name_ko", length = 100)
  private String nameKo;

  @Column(columnDefinition = "text")
  private String description;

  @Column(name = "is_system", nullable = false)
  private boolean isSystem;

  @Column(name = "created_by_user_id")
  private Long createdByUserId;

  private Variety(String name, String nameKo, Long createdByUserId) {
    this.name = name;
    this.nameKo = nameKo;
    this.isSystem = false;
    this.createdByUserId = createdByUserId;
  }

  public static Variety createByUser(String name, String nameKo, Long userId) {
    return new Variety(name, nameKo, userId);
  }
}
