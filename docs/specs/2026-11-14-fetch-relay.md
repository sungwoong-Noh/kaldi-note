---
id: RELAY
title: 크롤러 요청 중계 — 아임웹 클라우드 IP 차단을 Cloudflare Worker로 우회
status: 승인
milestone:
supersedes:
---

# 크롤러 요청 중계 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

관리자가 모모스 수집을 실행하면, 백엔드(OCI VM)는 `momos.co.kr`로 가는 요청을 직접 보내지 않고
Cloudflare Worker `kaldi-fetch-relay`에 "이 URL을 가져와 달라"고 맡긴다. Worker는 Cloudflare
출구 IP로 원본을 가져와 상태·본문·`Content-Type`을 그대로 돌려준다. 나머지 수집 흐름
(`CrawlRunService`, `MomosSource`)은 바뀌지 않는다.

배경 (2026-11-14 실측): 아임웹(imweb) 사이트는 앞단 CloudFront WAF가 클라우드 호스팅 IP를
일괄 차단한다. VM(158.179.172.168)에서 `momos.co.kr`은 UA와 무관하게 `robots.txt`까지 403
(`x-cache: Error from cloudfront`, 2775B "접근 제한" 페이지)이고, 같은 페이지가 센터커피·
앤트러사이트에서도 나온다. 임시 Worker를 거치면 VM → Worker → 모모스 목록·상세가 3회 모두 200,
목록에서 상품 링크 21개가 나왔다. 네이버 스마트스토어(429)·29CM(403)·무신사(403)·쿠팡
(Access denied)은 VM에서 더 강하게 막혀 대안이 되지 않는다.

판단은 **호스트 기준**이다 — 요청 URI의 호스트가 설정 `kaldi.crawler.relay.hosts`에 있으면
중계한다. 모든 크롤 요청이 `PageFetcher.get` 한 곳을 지나므로 `BeanSource`는 건드리지 않는다.

### 범위 밖 (Non-goals)

- Worker CI 자동 배포 (처음 한 번 사람이 `wrangler deploy`)
- 중계 요청의 재시도·캐시·속도 제한 (요청 간격 1000ms는 기존 크롤러가 지킨다)
- 다른 아임웹 사이트(센터커피·앤트러사이트 등) 소스 추가 — 나중에 설정에 호스트만 더한다
- 주기 실행(`@Scheduled`)
- JS 렌더링이 필요한 사이트 (Worker는 HTML 원문만 넘긴다)

## 용어

| 용어 | 정의 |
|---|---|
| 중계(relay) | 백엔드가 원본 대신 Worker에 GET을 보내고, Worker가 원본 응답을 그대로 돌려주는 것 |
| 원본(upstream) | 실제로 가져올 사이트 URL (예: `https://momos.co.kr/Product_CoffeeBeans`) |
| 중계 대상 호스트 | `kaldi.crawler.relay.hosts`에 있는 호스트. 대소문자 무시 완전 일치 |

## 데이터

스키마 변경 없음.

### 설정

| 위치 | 키 | 값 | 설명 |
|---|---|---|---|
| 백엔드 `application.yml` | `kaldi.crawler.relay.url` | `${KALDI_CRAWLER_RELAY_URL:}` | Worker 주소. 예 `https://kaldi-fetch-relay.<계정>.workers.dev` |
| 백엔드 `application.yml` | `kaldi.crawler.relay.token` | `${KALDI_CRAWLER_RELAY_TOKEN:}` | Worker와 공유하는 비밀 |
| 백엔드 `application.yml` | `kaldi.crawler.relay.hosts` | `momos.co.kr` | 쉼표 구분 목록 |
| Worker `wrangler.jsonc` `vars` | `ALLOWED_HOSTS` | `"momos.co.kr"` | 쉼표 구분 목록 |
| Worker secret | `RELAY_TOKEN` | `wrangler secret put RELAY_TOKEN` | 저장소에 두지 않는다 |
| VM `/opt/kaldi-note/infra/.env` | `KALDI_CRAWLER_RELAY_URL`, `KALDI_CRAWLER_RELAY_TOKEN` | — | 기존 `env_file`로 주입 |

