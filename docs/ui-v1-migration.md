# @4lt7ab/ui v1.0.0 migration audit

Inventory of every `@4lt7ab/ui*` import site in `src/web/`, tagged by the v1.0.0
breaking-change axis it falls on. Sized against the current pin
`github:4lt7ab/ui#v0.2.26` (see `package.json`) and the target
`@4lt7ab/ui#v1.0.0`, spanning v0.2.27 -> v0.2.33 -> v1.0.0.

This audit is the sizing input for downstream migration tasks in the
`ui-v1-migration` group; those tasks should execute against these tables
without re-grepping.

## Scope and conventions

- Scope: every `.ts` / `.tsx` file under `src/web/` that imports from
  `@4lt7ab/ui*`. Test-only `vi.mock` calls that reference a module path are
  included because the mock module path has to track any path moves.
- Package surface: the repo imports from four subpaths of a single `@4lt7ab/ui`
  package -- `@4lt7ab/ui/core`, `@4lt7ab/ui/ui`, `@4lt7ab/ui/content`,
  `@4lt7ab/ui/animations`. There is **no** top-level `@4lt7ab/content`
  package imported anywhere; the task context mentions
  `@4lt7ab/content` as the origin for the Container/LinkCard path move
  (axis 3), but that axis is a no-op here because neither symbol is in
  use and because this codebase only sees the `/content` subpath.
- "No-op" means a breaking-change axis has zero call sites in `src/web/`.
  Listed explicitly so the downstream tasks can close out axis-by-axis
  without re-auditing.

## Complete import inventory

Every `@4lt7ab/ui*` import across `src/web/`, in one table, for cross-reference.

| File | Line | Subpath | Symbols |
|------|-----:|---------|---------|
| `src/web/src/main.tsx` | 3 | `@4lt7ab/ui/core` | `ThemeProvider` |
| `src/web/src/App.tsx` | 2 | `@4lt7ab/ui/core` | `semantic as t` |
| `src/web/src/App.tsx` | 3 | `@4lt7ab/ui/ui` | `StatusDot`, `TabStrip`, `ThemePicker` |
| `src/web/src/App.tsx` | 4 | `@4lt7ab/ui/animations` | `ThemeBackground` |
| `src/web/src/App.test.tsx` | 29-30 | `@4lt7ab/ui/ui` | `vi.mock` (uses `ThemePicker`) |
| `src/web/src/App.test.tsx` | 39 | `@4lt7ab/ui/animations` | `vi.mock` for `ThemeBackground` |
| `src/web/src/components/ReactionStrip.tsx` | 2 | `@4lt7ab/ui/core` | `semantic as t` |
| `src/web/src/pages/NoteListPage.tsx` | 2 | `@4lt7ab/ui/core` | `semantic as t`, `staggerStyle` |
| `src/web/src/pages/NoteListPage.tsx` | 3-7 | `@4lt7ab/ui/ui` | `Button`, `IconButton`, `Card`, `Stack`, `Skeleton`, `EmptyState`, `Input`, `Textarea`, `ModalShell`, `ConfirmDialog`, `Field`, `SearchInput`, `Surface` |
| `src/web/src/pages/NoteListPage.tsx` | 8 | `@4lt7ab/ui/content` | `Markdown` |
| `src/web/src/pages/NoteListPage.test.tsx` | 29 | `@4lt7ab/ui/content` | `vi.mock` for `Markdown` |
| `src/web/src/pages/ReminderDashboardPage.tsx` | 2 | `@4lt7ab/ui/core` | `semantic as t`, `staggerStyle` |
| `src/web/src/pages/ReminderDashboardPage.tsx` | 3-7 | `@4lt7ab/ui/ui` | `Card`, `Badge`, `Button`, `IconButton`, `Stack`, `Skeleton`, `EmptyState`, `Select`, `Textarea`, `ModalShell`, `ConfirmDialog`, `Field`, `DatePicker`, `PageShell`, `SectionHeader`, `ExpandableCard` |
| `src/web/src/pages/LogsPage.tsx` | 2 | `@4lt7ab/ui/core` | `semantic as t`, `staggerStyle` |
| `src/web/src/pages/LogsPage.tsx` | 3-7 | `@4lt7ab/ui/ui` | `Card`, `Button`, `IconButton`, `Stack`, `Skeleton`, `EmptyState`, `Input`, `Textarea`, `ModalShell`, `ConfirmDialog`, `Field`, `DatePicker`, `PageShell`, `SectionHeader` |
| `src/web/src/test/render-helpers.tsx` | 5 | `@4lt7ab/ui/core` | `ThemeProvider` |

