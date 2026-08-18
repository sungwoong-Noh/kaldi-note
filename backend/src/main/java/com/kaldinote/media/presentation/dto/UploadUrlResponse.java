package com.kaldinote.media.presentation.dto;

import java.time.Instant;

public record UploadUrlResponse(String objectKey, String uploadUrl, Instant expiresAt) {}
