package com.kaldinote.catalog.presentation.dto;

import java.time.Instant;
import java.util.List;

/** 관리자 원두 목록 행. `missing`은 roastLevel → origin → variety → process 순서, 해당하는 것만. */
public record AdminBeanProductRowResponse(
    Long id,
    String name,
    Long roasterId,
    String roasterName,
    String beanMix,
    String roastLevel,
    Short roastLevelAgtron,
    String roastLevelCustom,
    List<String> countries,
    int originCount,
    boolean verified,
    boolean hidden,
    boolean manuallyEdited,
    boolean promoted,
    String source,
    String creatorNickname,
    List<String> missing,
    long brewCount,
    Instant updatedAt) {}
