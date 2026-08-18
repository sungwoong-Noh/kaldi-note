package com.kaldinote.recipe.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.recipe.application.RecipeService;
import com.kaldinote.recipe.presentation.dto.CreateRecipeRequest;
import com.kaldinote.recipe.presentation.dto.RecipeResponse;
import com.kaldinote.recipe.presentation.dto.UpdateRecipeRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recipes")
@RequiredArgsConstructor
@Tag(name = "레시피", description = "레시피 등록·조회·수정·삭제")
public class RecipeController {

  private final RecipeService recipeService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public RecipeResponse create(
      @Valid @RequestBody CreateRecipeRequest request, AuthenticatedUser user) {
    return recipeService.create(user.id(), request);
  }

  @GetMapping("/{id}")
  public RecipeResponse get(@PathVariable Long id, AuthenticatedUser user) {
    return recipeService.get(user.id(), id);
  }

  @PostMapping("/{id}/fork")
  @ResponseStatus(HttpStatus.CREATED)
  public RecipeResponse fork(@PathVariable Long id, AuthenticatedUser user) {
    return recipeService.fork(user.id(), id);
  }

  @PutMapping("/{id}")
  public RecipeResponse update(
      @PathVariable Long id,
      @Valid @RequestBody UpdateRecipeRequest request,
      AuthenticatedUser user) {
    return recipeService.update(user.id(), id, request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id, AuthenticatedUser user) {
    recipeService.delete(user.id(), id);
  }
}
