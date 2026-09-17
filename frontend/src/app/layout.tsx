import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/layout/BottomNav";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { initThemeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "kaldi note",
  description: "커피 레시피를 재현 가능한 형태로 기록하고 공유합니다.",
  // Next가 이 값으로 <link rel="manifest">를 만든다. 직접 <head>에 넣지 않는다.
  manifest: "/manifest.json",
};

// 부엌에서 폰으로 쓰는 것이 주 사용 환경이다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // suppressHydrationWarning: 브라우저 확장이 <html>에 속성을 넣는다(예: data-hwp-extension).
  // React가 만든 트리에 없는 것이라 하이드레이션 불일치로 잡히는데, 우리가 고칠 수 있는 것이
  // 아니다. 이 플래그는 이 엘리먼트의 속성 차이만 덮으며 자식 트리에는 영향이 없다.
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/*
          하이드레이션 전에 실행돼야 한다 — 그러지 않으면 다크를 저장해둔 사용자가 열 때마다
          라이트가 한 프레임 번쩍인다(docs/specs/2026-09-17-dark-mode-toggle.md).
        */}
        <script dangerouslySetInnerHTML={{ __html: initThemeScript() }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* 탭바는 여기 한 번만 둔다. 페이지마다 넣으면 새 화면을 만들 때마다 빠뜨린다. */}
        <Providers>
          {children}
          <BottomNav />
          <ServiceWorkerRegistrar />
        </Providers>
      </body>
    </html>
  );
}
