import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 스펙(AC-PWA-07)이 `text/javascript`를 요구한다. 정적 자산의 기본값은
        // `application/javascript`라 여기서 덮어쓴다 — 둘 다 유효한 JS MIME이지만
        // 인수 조건이 리터럴을 못박고 있다.
        source: "/sw.js",
        headers: [{ key: "Content-Type", value: "text/javascript" }],
      },
    ];
  },
};

export default nextConfig;
