package com.kaldinote.recipe.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "recipe_steps")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecipeStep {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "recipe_id")
  private Recipe recipe;

  @Column(name = "step_order", nullable = false)
  private Integer stepOrder;

  @Enumerated(EnumType.STRING)
  @Column(name = "step_type", nullable = false, length = 20)
  private StepType stepType;

  @Column(name = "start_at_seconds", nullable = false)
  private Integer startAtSeconds;

  @Column(name = "duration_seconds", nullable = false)
  private Integer durationSeconds;

  @Column(name = "water_g", precision = 6, scale = 1)
  private BigDecimal waterG;

  @Enumerated(EnumType.STRING)
  @Column(name = "pour_technique", length = 20)
  private PourTechnique pourTechnique;

  @Enumerated(EnumType.STRING)
  @Column(length = 20)
  private Agitation agitation;

  @Column(length = 500)
  private String note;

  private RecipeStep(
      Integer stepOrder,
      StepType stepType,
      Integer startAtSeconds,
      Integer durationSeconds,
      BigDecimal waterG,
      PourTechnique pourTechnique,
      Agitation agitation,
      String note) {
    this.stepOrder = stepOrder;
    this.stepType = stepType;
    this.startAtSeconds = startAtSeconds;
    this.durationSeconds = durationSeconds;
    this.waterG = waterG;
    this.pourTechnique = pourTechnique;
    this.agitation = agitation;
    this.note = note;
  }

  public static RecipeStep of(
      int stepOrder,
      StepType stepType,
      int startAtSeconds,
      int durationSeconds,
      BigDecimal waterG,
      PourTechnique pourTechnique,
      Agitation agitation,
      String note) {
    return new RecipeStep(
        stepOrder,
        stepType,
        startAtSeconds,
        durationSeconds,
        waterG,
        pourTechnique,
        agitation,
        note);
  }

  void assignTo(Recipe recipe) {
    this.recipe = recipe;
  }
}
