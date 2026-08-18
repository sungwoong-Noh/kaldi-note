package com.kaldinote.media.infrastructure;

import com.oracle.bmc.auth.SimpleAuthenticationDetailsProvider;
import com.oracle.bmc.model.BmcException;
import com.oracle.bmc.objectstorage.model.CreatePreauthenticatedRequestDetails;
import com.oracle.bmc.objectstorage.model.PreauthenticatedRequest;
import com.oracle.bmc.objectstorage.requests.CreatePreauthenticatedRequestRequest;
import com.oracle.bmc.objectstorage.requests.DeleteObjectRequest;
import com.oracle.bmc.objectstorage.requests.HeadObjectRequest;
import com.oracle.bmc.objectstorage.responses.CreatePreauthenticatedRequestResponse;
import com.oracle.bmc.objectstorage.responses.HeadObjectResponse;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * OCI Object Storage 실제 연동. PAR 발급·HEAD·삭제 3개만 쓴다. 로컬·테스트는 이 빈이 아니라 {@link
 * FakeObjectStorageClient}를 쓴다 — 실제 자격증명으로 하는 검증은 배포 이후로 미룬다(스펙의 수동 확인 항목).
 */
@Component
@Profile("!test")
public class OciObjectStorageClient implements ObjectStorageClient {

  private final com.oracle.bmc.objectstorage.ObjectStorageClient client;
  private final OciProperties properties;

  public OciObjectStorageClient(OciProperties properties) {
    this.properties = properties;
    Supplier<InputStream> privateKeySupplier =
        () -> new ByteArrayInputStream(properties.privateKey().getBytes(StandardCharsets.UTF_8));
    SimpleAuthenticationDetailsProvider provider =
        SimpleAuthenticationDetailsProvider.builder()
            .tenantId(properties.tenancyId())
            .userId(properties.userId())
            .fingerprint(properties.fingerprint())
            .privateKeySupplier(privateKeySupplier)
            .build();
    this.client =
        com.oracle.bmc.objectstorage.ObjectStorageClient.builder()
            .region(properties.region())
            .build(provider);
  }

  @Override
  public String issueUploadUrl(String objectKey, String contentType, Instant expiresAt) {
    CreatePreauthenticatedRequestDetails details =
        CreatePreauthenticatedRequestDetails.builder()
            .name("upload-" + objectKey)
            .objectName(objectKey)
            .accessType(CreatePreauthenticatedRequestDetails.AccessType.ObjectWrite)
            .timeExpires(Date.from(expiresAt))
            .build();

    CreatePreauthenticatedRequestResponse response =
        client.createPreauthenticatedRequest(
            CreatePreauthenticatedRequestRequest.builder()
                .namespaceName(properties.namespace())
                .bucketName(properties.bucketName())
                .createPreauthenticatedRequestDetails(details)
                .build());

    PreauthenticatedRequest par = response.getPreauthenticatedRequest();
    return "https://objectstorage." + properties.region() + ".oraclecloud.com" + par.getAccessUri();
  }

  @Override
  public Optional<ObjectHead> head(String objectKey) {
    try {
      HeadObjectResponse response =
          client.headObject(
              HeadObjectRequest.builder()
                  .namespaceName(properties.namespace())
                  .bucketName(properties.bucketName())
                  .objectName(objectKey)
                  .build());
      return Optional.of(new ObjectHead(response.getContentLength(), response.getContentType()));
    } catch (BmcException e) {
      if (e.getStatusCode() == 404) {
        return Optional.empty();
      }
      throw e;
    }
  }

  @Override
  public void delete(String objectKey) {
    client.deleteObject(
        DeleteObjectRequest.builder()
            .namespaceName(properties.namespace())
            .bucketName(properties.bucketName())
            .objectName(objectKey)
            .build());
  }

  @Override
  public String publicUrl(String objectKey) {
    return "https://objectstorage."
        + properties.region()
        + ".oraclecloud.com/n/"
        + properties.namespace()
        + "/b/"
        + properties.bucketName()
        + "/o/"
        + objectKey;
  }
}
