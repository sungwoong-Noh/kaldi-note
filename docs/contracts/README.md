# 계약 (API 조각)

스펙의 `## 계약` 절이 가리키는 실제 파일이 여기 있다. **API를 다루는 스펙만 계약을 갖는다.**

---

## 왜 JSON인가 (YAML이 아니라)

OpenAPI는 YAML과 JSON 둘 다 지원한다. 이 저장소는 **JSON을 쓴다** — 백엔드는 이미 Jackson을,
프론트는 `JSON.parse`를 갖고 있어서 **새 의존성이 0개**다. YAML을 쓰면 백엔드에 SnakeYAML을,
프론트에 js-yaml 같은 걸 추가해야 한다. 사람이 읽고 diff하는 데는 JSON도 충분하다.

## 파일명

`docs/contracts/YYYY-MM-DD-<기능명>.json` — **스펙과 같은 파일명**을 쓴다
(`docs/specs/YYYY-MM-DD-<기능명>.md` ↔ `docs/contracts/YYYY-MM-DD-<기능명>.json`). 도구가 이
이름 대응으로 스펙과 계약을 짝짓는다 — 다른 이름을 쓰면 자동 검증이 그 계약을 못 찾는다.

## 형식

OpenAPI 3.0의 부분 조각이다. 전체 스펙 문서가 아니라 **이 기능이 추가·변경하는 경로만** 담는다.

```json
{
  "openapi": "3.0.3",
  "info": { "title": "<스펙 제목>", "version": "1.0.0" },
  "paths": {
    "/api/v1/recipes": {
      "get": {
        "operationId": "searchRecipes",
        "parameters": [
          { "name": "q", "in": "query", "required": false, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": {
            "description": "성공",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/PageOfRecipeSummary" } }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "RecipeSummary": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "title": { "type": "string" }
        },
        "required": ["id", "title"]
      }
    }
  }
}
```

지원하는 스키마 기능은 최소한이다 — `type`(`string`·`integer`·`number`·`boolean`·`array`·
`object`), `properties`, `required`, `enum`, `nullable`, `items`, `$ref`. `oneOf`/`allOf`/
`anyOf` 같은 합성은 아직 다루지 않는다 — 필요해지면 그때 확장한다(YAGNI).

## 흐름

```
1. 스펙의 ## API 표를 확정한다 (경로·메서드·인증)
        ↓
2. docs/contracts/<스펙과 같은 이름>.json 작성
        ↓
3. FE 타입 생성:  node scripts/generate-contract-types.mjs
        ↓
4. 구현 (백엔드 컨트롤러 + 프론트 화면)
        ↓
5. 스펙 status를 구현완료로 바꾸는 순간부터 BE 계약 테스트가 강제된다
   (backend: ContractComplianceTest — 실제 springdoc 출력과 이 파일을 비교)
```

**계약이 스펙보다 먼저 바뀌지 않는다.** API 모양이 달라지면 스펙의 `## API`·`## 계약` 절을
먼저 고치고, 계약 파일과 생성된 타입을 그 다음에 갱신한다.

## FE 타입 생성

```bash
node scripts/generate-contract-types.mjs
```

`docs/contracts/*.json`을 전부 읽어 `frontend/src/types/generated/<계약 파일명>.ts`에 TS
인터페이스를 쓴다. **생성된 파일은 손으로 고치지 않는다** — 계약을 고치고 다시 생성한다.
`pnpm generate:contracts`로도 부를 수 있다(`frontend/package.json`).

이 타입은 화면 코드가 직접 쓰는 게 아니라 **대조용**이다. 이 프로젝트는 여전히 Zod 스키마에서
`z.infer`로 응답 타입을 추론한다(`docs/conventions/frontend.md`) — 계약에서 생성한 타입과
어긋나면 계약이 잘못됐거나 Zod 스키마가 뒤처진 것이다.

## BE 계약 테스트

`backend/src/test/java/com/kaldinote/common/contract/ContractComplianceTest.java`가
`docs/contracts/*.json`을 전부 읽는다. 각 계약은 **같은 이름의 스펙**을 찾아 `status`를
확인한다.

| 스펙 status | 동작 |
|---|---|
| `초안` · `승인` · `구현중` | 건너뜀 (아직 구현 전이라 비교할 대상이 없다) |
| `구현완료` | 실제 `/v3/api-docs`에 그 경로·메서드가 있는지 확인. 없으면 실패 |

`check-spec-coverage.sh`의 status 게이팅과 같은 패턴이다 — 스펙을 `구현완료`로 올리는 순간
자동으로 강제된다.

## 지금 있는 계약

| 계약 | 스펙 | 상태 |
|---|---|---|
| `2026-09-21-recipes-and-brews-search-api.json` | `2026-09-21-recipes-and-brews-search-api.md` | 스펙 `승인` — 테스트는 건너뛰는 중. M1에서 구현하면서 `구현완료`로 올리면 강제된다 |
