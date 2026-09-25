# 작업 방식·문서 관리 개정 — 결정과 실행 지시

작성: 2026-09-25 (Claude 앱에서 논의) · 상태: **승인됨 — 정리 세션 ①·②의 입력 문서**

> **이 문서는 작업 방식 개정의 승인된 스펙이다.** 정리 세션 ①·②는 이 문서를 근거로 기존
> `CLAUDE.md`·`docs/conventions/`·`.claude/commands/`를 고친다. 기존 규칙("스펙 → 계획 → 코드",
> "인터뷰 먼저")을 이유로 이 작업을 멈추거나 새 인터뷰를 열지 않는다 — 인터뷰는 이미 끝났다.
> 로드맵은 [`2026-09-23-roadmap.md`](2026-09-23-roadmap.md)(세션 ①에서 `docs/ROADMAP.md`로 이동).

---

## 1. 왜 바꾸는가

| 문제 | 근거 (2026-09-23 기준) |
|---|---|
| 계획이 두 갈래 | `product-direction.md` 12단계와 JOURNAL 한 줄의 ①~⑩이 따로 놀았다 |
| 시각 작업에 무거운 절차 | 홈 화면 하나에 AC 127개, 목업 보정 스펙 444줄 |
| 상태가 5곳에 흩어지고 낡음 | 루트 `CLAUDE.md` 상단이 9/16 상태, 자동 메모리는 8/14 이후 갱신 0회 |
| 문서가 쌓이기만 함 | 마크다운 109개·약 64,700줄, 완료된 계획만 42,427줄, JOURNAL 3,551줄 |
| 규칙이 기억에만 의존 | 같은 규칙이 4곳에 중복, 지켜졌는지 검사하는 장치 없음 |

## 2. 결정 목록

| # | 결정 | 출처 |
|---|---|---|
| W1 | 로드맵은 하나. 1부(둘이 쓰는 도구) M0~M4, 2부(공개 서비스) 보류 | 사용자 결정 |
| W2 | 작업은 세 갈래. **A** 풀 흐름(백엔드·데이터·도메인 숫자·권한에 닿으면 무조건 A) · **B** 시각(목업이 곧 스펙) · **C** 버그·잔손질(실패하는 테스트부터). 애매하면 A | 제안 후 승인 |
| W3 | 별도 계획 파일 폐지 → 스펙 하단 「구현 순서」 섹션. 승인은 스펙 1회 | 제안 후 승인 |
| W4 | 스펙 구성: 시나리오 · AC(기능·엣지·실패·비기능 전부 ID + 리터럴) · 계약 파일(OpenAPI) · 구현 순서 | 사용자 제안 + 보완 |
| W5 | 목업이 스펙보다 먼저. 목업에는 빈·로딩·에러·경계 상태 포함, 디자인 토큰 안에서만 | 사용자 제안 + 보완 |
| W6 | 인터뷰는 **기본값 표 방식**: 조사 후 결정 목록 전체를 추천값과 함께 한 번에 제시, 사용자는 바꿀 것만 짚는다. 개별 질문은 「추천 근거가 없는 것」「되돌리기 어려운 것」만. 기술 결정은 묻지 않고 근거를 남긴다 | 사용자 요청 |
| W7 | 인터뷰 종료 체크리스트: 목업 필드 ↔ 계약 대조, 상태별 화면, 권한, 에러 코드 | 제안 후 승인 |
| W8 | 구현 중 사소한 판단은 묻지 않고 결정, PR 본문 「구현 중 결정」에 기록 | 제안 후 승인 |
| W9 | JOURNAL 폐기. 세션 기록 = PR 본문, 반복 함정 = `docs/GOTCHAS.md`, 할 일 = GitHub Issue. 기존 JOURNAL은 archive 보존 | 사용자 결정 |
| W10 | 백로그·버그·시각 보정은 GitHub Issues + Project 보드. Milestone = 로드맵 M1~M4 | 사용자 결정 |
| W11 | `ROADMAP.md`는 마일스톤 목표·완료 정의만. 이슈 목록을 적지 않는다 | 제안 후 승인 |
| W12 | 결정 기록(ADR) 신설: `docs/decisions/`, 결정 1개 = 파일 1개, `status`로 유효/보류/대체됨 | 제안 후 승인 |
| W13 | 삭제하지 않는 것은 스펙·ADR뿐(ID 참조). 나머지는 역할이 끝나면 지우거나 닫는다 | 제안 후 승인 |
| W14 | 현황(테스트 수·AC 수·진행률)은 저장하지 않고 `scripts/status.sh`가 계산 | 제안 후 승인 |
| W15 | 기계로 검사 가능한 규칙은 `scripts/check-docs.sh` + CI로 강제 | 제안 후 승인 |
| W16 | CI 초록이면 셀프 머지 | 제안 후 승인 |
| W17 | 멀티 에이전트: 기본은 세션 1개 + 서브에이전트(explorer·mockup-checker·reviewer). 동시 세션은 `--worktree`로 최대 2개, 공용 파일 겹침 사전 확인. BE·FE 분리는 큰 기능만(계약 PR → BE·FE PR, 둘 다 main 기준) | 제안 후 승인 |
| W18 | 자동 메모리는 사용자 선호 1개 파일만. 사실은 저장하지 않는다 | 사용자 결정 |