Eight source files and three test files, exercising 28 distinct symbols from
`@4lt7ab/ui`.

## Axis 1 -- Retired components

Components removed across v0.2.27-v1.0.0. Each site below requires an
affirmative replacement decision before the pin can advance.

| Symbol | File:Line | Usage site(s) | Action |
|--------|-----------|---------------|--------|
| `PageShell` | `src/web/src/pages/ReminderDashboardPage.tsx:6` (import) | `<PageShell maxWidth={800} gap="lg">` wrapping the entire page (line 514, closing 608) | **Retirement replacement.** Replace `PageShell` with a local layout -- `<div>` + `Stack gap="lg"` inside a max-width container, matching whatever v1.0.0 exposes as the canonical page layout primitive. Preserve `maxWidth={800}` and `gap="lg"`. |
| `PageShell` | `src/web/src/pages/LogsPage.tsx:6` (import) | `<PageShell maxWidth={800} gap="lg">` wrapping the entire page (line 537, closing 597) | **Retirement replacement.** Same as above. Both pages should land on the same replacement primitive. |
| `SectionHeader` | `src/web/src/pages/ReminderDashboardPage.tsx:6` (import) | `<SectionHeader title={title} spacing="sm" />` inside `ReminderSection` (line 423) | **Retirement replacement.** Likely swap for a plain `<h2>` styled via `semantic` tokens, or whatever v1.0.0 exposes for section headings. Preserve `spacing="sm"` semantics. |
| `SectionHeader` | `src/web/src/pages/LogsPage.tsx:6` (import) | `<SectionHeader title="Logs" spacing="sm" />` in the main section (line 545) | **Retirement replacement.** Same as above. |
| `ExpandableCard` | `src/web/src/pages/ReminderDashboardPage.tsx:6` (import) | `<ExpandableCard title={...} variant="flat">` wrapping the dormant-reminders section (line 561, closing 583) | **Retirement replacement.** Needs a collapsible pattern -- most likely a local `useState`-driven toggle around a `Card variant="flat"`. Preserve the `title` + collapsed-by-default + `variant="flat"` shape. |

Retired symbols with **zero usage** in `src/web/` (no-op):
`MetadataTable`, `SectionLabel`, `FormModal`, `ShortcutHelpModal`,
`ThemeSurface`, `StatCard`, `PillSelect`, `PageHeader`.

## Axis 2 -- Content aliases removed

Removed content-package aliases: `SideNote`, `PullQuote`, `Epigraph`,
`TextSection`.

**No-op.** No call sites in `src/web/`.

## Axis 3 -- Path moves from @4lt7ab/content -> @4lt7ab/ui

Per task context, `Container` and `LinkCard` move from `@4lt7ab/content` to
`@4lt7ab/ui`.

**No-op for the listed symbols.** `Container` and `LinkCard` are not imported
anywhere in `src/web/`.

**Resolved: `Markdown` stays at `@4lt7ab/ui/content` -- no action.** This repo's
only content-package import is `Markdown` at
`src/web/src/pages/NoteListPage.tsx:8` (and its mock at
`NoteListPage.test.tsx:29`), from `@4lt7ab/ui/content`.

Grounded in the upstream `CHANGELOG.md` at the currently pinned
`@4lt7ab/ui#v0.2.26`:

- Axis 3's path-move entries (`Container` and `LinkCard`) are the only
  content -> ui relocations mentioned anywhere in the planning context, and
  `Markdown` is **not** in that list.
- The CHANGELOG has no `Markdown` path-move entry in any released version up
  to and including v0.2.26, and the `## Unreleased` section is empty. No
  v0.2.27+ or v1.0.0 entries exist in the upstream changelog at the time of
  audit resolution.
