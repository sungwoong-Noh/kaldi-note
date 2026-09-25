---
id: 0007
title: PostgreSQL을 쓴다 (Oracle Autonomous DB를 쓰지 않는다)
status: 유효
date: 2026-08-14
supersededBy:
---

# 0007. PostgreSQL을 쓴다 (Oracle Autonomous DB를 쓰지 않는다)

## 맥락

OCI Always Free 프리티어는 Autonomous Database(Oracle)도 무료로 제공한다. 관리형 DB를
직접 운영하는 것보다 편해 보인다.

## 결정

**PostgreSQL을 쓴다.** OCI VM 위에 직접 올린다.

## 결과

- Autonomous DB의 **7일 유휴 자동 정지 · 90일 미사용 삭제** 정책을 피한다 — 취미 프로젝트라
  매일 트래픽이 있다는 보장이 없다.
- 로컬 개발 환경(`docker-compose.yml`의 PostgreSQL)과 운영 DB가 같은 엔진이라 방언 차이로
  인한 거짓 통과가 없다. 같은 이유로 테스트에서 H2 대신 Testcontainers PostgreSQL을 쓴다
  (`backend/CLAUDE.md`).
- JSONB·부분 인덱스 등 PostgreSQL 전용 기능을 그대로 활용한다(`recipe_snapshot` 등).