## 3. 문서 구조와 수명

```
CLAUDE.md               지도만. ≤150줄, 상태·숫자 없음
docs/
  ROADMAP.md            마일스톤 목표·완료 정의
  decisions/            ADR. README.md + TEMPLATE.md + NNNN-<slug>.md
  specs/                스펙(+구현 순서). README.md(작성 규칙) + TEMPLATE.md
  contracts/            OpenAPI 조각 (세션 ②)
  conventions/          작업 방식 원본 (workflow·git·backend·frontend·verification)
  GOTCHAS.md            지금 유효한 함정만. ≤100줄
  design/               목업·브랜드·아키텍처 (입력물)
  archive/              plans/, JOURNAL.md
GitHub Issues + Project 백로그·버그·시각 보정
PR 본문                  세션 기록
```

| 문서 | 생성 | 수정 | 삭제 |
|---|---|---|---|
| Issue | 발견 즉시 | Milestone·라벨 배정 | 머지 시 `Closes #`로 닫힘 |
| ROADMAP | — | 마일스톤 편성·종료 (사용자 결정) | 안 함 |
| ADR | 되돌리기 어려운 결정이 생길 때 | 대체 시 `status`만 | **안 함** |
| 스펙 | A 갈래 착수 | 구현 중(AC 추가는 새 ID, 기존 ID 의미 변경 금지), 완료 시 `status` | **안 함** |
| 스펙 「구현 순서」 | 스펙과 함께 | 태스크 커밋마다 체크 | `구현완료` 시 삭제 |
| GOTCHAS | 함정 발견 | — | 해결 시 |
| 규칙 | — | 마일스톤 회고, 같은 문제 2회 반복 시만 | 회고 때 |

## 4. 규칙을 두는 곳

| 층 | 파일 | 역할 |
|---|---|---|
| 지도 | 루트 `CLAUDE.md` | 무엇이 어디 있는지 + 갈래 판정 요약 |
| 원칙 | `docs/conventions/workflow.md` | 갈래·흐름·수명표·공통 완료 정의의 유일한 원본 |
| 현장 | 각 폴더 `README.md` + `TEMPLATE.md` | 그 문서 쓰는 법 |
| 실행 시점 | `.claude/commands/*`, SessionStart hook | 정해진 때 실행. 규칙 본문을 반복하지 않고 링크 |
| 강제 | `check-docs.sh`, `check-spec-coverage.sh`, CI | 기계 검사 |

---

## 5. 정리 세션 ① — 문서와 규칙 (브랜치 `chore/workflow-revision`, PR 1개, 코드 변경 없음)

