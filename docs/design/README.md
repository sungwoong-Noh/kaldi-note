# docs/design — 폴더 지도

설계 **입력물**을 두는 곳이다. 인수 조건(AC)은 없다 — AC는 `docs/specs/`가 갖는다.
시각은 목업이 정본이다(`docs/decisions/0010-mockup-is-visual-source-of-truth.md`).

```
docs/design/
├── README.md                          이 문서
├── 2026-08-14-architecture.md         ┐
├── 2026-08-14-frontend-ia.md          │ 설계 문서 4개
├── 2026-09-08-brand.md                │
├── 2026-09-16-product-direction.md    ┘
├── kaldi-note-design/                 ★ 앱 화면 · 디자인 시스템 정본 (INDEX.md부터)
├── admin/                             관리자 콘솔 핸드오프 (README.md · design/Admin.dc.html)
└── requests/                          디자인 도구에 보낸 요청문 (날짜순)
```

## 무엇을 어디서 보나

| 찾는 것 | 위치 |
|---|---|
| 화면 목업 · 어느 파일이 현행인가 | `kaldi-note-design/INDEX.md` |
| 토큰 · 컴포넌트 · 보이스 | `kaldi-note-design/docs/README.md`, `kaldi-note-design/system/` |
| 확정된 디자인 결정 | `kaldi-note-design/docs/DECISIONS.md` (다른 문서와 어긋나면 이쪽 우선) |
| 로고 · 아이콘 SVG | `kaldi-note-design/system/assets/` |
| 관리자 화면 | `admin/` |
| 목업이 왜 이렇게 그려졌나 | `requests/` — 요청문 |
| 시스템 구조 · 정보 구조 · 브랜드 · 제품 방향 | 위 설계 문서 4개 |

## 규칙

- **원본 zip · 중복 에셋은 두지 않는다.** 디자인 도구에서 받은 묶음은 풀어서 `kaldi-note-design/`에 반영하고
  zip은 커밋하지 않는다. 스테이징은 경로를 지정한다(`git add -A` 금지).
- 역할이 끝난 문서는 `docs/archive/`로 옮긴다.
