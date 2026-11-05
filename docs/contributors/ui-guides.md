# Feature guides and release announcements

Release definitions live in `src/data/ui-guides/releases/<version>.ts`. Register
a file in `GUIDE_RELEASES` in `src/data/ui-guides.ts`; the planner orders eligible
releases by semantic version, newest first. The running version comes from
Electron's `app.getVersion()` and the application version in `package.json`.
Registering a planned release does not change that version or announce its
guides before the application reaches the required version.

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

Fresh-install welcome tours can set `welcomeOrder` on a feature to put setup
before dependent features within the same release. Upgrade announcements and
manual replay retain the release's registered order. Release groups still sort
by semantic version, newest first.

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

Steps may declare an `advanceWhen` CSS selector and a localized
`waitingDescription`. Next and the right-arrow shortcut remain disabled until
that selector matches a visible element. This is a read-only readiness check;
it never selects or creates data on the user's behalf.

## Planned 1.3.0 guides

`src/data/ui-guides/releases/1.3.0.ts` registers three features (the local lecturer directory is revision 3):

| Guide ID                  | Scope     | Steps | Content                                                                                                                          |
| ------------------------- | --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| `form-generation`         | Workspace | 6     | Choose a document, proposal/defense stages, form selection, profile/administration data, preview, and separate PDFs in a ZIP.    |
| `lecturer-directory`      | Workspace | 5     | Author identity, search by name/NIP, local directory management, chair/examiner selection, and saving the local default profile. |
| `document-author-profile` | Editor    | 3     | Per-document author/lecturer data, explicitly copying defaults, and saving document settings.                                    |

These guides become automatically eligible at application version `1.3.0`.
The definitions do not bump the application version. Existing 1.2.0 IDs,
revisions and seen state remain unchanged.

The form tour never selects a document, changes stage/checkboxes, or exports
files automatically. Its first step waits for a selected document before enabling
Next, so an empty page does not produce six repeated fallback explanations.
Users can select a document while following the guide; the remaining steps
then track its real controls. Without documents, the empty state explains how
to close the guide, create/import a document and reopen it from help.

The lecturer guide navigates to `/settings` and the form guide to
`/dashboard/forms`; closing either restores the original workspace route.
The editor guide opens the existing settings panel and restores the previous
panel state on dismissal. It never copies defaults, saves profile data, or
changes lecturer selections. Cloud-locked documents have a fallback explanation
instead of an unavailable default-copy action. Internship advisors remain manual.

Both languages explain that local directory edits do not rewrite stored profiles,
default profile changes do not rewrite existing documents, B0/B1 are proposal-only,
and assessment/comment/correction/signature fields stay blank for faculty.

## Editor writing tours

The editor guides for `1.2.0` live in `src/data/ui-guides/releases/1.2.0/editor.ts`.
They cover 11 features with 29 steps: navigation, writing/heading structure, text
formatting, document metadata/keywords, figures/tables, equations, citations and
bibliography, cross-references/aliases, variables/symbols, review/save/PDF and the
sidebar. Both locale files contain the explanations and literal syntax examples.

The writing outline contains H1–H3. H4 is a paragraph style without indentation,
not an outline or table-of-contents level. Navigation shortcuts use Mod (Command
on Mac, Ctrl elsewhere): Mod+number selects an available schema chapter;
Mod+0 opens the document appendix, and Mod+N advances to the next chapter. Toolbar arrows move to adjacent chapters.

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

Run `bun test tests/ui-guides.test.ts tests/first-installed.test.ts tests/default-profile-changes.test.ts`
for planner, registry, locale, persistence and selective-copy checks. UI checks use isolated temporary
profiles and fixtures; run them sequentially:

```sh
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/workspace-ui.cjs
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/editor-guide-ui.cjs
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/default-profile-ui.cjs
```

Cloud access during development uses the local HighTex server configured in
`LOCAL_SERVER` (currently `http://127.0.0.1:8000`). These guide checks need no cloud
connection or account.

## Reviewing local defaults

The editor's Use local defaults action opens a field-by-field before/after
preview. Only selected changes are applied to the document settings draft;
the existing Save action is still required to persist them. Closing/cancelling
the preview changes nothing. Unchanged profiles show an explicit no-change state.

Fields that would clear an existing name or NIP start unchecked, including a
partially empty lecturer record. Users may explicitly select those changes to
clear a value. Lecturer names and NIPs are copied together. Nonselected roles,
CV and photos are preserved. Internship documents accept only author name/NIM
from this action, retaining their manual advisor data. Cloud-locked author data
continues to disable default-copy access.

The pure diff/apply rules are in `src/utils/default-profile-changes.ts`; the
preview uses `DefaultProfilePreview` and never writes the database itself.

## Workspace walkthroughs and revisions

The four baseline workspace guides live in `src/data/ui-guides/releases/1.2.0/workspace.ts`.
They contain 14 steps: create/import/open (3), search/category/sort/selection (4),
BibTeX/Zotero/search/reference row (4), and document menu/bulk export/export folder (3).
Each step explains the visible control and the outcome of using it. Avoid adding
steps just to increase the counter. Current registered guides all have multiple
steps and distinct explanations, verified by the registry test.

The baseline workspace guides now use revision 2; chapter navigation uses revision 3
and the sidebar guide revision 2. Their IDs stay stable. Previously acknowledged
older revisions are offered once again, while unchanged guides keep their read state.
Navigation includes chapter-list jumps and appendices; the sidebar visits its actual
tabs and restores the user's previous panel when dismissed.

Search and export tours wait for a document rather than repeating the empty state
for every step. They explain how to create/import one or clear filters and can be
closed at any time. Reference-library steps explain the empty state when needed.
Export-folder guidance visits Settings and restores the original workspace route.
Tour navigation never starts a document import/export or a category refresh.

## Visual focus during tours

`src/css/ui-guides.css` keeps the coach and release announcement on the application's
popover, text and action colors. The temporary backdrop dims and lightly blurs
surrounding UI, with stronger dimming in dark mode. The actual target remains clear
and interactive. A border/shadow, readable body text and compact progress bar help
separate the coach from the background without overriding the selected theme.

The tour layer sits above incidental notifications. Opening a real dialog, menu
or selection popup still pauses the entire focus layer so those controls can be
used normally. The backdrop also covers the workspace while a target is loading.
`DialogContent.overlayClassName` scopes the announcement backdrop without changing
other application dialogs. No guide IDs/revisions change for this visual update.

The workspace/editor Electron checks verify rendered text/action contrast (at
least 4.5:1), surfaces matching both themes, dimmed blurred backdrops, notification
layering, target interactions, popup pauses and viewport bounds. Their screenshots
include light/dark coach and announcement examples.
