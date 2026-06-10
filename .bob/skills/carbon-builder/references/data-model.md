# Data Model & Schema Reference

## code_search Results (Storybook-based)

These fields are returned for Carbon component queries:

| Field | Type | Description |
|-------|------|-------------|
| `component_id` | string | Normalized ID, e.g. `"accordion"`, `"about-modal"` |
| `component_name` | string | Display name |
| `component_type` | string | `"React"` or `"Web Components"` |
| `ibm_products` | string | `"yes"` (IBM Products) or `"no"` (Carbon Core) |
| `variants[]` | array | See variants schema below |
| `imports` | string | Import statement(s) for this component |
| `storybook_url` | string | Link to Storybook entry |
| `iframe_url` | string | Embeddable Storybook iframe URL |
| `canonical_url` | string | Canonical component page URL |
| `component_aliases_text` | string | Alias/search terms for this component |
| `search_tokens` | string | Full-text search tokens |
| `storybook_title` | string | Storybook navigation title |
| `last_updated` | string | ISO timestamp — use for freshness validation |
| `rag_id` | string | Unique identifier referenced in AI Chat client system prompts |
| `story_files` | array | Source story file paths — useful for canon source Q&A |

### variants[] Schema

Each element in `variants[]`:

| Field | Description |
|-------|-------------|
| `variant_id` | Unique variant identifier |
| `example` | Code example string |
| `props_used` | Props applied in this example |
| `props_literal` | Concrete prop values from story args |
| `props_schema` | Full props schema for validation |
| `variant_is_default` | `true` for the default/recommended variant |
| `requery_hint` | Present on stub entries — signals a follow-up query is needed |

---

## docs_search Results (Chunked Content)

These fields are returned for Carbon documentation queries:

| Field | Type | Description |
|-------|------|-------------|
| `component_id` | string | Component this chunk belongs to |
| `topic_id` | string | Topic identifier |
| `page_type` | string | `"usage"`, `"style"`, `"accessibility"`, `"code"`, `"content"` |
| `section_heading` | string | Heading under which this chunk appears |
| `chunk_text` | string | The actual documentation text |
| `chunk_ordinal` | integer | Position of this chunk within the section |
| `chunk_ordinal_max` | integer | Total chunks in this section (pagination signal) |
| `breadcrumbs` | array | Navigation path to this page |
| `last_crawled_at` | string | ISO timestamp — prefer fresher content |

---

## AI Chat Documents (served via `docs_search`)

When the query targets AI Chat API docs, these fields are typical:

| Field | Description |
|-------|-------------|
| `section_heading` | Section title |
| `titleline` | Page title |
| `section_slug_phrase` | URL-safe slug for the section |
| `api_symbols_text` | API symbols/types referenced in this chunk |
| `url_filename` | Source filename |
| `chunk_summary` | Brief summary of the chunk |
| `chunk_title` | Chunk-level title |
| `chunk_text` | Full chunk content |
| `anchor_url` | Deep-link anchor URL |
| `page_url` | Full page URL |
| `last_crawled_at` | ISO timestamp |

Key entity names to query directly: `PublicChatState`, `ChatInstance`, `PublicConfig`,
`Assistant`, `migration-1.0.0`.

---

## get_charts Results

### `mode: "schema"` response

| Field | Description |
|-------|-------------|
| `status` | `"schema_only"` |
| `chart.chart_id` | Normalized chart type slug (e.g. `"bar"`) |
| `chart.framework` | Resolved framework string |
| `available_variants` | Array of `{ variant_id, name }` — all variants for this chart+framework |
| `default_variant` | Recommended `variant_id` |
| `data_schema.symbols` | Symbol name(s) for the data array |
| `data_schema.known_fields` | Field names expected in each data object |
| `options_schema.symbols` | Symbol name(s) for the options object |
| `options_schema.known_top_level_keys` | Top-level keys (axes, legend, title, toolbar, etc.) |
| `framework_components` | Map of chart class names → source file paths |
| `vanilla_names` | Vanilla/HTML class names for this chart |

