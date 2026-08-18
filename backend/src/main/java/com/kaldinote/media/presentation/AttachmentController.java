package com.kaldinote.media.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.media.application.AttachmentService;
import com.kaldinote.media.presentation.dto.UploadUrlRequest;
import com.kaldinote.media.presentation.dto.UploadUrlResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/attachments")
@RequiredArgsConstructor
@Tag(name = "사진 첨부", description = "레시피·브루잉 로그 사진 업로드·조회·삭제")
public class AttachmentController {

  private final AttachmentService attachmentService;

  @PostMapping("/upload-url")
  public UploadUrlResponse issueUploadUrl(
      @Valid @RequestBody UploadUrlRequest request, AuthenticatedUser user) {
    return attachmentService.issueUploadUrl(user.id(), request);
  }
}
