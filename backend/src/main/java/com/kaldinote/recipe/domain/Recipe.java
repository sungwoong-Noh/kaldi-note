package com.kaldinote.recipe.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "recipes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Recipe extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "owner_user_id")
  private Long ownerUserId;

  @Enumerated(EnumType.STRING)
  @Column(name = "source_type", nullable = false, length = 20)
  private RecipeSourceType sourceType;

  @Column(name = "author_name", length = 100)
  private String authorName;

  @Column(name = "source_url", length = 500)
  private String sourceUrl;

  @Column(name = "source_note", length = 500)
  private String sourceNote;

  @Column(nullable = false, length = 100)
  private String title;

  @Column(length = 2000)
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(name = "brew_method", nullable = false, length = 20)
  private BrewMethod brewMethod;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private RecipeVisibility visibility;

  @Column(name = "parent_recipe_id")
  private Long parentRecipeId;

  @Column(name = "fork_root_id")
  private Long forkRootId;

  @Column(name = "dose_g", nullable = false, precision = 5, scale = 1)
  private BigDecimal doseG;

  @Column(name = "water_g", nullable = false, precision = 6, scale = 1)
  private BigDecimal waterG;

  @Column(name = "water_temp_c", precision = 4, scale = 1)
  private BigDecimal waterTempC;

  @Column(name = "total_time_seconds")
  private Integer totalTimeSeconds;

  @Column(name = "brewer_id")
  private Long brewerId;

  @Column(name = "filter_id")
  private Long filterId;

  @Column(name = "grinder_model_id")
  private Long grinderModelId;

  @Column(name = "grind_setting_value", precision = 7, scale = 1)
  private BigDecimal grindSettingValue;

  @Enumerated(EnumType.STRING)
  @Column(name = "grind_setting_unit", length = 10)
  private GrindSettingUnit grindSettingUnit;

  @Column(name = "grind_micron_estimated", precision = 6, scale = 0)
  private BigDecimal grindMicronEstimated;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("stepOrder ASC")
  private List<RecipeStep> steps = new ArrayList<>();

  private Recipe(
      Long ownerUserId,
      String title,
      String description,
      RecipeVisibility visibility,
      BigDecimal doseG,
      BigDecimal waterG,
      BigDecimal waterTempC,
      Integer totalTimeSeconds,
      Long brewerId,
      Long filterId,
      Long grinderModelId,
      BigDecimal grindSettingValue,
      GrindSettingUnit grindSettingUnit,
      BigDecimal grindMicronEstimated) {
    this.ownerUserId = ownerUserId;
    this.sourceType = RecipeSourceType.USER;
    this.title = title;
    this.description = description;
    this.brewMethod = BrewMethod.POUR_OVER;
    this.visibility = visibility;
    this.doseG = doseG;
    this.waterG = waterG;
    this.waterTempC = waterTempC;
    this.totalTimeSeconds = totalTimeSeconds;
    this.brewerId = brewerId;
    this.filterId = filterId;
    this.grinderModelId = grinderModelId;
    this.grindSettingValue = grindSettingValue;
    this.grindSettingUnit = grindSettingUnit;
    this.grindMicronEstimated = grindMicronEstimated;
  }

  public static Recipe create(
      Long ownerUserId,
      String title,
      String description,
      RecipeVisibility visibility,
      BigDecimal doseG,
      BigDecimal waterG,
      BigDecimal waterTempC,
      Integer totalTimeSeconds,
      Long brewerId,
      Long filterId,
      Long grinderModelId,
      BigDecimal grindSettingValue,
      GrindSettingUnit grindSettingUnit,
      BigDecimal grindMicronEstimated) {
    return new Recipe(
        ownerUserId,
        title,
        description,
        visibility,
        doseG,
        waterG,
        waterTempC,
        totalTimeSeconds,
        brewerId,
        filterId,
        grinderModelId,
        grindSettingValue,
        grindSettingUnit,
        grindMicronEstimated);
  }

  public void applyUpdate(
      String title,
      String description,
      RecipeVisibility visibility,
      BigDecimal doseG,
      BigDecimal waterG,
      BigDecimal waterTempC,
      Integer totalTimeSeconds,
      Long brewerId,
      Long filterId,
      Long grinderModelId,
      BigDecimal grindSettingValue,
      GrindSettingUnit grindSettingUnit,
      BigDecimal grindMicronEstimated) {
    this.title = title;
    this.description = description;
    this.visibility = visibility;
    this.doseG = doseG;
    this.waterG = waterG;
    this.waterTempC = waterTempC;
    this.totalTimeSeconds = totalTimeSeconds;
    this.brewerId = brewerId;
    this.filterId = filterId;
    this.grinderModelId = grinderModelId;
    this.grindSettingValue = grindSettingValue;
    this.grindSettingUnit = grindSettingUnit;
    this.grindMicronEstimated = grindMicronEstimated;
  }

  public void replaceSteps(List<RecipeStep> newSteps) {
    newSteps.forEach(s -> s.assignTo(this));
    this.steps.clear();
    this.steps.addAll(newSteps);
  }

  public void softDelete() {
    this.deletedAt = Instant.now();
  }

  public boolean isOwnedBy(Long userId) {
    return ownerUserId != null && ownerUserId.equals(userId);
  }
}
