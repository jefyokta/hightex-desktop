# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]



### ✨ Features


- **editor:** Keyword creation directly in editor and placeholder

- **editor:** Add .ht option in download button at editor page

- Add feedback in every action

- **dev:** Type for translator key

- **ui:** Enhance pdf export progress bar and success toast

- **ui:** Add contributors list



### 🐛 Bug Fixes


- **editor:** Fix creating table from navbar button generate error

- **sheet:** Update intern sheets

- **types:** Add missing openPath and showInFolder to FileApi

- Replace hardcoded error/toast strings with translation keys



### 🔄 Updates


- **page:** Page margin updated from 3-3-4-4 to 3-3-4-3

- **Breaking:** **file:** Snapshot file extension updated from htx to hts



## [0.6.1] - 2026-09-18



### ✨ Features


- **editor:** Auto fix for deprecated nodes



### 🐛 Bug Fixes


- H4 now has no indent and margine left



### 🔧 Miscellaneous


- Release 0.6.1



## [0.6.0] - 2026-09-17



### ✨ Features


- Auto dotted name ex: jepi okta mipa -> jepi okta mipa.

- Givin feedback after copying any refs

- **editor:** Implement find and replace feature

- #19 add second advisor option

- **artifact:** Now artifact save categories backup #30

- **editor:** Equation ref

- **paginated:** Equation and attachment ref added

- **core:** Save tiptap content error #34



### 🐛 Bug Fixes


- Showing all variables when only '\' typed

- Scroll on zotero modal

- Add tooltips for find and replace, register extension to chapter, and add navbar button

- **#21:** Unhardcode kaprodi dan dekan

- Handle optional advisor profile and remove fallback signatories

- Restore default fallback signatories in validity and consent sheets

- Decrase margin between nested lists and fix rowspanned table header border-bottom

- Decrase margin between nested lists and fix rowspanned table header border-bottom

- **paginated:** Fix unconsistent styiling between editor and final document

- Fix paginated unrowspaned cell and vertical borders

- Cell in first row in table of figure table now automatically convert to table heade

- **paginate:** Typo DAFTAR ISI -> DAFTAR PUSTAKA

- Validity layout fixed

- Unloaded katex css is fixed



### 🔄 Updates


- Add option to show editor's scrollbar

- Lang support almost complete

- Scrollbar's color is depend on application mode

- Grid node removed, use standalone table instead

- Math block now available in navbar

- Add scrollbar into sidebar tab

- **paginated:** Every cells in row should be a th to be a header row



## [0.5.1] - 2026-09-13



### 🔧 Miscellaneous


- Chore():release v0.5.1



## [0.5.0] - 2026-09-13



### ✨ Features


- **lang:** Partially support



### 🐛 Bug Fixes


- **intern-doc:** Presentation sheet not included anymore



## [0.4.1] - 2026-08-16



### 🐛 Bug Fixes


- Model names is changed when its built, so we cant use grammar based on its contructor name

- Including category when updating document data



### 🔧 Miscellaneous


- Release 0.4.1



## [0.4.0] - 2026-08-11



## [0.3.6] - 2026-07-15



## [0.3.5] - 2026-07-15



## [0.3.4] - 2026-07-15



### ✨ Features


- Add keyboard shorcut for chapter navigating



### 🐛 Bug Fixes


- Remove blank pages that broke the pages measurenment in splitter feature

- Prevent unexpected blank pages during PDF generation

- Chapter heading automatically update when it's scheme updated



### 🔄 Updates


- Support intern report



## [0.3.3] - 2026-07-10



### ✨ Features


- Add progress text in splitter progress

- Add forms page as placeholder for next update



### 🐛 Bug Fixes


- Typo text status  while splitter running

- Split document now splitting correctly



## [0.3.2] - 2026-07-08



### 🐛 Bug Fixes


- Variable value didnt updated immediately in editor when updating variable

- Enchant error message in splitter job



## [0.3.1] - 2026-07-08



## [0.3.0] - 2026-07-08



### ✨ Features


- Add watermarked pdf option

- Split feature for uploading to repository



### 🐛 Bug Fixes


- Fixtables running when table extenstion is not registered to chapter editor

- Correct typo in override local features error message



### 🔄 Updates


- Nim/nip using identity_number instead of splitted email

- Add decorator and sending error to renderer



## [0.2.0] - 2026-07-05



### ✨ Features


- Add fix table option

- Add cli stripped utilites

- Add title and highligt in editor toolbar



### 🔧 Miscellaneous


- Update changelog



## [0.1.0] - 2026-07-03



### ✨ Features


- Variable in editor

- Create custom variables



### 🐛 Bug Fixes


- Import document depends on it version

- Throwing error when inputing static varname instead of returning it



## [0.0.14] - 2026-07-02



## [0.0.11] - 2026-07-01



### 🐛 Bug Fixes


- Catch error on application started due to no network connection

- Protocol not spawned in cli mode



## [0.0.12] - 2026-07-02



### 🐛 Bug Fixes


- Report message, and silent pdf generation error



## [0.0.10] - 2026-06-28



## [0.0.9-beta] - 2026-06-28



## [0.0.9] - 2026-06-28



## [0.0.8] - 2026-06-28



## [0.0.7] - 2026-06-28



## [0.0.6] - 2026-06-28



### ✨ Features


- Add image convertion while importing



## [0.0.5] - 2026-06-26



## [0.0.4] - 2026-06-26



## [0.0.3] - 2026-06-26



### 🐛 Bug Fixes


- Logout modal



## [0.0.2] - 2026-06-26



## [0.0.1] - 2026-06-25



## [0.0.6-beta] - 2026-06-25



## [0.0.5-beta] - 2026-06-25



## [0.0.4-beta] - 2026-06-25



## [0.0.3-beta] - 2026-06-25



## [0.0.1-beta] - 2026-06-25



### #feat


- Grid, a table outside figure



### Image


- Move to webp



### Rename


- Where builder to query builder



### ✨ Features


- Static chapter builder added

- Wip variable



### 🐛 Bug Fixes


- Images in attachment



### 🔄 Updates


- No more attachment in pdf file