## 계약

Worker `kaldi-fetch-relay` (`infra/fetch-relay/`). 백엔드 API 변경 없음.

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/?url=<encodeURIComponent(원본 URL)>` | 헤더 `X-Relay-Token: <RELAY_TOKEN>` | 원본 응답의 상태·본문·`Content-Type`을 그대로 반환 |

Worker → 원본 요청: `GET`, 헤더는 들어온 `User-Agent`만 그대로 붙인다(백엔드가
`kaldi-note-crawler/1.0`을 보낸다). 리다이렉트는 `fetch` 기본(follow).

Worker 자체 오류 응답 본문은 `{"code":"<CODE>"}`, `Content-Type: application/json`.

| 상황 | 상태 | code |
|---|---|---|
| GET이 아님 | 405 | `RELAY_METHOD_NOT_ALLOWED` |
| `X-Relay-Token` 없음 또는 불일치 | 401 | `RELAY_UNAUTHORIZED` |
| `url` 없음, URL 파싱 실패, `https:`가 아님 | 400 | `RELAY_BAD_URL` |
| 호스트가 `ALLOWED_HOSTS`에 없음 | 403 | `RELAY_HOST_NOT_ALLOWED` |
| 원본 `fetch`가 예외를 던짐 | 502 | `RELAY_UPSTREAM_FAILED` |

검사 순서는 표의 위에서 아래다(메서드 → 토큰 → URL → 호스트). 토큰 검사를 통과하지 못하면 원본에
요청하지 않는다.

백엔드 쪽 실패는 새 `ErrorCode`를 만들지 않는다. 중계 대상인데 url 또는 token이 비어 있으면
`PageFetcher.get`이 `IllegalStateException("중계 설정 없음: <host>")`을 던지고, 기존
`CrawlRunService.crawl()`의 목록 실패 처리가 실행을 `FAILED`로 남긴다. Worker가 4xx/5xx를
돌려주면 기존과 같다 — 목록이면 `FAILED`, 상세면 skipped `FETCH_FAILED`.

---

## 인수 조건

### 기능

#### AC-RELAY-01 · 원본 응답을 그대로 돌려준다

- **Given** `RELAY_TOKEN=t0ken`, `ALLOWED_HOSTS=momos.co.kr`, 원본이 200 · 본문 `<html>ok</html>` · `Content-Type: text/html; charset=utf-8`
- **When** `GET /?url=https%3A%2F%2Fmomos.co.kr%2FProduct_CoffeeBeans`, `X-Relay-Token: t0ken`
- **Then** 응답 200, 본문 `<html>ok</html>`, `Content-Type: text/html; charset=utf-8`. 원본 요청 URL은 `https://momos.co.kr/Product_CoffeeBeans`
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-02 · 원본의 오류 상태도 바꾸지 않는다

- **Given** AC-RELAY-01의 설정, 원본이 404 · 본문 `nope`
- **When** 같은 요청
- **Then** 응답 404, 본문 `nope`
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-03 · User-Agent를 원본에 그대로 넘긴다

- **Given** AC-RELAY-01의 설정
- **When** `User-Agent: kaldi-note-crawler/1.0`을 붙여 요청
- **Then** 원본 요청의 `User-Agent`가 `kaldi-note-crawler/1.0`
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-04 · 중계 대상 호스트는 Worker로 보낸다

- **Given** `relay.url=https://relay.test`, `relay.token=t0ken`, `relay.hosts=momos.co.kr`
- **When** `PageFetcher.get(URI.create("https://momos.co.kr/x"))`
- **Then** 실제 요청은 `GET https://relay.test?url=https%3A%2F%2Fmomos.co.kr%2Fx`, 헤더 `X-Relay-Token: t0ken`, `User-Agent: kaldi-note-crawler/1.0`. 반환값은 Worker 응답 본문
- **검증** `PageFetcherTest` (MockRestServiceServer)

