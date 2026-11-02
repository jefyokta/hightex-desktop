# Feature guides and release announcements

Release definitions live in `src/data/ui-guides/releases/<version>.ts`. Register
a file in `GUIDE_RELEASES` in `src/data/ui-guides.ts`; the planner orders eligible
releases by semantic version, newest first. The running version comes from
Electron's `app.getVersion()`, currently `1.2.0` in `package.json`.

A **version** groups features and determines availability. A **guide ID and
revision** determine whether a feature has been seen. Updating the application
version alone never repeats a guide. A new guide in the same version still
appears; increasing a guide's revision deliberately offers that explanation again.

## User flow

When unseen guides are available, the app first opens a release announcement.
It lists only new features, grouped by version with the current release first.
The user can continue the tour or skip. Skipping, closing or pressing Escape
acknowledges **every new guide listed in that announcement**, so it will not
reappear on the next launch. The tour itself also supports skipping.

The sidebar help action opens a feature picker; editor help opens the editor's
feature picker. Selectors use localized feature names and stable guide IDs, not
version numbers. Manual replay marks only guides actually opened in the tour;
closing the picker without starting marks nothing. A manual tour finishes after
its selected feature; automatic tours advance through all announced features.
Users can switch features directly in the tour selector.

Workspace and editor scopes are independent. Editor announcements appear when a
user opens a document, without opening any extra window automatically. Existing
imports, confirmation dialogs or mobile drawers take priority; the announcement
waits for them to close. A failed acknowledgment shows a nonblocking notice and
leaves the guides eligible for a later launch.

## Add a guide

1. Add a release file, or add a feature to its existing release file.
2. Give the guide a unique stable `id`, a `revision` starting at 1, its `scope`,
   and localized `name` and `summary` keys. Each feature owns its steps.
3. Add its locale texts to **both** `src/locales/id.json` and `src/locales/en.json`.
4. Define each step's target selectors, text keys and workspace route. Register
   the release import if it is new. No hook or renderer changes are needed.

Example shape for a future release (replace example text keys and selectors with
the feature's real keys and controls):

```tsx
export default {
  version: "1.3.0",
  guides: [
    {
      id: "advanced-search",
      revision: 1,
      name: "guide.features.advancedSearch.name",
      summary: "guide.features.advancedSearch.summary",
      scope: "workspace", // or "editor"
      steps: [
        {
          id: "search-field",
          title: "guide.features.advancedSearch.field.title",
          description: "guide.features.advancedSearch.field.description",
          selectors: ['[data-tour="document-search"]'],
          route: "/dashboard", // omit for editor-window controls
        },
      ],
    },
  ],
} satisfies GuideRelease;
```

Keep existing IDs stable when editing text. Increase `revision` when the changed
explanation needs to be shown again. New features get new IDs. Versions with no
features needing explanation need no definition file. Each guide may contain
multiple steps; step IDs must be unique within that guide.

## Implementation boundaries

- `src/types/ui-guides.d.ts` holds global guide, controller, storage and IPC types.
  Locale keys are checked by TypeScript; release files need no type imports.
- `src/data/ui-guides.ts` contains pure eligibility, ordering and acknowledgment
  rules. It does not render UI or access persistence.
- `useUIGuide` owns the queued/intro/tour session, feature selection and visited
  IDs. It uses the existing onboarding IPC for status and acknowledgments.
- `GuideAnnouncement` renders the automatic release summary and manual picker.
- `GuidePlanTour` localizes definitions; `GuidedTour` tracks real controls and
  manages the spotlight, positioning and keyboard interactions.
- `WorkspaceGuide` follows each step's route and restores the user's original
  page after dismissal. `EditorGuide` supplies the frozen-section context.
- `EditorChrome` allocates space for the titlebar and the remaining workspace.
  Editor integration checks render this same shell. Guide announcements and coach
  cards reserve the titlebar area so scrolling a target cannot hide the window title.

A highlighted control remains usable; opening its menu or dialog pauses the
spotlight until that popup closes. Use fallback selectors and
`fallbackDescription` for empty lists. Editor steps can provide
`frozenDescription` when a section has no formatting toolbar. Tab cycles through
highlighted controls and tour actions; Escape skips. Targets follow scroll,
resize, rerenders and animated sidebars.

## Editor writing tours

The editor guides for `1.2.0` live in `src/data/ui-guides/releases/1.2.0/editor.ts`.
They cover 11 features with 24 steps: navigation, writing/heading structure, text
formatting, document metadata/keywords, figures/tables, equations, citations and
bibliography, cross-references/aliases, variables/symbols, review/save/PDF and the
sidebar. Both locale files contain the explanations and literal syntax examples.

The writing outline contains H1–H3. H4 is a paragraph style without indentation,
not an outline or table-of-contents level. Navigation shortcuts use Mod (Command
on Mac, Ctrl elsewhere): Mod+number selects an available schema chapter;
Mod+N always opens the document appendix. Toolbar arrows move to adjacent chapters.

An editor step may declare:

- `editor.chapter: "normal"` to move to a normal writing chapter when needed.
- `editor.chapter: "abstract"` to show the abstract and its keyword editor.
- `editor.sidebar` to open an existing sidebar tab (`setting`, `citation`, etc.).
- `example` as a locale key for a readable code example in the coach.

The editor wrapper waits for chapter content to be ready before enabling the
step. It restores the previous chapter and sidebar state on dismissal. Preparation
only navigates and opens panels; it does not insert examples, press formatting
controls, save/export files or change document fields. Selection bubbles and
suggestion popups pause the coach so their real controls remain usable.

## Persistence and verification

Install metadata and `seenGuides: Record<guideId, revision>` live in
`userData/installed.json`, outside document archives and application settings.
Acknowledgments merge monotonically and are saved atomically. Legacy timestamp
markers preserve the installation date during migration. Old aggregate IDs from
the prototype remain harmless; the feature-based definitions receive their own
IDs and are announced once.

Run `bun test tests/ui-guides.test.ts tests/first-installed.test.ts` for planner,
registry, locale and persistence checks. UI checks use isolated temporary
profiles and fixtures; run them sequentially:

```sh
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/workspace-ui.cjs
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/editor-guide-ui.cjs
```

Cloud access during development uses the local HighTex server configured in
`LOCAL_SERVER` (currently `http://127.0.0.1:8000`). These guide checks need no cloud
connection or account.