- `Markdown`'s source still lives at
  `packages/content/src/components/Markdown/` in the installed package,
  consistent with the `@4lt7ab/ui/content` subpath export.

If the eventual v1.0.0 release notes contradict this -- i.e. `Markdown` does
end up in the path-move list with `Container` / `LinkCard` -- the pin-bump
task must rewrite `NoteListPage.tsx:8` and the `vi.mock` at
`NoteListPage.test.tsx:29` in lockstep. Until that release ships with an
explicit entry, the two import sites stay on `@4lt7ab/ui/content`.

## Axis 4 -- Flat -> compound API refactors

Components converted from flat prop APIs to compound children: `Select`,
`Combobox`, `TopBar`.

| Symbol | File:Line | Usage site(s) | Action |
|--------|-----------|---------------|--------|
| `Select` | `src/web/src/pages/ReminderDashboardPage.tsx:6` (import) | Two usages: `<Select options={RECURRENCE_OPTIONS} value={recurrence} onChange={...} />` inside `CreateReminderOverlay` (lines 79-84) and `EditReminderOverlay` (lines 208-213). `RECURRENCE_OPTIONS` is defined at line 13 as an array of `{ value, label }` pairs. | **Compound rewrite.** Replace both flat-`options` call sites with the compound `<Select><Select.Option .../>...</Select>` form (or whatever v1.0.0 names the sub-components). The `RECURRENCE_OPTIONS` constant becomes a `.map` over `Select.Option` children, or a loop around the new child component. Both overlays should migrate together -- they share the same options array. |

`Combobox` and `TopBar` are **no-op** -- not imported anywhere in `src/web/`.

## Axis 5 -- TableFilters -> Table.FilterBar compound

**No-op.** `Table` and `TableFilters` are not imported anywhere in `src/web/`.

## Axis 6 -- Prop lockdowns

v1.0.0 removes `style`, `className`, and `...HTMLAttributes` passthrough
everywhere, and enforces explicit allowlists on form elements.

Audit result: **effectively no-op, with one thing to verify.**

- **No `style` or `className` passed to `@4lt7ab/ui` components** anywhere in
  `src/web/`. Every inline `style={{...}}` block in the audited files is on
  plain DOM elements (`<div>`, `<main>`, `<h1>`, `<section>`, `<span>`,
  `<form>`, native `<button>`), which are untouched by the lockdown.
- **Form element props stay within the expected allowlist.** `Input` and
  `Textarea` call sites (both `NoteListPage.tsx` and `ReminderDashboardPage.tsx`
  and `LogsPage.tsx`) use only `id`, `value`, `onChange`, `placeholder`,
  `autoFocus`, and `rows` -- all standard and expected to remain on the
  v1.0.0 allowlist. No `name`, `data-*`, `aria-*` passthrough, no `...rest`
  spreads.
- **To verify at pin-bump:** the native `<button type="button" onClick={...}>`
  in `ReactionStrip.tsx` (lines 86-119) is **not** an `@4lt7ab/ui` component
  and is out of scope for the lockdown. Included here only to pre-empt a
  false positive when grepping.

No migration action needed for this axis. If the pin-bump surfaces a
TypeScript error referencing a removed prop, it will be on an Axis 7 prop
(below) rather than a generic `style`/`className`.

## Axis 7 -- Preset / union migrations

Props migrating from free numeric/string values to presets or enumerated unions
on `Icon`, `IconButton`, `ModalShell`, `ProgressBar`, `Divider`, `Skeleton`,
`Stack`, `Container`, `Grid`, `Table`, `Badge`, `Surface`, `StatusDot`.

Every call site below passes a numeric or string value that likely needs to
map to a preset token in v1.0.0. Exact preset names are unknown from the
current task context -- the downstream migration task must cross-reference
the v1.0.0 API and rewrite in one pass per component.

### IconButton -- `size`, `buttonSize`