#### AC-RELAY-05 · 그 밖의 호스트는 직접 요청한다

- **Given** AC-RELAY-04의 설정
- **When** `PageFetcher.get(URI.create("https://unspecialty.com/sitemap.xml"))`
- **Then** 실제 요청은 `GET https://unspecialty.com/sitemap.xml`, `X-Relay-Token` 헤더 없음
- **검증** `PageFetcherTest`

### 엣지 (경계값)

#### AC-RELAY-10 · Worker 호스트 비교는 대소문자를 무시한다

- **Given** AC-RELAY-01의 설정
- **When** `url=https://MOMOS.CO.KR/Product_CoffeeBeans`
- **Then** 200 (원본 요청 1회)
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-11 · Worker는 서브도메인을 허용하지 않는다

- **Given** AC-RELAY-01의 설정
- **When** `url=https://www.momos.co.kr/`
- **Then** 403, `{"code":"RELAY_HOST_NOT_ALLOWED"}`, 원본 요청 0회
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-12 · Worker는 https만 허용한다

- **Given** AC-RELAY-01의 설정
- **When** `url=http://momos.co.kr/`
- **Then** 400, `{"code":"RELAY_BAD_URL"}`, 원본 요청 0회
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-13 · 백엔드 호스트 비교도 대소문자를 무시한다

- **Given** AC-RELAY-04의 설정
- **When** `PageFetcher.get(URI.create("https://MOMOS.co.kr/x"))`
- **Then** 요청이 `https://relay.test?url=...`로 간다
- **검증** `PageFetcherTest`

### 실패

#### AC-RELAY-20 · 토큰이 없으면 거부한다

- **Given** AC-RELAY-01의 설정
- **When** `X-Relay-Token` 없이 요청
- **Then** HTTP `401`와 `code: "RELAY_UNAUTHORIZED"`, 원본 요청 0회
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-21 · 토큰이 틀리면 거부한다

- **Given** AC-RELAY-01의 설정
- **When** `X-Relay-Token: wrong`
- **Then** HTTP `401`와 `code: "RELAY_UNAUTHORIZED"`, 원본 요청 0회
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-22 · url이 없거나 URL이 아니면 거부한다

- **Given** AC-RELAY-01의 설정, 올바른 토큰
- **When** ① `url` 파라미터 없음 ② `url=not%20a%20url`
- **Then** 둘 다 HTTP `400`와 `code: "RELAY_BAD_URL"`, 원본 요청 0회
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-23 · 허용하지 않은 호스트는 거부한다

- **Given** AC-RELAY-01의 설정, 올바른 토큰
- **When** `url=https://example.com/`
- **Then** HTTP `403`와 `code: "RELAY_HOST_NOT_ALLOWED"`, 원본 요청 0회
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-24 · GET이 아니면 거부한다

- **Given** AC-RELAY-01의 설정, 올바른 토큰
- **When** `POST /?url=https%3A%2F%2Fmomos.co.kr%2F`
- **Then** HTTP `405`와 `code: "RELAY_METHOD_NOT_ALLOWED"`, 원본 요청 0회
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-25 · 원본 요청이 실패하면 502

- **Given** AC-RELAY-01의 설정, 원본 `fetch`가 `TypeError`를 던짐
- **When** 올바른 요청
- **Then** HTTP `502`와 `code: "RELAY_UPSTREAM_FAILED"`
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-26 · 중계 설정이 비어 있으면 예외

