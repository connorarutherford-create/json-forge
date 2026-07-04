# JSON Forge — Build Spec

## Product
Chrome extension that formats, validates, and beautifies JSON. Clean UI, instant results, zero permissions.

## Target Market
Web developers, API consumers, backend engineers, data analysts — anyone who works with JSON daily.

## Value Proposition
"The JSON tool you actually want to use." Beautiful, fast, works offline, no ads, no data collection.

## Market Signal (Google Trends, July 2026)

```
json online                  100  ↑60%
json online formatter         98  ↑60%
json formatter & validator    --  ↑400%
compare json online           --  ↑160%
json path finder              --  ↑150% (Breakout)
chrome json formatter         13  ↓60%  ← existing extensions failing
```

Core demand is at maximum. Chrome-extension-specific searches are down 60% — users gave up on the existing garbage. "Best json formatter" growing 50% = people hunting for recommendations because the CWS results are bad.

## Features

### Free (immediate value, no account needed)

| # | Feature | Implementation | Effort |
|:-:|---------|---------------|:------:|
| 1 | **Paste or type JSON** — textarea input, formats on blur or Cmd+Enter | DOM event listener | 1h |
| 2 | **Syntax highlighting** with line numbers | Prism.js or highlight.js, minimal bundle | 2h |
| 3 | **Collapsible tree view** — toggle expand/collapse all | Recursive DOM render with toggle buttons | 3h |
| 4 | **Validation errors** with line numbers and descriptions | JSON.parse in try/catch, map error to line | 1h |
| 5 | **Dark/light themes** — auto-detect system preference, manual toggle | CSS custom properties, matchMedia listener | 1h |
| 6 | **Copy formatted JSON** — one-click copy button | navigator.clipboard.writeText | 0.5h |
| 7 | **Drag-and-drop .json file** — open file directly | FileReader API, drag event handlers | 1h |
| 8 | **Character/line count** — live stats in status bar | String/array length on format | 0.5h |
| 9 | **Minify toggle** — compressed one-line output | JSON.stringify without spacing | 0.5h |

### Pro ($4.99/yr)

| # | Feature | Effort |
|:-:|---------|:------:|
| 1 | **JSON diff/comparison** — side-by-side or inline diff | 4h (use jsdiff or similar) |
| 2 | **Export** — save as CSV, YAML, XML | 2h per format |
| 3 | **History** — last 50 formatted JSONs with timestamps | 2h |
| 4 | **JSONPath query** — filter JSON using JSONPath expressions | 3h |
| 5 | **Custom themes** — save custom color schemes | 1h |
| 6 | **Batch format** — format multiple JSONs at once | 2h |

### Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large JSON files freeze UI | Medium | Stream rendering for >1MB; show warning and offer truncation |
| Licensing for dev audience (same as Link Cleaner issue) | Medium | Accept honor system for v1; add server check if <5% conversion |
| Prism.js bundle size | Low | Use tree-shaken build; lazy-load tree view |

## Permissions
- **None.** No `activeTab`, no `storage` (Pro uses `storage.local` only), no host permissions.
- This is the marketing hook: "Zero permissions. No data leaves your browser."

## Monetization
- **Free:** Format, validate, syntax highlight, tree view, minify, copy, drag-drop
- **Pro ($4.99/yr):** Diff, export (CSV/YAML), history, JSONPath, custom themes
- 7-day free trial (same pattern as Link Cleaner — chrome.storage.sync flag, double-click activation)

## Technical Architecture
- Single popup HTML page with embedded JS/CSS
- Content script: none (page_action style — click icon → popup)
- Service worker: minimal — just for context menu "Format JSON from selection" (v1 maybe skip this)
- No external dependencies shipped* (*except optional diff library for Pro)
- No build step needed for v1 — plain HTML + CSS + JS

## Visual Design
- Same design DNA as Link Cleaner site — monochrome, spacious, quiet
- Dark theme: `#0f0f1a` background, `#22c55e` accent (valid), `#ef4444` accent (error)
- Light theme: white background, `#1e293b` accent
- Monospace font for JSON output (Courier Prime or similar)
- Responsive popup: min 400px wide, scrollable

## Landing Page
- GitHub Pages: `connorarutherford-create.github.io/json-forge/`
- Same template as link-cleaner-site — hero, features, pricing, install
- Interactive demo (paste JSON, see it format in-browser)

## Build Plan

| Day | What happens |
|:---:|-------------|
| 1 | Write extension: popup UI, format/validate logic, theme toggle, copy, minify |
| 2 | Write Pro features: diff, export, history. Test large files. Zip and deliver |
| — | Connor submits to CWS (1-3 biz day review) |
| +1 | Build landing page on GitHub Pages while waiting |
| +N | Launch: X post, Product Hunt, Hacker News |

## Flip Projection

| Subs | ARR | Flip (3-5x) |
|:----:|:---:|:-----------:|
| 10 | $50 | Too early |
| 50 | $250 | $750-$1,250 |
| 100 | $500 | $1,500-$2,500 |
| 200 | $1,000 | $3,000-$5,000 |
| 500 | $2,500 | $7,500-$12,500 |

## Microns Listing Strategy
- Category: Browser Extensions (or Tools)
- Keywords: json formatter, developer tools, json validator, json viewer
- Selling points: zero permissions, beautiful UI, works offline, growing user base, low maintenance codebase

## Repo
`github.com/connorarutherford-create/json-forge`
