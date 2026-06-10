# Framework Rules

## 1. Always Set `filters.component_type`

Set `filters.component_type` whenever the user specifies a framework.

- User says "React" → `filters.component_type: "React"`
- User says "Web Components" → `filters.component_type: "Web Components"`
- User does not specify → **default to React**

---

## 2. Validate Results After Every Query

After every `code_search` response:

1. Discard any hit where `component_type` ≠ requested framework
2. If ≥ 1 valid hit remains → use only those hits
3. If 0 valid hits remain:
   - Retry **once** with an adjusted query (try aliases, hyphen/space normalization)
   - Do **not** silently fall back to the other framework

---

## 3. Never Mix React and Web Components

- React → output JSX only
- Web Components → output HTML/Lit-based examples only
- Use imports as an additional guardrail:
  - Web Components often use `import { html } from 'lit'`
  - React always uses `import React from 'react'` or direct component imports

---

## 4. Icons & Pictograms Routing Rule

When the intent is an icon or pictogram search:

- Use `code_search`
- Do **not** set `filters.component_type`
- Do **not** set `filters.ibm_products`
- Set `filters.asset_type`:
  - `"icon"` for icon requests
  - `"pictogram"` for pictogram requests
- If ambiguous: try `"icon"` first, then `"pictogram"`, then retry without `asset_type`
- Normalize slugs: spaces → hyphens (e.g., `ai governance` → `ai-governance`)
- Probe Carbon-style double-hyphen slugs if applicable (e.g., `ai--governance`)

**Example queries:**
```json
{"query": "ai-governance", "size": 3, "filters": {"asset_type": "icon"}}
{"query": "ai governance pictogram", "size": 3}
```

---

## 5. IBM Plex Font Enforcement

For Carbon v11, load base styles from `@carbon/styles/css/styles.css` in the app entry module (for example `src/main.jsx`).
Do not use legacy Carbon style paths like `@carbon/react/scss/*`.
Install `@carbon/styles` as a separate dependency alongside `@carbon/react`.
IBM Plex is loaded via Carbon styles/tokens (`@carbon/styles`). Apply these rules:

### Use semantic HTML with Carbon typography
Apply typography via semantic HTML tags (`h1`, `h2`, `h3`, `p`) with Carbon typography
tokens or classes.

### Use Carbon spacing tokens via SCSS
Use Carbon spacing tokens through utility classes defined in `src/styles.scss`:

```scss
.section-spacing { margin-block: $spacing-07; }
.aligned-grid { gap: $spacing-05; }
```

Or import spacing tokens and use their computed values in JS:
```js
const spacing05 = '1rem'; // used in layout constants, not inline styles
```

### Never use inline token strings

```jsx
// ❌ Wrong — token strings do NOT resolve at runtime
<Component style={{ margin: '$spacing-05' }} />
```

```html
<!-- ❌ Wrong -->
<div style="margin: $spacing-05"></div>
```

```jsx
// ✅ Correct — use className referencing an SCSS utility class
<Component className="section-spacing" />
```

### Typography checklist
- All headings, body text, and labels must render in **IBM Plex Sans**
- Create SCSS utility classes using Carbon spacing tokens and apply via `className` (React) or `class` (Web Components) whenever additional spacing or alignment is needed

---

## 6. Web Components Styling Safety Rules

When the target framework is **Web Components**, prefer a minimal import strategy first.

### Stepwise SCSS setup protocol

1. **Minimal baseline (always first)**

```scss
@use '@carbon/styles/scss/reset';
@use '@carbon/styles/scss/type';
```

2. **Add grid only when layout utilities are needed**

```scss
@use '@carbon/styles/scss/reset';
@use '@carbon/styles/scss/type';
@use '@carbon/styles/scss/grid';
```

3. **Add theme wiring only when explicitly required**

```scss
@use '@carbon/styles/scss/reset';
@use '@carbon/styles/scss/theme';
@use '@carbon/styles/scss/themes';
@use '@carbon/styles/scss/type';
@use '@carbon/styles/scss/grid';
```

### Project wiring checks

- Import SCSS from the app entry module before component imports (for example `import './styles.scss';`).
- Do not use HTML `<link>` tags for SCSS files.
- Preserve an existing app theme class when present; otherwise default to `<body class="cds--white">`.

### Avoid fragile theme wiring by default

- Do not introduce `@use '@carbon/styles/scss/theme' with (...)` or `@use '@carbon/styles/scss/themes'` unless explicitly required by the user/task.
- Start from the minimal baseline and expand only when needed.

### CSS fallback path

- If SCSS import resolution fails, fall back to app-entry CSS import:
  - `@carbon/styles/css/styles.css`
- For Carbon Web Components, keep component imports package-native and avoid inventing non-existent CSS files.
