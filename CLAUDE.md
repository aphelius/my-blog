# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is a personal blog built on the **AstroPaper** theme (Astro 6, Tailwind v4, TypeScript). It is statically rendered and SEO-focused.

## Commands

- `npm run dev` — start the dev server. In this environment prefer background mode: `astro dev --background`, then manage with `astro dev stop` / `astro dev status` / `astro dev logs`.
- `npm run build` — runs `astro check` (type-check) → `astro build` → builds the Pagefind search index → copies it into `public/`. **Note:** the copy step uses `cp -r` (Unix); on Windows run the build under Git Bash / WSL, or adjust that step.
- `npm run preview` — preview the production build.
- `npm run lint` — ESLint. `npm run format` / `npm run format:check` — Prettier.
- `npm run sync` — regenerate Astro content types after changing `content.config.ts` or frontmatter shape.

There is no test suite. "Checking correctness" means `astro check` + `lint` + a dev/preview run.

## Configuration is indirected — edit the right file

All site settings live in **`astro-paper.config.ts`** (title, author, URL, lang, timezone, socials, feature flags). Do **not** edit `src/config.ts` — it only applies defaults and re-exports a fully-resolved object. Everything else in the codebase imports the resolved config via `@/config`.

`astro.config.ts` is separate and holds the Astro build pipeline: integrations (mdx, sitemap), markdown processor (remark/rehype plugins, Shiki code highlighting with custom transformers), fonts, and the `i18n` block.

Path aliases (`tsconfig.json`): `@/*` → `src/*`, plus `@/astro-paper.config` → the root config file.

## Architecture

**Content** — Two content collections defined in `content.config.ts`:
- `posts` ← `src/content/posts/**` and `pages` ← `src/content/pages/**`.
- The glob pattern is `**/[^_]*.{md,mdx}`, so **files or folders prefixed with `_` are excluded** (used for drafts/partials/example bundles).
- Post frontmatter schema (pubDatetime, modDatetime, title, featured, draft, tags, ogImage, description, etc.) is enforced by Zod in `content.config.ts`. `author` and `tags` have defaults. Drafts (`draft: true`) and future-dated posts are filtered by `src/utils/postFilter.ts` (scheduled posts use `posts.scheduledPostMargin`).

**i18n** — `src/i18n/lang/*.ts` files are auto-globbed by `src/i18n/index.ts`; the filename is the locale key. `useTranslations(locale)` returns that locale's UI strings and **falls back to English** if the locale file is missing. Important gotcha: the active locale comes from `Astro.currentLocale`, which is driven by the `i18n.locales` array in `astro.config.ts`. Adding a `lang/<x>.ts` file alone does **not** switch the UI — the locale must also be wired into `astro.config.ts` i18n (and `astro-paper.config.ts` `site.lang`).

**Search** — Pagefind. Index is generated at build time from `dist/` and copied to `public/pagefind`; the `search.astro` page mounts `@pagefind/default-ui`. Search therefore only works against a built site, not in pure dev.

**Dynamic OG images** — Generated with `satori` at build time via `src/pages/og.png.ts` (site default) and `src/pages/posts/[...slug]/index.png.ts` (per-post). Controlled by the `features.dynamicOgImage` flag.

**Theming / dark mode** — An inline `is:inline` script in `src/layouts/Layout.astro` sets `data-theme` before first paint (FOUC prevention); `src/scripts/theme.ts` handles runtime toggling. Colors are CSS variables in `src/styles/theme.css`; global styles and Tailwind utilities in `src/styles/global.css`.

**Client navigation** — `<ClientRouter />` (Astro View Transitions) is enabled in the layout, so the app does soft client-side navigation. Any client script that touches the DOM must (re)initialize on the `astro:page-load` event, not just `DOMContentLoaded` — see `src/scripts/animations.ts` and the theme script for the pattern.

**Routing** — Pages live in `src/pages`. Dynamic routes: `posts/[...slug]`, `posts/[...page]` (pagination), `tags/[tag]/[...page]`. Route-private helpers/components are colocated in `_utils/` and `_components/` folders (the `_` prefix keeps them out of routing).

## Local customizations beyond stock AstroPaper

- `src/i18n/lang/zh.ts` — Chinese UI strings.
- `src/styles/animations.css` + `src/scripts/animations.ts` — scroll-reveal, homepage hero typing/gradient, hover micro-interactions. All effects are gated behind `prefers-reduced-motion`.
