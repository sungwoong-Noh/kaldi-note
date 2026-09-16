/**
 * PWA 매니페스트.
 *
 * <p><b>`public/manifest.json`이 아니라 Route Handler인 이유:</b> 정적 파일로 두면 Next도 Workers도
 * `application/json`으로 서빙하는데, 스펙(AC-PWA-01)이 `application/manifest+json`을 요구한다.
 * Next의 `app/manifest.ts`는 MIME을 보장하지만 경로가 `/manifest.webmanifest`로 고정돼
 * AC-PWA-01·06의 `/manifest.json`과 어긋난다. 그래서 경로와 MIME을 둘 다 여기서 정한다.
 */
const manifest = {
  name: "kaldi note",
  short_name: "kaldi note",
  description: "커피 레시피를 재현 가능한 형태로 기록하고 공유합니다.",
  lang: "ko",
  start_url: "/",
  display: "standalone",
  // 스플래시 바탕. 앱 배경과 같아야 렌더 직후 색이 튀지 않는다.
  //
  // ★ globals.css의 --paper 라이트 값을 sRGB로 옮긴 것이다. 매니페스트는 JSON이라
  //   CSS 변수를 쓸 수 없어 여기 박혀 있다 — **토큰을 고치면 이 두 줄도 함께 고친다.**
  //   (.select-chevron의 stroke 색이 같은 이유로 globals.css에 박혀 있다.)
  background_color: "#fdfcf9",
  // 상단바·상태바 색. globals.css의 --accent 라이트 값과 같다.
  // 매니페스트는 값을 하나만 가지므로 다크에서도 이 브라운이 쓰인다.
  theme_color: "#684231",
  icons: [
    {
      src: "/icons/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-512-maskable.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

export function GET() {
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
