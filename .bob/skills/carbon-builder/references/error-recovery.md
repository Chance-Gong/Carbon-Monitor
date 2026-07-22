# Error Recovery & Performance

## Error Recovery Protocol

### Carbon Charts Errors

**Hard rule: never fall back to `code_search` for chart errors.**

| Error | Recovery |
|-------|---------|
| `error: "not_found"` | 1. Try a closely related chart type slug (`"column"` → `"bar"`, `"doughnut"` → `"donut"`). 2. Try a different framework if user permits. 3. Report to user. |
| `error: "chunks_not_found"` | Source code is not indexed. Run `mode: "schema"` to confirm the manifest exists and inspect `available_variants`. Report to user. |
| `buildable: false` | Inspect `incomplete.reason` and `incomplete.missing`. Suggest a different variant from `available_variants`. Do not call `code_search`. |
| `variant_not_found: true` | Server substituted the closest match. Inform the user which variant was used (`result.variant_note`). |
| `recovery` object present | Use cross-framework donor source files for data/options; keep requested-framework `import_hint`/`usage_hint`. Follow `assembly.instruction` exactly. |

---

### Zero or Low Hits After Discovery

If the initial discovery query returns 0 or unexpectedly few results:

1. **Normalize the alias** — try spaces ↔ hyphens; fold case
   - `"DataTable"` → `"data-table"` → `"data table"`
2. **Toggle `ibm_products`**
   - If `ibm_products: "yes"` returned nothing → try `ibm_products: "no"`, or remove the filter
   - If `ibm_products: "no"` returned nothing → try `ibm_products: "yes"`
3. **Adjust UIShell phrasing** — for navigation/layout components try:
   - `"header navigation"`, `"ui shell"`, `"side nav"`, `"shell header"`,
     `"breadcrumb navigation"`, `"global header"`
4. **Retry once with expanded synonyms**
   - Try alternate names: `"notification"` / `"toast"` / `"inline notification"`
5. **Never switch frameworks automatically** — only retry with a different `component_type`
   if the user explicitly permits it
6. **Present options** — if still ambiguous after retry, surface the top 2 plausible
   component IDs and ask the user to confirm

### AI Chat Recovery

If an AI Chat docs query returns insufficient results:
- Retry with symbol name variations
- Include `"migration-1.0.0"` if the context implies a version upgrade

If an AI Chat code query returns insufficient results:
- Retry with/without the example root token:
  - Try `"ai chat react"`, then `"ai chat react basic"`
  - Keep the framework filter constant
- If files are missing, query by specific filename:
  ```json
  {"query": "ai chat react history customLoadHistory.ts", "size": 3, "filters": {"component_type": "React"}}
  ```

---

## Performance Optimization Rules

1. **Always enforce `component_type`** — prevents cross-framework result pollution
2. **Set `component_id` only after discovery** — premature ID guessing wastes a call
3. **Debounce a11y queries** — stop once the relevant section headings are covered
4. **Minimize call count:**
   - Discovery: 1–2 calls
   - Targeted: 1–2 calls
   - Total ideal: ≤ 4 calls for any request
5. **Fetch missing doc chunks only if needed** — check `chunk_ordinal_max` first
6. **For AI Chat docs** — prefer one concise `docs_search` call; server auto-routes to the AI Chat index
7. **For AI Chat code** — prefer one concise `code_search` call with framework guardrail and optional example root
8. **Trust server-side reconstruction** — multi-chunk files are assembled automatically;
   do not issue chunk-by-chunk queries

---

## Quality Assurance Checklist

Use this checklist before composing the final response:

### Parsing & Framework
- [ ] JSON parsed from string before reasoning
- [ ] Framework consistent — no React/Web Components mixing
- [ ] Results filtered by `component_type`; mismatches discarded

### Component & Product Scope
- [ ] Product scope correct (`ibm_products: "yes"` vs `"no"`)
- [ ] `component_id` chosen via discovery → canonicalization (never guessed)

### Variants & Props
- [ ] Variant selection appropriate (`variant_is_default: true` if user didn't specify)
- [ ] Props validated against `props_schema`
- [ ] IBM Plex font applied correctly — no inline token strings

### Documentation
- [ ] Docs freshness considered — used most recent `last_crawled_at`
- [ ] Chunks complete if needed — `chunk_ordinal_max` checked

### Accessibility
- [ ] A11y queries targeted by `component_id`
- [ ] A11y queries debounced — stopped when headings are covered

### AI Chat
- [ ] AI Chat doc query validated against intended API symbol/topic
  (e.g., `PublicChatState`, `ChatInstance`, `migration-1.0.0`)
- [ ] AI Chat code validated against intended `example_root` and framework
- [ ] All required files confirmed present (check for `is_complete_file: true`)
- [ ] Complete file content available when needed

### Carbon Charts
- [ ] `code_search` was NOT called for chart content — `get_charts` only
- [ ] 2-call convention followed: `mode:"schema"` → `mode:"full"`
- [ ] Assembly fields used verbatim: `install_command`, `styles_import`, `import_hint`, `usage_hint`
- [ ] `assembly.install_command` executed and confirmed successful before completion
- [ ] Chart dependencies verified installed before applying/validating `styles_import`
- [ ] `styles_import` placed as top-level app entry import — not in SCSS
- [ ] Chart CSS import resolves after install (no module resolution errors)
- [ ] `buildable` checked before generating code; `incomplete` fields reported if false
- [ ] Cross-framework `recovery` object handled correctly if present

### Token Conservation
- [ ] Tool response not restated or summarized — stated "Received the necessary context"
- [ ] No extra files written (no tests, no README)
- [ ] Response stops after emitting the requested files
