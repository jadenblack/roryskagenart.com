# PRD — Admin UI Reliability: shadcn/ui Standards, Interaction Fixes, Drafts & Zero-Token Testing

> Status: **Approved** (2026-09-13). Phases tracked in this file; Phase 0 is in flight.

## 1. Audit — reported bugs, root-caused in code

The 12 components in `src/components/ui/` are hand-rolled imitations of shadcn/ui, not
registry components. Verified defects:

| Symptom | Root cause |
|---|---|
| Dot-menu choices don't work | `dropdown-menu.tsx` wraps the trigger in `<div onClick={toggle}>` *and* puts `onClick={() => setOpen(false)}` on the panel — competing nested handlers instead of Radix's item model. Items are non-focusable divs; no keyboard support. |
| Row clicks unreliable | `CatalogView` nests a full-width button beside that dropdown; the bespoke document-level `mousedown` outside-click handler fights row affordances. |
| Modal scroll failure | `dialog.tsx` centers content in `fixed inset-0 flex items-center justify-center` — tall dialogs clip at both ends (flex centering clips the top, layer unscrollable). Call sites patch with `max-h-[85vh] overflow-y-auto`, which breaks on short viewports. |
| (X) close does nothing | The X button dispatches `CustomEvent('dialog-close-request')` — nothing in the codebase listens for it. Guaranteed dead. |
| "Bespoke slop" | 5 files render their own `fixed inset-0` modals bypassing `ui/dialog` (ArtworkQuickViewModal, InquiryModal, ArtworkFocusView, HomeLandingView, AdminLayout); 2 admin views use `window.confirm`/`alert` (Taxonomies, Users); trash fires immediately with no confirm. |
| No tests | Zero test files, no runner, for 636 files. |

Also confirmed: Radix not installed; `tailwindcss-animate` missing (the `animate-in`
classes are dead CSS); `@google/genai` declared but never imported — the app stays
AI-free under this PRD.

## 2. Non-goals — not a rebuild

No changes to views, hash routing, the state engine, or the public pages (hero /
PageHeader / slider stay). No new design language — primitives adopt upstream shadcn
styling the app already approximates. One additive migration only.

## 3. Zero-token testing guarantee

Vitest + React Testing Library, `vi.mock` on `lib/adminApi` and Supabase. Offline,
deterministic, no network, no LLM calls, no DB writes from tests, no secrets.
`npm test` is free to run forever; optional Playwright E2E targets only the local
dev server.

## 4. Phases

- **Phase 0 — Test infra first** *(this PR)*: vitest/jsdom/RTL + `src/test/setup.ts`,
  `"test": "vitest run"`. Baseline tests pin today's broken contracts (X dispatches
  the orphan event; dropdown panel closes-on-container-click) so the Phase 1 fix
  flipping them proves the repair.
- **Phase 1 — Real shadcn primitives:** install `@radix-ui/react-{dialog,dropdown-menu,switch,label,slot}`
  + `tailwindcss-animate` (`@plugin` in TW4). Regenerate `ui/*` from official registry
  source keeping current exports/props as adapters. Dialog: X wired via context,
  content owns scroll, focus trap + scroll lock. Dropdown: portal + `onSelect` items +
  arrow keys. Select stays native (accessible; 5 call sites use `value/onChange`).
  Migrate call sites — 7 dialog, 5 select, 2 dropdown, `window.confirm` → confirm
  Dialog in Users/Taxonomies, QuickView/Inquiry modals → `ui/Dialog`, toast from the
  `flash` string.
- **Phase 2 — Regression suite:** reported bugs pinned as tests (X closes, Esc,
  overlay click, tall-body scroll, menu item fires once, row click navigates, trash
  confirms).
- **Phase 3 — Drafts:** one migration (`draft boolean DEFAULT false` + partial index),
  `draft` in artworks GET/POST/PATCH, engine forces `enabled:false` for drafts (single
  choke point = drafts can never render publicly), Save-as-draft vs Publish in the
  edit dialog, Draft badge + Publish/Unpublish menu items + filter, dashboard count.
- **Phase 4 — Draft & E2E tests:** draft lifecycle unit tests; optional Playwright
  smoke (create draft → badge → publish → badge clears).

## 5. Acceptance checklist

- [ ] Every dot-menu choice fires exactly once
- [ ] No `window.confirm`/`alert` anywhere in `src/`
- [ ] All modals: X/Esc/backdrop work, long forms scroll, focus trapped and restored
- [ ] Keyboard operable (menus, dialogs, switches)
- [ ] Draft invisible publicly until published; reversible; survives reload
- [ ] `npm run lint`, `npm test` (~30–40 tests), `npm run build` clean
- [ ] Public pages pixel-unchanged (light + dark screenshots before/after)