- [ ] 1. `main` 최신에서 브랜치 생성. 이 문서와 로드맵 초안을 첫 커밋으로
- [ ] 2. `docs/design/2026-09-23-roadmap.md` → `docs/ROADMAP.md` 이동, M0 체크리스트를 이 문서 기준으로 갱신
- [ ] 3. `docs/decisions/` 신설 — README(작성·대체 규칙), TEMPLATE, ADR 0001~0008(루트 `CLAUDE.md` 「뒤집으면 안 되는 설계 결정」 8개), 0009(R1 공개 서비스 보류). `CLAUDE.md`에는 목록 링크만
- [ ] 4. `docs/specs/README.md` 신설(작성 규칙을 `workflow.md`에서 이동) + `TEMPLATE.md` 개정: frontmatter `milestone`·`supersedes`, 절 = 시나리오 / AC(기능·엣지·실패·비기능) / 계약 / 구현 순서 / 수동 확인
- [ ] 5. `docs/conventions/workflow.md` 재작성: 갈래(W2), 흐름 0~5, 수명표(§3), 공통 완료 정의, 인터뷰 규칙(W6·W7), 멀티 에이전트(W17)
- [ ] 6. `handover.md` 개정(JOURNAL 제거, PR 본문·GOTCHAS·이슈로 대체), `git.md` 개정(셀프 머지 W16, PR 본문 「구현 중 결정」 W8). `.github/pull_request_template.md`도 맞춘다
- [ ] 7. 루트 `CLAUDE.md` ≤150줄로 재작성: 상태 블록·「구현 순서」 섹션 삭제, 숫자 없음, 「메모리에는 사실을 저장하지 않는다」 한 줄. `backend/`·`frontend/CLAUDE.md`에서 낡은 상태 문구 제거
- [ ] 8. 커맨드: `/interview`(W6·W7), `/resume`(ROADMAP + `gh issue list` 기반, 테스트 실행은 유지), `/handover`(PR 본문 작성·스펙 status·GOTCHAS·이슈 닫기, JOURNAL 제거), `/fix` 신설(B·C 갈래 한 세션 처리)
- [ ] 9. archive: `docs/plans/` → `docs/archive/plans/`, `docs/JOURNAL.md` → `docs/archive/JOURNAL.md`. 스펙 frontmatter `plan:`과 본문 링크를 새 경로로 일괄 치환. JOURNAL에서 **지금도 유효한** 함정만 `docs/GOTCHAS.md`로(≤100줄)
- [ ] 10. `2026-09-17-small-features.md`를 `status: 분할됨`으로 닫고 항목을 M2·M3 이슈로. `product-direction.md` 결정 1에 R1 보류 주석, 「단계와 스펙」 표에 ROADMAP 링크, 「디자인이 아직 없는 화면」 표 갱신(`screens-v2` 존재). `AC-RECIPESBREWS-54`에 「2부 P2에서 교체 예정」 주석
- [ ] 11. GitHub: 라벨(`lane:A`·`lane:B`·`lane:C`·`be`·`fe`), Milestone M1~M4, Project 보드(Backlog·Next·In progress·Review·Done). 이슈 이전은 **선별만**: 최근 2주 JOURNAL의 미처리 항목, 1부 로드맵 관련 스펙 「범위 밖」 항목, M1~M4의 미작성 스펙 단위
- [ ] 12. 자동 메모리: 설계 결정·작업 규칙 파일 삭제, 인터뷰 파일을 「사용자 선호」로 개정(선택지로 고르는 방식 선호, 빈틈을 스스로 검토, W6 인터뷰 방식), `MEMORY.md` 갱신

**완료 기준 (전부 명령으로 확인):**

- `./scripts/check-spec-coverage.sh` 통과
- `wc -l CLAUDE.md` ≤ 150
- `grep -rn 'docs/plans/' --include=*.md . | grep -v docs/archive` 출력 없음
- `test ! -e docs/JOURNAL.md && test ! -d docs/plans`
- `wc -l docs/GOTCHAS.md` ≤ 100
- `gh issue list --milestone M1` 에 1건 이상

## 6. 정리 세션 ② — 도구 (브랜치 `chore/workflow-tooling`, PR 1개)

- [ ] 1. `scripts/status.sh`: 마일스톤별 스펙 status·AC 수, 열린 이슈 요약(`gh`), 진행 중 브랜치. 저장하지 않고 출력만
- [ ] 2. `scripts/check-docs.sh` + 셸 테스트 + `spec.yml` 연결: 스펙 `milestone`이 ROADMAP에 존재, `supersedes` 대상에 대체 표시 존재, `CLAUDE.md` ≤150줄, `GOTCHAS.md` ≤100줄, 상대 링크 깨짐 0, `구현완료` 스펙에 「구현 순서」 잔존 시 경고
- [ ] 3. `.claude/settings.json` SessionStart hook → `scripts/status.sh`
- [ ] 4. Playwright 스크린샷 스냅샷: 홈·레시피 목록·레시피 상세·기록 상세·환산기 × 뷰포트 390·1280. 기준 이미지는 CI와 같은 환경에서 생성
- [ ] 5. 계약 도구 최소 구성: `docs/contracts/` 규칙, 계약 → FE 타입 생성 스크립트, BE에서 springdoc 출력과 계약 비교 테스트. 첫 적용은 M1 검색 API
- [ ] 6. `.claude/agents/`: `explorer`(읽기 전용 탐색), `mockup-checker`(구현 캡처 ↔ 목업 대조 보고), `reviewer`(AC 누락·계약 불일치·GOTCHAS 위반 검토). `.worktreeinclude`(`.env`)
- [ ] 7. `.github/ISSUE_TEMPLATE/`: 기능(A)·시각(B)·버그(C)

## 7. 시험 운행 (2주)

M1에 새 흐름을 적용하고 다음을 재측정한다. 안 맞는 규칙은 고치거나 되돌린다.

| 지표 | 개정 전 | 목표 |
|---|---|---|
| 세션 시작 시 읽는 규칙·상태 문서 | 약 2,000줄 | ≤ 400줄 |
| 시각 보정 1건의 문서 | 스펙+계획 | 0줄 (이슈 1개) |
| 기능 1건의 승인 관문 | 2회 | 1회 |
| 「지금 무엇을 하나」의 출처 | 5곳 | 1곳 (ROADMAP + 보드) |