- **Given** `relay.hosts=momos.co.kr`, ① `relay.url` 빈 값 ② `relay.token` 빈 값
- **When** `PageFetcher.get(URI.create("https://momos.co.kr/x"))`
- **Then** 둘 다 `IllegalStateException`, 메시지 `중계 설정 없음: momos.co.kr`. 외부 요청 0회
- **검증** `PageFetcherTest`

#### AC-RELAY-27 · 중계 설정이 비어 있으면 모모스 실행은 FAILED

- **Given** AC-RELAY-26 ①의 `PageFetcher`
- **When** `CrawlRunService.start("momos", adminId)` (동기 executor)
- **Then** 실행 `status=FAILED`, `errorMessage="목록 요청 실패: 중계 설정 없음: momos.co.kr"`
- **검증** `CrawlRunServiceTest`

### 비기능

#### AC-RELAY-30 · 본문을 스트림 그대로 넘긴다

- **Given** 원본 응답 본문이 `ReadableStream`
- **When** AC-RELAY-01의 요청
- **Then** Worker 응답의 `body`가 원본 응답의 `body`와 같은 객체다 (`text()`로 읽어 다시 만들지 않는다 — CPU 10ms 제약)
- **검증** `infra/fetch-relay/index.test.js`

#### AC-RELAY-31 · 커버리지 검사가 Worker 테스트를 본다

- **Given** `scripts/check-spec-coverage.sh`
- **When** 실행
- **Then** 검사 경로에 `infra/fetch-relay`가 있고, 이 스펙의 AC 중 `index.test.js`에만 있는 것도 커버됨으로 집계된다
- **검증** CI `spec` job

#### AC-RELAY-32 · CI가 Worker 테스트를 돌린다

- **Given** `.github/workflows/spec.yml`
- **When** PR
- **Then** `node --test infra/fetch-relay/` 단계가 있고, 테스트가 하나라도 실패하면 job이 실패한다
- **검증** CI `spec` job

---

## 구현 순서

각 태스크는 TDD 사이클 하나(실패 테스트 → 실패 확인 → 최소 구현 → 통과 확인 → 커밋).

- [ ] **Task 1: Worker** — Covers: AC-RELAY-01, 02, 03, 10, 11, 12, 20, 21, 22, 23, 24, 25, 30

  의존성 없이 Node 24 내장 `node:test`·`fetch`·`Response`로 테스트한다. 테스트는
  `globalThis.fetch`를 가짜로 바꿔 원본 호출 횟수·URL·헤더를 기록한다.

  ```js
  // infra/fetch-relay/index.js
  const err = (status, code) => Response.json({ code }, { status });

  export default {
    async fetch(request, env) {
      if (request.method !== "GET") return err(405, "RELAY_METHOD_NOT_ALLOWED");
      if (request.headers.get("X-Relay-Token") !== env.RELAY_TOKEN || !env.RELAY_TOKEN)
        return err(401, "RELAY_UNAUTHORIZED");
      let target;
      try { target = new URL(new URL(request.url).searchParams.get("url")); } catch { return err(400, "RELAY_BAD_URL"); }
      if (target.protocol !== "https:") return err(400, "RELAY_BAD_URL");
      const allowed = env.ALLOWED_HOSTS.split(",").map((h) => h.trim().toLowerCase());
      if (!allowed.includes(target.hostname)) return err(403, "RELAY_HOST_NOT_ALLOWED");
      let upstream;
      try {
        upstream = await fetch(target, { headers: { "User-Agent": request.headers.get("User-Agent") ?? "" } });
      } catch { return err(502, "RELAY_UPSTREAM_FAILED"); }
      const headers = new Headers();
      const type = upstream.headers.get("Content-Type");
      if (type) headers.set("Content-Type", type);
      return new Response(upstream.body, { status: upstream.status, headers });
    },
  };
  ```

  `url` 파라미터가 없으면 `new URL(null)`이 던지므로 400이 된다. `URL.hostname`은 이미
  소문자로 정규화된다(AC-10).

  ```jsonc
  // infra/fetch-relay/wrangler.jsonc
  { "name": "kaldi-fetch-relay", "main": "index.js", "compatibility_date": "2026-11-01",
    "vars": { "ALLOWED_HOSTS": "momos.co.kr" } }
  ```

  `infra/fetch-relay/package.json`은 `{"type":"module"}` 한 줄만 둔다(테스트가 ESM을 import).

