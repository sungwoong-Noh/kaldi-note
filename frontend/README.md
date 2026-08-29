This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 배포

**이 앱은 Vercel이 아니라 Cloudflare Workers에 배포한다.** 위 문단들은 `create-next-app`이 만든 보일러플레이트다.

`main`에 `frontend/**` 변경이 머지되면 `.github/workflows/frontend.yml`의 `deploy` job이 OpenNext로 빌드해 `wrangler`로 올린다. 수동 배포는 `pnpm build:worker && pnpm deploy:worker`.

배경과 인수 조건은 `../docs/specs/2026-08-21-web-deploy.md`, 작업 지침은 `CLAUDE.md`를 본다.