| File:Line | Site | Current props |
|-----------|------|---------------|
| `NoteListPage.tsx:120` | Edit note | `size={18}` |
| `NoteListPage.tsx:121` | Delete note | `size={18}` |
| `NoteListPage.tsx:384` | New note (list header) | `size={18} buttonSize="sm"` |
| `NoteListPage.tsx:521` | New note (mobile toolbar) | `size={18} buttonSize="sm"` |
| `ReminderDashboardPage.tsx:362` | Dismiss reminder | `size={16} buttonSize="sm"` |
| `LogsPage.tsx:292` | Edit entry | `size={16} buttonSize="sm"` |
| `LogsPage.tsx:299` | Delete entry | `size={16} buttonSize="sm"` |
| `LogsPage.tsx:425` | Backdate | `size={16} buttonSize="sm"` |
| `LogsPage.tsx:432` | Edit log | `size={16} buttonSize="sm"` |

Action: map `size={18}` / `size={16}` to the corresponding icon-size presets,
and confirm `buttonSize="sm"` is still a valid preset string in v1.0.0.

### Skeleton -- `height`, `width`

| File:Line | Current props |
|-----------|---------------|
| `NoteListPage.tsx:412-414` | `height={48}` x3 |
| `NoteListPage.tsx:453` | `height={32} width="60%"` |
| `NoteListPage.tsx:456` | `height={16} width="40%"` |
| `NoteListPage.tsx:458` | `height={200}` |
| `NoteListPage.tsx:532` | `height={32} width="60%"` |
| `NoteListPage.tsx:534` | `height={200}` |
| `ReminderDashboardPage.tsx:428-429` | `height={56}` x2 |
| `ReminderDashboardPage.tsx:570` | `height={56}` |
| `LogsPage.tsx:468` | `height={40}` |
| `LogsPage.tsx:548-550` | `height={72}` x3 |

Action: numeric `height`/`width` values replaced with preset unions. The
mix of values (16/32/40/48/56/72/200) suggests the call sites will need
specific preset choices per site rather than a blanket find-replace.

### Stack -- `gap`, `direction`, `justify`

| File:Line | Current props |
|-----------|---------------|
| `NoteListPage.tsx:180` | `gap="sm"` |
| `NoteListPage.tsx:190` | `direction="horizontal" gap="sm" justify="end"` |
| `NoteListPage.tsx:238` | `gap="sm"` |
| `NoteListPage.tsx:248` | `direction="horizontal" gap="sm" justify="end"` |
| `NoteListPage.tsx:411` | `gap="xs"` |
| `ReminderDashboardPage.tsx:60` | `gap="sm"` |
| `ReminderDashboardPage.tsx:88` | `direction="horizontal" gap="sm" justify="end"` |
| `ReminderDashboardPage.tsx:190` | `gap="sm"` |
| `ReminderDashboardPage.tsx:231` | `direction="horizontal" gap="sm" justify="end"` |
| `ReminderDashboardPage.tsx:426` | `gap="sm"` |
| `ReminderDashboardPage.tsx:441` | `gap="sm"` |
| `ReminderDashboardPage.tsx:569` | `gap="sm"` |
| `ReminderDashboardPage.tsx:573` | `gap="sm"` |
| `LogsPage.tsx:54` | `gap="sm"` |
| `LogsPage.tsx:76` | `direction="horizontal" gap="sm" justify="end"` |
| `LogsPage.tsx:125` | `gap="sm"` |
| `LogsPage.tsx:141` | `direction="horizontal" gap="sm" justify="end"` |
| `LogsPage.tsx:201` | `gap="sm"` |
| `LogsPage.tsx:228` | `direction="horizontal" gap="sm" justify="end"` |
| `LogsPage.tsx:349` | `gap="sm"` |
| `LogsPage.tsx:364` | `direction="horizontal" gap="sm" justify="end"` |
| `LogsPage.tsx:474` | `gap="sm"` |
| `LogsPage.tsx:547` | `gap="sm"` |
| `LogsPage.tsx:558` | `gap="sm"` |

Action: `gap`, `direction`, `justify` already use string values. Verify the
exact preset names still include `"sm"`, `"xs"`, `"horizontal"`, `"end"` in
v1.0.0. If the union narrows, bulk-rename in a single pass.

### ModalShell -- `maxWidth`, `role`, `aria-label`

