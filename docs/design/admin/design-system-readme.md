# kaldi·note Design System — "Clean Ledger"

kaldi·note is a Korean-language **coffee brew log** (web + mobile, light + dark). People record each pour-over — bean, roaster, dose/water, grind, temperature, time, yield, taste — save recipes, and compare brews over time. The system treats records as data: almost no color, every measured value in a monospace face, and a single espresso accent. The goal is a quiet screen you can open every morning without fatigue.

Products represented: **one mobile app** (bottom-tab navigation: 홈 · 레시피 · 기록 · 더보기). Web is mentioned in the source ("WEB + MOBILE") but no web screens were provided.

## Sources
- Attached codebase `system/` (read-only mount):
  - `system/Design System.dc.html` — v1.0 spec: brand, color tokens, type scale, spacing/radius, core components, voice.
  - `system/Navigation.dc.html` — tab-bar spec + two mobile screens (N1 Home, N2 Recipe list).
  - `system/Assets.dc.html` — logo/icon file guide, roast dots, hex table.
  - `system/assets/*.svg` — logos, app icons, favicon, roast-dots (also uploaded to `uploads/`).

## Index
- `styles.css` — entry point (imports only) → `tokens/fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `base.css`
- `assets/` — logo lockups (ink/paper), symbol (ink/paper/currentColor), app icons, favicon, roast-dots reference sheet
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `components/` — React primitives (see below)
- `ui_kits/app/` — mobile app click-through (`index.html`, `Screens.jsx`, `README.md`)
- `templates/admin/` — **Admin console** template (`Admin.dc.html` + `StatusTag.dc.html`): 원두 수집 · 장비 · 그라인더 영점 · 회원 · 403, 1440×900 web, light/dark, with every requested state as a preview chip
- `thumbnail.html` — project tile
- `SKILL.md` — Agent Skill wrapper

## Components
- `components/core/` — **Button**, **TextField**, **MetricField**, **Tag**, **Segmented**, **Avatar**, **Switch**
- `components/record/` — **Metric**, **FlavorBar**, **RoastDot**, **RecordRow**, **RecipeCard**, **BrewHeroCard**
- `components/navigation/` — **Wordmark**, **TabBar**, **ScreenHeader**, **SectionHeader**

Inventory follows the source's "핵심 컴포넌트" (buttons, inputs, metric row, flavor bars, tags, segmented, avatar) plus the elements used in the N1/N2 screens (tab bar, switch, recipe card, record row, hero card, headers).

### Intentional additions
- **Wordmark** — the source builds the lockup from live type + CSS circles everywhere in-app (and recommends it over the SVG); wrapped for reuse.
- **ScreenHeader / SectionHeader** — repeated title patterns from N1/N2, factored out.
- **RoastDot** — the source says to implement roast dots as plain divs, not SVG.

---

## CONTENT FUNDAMENTALS
- **Language:** Korean UI copy. English appears only as small mono caps labels/eyebrows (`DOSE / WATER`, `RECIPES`, `TODAY · 08:20`, `CURATED`).
- **Tone:** 담백한 존댓말 — plain, polite (합니다/습니다체). Calm, factual, never cheerleading.
- **No evaluation:** the app never judges whether the coffee was good. It returns facts and numbers. Suggestions are observations, not commands: “지난 세 번 모두 92°C였습니다.”
- **No exclamation marks, no emoji, no interjections, no tildes.**
  - ✓ “오늘 기록을 저장했습니다.” ✗ “기록 저장 완료! 잘하셨어요 ☕”
  - ✓ “아직 기록이 없습니다. 첫 잔부터 남겨보세요.” ✗ “텅 비었네요! 어서 커피를 내려주세요~”
- **Person:** the app doesn't say "I"; it addresses the user implicitly. User-authored notes are first person and casual (“다음엔 2도 낮춰볼게요.”), shown in quotes/italics.
- **Buttons:** short verb phrases — 기록 저장, 취소, 다시 내리기, 이 레시피로 내렸다, 새 레시피, 전체 보기, 더 보기.
- **Numbers:** always with units and fixed formatting — `92 °C`, `1:15.6` / `1 : 15.6`, `02:45`, `16g / 250g`, `15g → 250g · 92°C · 3:30`, `C40 · 22클릭`, ratings `★ 4`, dates `09.15`. Separator is the middle dot `·`.
- **Brand name:** always lowercase `kaldi·note`; the middle dot is always accent-colored. Never `KALDI`.

## VISUAL FOUNDATIONS
- **Color:** warm-tinted neutrals only (oklch hue 60–85, chroma ≤ 0.015) plus one chromatic family, espresso (`--kn-accent` 0.42 0.06 45). Danger/success are system signals only. Dark mode is the same structure with lightness inverted. The roast scale is the only other color and only on roast dots.
- **Type:** IBM Plex Sans KR for prose (600 headings with negative tracking −1.5% to −3%; 400 body at 15/1.7). IBM Plex Mono for **every measured value**, without exception, so digits line up across records. Labels = mono 10–11px, uppercase, +10–16% tracking, ink-3.
- **Spacing:** 4pt scale (4/8/12/16/24/32/48). Mobile gutter 24px. Generous vertical rhythm; lists are dense ledgers.
- **Backgrounds:** flat solid colors only. No imagery, gradients, textures, or patterns. Page canvas is `--kn-canvas`; cards are `--kn-paper`.
- **Layering:** **no shadows.** Depth = 1px border + surface lightness difference. The only glow is the input focus ring (3px accent at 12% alpha).
- **Borders:** 1px hairlines everywhere (`--kn-border`, dividers a step lighter). Dashed 1px for "add" affordances. Lists use top hairlines between rows rather than cards.
- **Radii:** 3px tags · 4px spec panels · 6/7/8px buttons (sm/md/lg) · 8px segmented track · 10–12px cards · 14px hero card · full for avatars/switch/roast dots. Tags are never pills.
- **Cards:** paper fill, 1px border, 12px radius, 17×18 padding, no shadow. The hero card (latest brew) is the single inverted ink plate on Home.
- **Hover:** primary darkens (ink → ink-hover 0.15); secondary goes surface → sunken; ghost gets an accent-wash background; links go accent → accent-hover. **Press:** no shrink/bounce specified.
- **Animation:** none defined in source; keep to short (≈120ms) ease color transitions. No bounces.
- **Transparency/blur:** not used (only the focus ring alpha).
- **Imagery:** none. Logo must never sit directly on a photo — always on a solid plate.
- **Layout:** fixed bottom tab bar (58px + safe area, 1px top border, paper bg) on top-level list screens only; screen CTA sits full-width directly above it. Detail, compose, timer, login and offline screens have no tab bar (back/close only).
- **Emphasis:** big mono numbers (36px, −4% tracking) are the hero of cards; color is not used for emphasis.

## ICONOGRAPHY
- **The brand uses no icons.** Navigation is text-only (“이 브랜드는 선·수치·여백으로 말합니다”). No icon font, no sprite, no PNG icons.
- **No emoji.** Unicode is used sparingly as glyphs: `·` separator, `★` rating, `→` in recipe lines, `°C`, `▮▮▮` in the status bar mock.
- **Brand marks** (in `assets/`): `logo-symbol*.svg` (ring r=12 stroke 2 + dot r=4 on a 26 viewBox — the water's center seen from above a dripper), `logo-lockup-ink/paper.svg` (wordmark set as `<text>` — outline before distribution), `app-icon.svg`, `app-icon-accent.svg`, `favicon.svg` (heavier 2.6 stroke for small sizes — don't downscale the app icon), `roast-dots.svg` (reference sheet only).
- In-app, prefer the symbol + HTML text (the `Wordmark` component) over the SVG lockup.
- SVGs hard-code hex for tool compatibility; UI code should use oklch tokens.

## Fonts
IBM Plex Sans KR and IBM Plex Mono are loaded from Google Fonts (the source does the same); no font binaries were provided, so `tokens/fonts.css` uses an `@import`, not local `@font-face` files.
