---
id: 0005
title: users.role과 JWT role claim을 MVP에 포함한다
status: 유효
date: 2026-08-14
supersededBy:
---

# 0005. users.role과 JWT role claim을 MVP에 포함한다

## 맥락

관리자 API·화면은 MVP 범위 밖이다. 그렇다면 `role` 컬럼도 나중에 추가하면 되지 않느냐는
질문이 자연스럽게 나온다.

## 결정

**`users.role` 컬럼과 JWT의 `role` claim은 지금 넣는다.** 화면·API는 후속이어도 된다.

## 결과

- 나중에 컬럼을 추가하면 이미 발급된 토큰이 전부 `role` claim 없이 떠 있는 상태가 되고,
  전체 인가 정책을 다시 훑어야 한다 — 그 비용이 지금 컬럼 하나 추가하는 비용보다 크다.
- 관리자 API(`POST /admin/recipes` 등, 2부 P1)는 이 컬럼 위에 권한 체크만 얹으면 된다.
