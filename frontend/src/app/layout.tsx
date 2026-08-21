import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "kaldi note",
  description: "커피 레시피를 재현 가능한 형태로 기록하고 공유합니다.",
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
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
