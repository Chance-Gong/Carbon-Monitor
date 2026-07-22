# Implementation Guardrails

## 1. Stability Policy (Hard Rule)

Never suggest or use unstable, preview, canary, or `@carbon/labs-react` components unless:

- the user explicitly asks for them, or
- they are already present in the repository.

If a stable Carbon equivalent exists, use the stable option by default.

---

## 2. AI Chat SSR Build-Safety (Hard Rule)

Apply this section when generating code that uses `@carbon/ai-chat` or `@carbon/web-components`.

### Detect SSR first

Before choosing imports/integration patterns, check for SSR indicators:

- SSR entry files (`entry-server.*`, `server.js`, `server.ts`)
- SSR config in `vite.config.*` / `webpack.config.*` (`ssr`, `ssr.external`, `ssr.noExternal`)
- SSR scripts in `package.json` (`build:ssr`, `dev:ssr`, `preview:ssr`)

### If SSR is present

- Do not use top-level browser-only imports in SSR-rendered code paths.
- Use client-only loading (`React.lazy` + `Suspense`, or dynamic import in `useEffect`).
- Add `@carbon/ai-chat` and `@carbon/web-components` to `ssr.external` when needed.
- Treat client-only loading and SSR config as a required pair.

### If SSR is not present

- Standard client-side imports are acceptable.

### CSS import rule

- Do not import CSS from `@carbon/ai-chat/es/index.css` (or similar paths).
- AI Chat styles are encapsulated; invalid CSS imports cause build failures.

---

## 3. Package and Dependency Rules

- Prefer official Carbon packages over recreating equivalent components.
- If the required Carbon package is missing, add the dependency instead of hand-building a clone.
- Carbon v11 base styles must be imported from `@carbon/styles/css/styles.css` in the app entry module.
- Never use legacy Carbon style imports like `@carbon/react/scss/*` for Carbon v11 apps.
- When using `@carbon/react`, install `@carbon/styles` as a separate dependency.
- When using `@carbon/ibm-products`, include:

```scss
@use '@carbon/ibm-products/css/index-full.css';
```

- For charts, continue following `get_charts` assembly hints verbatim.
- For Web Components projects:
  - Use `@carbon/web-components` for components and `@carbon/styles` for global Carbon styles/fonts.
  - Add `sass` only when SCSS is explicitly used.
  - Never reference undocumented/non-existent style paths (for example ad-hoc component CSS files).

---

## 4. Component/API Correctness

- Avoid deprecated props when a supported prop exists.
- Validate props against current examples/docs returned by MCP tools.
- Keep imports aligned with returned package/source guidance.

---

## 5. Styling and Theming Discipline

- Use Carbon theme tokens, spacing tokens, and typography mixins over hardcoded values.
- Avoid targeting Carbon internal class names (for example `.bx--`, `.cds--`) unless no alternative exists and the user explicitly confirms.
- Avoid direct style overrides of Carbon internals unless necessary and explicitly confirmed.
- Do not force explicit `<Theme>` wrappers when the host app already provides Carbon theme context.
- For Web Components styling setup:
  - Prefer a minimal SCSS baseline first: `@use '@carbon/styles/scss/reset';` and `@use '@carbon/styles/scss/type';`
  - Only add advanced theme SCSS wiring when explicitly required.
  - If SCSS wiring fails, fall back to `@carbon/styles/css/styles.css` in the entry module.
- CDN guidance: if the user requests CDN/quick-start, use IBM-hosted Carbon/Plex CDN resources (not third-party font CDNs).

---

## 6. Web Components Project Setup Checklist

Before finalizing a Web Components implementation:

- Ensure an app entry module imports styles before component imports (for example `import './styles.scss';` first).
- Ensure `<body>` preserves an existing Carbon theme class; if none exists, use `cds--white`.
- Ensure SCSS files are not referenced through HTML `<link>` tags.
- Ensure dependencies include `@carbon/web-components` and `@carbon/styles`; add `sass` only when SCSS is used.

---

## 7. Layout and Accessibility Guardrails

- Use separate Grid containers for distinct logical content groups.
- Specify responsive spans (`sm`/`md`/`lg`) for layout columns.
- Keep overlay/floating UI (modals, side panels, tooltips, toasts) out of normal page Grid flow.
- For Layer usage, rely on nesting/context; do not manually set `level`.
- Use `withBackground` when a visible layer background is intended.
- Breadcrumb current item must use `isCurrentPage` and must not include `href`.
- Icon-only interactive controls must include descriptive `iconDescription`.

---

## 8. Image-Driven UI Workflow Guardrails

Apply this section when the user provides images or visual references for UI implementation.

- Perform a complete design analysis before implementation.
- Start with design scale analysis (dimensions/proportions) before mapping components.
- Include these sections in analysis output:
  - Component Inventory
  - Typography Analysis
  - Grid Analysis
  - Spacing Analysis
- In Grid Analysis, include responsive spans for all breakpoints (`sm`/`md`/`lg`).
- Use Carbon grid variants correctly:
  - default: 32px gutter
  - narrow: 16px gutter
  - condensed: 0px gutter
- Use column-span estimation when dimensions are known:
  - `Math.ceil((width in pixels) / ((grid width) / (number of columns)))`
- Use separate Grid containers for logical content groups that should wrap together.
- Pause after presenting analysis and get user confirmation before implementation.
- Prefer custom class names for styling; avoid Carbon internal class targeting unless explicitly confirmed.
- Validate implemented UI behavior in the browser (visual, responsive, and accessibility checks).