### `mode: "full"` response

| Field | Description |
|-------|-------------|
| `status` | `"complete"` or `"incomplete_example"` |
| `buildable` | `true` when source files are runnable |
| `chart` | `{ chart_id, chart_name, framework, version, canonical_url, vanilla_names, framework_components }` |
| `chosen_variant` | See chosen_variant schema below |
| `variant_not_found` | `true` if requested variant_id was not found; server used closest match |
| `variant_used` | The actual `variant_id` resolved |
| `available_variants` | Array of `{ variant_id, name }` |
| `source_files` | Array of reassembled source files — see source_files schema below |
| `assembly` | Assembly hints — see assembly schema below |
| `recovery` | Present when cross-framework fallback was used (see charts-protocols.md) |
| `incomplete` | Present when `buildable: false` — `{ reason, missing }` |
| `user_data` | Present when `data` arg supplied — includes merge instruction |
| `user_options` | Present when `options` arg supplied — includes merge instruction |

#### chosen_variant schema

| Field | Description |
|-------|-------------|
| `variant_id` | Variant identifier |
| `name` | Human-readable variant name |
| `variant_is_default` | `true` for the default/recommended variant |
| `import_hint` | Framework-specific component import statement — use verbatim |
| `usage_hint` | Component usage template — substitute your data and options |
| `example_quality` | `"runnable"`, `"partial"`, `"cross_framework_recovery"`, etc. |
| `has_concrete_data` | `true` when example data array is indexed |
| `has_concrete_options` | `true` when example options object is indexed |
| `build_inputs` | `{ chart_name, data_symbols[], options_symbols[] }` |
| `source_file` | `{ path, url_blob }` — primary source file reference |

#### source_files[] schema

| Field | Description |
|-------|-------------|
| `path` | File path within the example |
| `file_role` | `"variant"` (data+options), `"dependency"`, or `"framework_component"` (importable class) |
| `code` | Full reassembled file content |
| `imports` | Import statements found in the file |
| `exports` | Export statements found in the file |

#### assembly schema

| Field | Description |
|-------|-------------|
| `install_command` | Terminal command to install the chart package — use verbatim |
| `styles_import` | Top-level import for chart CSS — add to app entry module, never in SCSS |
| `builder_call` | Derived invocation string, e.g. `builder('BarChartSimple', data, options)` |
| `instruction` | Code generation instruction from the server — follow exactly |

---

## AI Chat Code Results (served via `code_search`)

When the query targets AI Chat sample code, these fields are typical:

| Field | Description |
|-------|-------------|
| `doc_id` | Parent document identifier — join key between manifest and chunks |
| `rag_id` | Globally unique identifier referenced in AI Chat system prompts |
| `example_root` | Example name: `basic`, `custom-element`, `history`, `watsonx`, `watch-state` |
| `framework` | `"react"` or `"web-components"` |
| `example` | Code snippet |
| `path` | File path within the example |
| `filename` | File name |
| `title` | Human-readable title |
| `url` | Source URL |
| `tags` | Search tags |
| `component_name` | Component display name |
| `component_type` | `"React"` or `"Web Components"` |
| `description` | Example description |
| `code` | Full code content |
| `raw` | Raw source |
| `last_updated` | ISO timestamp — use for freshness validation |
| `doc_type` | Document classification |
| `version` | Version tag |
| `chunk_id` | Globally unique: `doc_id::file_id::chunk_no` |
| `file_id` | File identifier within the example |
| `example_files` | Array of all files in the example — use as source of truth for file list |
| `is_complete_file` | `true` when the server has auto-reconstructed a multi-chunk file |

> **Note:** Each `chunk_id` is globally unique — no collisions across files within an example.
> The server automatically reconstructs multi-chunk files when it detects file-specific queries.
