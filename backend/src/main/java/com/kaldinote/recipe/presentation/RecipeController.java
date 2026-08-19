package com.kaldinote.recipe.presentation;

import com.kaldinote.common.response.PageParams;
import com.kaldinote.common.response.PageResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.recipe.application.RecipeService;
import com.kaldinote.recipe.presentation.dto.CreateRecipeRequest;
import com.kaldinote.recipe.presentation.dto.RecipeResponse;
import com.kaldinote.recipe.presentation.dto.RecipeSummaryResponse;
import com.kaldinote.recipe.presentation.dto.UpdateRecipeRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
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
import org.springframework.web.bind.annotation.RequestParam;
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

  @GetMapping
  @Operation(
      summary = "볼 수 있는 레시피 목록",
      description =
          "내 것 + 남의 PUBLIC + 상호 팔로우 상대의 FRIENDS + 주인 없는 CURATED. createdAt 내림차순(동점 시 id 내림차순).")
  public PageResponse<RecipeSummaryResponse> list(
      @Parameter(description = "0-based 페이지 번호. 음수면 400.", schema = @Schema(defaultValue = "0"))
          @RequestParam(required = false)
          Integer page,
      @Parameter(
              description = "페이지 크기. 1 이상 100 이하(양끝 포함), 벗어나면 400.",
              schema = @Schema(defaultValue = "20"))
          @RequestParam(required = false)
          Integer size,
      @Parameter(description = "지정하면 그 사용자가 소유한 레시피만. 없는 id면 빈 목록.") @RequestParam(required = false)
          Long ownerUserId,
      AuthenticatedUser user) {
    return recipeService.list(user.id(), ownerUserId, PageParams.of(page, size));
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
