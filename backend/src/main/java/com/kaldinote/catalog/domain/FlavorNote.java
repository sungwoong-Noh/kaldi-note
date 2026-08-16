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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "flavor_notes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FlavorNote {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "name_en", nullable = false, length = 100)
  private String nameEn;

  @Column(name = "name_ko", nullable = false, length = 100)
  private String nameKo;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "parent_id")
  private FlavorNote parent;

  @Column(nullable = false)
  private Short level;
}
