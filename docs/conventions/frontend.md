# 프론트엔드 컨벤션 (TypeScript / Next.js)

기준: [Next.js App Router 관례](https://nextjs.org/docs/app) + ESLint(`next/core-web-vitals`) + Prettier. **포맷은 고민하지 않는다** — `pnpm format`을 돌린다.

이 문서는 린터가 잡아주지 않는 **이름·구조·설계 규칙**을 다룬다.

---

## 네이밍

| 대상 | 규칙 | 예 |
|---|---|---|
| 컴포넌트 파일 | PascalCase | `RecipeStepList.tsx` |
| 그 외 파일 | kebab-case | `api-client.ts`, `use-recipe-form.ts` |
| App Router 파일 | Next.js 예약어 그대로 | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` |
| 컴포넌트 | PascalCase | `RecipeStepList` |
| 훅 | `use` 접두어 camelCase | `useRecipe`, `useGrindConversion` |
| 변수·함수 | camelCase | `fetchRecipes` |
| 상수 | UPPER_SNAKE | `MAX_STEP_COUNT` |
| 타입·인터페이스 | PascalCase, 접두어 없음 | `Recipe` (`IRecipe` 아님) |
| Zod 스키마 | `<대상>Schema` | `createRecipeSchema` |
| 불리언 | `is` / `has` / `can` 접두어 | `isEstimated`, `hasTds` |

### 단위를 이름에 넣는다

백엔드와 같은 규칙이다. 커피 도메인은 단위 실수가 곧 버그다.

```ts
doseG: number          // 좋음
waterTempC: number     // 좋음
totalTimeSeconds: number

dose: number           // 나쁨
time: number           // 나쁨
```

---

## 파일 배치

`frontend/CLAUDE.md`의 "프로젝트 구조"를 따른다. 핵심 규칙:

- **`app/`은 라우팅만.** 페이지는 훅을 부르고 `features/`의 컴포넌트를 배치하는 정도. 100줄을 넘으면 옮길 것이 있다는 신호다.
- **`features/<domain>/`에 도메인 코드를 모은다.** 각 feature는 `api.ts`, `queries.ts`, `schema.ts`, `components/`를 갖는다.
- **`features/` 끼리 서로 import 하지 않는다.** 공유가 필요하면 `components/`나 `lib/`로 올린다.
- **한 곳에서만 쓰는 컴포넌트는 그 feature 안에 둔다.** 두 번째 사용처가 생길 때 승격한다. 미리 올리지 않는다.

### 한 파일에 하나의 컴포넌트

파일당 export 하는 컴포넌트는 하나다. 그 컴포넌트에서만 쓰는 작은 하위 컴포넌트는 같은 파일에 두되, export 하지 않는다.

---

## 컴포넌트

```tsx
interface RecipeStepListProps {
  steps: RecipeStep[];
  totalWaterG: number;
  onStepClick?: (stepOrder: number) => void;
}

export function RecipeStepList({ steps, totalWaterG, onStepClick }: RecipeStepListProps) {
  // ...
}
```

- **함수 선언(`function`)을 쓴다.** `const X = () => {}` 보다 스택 트레이스가 읽기 쉽다.
- **Props는 `interface`로 명시**하고 이름은 `<컴포넌트>Props`.
- `React.FC`를 쓰지 않는다.
- **default export를 쓰지 않는다.** 예외: `app/`의 `page.tsx`·`layout.tsx`는 Next.js가 default export를 요구한다.

### 서버 컴포넌트가 기본이다

- **`'use client'`를 습관적으로 붙이지 않는다.** 필요한 최말단 컴포넌트에만 붙인다.
- 필요한 경우: `useState`/`useEffect`, 이벤트 핸들러, 브라우저 API, TanStack Query 훅.
- 클라이언트 컴포넌트 안에서도 서버 컴포넌트를 `children`으로 받을 수 있다. 경계를 잘게 유지한다.

### 컴포넌트가 커지면

- 100줄을 넘으면 분리를 검토한다.
- `if`/삼항이 3중으로 겹치면 조건별 컴포넌트로 나눈다.
- 로직이 절반 이상이면 커스텀 훅으로 뺀다.

---

## 타입

- **`tsconfig.json`은 `strict: true`.** 끄지 않는다.
- **`any` 금지.** 정말 모르는 타입은 `unknown`으로 받고 좁힌다.
- **API 응답 타입은 손으로 적지 않는다.** Zod 스키마에서 추론한다.

```ts
// features/recipe/schema.ts
import { z } from 'zod';

export const recipeSchema = z.object({
  id: z.number(),
  title: z.string(),
  doseG: z.number(),
  waterG: z.number(),
  visibility: z.enum(['PRIVATE', 'FRIENDS', 'PUBLIC']),
  steps: z.array(recipeStepSchema),
});

export type Recipe = z.infer<typeof recipeSchema>;   // ★ 여기서 타입이 나온다
```

- 백엔드 응답은 **런타임에 파싱한다**(`recipeSchema.parse(json)`). 타입 단언(`as Recipe`)은 거짓말이다.
- `type`과 `interface`: 객체 형태는 `interface`, 유니온·유틸리티는 `type`.
- `enum`을 쓰지 않는다. 유니온 리터럴(`'PRIVATE' | 'FRIENDS' | 'PUBLIC'`)이 트리셰이킹과 추론에 유리하다.

---

## 데이터 페칭

**서버 상태는 전부 TanStack Query로 다룬다.** `useEffect` + `fetch` 조합을 쓰지 않는다.

```ts
// features/recipe/queries.ts
export const recipeKeys = {
  all: ['recipes'] as const,
  lists: () => [...recipeKeys.all, 'list'] as const,
  list: (filters: RecipeFilters) => [...recipeKeys.lists(), filters] as const,
  details: () => [...recipeKeys.all, 'detail'] as const,
  detail: (id: number) => [...recipeKeys.details(), id] as const,
};

export function useRecipe(id: number) {
  return useQuery({
    queryKey: recipeKeys.detail(id),
    queryFn: () => fetchRecipe(id),
  });
}
```

- **쿼리 키는 팩토리 객체로 관리한다.** 문자열을 여기저기 흩뿌리면 무효화가 어긋난다.
- 뮤테이션 성공 시 관련 키를 `invalidateQueries`로 무효화한다.
- **서버 상태를 `useState`에 복사하지 않는다.** 동기화 버그의 근원이다.
- 클라이언트 전용 상태(모달 열림, 폼 입력 중)만 `useState`/`useReducer`를 쓴다. 전역 상태 라이브러리는 필요해질 때 도입한다 — 지금은 필요 없다.

### API 클라이언트

- 모든 호출은 `lib/api-client.ts`를 거친다. 인증 헤더 부착·에러 변환·401 시 토큰 갱신이 여기 한 곳에 있다.
- 컴포넌트에서 `fetch`를 직접 부르지 않는다.
- 에러는 백엔드의 `code` 필드로 분기한다. **`message` 문자열로 판단하지 않는다** — 문구는 바뀐다.

---

## 폼

React Hook Form + Zod resolver를 쓴다.

```tsx
const form = useForm<CreateRecipeInput>({
  resolver: zodResolver(createRecipeSchema),
  defaultValues: { doseG: 15, waterG: 250, steps: [] },
});
```

- **검증 규칙은 Zod 스키마 한 곳에만 둔다.** JSX에 흩어놓지 않는다.
- 백엔드 검증 규칙과 어긋나지 않게 맞춘다. 프론트 검증은 UX용이고, 최종 방어선은 백엔드다.

---

## 스타일

- **Tailwind 유틸리티를 인라인으로 쓴다.** 별도 CSS 파일을 만들지 않는다.
- 조건부 클래스는 `cn()`(`clsx` + `tailwind-merge`)으로 합친다.
- 반복되는 조합은 컴포넌트로 추출한다. `@apply`를 쓰지 않는다.
- **모바일 우선.** 기본 스타일이 모바일이고 `md:`·`lg:`로 넓은 화면을 덧붙인다.
- 색상·간격은 Tailwind 토큰을 쓴다. 임의값(`w-[137px]`)은 최후 수단.

### 접근성

- 클릭 가능한 것은 `<button>`이나 `<a>`다. `<div onClick>`을 쓰지 않는다.
- 모든 `<img>`에 `alt`. 장식용이면 `alt=""`.
- 폼 입력에 `<label>`을 연결한다.
- **터치 타깃은 최소 44×44px.** 부엌에서 젖은 손으로 쓴다.

---

## 테스트

```tsx
describe('RecipeStepList', () => {
  it('푸어 스텝의 누적 물량을 표시한다', () => {
    render(<RecipeStepList steps={steps} totalWaterG={250} />);

    expect(screen.getByText('60g')).toBeInTheDocument();
  });
});
```

- Vitest + Testing Library.
- **사용자가 보는 것으로 조회한다**: `getByRole`, `getByLabelText`, `getByText`. `getByTestId`는 최후 수단.
- 구현 세부(state 값, 내부 함수 호출)를 검증하지 않는다. **화면에 무엇이 보이는가**를 검증한다.
- 테스트 설명은 한국어로 사실을 진술한다.
- API는 MSW로 모킹한다. 실제 백엔드를 호출하지 않는다.

### 반드시 있어야 하는 테스트

- 분쇄도 환산 결과에 "추정치" 표기가 렌더링된다
- TDS가 없으면 추출 수율·SCA 차트 영역이 렌더링되지 않는다
- 푸어 스텝의 추가·삭제·순서 변경이 동작한다

---

## 성능

- **`next/image`를 쓴다.** `<img>` 직접 사용 금지 — 원두 사진이 많은 앱이다.
- `useMemo`/`useCallback`을 습관적으로 붙이지 않는다. 실제로 느릴 때 측정하고 붙인다.
- 리스트의 `key`에 배열 인덱스를 쓰지 않는다. **푸어 스텝은 순서가 바뀌므로 인덱스 key는 확실한 버그다.**
- 큰 컴포넌트는 `next/dynamic`으로 분할한다.

---

## 하지 말 것

- `any` 타입.
- `app/` 페이지에 로직 몰아넣기.
- `useEffect` + `fetch`로 서버 데이터 가져오기.
- 서버 응답 타입을 손으로 선언하거나 `as`로 단언하기.
- `localStorage`에 access token 저장 — XSS로 탈취된다.
- `'use client'`를 파일 최상단에 습관적으로 붙이기.
- 에러를 `message` 문자열로 분기하기 — `code`를 쓴다.
- `pnpm dev`만 확인하고 완료 처리 — `pnpm build`까지 돌린다.
- 데스크톱 뷰포트에서만 확인 — 375px에서 확인한다.
