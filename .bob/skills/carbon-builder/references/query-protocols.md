# Query Protocols

## Core Strategy: Discover → Canonicalize → Target

### Phase 1 — Discover (1–2 calls)
- Use broad query terms to identify the correct `component_id`
- Do not set `component_id` yet — you are still discovering it
- Use `size: 3`

### Phase 2 — Canonicalize
- Confirm the `component_id` from discovery results
- Handle aliases: normalize spaces ↔ hyphens, fold case
- Apply UIShell taxonomy cues where relevant (see UIShell section below)

### Phase 3 — Target (1–2 calls)
- Set `filters.component_id` to the confirmed ID
- Set `filters.component_type` to the requested framework
- Add `filters.ibm_products` if product scope is known
- Use `size: 3`; increase only if you need more variants or doc chunks

---

## Component Identification Protocol

Before setting `filters.component_id`, follow this sequence:

1. **Discovery query** — broad text query, no `component_id` filter
2. **Inspect results** — read `component_id`, `component_name`, `component_aliases_text`
3. **Canonicalize** — pick the exact `component_id` string returned by the server
4. **UIShell cues** — for nav/header/sidebar components, try:
   - `"header navigation"`, `"ui shell"`, `"side nav"`, `"shell header"`
5. **Set `component_id`** — only after confirming it from a real result

---

## Smart Filters

| Filter | When to set |
|--------|-------------|
| `component_type` | Always when framework is known (React or Web Components) |
| `component_id` | Only after discovery/canonicalization |
| `ibm_products` | When user explicitly mentions IBM Products or Carbon Core |
| `asset_type` | For icon/pictogram queries only — omit for components |
| `page_type` | For docs queries — `"usage"`, `"style"`, `"accessibility"`, `"code"` |

---

## Special Case: Carbon Charts

**Hard rule: never use `code_search` for Carbon Charts. Use `get_charts` only.**

Use the 2-call convention:

**Call 1 — discover variants and schema:**
```json
{"framework": "react", "chart_type": "bar", "mode": "schema"}
```

**Call 2 — fetch source and assembly hints:**
```json
{"framework": "react", "chart_type": "bar", "variant": "simple", "mode": "full"}
```

Supported frameworks: `react`, `angular`, `vue`, `svelte`, `vanilla`, `html`

Chart type slugs: `bar`, `line`, `pie`, `donut`, `area`, `scatter`, `bubble`,
`combo`, `radar`, `treemap`, `heatmap`, `gauge`, `meter`
(use `bar` for column charts; use `donut` for doughnut)

Input contract: provide `framework` + `chart_type`, OR `doc_id`, OR `rag_id`.

See [charts-protocols.md](charts-protocols.md) for the full protocol including
assembly hints, buildability, and error recovery.

---

## Special Case: Icons & Pictograms

When the query clearly indicates an icon or pictogram:

- Use `code_search`
- Do NOT set `filters.component_type` or `filters.ibm_products`
- Set `filters.asset_type: "icon"` or `"pictogram"`
- Normalize slugs: `ai governance` → `ai-governance`; probe `ai--governance` if needed
- If 0 hits after targeted query, retry without `asset_type`

---

## Special Case: Carbon AI Chat Docs

Use `docs_search`. The server auto-routes to the AI Chat index when appropriate.

**Rules:**
- Do NOT set `filters.component_type`, `filters.component_id`, or `filters.ibm_products`
- Query directly with API/type names or migration topics
- If upgrade/migration context exists, include `"migration-1.0.0"` in the query

**Example queries:**
```json
{"query": "PublicChatState", "size": 3}
{"query": "ChatInstance", "size": 3}
{"query": "PublicConfig baseUrl", "size": 3}
{"query": "assistant tool usage", "size": 3}
{"query": "migration-1.0.0 breaking changes", "size": 3}
```

---

## Special Case: Carbon AI Chat Code Examples

Use `code_search` when the user asks for AI Chat sample apps or snippets.

**Rules:**
- Set `filters.component_type` per the framework guardrail (default React)
- Do NOT set `filters.ibm_products`
- Include: `"ai chat"` + framework + example root in the query
- Use `size: 15` when fetching a full example (all files)

**Example roots:** `basic`, `custom-element`, `history`, `watsonx`, `watch-state`

**Example queries:**
```json
{"query": "ai chat react basic", "size": 3, "filters": {"component_type": "React"}}
{"query": "ai chat web components custom element", "size": 3, "filters": {"component_type": "Web Components"}}
{"query": "ai chat history", "size": 3}
```

**For specific file retrieval:**
```json
{"query": "ai chat web components history customLoadHistory.ts", "size": 3, "filters": {"component_type": "Web Components"}}
```

---

## Efficient Pagination & Chunk Handling

1. Start with `size: 3` for all queries
2. Increase `size` only if needed (e.g., `size: 15` for full AI Chat example file sets)
3. Fetch all doc chunks for a section only when completeness is required
4. Check `chunk_ordinal` and `chunk_ordinal_max` to determine if follow-up chunk queries are needed
5. **Do not manually assemble multi-chunk files** — the server reconstructs them automatically
6. For AI Chat examples, inspect `example_files` on the top hit as the authoritative file list
