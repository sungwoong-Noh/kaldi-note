# kaldi-note 디자인 — 전체 목록

폴더 하나로 정리한 최종본입니다. `.dc.html`은 브라우저로 바로 열립니다(같은 폴더의 `support.js` 필요 — 폴더째 옮기세요).

```
kaldi-note-design/
├─ INDEX.md            ← 지금 이 문서
├─ docs/               구현 문서 (읽는 순서는 아래)
├─ system/             디자인 시스템 · 내비게이션 · 로고/아이콘 에셋
├─ screens/            화면 목업 (번호 순)
├─ screenshots/        빠른 확인용 PNG
└─ archive/            채택 전 시안 — 구현 대상 아님
```

## 1. 문서 — 이 순서로 읽기

| # | 파일 | 역할 |
|---|---|---|
| 1 | `docs/README.md` | 제품 원칙 · 토큰 · 컴포넌트 사전 · 보이스 · 구현 순서 |
| 2 | `docs/DECISIONS.md` | 확정 결정 — 다른 문서와 어긋나면 **이 문서 우선** |
| 3 | `docs/RECIPES-AND-BREWS.md` | 레시피 / 잔 구조 · 담기 · 검색 · 필터 · 데이터 모델 |
| 4 | `docs/HOME-CALENDAR.md` | 달력 홈 (모바일 + 웹) |
| 5 | `docs/SCREENS-V3.md` | 레시피 작성 · 프로필 · 더보기 · 내 기구 + **기존 문서와 어긋난 점** |

## 2. 디자인 시스템 — `system/`

| 파일 | 내용 |
|---|---|
| `Design System.dc.html` | 로고 · 색(라이트/다크) · 타입 · 간격 · 컴포넌트 · 보이스 |
| `Navigation.dc.html` | 하단 탭 4개 규격 · CTA와의 관계 |
| `Assets.dc.html` + `assets/` | 심볼 · 락업 · 앱 아이콘 · 파비콘 · 로스트 도트 SVG |

## 3. 화면 — `screens/`

| 파일 | 라우트 | 담긴 화면 | 상태 |
|---|---|---|---|
| `01 Home - Mobile` | `/` | 달력 · 팔로우 레일 · 날짜별 목록 | 현행 |
| `01 Home - Web` | `/` | 달력 박스 셀 · 우측 날짜 목록 | 현행 |
| `02 Recipes and Cups - Mobile` | `/recipes` `/brews` | 내 서랍 · 둘러보기 · 필터 시트 · 레시피 상세 · 담기 · 내 잔 | 현행 |
| `02 Recipes and Cups - Web` | `/recipes` `/brews` | 결정 패널 · 둘러보기 · 내 서랍 · 레시피 상세 · 내 잔 테이블 | 현행 |
| `03 Recipe Edit` | `/recipes/new` `/[id]/edit` | 웹 · 모바일 · 스텝 시트 · 다크 · 상태 8 | 현행 |
| `04 Profile` | `/u/[id]` | 웹 · 모바일 · 관계 4종 · 404 · 상태 | 현행 |
| `05 More and Settings` | `/more` `/settings` | 모바일 · 웹 아바타 메뉴 · 설정 · 상태 | 현행 |
| `06 Gear` | `/more/gear` | 그라인더 목록 · 추가 · 상세 · 상태 | 현행 |
| `07 Timer and Feed` | — | **푸어 타이머**(03번 프레임) · 친구 피드 | 타이머만 현행 |
| `08 Other Screens - Mobile` | 여러 개 | **잔 상세 · 분쇄도 환산기 · 로그인 · 오프라인**만 현행 | 부분 현행 |
| `08 Other Screens - Web` | 여러 개 | **W3 잔 상세**만 현행 | 부분 현행 |

`07`, `08`의 나머지 프레임은 01–06으로 대체되었습니다. 겹치면 **번호가 작은 파일**을 따르세요.

### 라우트 → 파일

| 라우트 | 모바일 | 웹 |
|---|---|---|
| `/` 홈 | 01 Home - Mobile | 01 Home - Web |
| `/recipes` 내 서랍 · 둘러보기 | 02 … Mobile (RM1–RM3) | 02 … Web (RW1–RW2) |
| `/recipes/[id]` | 02 … Mobile (RM4) | 02 … Web (RW3) |
| `/recipes/new` · `/[id]/edit` | 03 Recipe Edit (M1–M3) | 03 Recipe Edit (W) |
| `/brews` 내 잔 | 02 … Mobile (BM1) | 02 … Web (BW1) |
| `/brews/[id]` 잔 상세 | 08 Other - Mobile (B2) | 08 Other - Web (W3) |
| 타이머 | 07 Timer and Feed (03) | — |
| `/u/[id]` | 04 Profile (M1–M3) | 04 Profile (W) |
| `/more` · `/settings` | 05 More (M1–M2) | 05 More (W) |
| `/more/gear` | 06 Gear (M1–M3) | 06 Gear (W) |
| `/gear/grind-converter` | 08 Other - Mobile (G) | — |
| `/login` · `/offline` | 08 Other - Mobile (L, O) | — |

## 4. 아직 없는 것

- 잔 기록 작성 `/brews/new` — 03 Recipe Edit의 폼 패턴 + 잔 상세의 평가 5축으로 조합
- 웹 다크 — 모바일 다크와 같은 토큰 치환
- 잔 상세 · 타이머 · 분쇄도 환산기의 v3 개편(용어 「잔」, 스텝 라벨 뜸·붓기·대기·돌리기·젓기 반영)

## 5. 열려 있는 결정

없음 — 공개 범위 · 온도 · 배전도 · 스텝/방식/교반 · 분쇄도 단위는 `docs/DECISIONS.md` 기준으로 확정입니다. screens-v3의 Q 목록 18건도 `docs/DECISIONS.md` 5절로 확정됐습니다(2026-09-25).
