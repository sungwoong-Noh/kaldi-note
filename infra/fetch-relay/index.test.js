import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import worker from "./index.js";

const ENV = {
  RELAY_TOKEN: "t0ken",
  ALLOWED_HOSTS: "momos.co.kr",
};

const TARGET = "https://momos.co.kr/Product_CoffeeBeans";
const ENCODED_TARGET = encodeURIComponent(TARGET);

describe("kaldi-fetch-relay worker", () => {
  let calls;
  let nextUpstream;

  beforeEach(() => {
    calls = [];
    nextUpstream = () =>
      new Response("<html>ok</html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    globalThis.fetch = async (input, init = {}) => {
      calls.push({ url: String(input), headers: new Headers(init.headers) });
      return nextUpstream();
    };
  });

  it("AC-RELAY-01 · 원본 응답을 그대로 돌려준다", async () => {
    const req = new Request(`https://relay.test/?url=${ENCODED_TARGET}`, {
      headers: { "X-Relay-Token": "t0ken" },
    });

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 200);
    assert.equal(await res.text(), "<html>ok</html>");
    assert.equal(res.headers.get("Content-Type"), "text/html; charset=utf-8");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, TARGET);
  });

  it("AC-RELAY-02 · 원본의 오류 상태도 바꾸지 않는다", async () => {
    nextUpstream = () => new Response("nope", { status: 404 });
    const req = new Request(`https://relay.test/?url=${ENCODED_TARGET}`, {
      headers: { "X-Relay-Token": "t0ken" },
    });

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 404);
    assert.equal(await res.text(), "nope");
  });

  it("AC-RELAY-03 · User-Agent를 원본에 그대로 넘긴다", async () => {
    const req = new Request(`https://relay.test/?url=${ENCODED_TARGET}`, {
      headers: {
        "X-Relay-Token": "t0ken",
        "User-Agent": "kaldi-note-crawler/1.0",
      },
    });

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].headers.get("User-Agent"), "kaldi-note-crawler/1.0");
  });

  it("AC-RELAY-10 · Worker 호스트 비교는 대소문자를 무시한다", async () => {
    const req = new Request(
      "https://relay.test/?url=https://MOMOS.CO.KR/Product_CoffeeBeans",
      { headers: { "X-Relay-Token": "t0ken" } },
    );

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
  });

  it("AC-RELAY-11 · Worker는 서브도메인을 허용하지 않는다", async () => {
    const req = new Request("https://relay.test/?url=https://www.momos.co.kr/", {
      headers: { "X-Relay-Token": "t0ken" },
    });

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { code: "RELAY_HOST_NOT_ALLOWED" });
    assert.equal(calls.length, 0);
  });

  it("AC-RELAY-12 · Worker는 https만 허용한다", async () => {
    const req = new Request("https://relay.test/?url=http://momos.co.kr/", {
      headers: { "X-Relay-Token": "t0ken" },
    });

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { code: "RELAY_BAD_URL" });
    assert.equal(calls.length, 0);
  });

  it("AC-RELAY-20 · 토큰이 없으면 거부한다", async () => {
    const req = new Request(`https://relay.test/?url=${ENCODED_TARGET}`);

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { code: "RELAY_UNAUTHORIZED" });
    assert.equal(calls.length, 0);
  });

  it("AC-RELAY-21 · 토큰이 틀리면 거부한다", async () => {
    const req = new Request(`https://relay.test/?url=${ENCODED_TARGET}`, {
      headers: { "X-Relay-Token": "wrong" },
    });

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { code: "RELAY_UNAUTHORIZED" });
    assert.equal(calls.length, 0);
  });

  it("AC-RELAY-22 · url이 없거나 URL이 아니면 거부한다", async () => {
    const noUrl = new Request("https://relay.test/", {
      headers: { "X-Relay-Token": "t0ken" },
    });
    const badUrl = new Request("https://relay.test/?url=not%20a%20url", {
      headers: { "X-Relay-Token": "t0ken" },
    });

    const res1 = await worker.fetch(noUrl, ENV);
    const res2 = await worker.fetch(badUrl, ENV);

    assert.equal(res1.status, 400);
    assert.deepEqual(await res1.json(), { code: "RELAY_BAD_URL" });
    assert.equal(res2.status, 400);
    assert.deepEqual(await res2.json(), { code: "RELAY_BAD_URL" });
    assert.equal(calls.length, 0);
  });

  it("AC-RELAY-23 · 허용하지 않은 호스트는 거부한다", async () => {
    const req = new Request("https://relay.test/?url=https://example.com/", {
      headers: { "X-Relay-Token": "t0ken" },
    });

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { code: "RELAY_HOST_NOT_ALLOWED" });
    assert.equal(calls.length, 0);
  });

  it("AC-RELAY-24 · GET이 아니면 거부한다", async () => {
    const req = new Request(
      "https://relay.test/?url=https%3A%2F%2Fmomos.co.kr%2F",
      {
        method: "POST",
        headers: { "X-Relay-Token": "t0ken" },
      },
    );

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 405);
    assert.deepEqual(await res.json(), { code: "RELAY_METHOD_NOT_ALLOWED" });
    assert.equal(calls.length, 0);
  });

  it("AC-RELAY-25 · 원본 요청이 실패하면 502", async () => {
    nextUpstream = () => {
      throw new TypeError("fetch failed");
    };
    const req = new Request(`https://relay.test/?url=${ENCODED_TARGET}`, {
      headers: { "X-Relay-Token": "t0ken" },
    });

    const res = await worker.fetch(req, ENV);

    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { code: "RELAY_UPSTREAM_FAILED" });
  });

  it("AC-RELAY-30 · 본문을 스트림 그대로 넘긴다", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("<html>stream</html>"));
        controller.close();
      },
    });
    const upstreamResponse = new Response(stream, { status: 200 });
    nextUpstream = () => upstreamResponse;
    const req = new Request(`https://relay.test/?url=${ENCODED_TARGET}`, {
      headers: { "X-Relay-Token": "t0ken" },
    });

    const res = await worker.fetch(req, ENV);

    assert.equal(res.body, upstreamResponse.body);
  });
});
