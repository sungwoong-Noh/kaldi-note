package com.kaldinote.media.infrastructure;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kaldi.oci")
public record OciProperties(
    String tenancyId,
    String userId,
    String fingerprint,
    String privateKey,
    String region,
    String namespace,
    String bucketName) {}
