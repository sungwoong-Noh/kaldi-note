package com.kaldinote.crawler.infrastructure;

import java.util.Locale;

final class BlendNames {

  private BlendNames() {}

  static boolean isBlend(String productName) {
    return productName.contains("블렌드") || productName.toLowerCase(Locale.ROOT).contains("blend");
  }
}