- [ ] **Task 2: PageFetcher 중계 분기** — Covers: AC-RELAY-04, 05, 13, 26

  `@Value`로 `kaldi.crawler.relay.url`·`token`·`hosts`를 받는다. 테스트용 생성자
  `PageFetcher(RestClient, RelaySettings)` 형태로 MockRestServiceServer와 함께 주입한다
  (레코드 하나, 인터페이스 없음).

  ```java
  public String get(URI uri) {
    URI target = uri;
    boolean viaRelay = relay.hosts().stream().anyMatch(h -> h.equalsIgnoreCase(uri.getHost()));
    if (viaRelay) {
      if (relay.url().isBlank() || relay.token().isBlank())
        throw new IllegalStateException("중계 설정 없음: " + uri.getHost().toLowerCase());
      target = UriComponentsBuilder.fromUriString(relay.url())
          .queryParam("url", URLEncoder.encode(uri.toASCIIString(), UTF_8)).build(true).toUri();
    }
    // 기존 요청 + viaRelay일 때만 .header("X-Relay-Token", relay.token())
  }
  ```

  `application.yml`의 `kaldi:` 아래에 「설정」 표의 세 키를 추가한다. 테스트 프로필은 기본값
  (빈 url·token, hosts=momos.co.kr) 그대로 — 기존 `MomosSourceTest`·`CrawlRunServiceTest`가
  실제 네트워크를 쓰지 않는지 확인한다.

- [ ] **Task 3: 실행 실패 흐름** — Covers: AC-RELAY-27

  `CrawlRunServiceTest`에 중계 설정이 빈 `PageFetcher`로 모모스를 실행하는 케이스 1개.
  `CrawlRunService` 코드는 바꾸지 않는다 — 기존 목록 실패 처리가 메시지를 만든다.

- [ ] **Task 4: CI·커버리지** — Covers: AC-RELAY-31, 32

  - `scripts/check-spec-coverage.sh`의 검사 경로 목록(`for path in ...`)과 상단 주석에
    `infra/fetch-relay` 추가
  - `.github/workflows/spec.yml`에 단계 추가: `node --test infra/fetch-relay/`
    (ubuntu-latest의 Node 사용, `actions/setup-node`로 Node 24 고정)

- [ ] **Task 5: 배포 절차 문서** — Covers: (문서)

  `infra/README.md`에 「크롤러 중계 Worker」 절: ① `cd infra/fetch-relay && npx wrangler deploy`
  ② `npx wrangler secret put RELAY_TOKEN` (값은 `openssl rand -hex 32`) ③ VM `.env`에 두 변수
  추가 후 `docker compose -f docker-compose.prod.yml up -d` ④ 아래 수동 확인.
  실제 배포·비밀값 주입은 머지 후 사람이 한다(구현 세션 범위 밖).

---

## 수동 확인

- [ ] ★ Worker 배포 + VM `.env` 반영 후, 관리자 콘솔에서 모모스 수집 실행 → `status=SUCCEEDED`, `created + updated ≥ 1`
- [ ] VM에서 `curl -s -o /dev/null -w "%{http_code}" "https://kaldi-fetch-relay.<계정>.workers.dev/?url=https%3A%2F%2Fmomos.co.kr%2F"` (토큰 없이) → `401`

## 열어둔 결정

- 아임웹이 Cloudflare 출구 IP까지 막으면: 같은 `relay.url` 계약을 지키는 중계를 집 노트북
  (Tailscale)에 두는 안으로 넘어간다. 그때 다시 정한다.