| File:Line | Current props |
|-----------|---------------|
| `NoteListPage.tsx:177` | `maxWidth={560}` |
| `NoteListPage.tsx:235` | `maxWidth={560}` |
| `NoteListPage.tsx:346` | default |
| `ReminderDashboardPage.tsx:57` | default |
| `ReminderDashboardPage.tsx:120` | default |
| `ReminderDashboardPage.tsx:173` | default |
| `ReminderDashboardPage.tsx:292` | `maxWidth={420} role="alertdialog" aria-label="Confirm dismiss"` |
| `LogsPage.tsx:51` | default |
| `LogsPage.tsx:120` | default |
| `LogsPage.tsx:198` | default |

Action: numeric `maxWidth` migrates to a width preset union. Confirm
`role`/`aria-label` remain supported on the form-element allowlist (axis 6)
for ModalShell.

### Surface -- `level`, `padding`, `border`, `radius`

| File:Line | Current props |
|-----------|---------------|
| `NoteListPage.tsx:86` | `level="solid" padding="lg" border radius="lg"` |

Action: confirm `level="solid"`, `padding="lg"`, `radius="lg"`, and the
boolean `border` prop survive into v1.0.0 presets.

### Badge -- `variant`

| File:Line | Current props |
|-----------|---------------|
| `ReminderDashboardPage.tsx:359` | `variant="info"` |

Action: verify `"info"` is still a valid variant preset.

### StatusDot -- `variant`, `size`

| File:Line | Current props |
|-----------|---------------|
| `App.tsx:69-72` | `variant={connected ? "success" : "error"} size="sm"` |

Action: verify `"success"`, `"error"`, and `"sm"` are still valid preset values.

### TabStrip -- `size` (StatusDot's sibling in the same header)

| File:Line | Current props |
|-----------|---------------|
| `App.tsx:62-67` | `tabs={...} activeKey={page} onChange={...} size="sm"` |

Action: `TabStrip` is not in the context's Axis 7 list, but `size="sm"` is the
kind of preset prop that often gets tightened across a library major. Verify
at pin-bump; no migration action unless the prop union changes.

### ThemePicker, ThemeBackground, ThemeProvider

These appear in the imports but take no size/width/height/layout props in the
audited call sites. Verify the `variant="compact"` prop on `ThemePicker`
(App.tsx:73) and `defaultTheme="synthwave" applyPageStyles` on `ThemeProvider`
(main.tsx:8, render-helpers.tsx:44) still match v1.0.0's API. No migration
action expected.

### Components not touched by Axis 7 in this codebase

`Icon`, `ProgressBar`, `Divider`, `Container`, `Grid`, `Table` -- not imported
anywhere in `src/web/`, so those parts of Axis 7 are no-op.

## Open questions / follow-up tasks

The audit surfaced two gaps that the v1.0.0 release notes (not available in
the task context) must resolve before the pin-bump lands:

1. **`Markdown` location -- RESOLVED (2026-04-19).** The upstream
   `CHANGELOG.md` at v0.2.26 has no `Markdown` path-move entry and an empty
   `## Unreleased` section. Axis 3's path-move list explicitly names only
   `Container` and `LinkCard`. Decision: `Markdown` stays at
   `@4lt7ab/ui/content`; `src/web/src/pages/NoteListPage.tsx:8` and
   `src/web/src/pages/NoteListPage.test.tsx:29` keep their current import
   path. If v1.0.0 release notes when published contradict this, the
   pin-bump task rewrites both sites in lockstep. See Axis 3 above for the
   full reasoning. (Task `01KPM41RWJFMP6DT35NQN4PQN6`.)

2. **Replacement primitives for retired `PageShell`, `SectionHeader`,
   `ExpandableCard`.** Each retired component listed in Axis 1 needs an
   affirmative v1.0.0 replacement or a documented "roll your own with
   semantic tokens" guidance. The replacements above are speculative
   pending release notes.

Filed as docs follow-up tasks in the `ui-v1-migration` group:

- `01KPM41RWJFMP6DT35NQN4PQN6` -- Confirm Markdown location in @4lt7ab/ui v1.0.0
  release notes. **Resolved above.**
- `01KPM41RWK0BJ36H7GZZZVQYGE` -- Identify v1.0.0 replacements for retired
  PageShell / SectionHeader / ExpandableCard.
