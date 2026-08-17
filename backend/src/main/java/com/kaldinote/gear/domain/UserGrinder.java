package com.kaldinote.gear.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "user_grinders")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserGrinder extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "grinder_model_id", nullable = false)
  private Long grinderModelId;

  @Column(length = 50)
  private String nickname;

  @Column(name = "calibration_offset_clicks", nullable = false, precision = 6, scale = 2)
  private BigDecimal calibrationOffsetClicks;

  @Column(name = "is_default", nullable = false)
  private boolean isDefault;

  private UserGrinder(Long userId, Long grinderModelId, String nickname) {
    this.userId = userId;
    this.grinderModelId = grinderModelId;
    this.nickname = nickname;
    this.calibrationOffsetClicks = BigDecimal.ZERO;
    this.isDefault = false;
  }

  public static UserGrinder of(Long userId, Long grinderModelId, String nickname) {
    return new UserGrinder(userId, grinderModelId, nickname);
  }

  public boolean isOwnedBy(Long userId) {
    return this.userId != null && this.userId.equals(userId);
  }
}
