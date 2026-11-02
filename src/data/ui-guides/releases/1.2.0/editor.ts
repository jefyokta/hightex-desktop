export const editorGuides = [
  {
    id: "chapter-navigation",
    revision: 2,
    name: "guide.features.chapters.name",
    summary: "guide.features.chapters.summary",
    scope: "editor",
    steps: [
      {
        id: "chapters",
        title: "guide.steps.chapters.title",
        description: "guide.steps.chapters.description",
        selectors: ['[data-tour="chapter-navigation"]'],
      },
    ],
  },
  {
    id: "editor-writing-basics",
    revision: 2,
    name: "guide.editorGuides.writing.name",
    summary: "guide.editorGuides.writing.summary",
    scope: "editor",
    steps: [
      {
        id: "paragraphs",
        title: "guide.editorGuides.writing.steps.paragraphs.title",
        description: "guide.editorGuides.writing.steps.paragraphs.description",
        selectors: [
          '[data-tour="editor-content"] .tiptap > p',
          '[data-tour="editor-content"] .tiptap',
        ],
        editor: {
          chapter: "normal",
        },
      },
      {
        id: "headings",
        title: "guide.editorGuides.writing.steps.headings.title",
        description: "guide.editorGuides.writing.steps.headings.description",
        selectors: ['[data-tour="editor-headings"]'],
        editor: {
          chapter: "normal",
        },
        example: "guide.editorGuides.writing.steps.headings.example",
      },
    ],
  },
  {
    id: "editor-formatting",
    revision: 2,
    name: "guide.editorGuides.formatting.name",
    summary: "guide.editorGuides.formatting.summary",
    scope: "editor",
    steps: [
      {
        id: "emphasis",
        title: "guide.editorGuides.formatting.steps.emphasis.title",
        description: "guide.editorGuides.formatting.steps.emphasis.description",
        selectors: ['[data-tour="editor-italic"]'],
        editor: {
          chapter: "normal",
        },
      },
      {
        id: "lists",
        title: "guide.editorGuides.formatting.steps.lists.title",
        description: "guide.editorGuides.formatting.steps.lists.description",
        selectors: ['[data-tour="editor-lists"]'],
        editor: {
          chapter: "normal",
        },
      },
    ],
  },
  {
    id: "editor-document-details",
    revision: 1,
    name: "guide.editorGuides.details.name",
    summary: "guide.editorGuides.details.summary",
    scope: "editor",
    steps: [
      {
        id: "metadata",
        title: "guide.editorGuides.details.steps.metadata.title",
        description: "guide.editorGuides.details.steps.metadata.description",
        selectors: ['[data-tour="editor-document-settings"]'],
        editor: {
          sidebar: "setting",
        },
        example: "guide.editorGuides.details.steps.metadata.example",
      },
      {
        id: "keywords",
        title: "guide.editorGuides.details.steps.keywords.title",
        description: "guide.editorGuides.details.steps.keywords.description",
        selectors: [
          '[data-tour="editor-keywords"]',
          '[data-tour="editor-document-settings"]',
        ],
        editor: {
          sidebar: "setting",
          chapter: "abstract",
        },
        example: "guide.editorGuides.details.steps.keywords.example",
      },
    ],
  },
  {
    id: "editor-figures-tables",
    revision: 1,
    name: "guide.editorGuides.figures.name",
    summary: "guide.editorGuides.figures.summary",
    scope: "editor",
    steps: [
      {
        id: "figures",
        title: "guide.editorGuides.figures.steps.figures.title",
        description: "guide.editorGuides.figures.steps.figures.description",
        selectors: ['[data-tour="editor-image"]'],
        editor: {
          chapter: "normal",
        },
        example: "guide.editorGuides.figures.steps.figures.example",
      },
      {
        id: "tables",
        title: "guide.editorGuides.figures.steps.tables.title",
        description: "guide.editorGuides.figures.steps.tables.description",
        selectors: ['[data-tour="editor-table"]'],
        editor: {
          chapter: "normal",
        },
        example: "guide.editorGuides.figures.steps.tables.example",
      },
      {
        id: "grid",
        title: "guide.editorGuides.figures.steps.grid.title",
        description: "guide.editorGuides.figures.steps.grid.description",
        selectors: ['[data-tour="editor-grid"]'],
        editor: {
          chapter: "normal",
        },
      },
    ],
  },
  {
    id: "editor-equations",
    revision: 1,
    name: "guide.editorGuides.equations.name",
    summary: "guide.editorGuides.equations.summary",
    scope: "editor",
    steps: [
      {
        id: "block-math",
        title: "guide.editorGuides.equations.steps.block_math.title",
        description:
          "guide.editorGuides.equations.steps.block_math.description",
        selectors: ['[data-tour="editor-math"]'],
        editor: {
          chapter: "normal",
        },
        example: "guide.editorGuides.equations.steps.block_math.example",
      },
      {
        id: "inline-math",
        title: "guide.editorGuides.equations.steps.inline_math.title",
        description:
          "guide.editorGuides.equations.steps.inline_math.description",
        selectors: [
          '[data-tour="editor-content"] .tiptap > p',
          '[data-tour="editor-content"] .tiptap',
        ],
        editor: {
          chapter: "normal",
        },
        example: "guide.editorGuides.equations.steps.inline_math.example",
      },
    ],
  },
  {
    id: "editor-citations",
    revision: 1,
    name: "guide.editorGuides.citations.name",
    summary: "guide.editorGuides.citations.summary",
    scope: "editor",
    steps: [
      {
        id: "citation-library",
        title: "guide.editorGuides.citations.steps.citation_library.title",
        description:
          "guide.editorGuides.citations.steps.citation_library.description",
        selectors: ['[data-tour="editor-citation-library"]'],
        editor: {
          sidebar: "citation",
        },
      },
      {
        id: "cite-in-text",
        title: "guide.editorGuides.citations.steps.cite_in_text.title",
        description:
          "guide.editorGuides.citations.steps.cite_in_text.description",
        selectors: [
          '[data-tour="editor-content"] .tiptap > p',
          '[data-tour="editor-content"] .tiptap',
        ],
        editor: {
          chapter: "normal",
        },
        example: "guide.editorGuides.citations.steps.cite_in_text.example",
      },
      {
        id: "bibliography",
        title: "guide.editorGuides.citations.steps.bibliography.title",
        description:
          "guide.editorGuides.citations.steps.bibliography.description",
        selectors: ['[data-tour="editor-tab-previewer"]'],
        editor: {
          sidebar: "chapterTree",
        },
      },
    ],
  },
  {
    id: "editor-references-aliases",
    revision: 1,
    name: "guide.editorGuides.referencesAliases.name",
    summary: "guide.editorGuides.referencesAliases.summary",
    scope: "editor",
    steps: [
      {
        id: "object-references",
        title:
          "guide.editorGuides.referencesAliases.steps.object_references.title",
        description:
          "guide.editorGuides.referencesAliases.steps.object_references.description",
        selectors: [
          '[data-tour="editor-content"] .tiptap > p',
          '[data-tour="editor-content"] .tiptap',
        ],
        editor: {
          chapter: "normal",
        },
        example:
          "guide.editorGuides.referencesAliases.steps.object_references.example",
      },
      {
        id: "aliases",
        title: "guide.editorGuides.referencesAliases.steps.aliases.title",
        description:
          "guide.editorGuides.referencesAliases.steps.aliases.description",
        selectors: [
          '[data-tour="editor-content"] .tiptap > p',
          '[data-tour="editor-content"] .tiptap',
        ],
        editor: {
          chapter: "normal",
        },
        example: "guide.editorGuides.referencesAliases.steps.aliases.example",
      },
    ],
  },
  {
    id: "editor-variables",
    revision: 1,
    name: "guide.editorGuides.variables.name",
    summary: "guide.editorGuides.variables.summary",
    scope: "editor",
    steps: [
      {
        id: "manage-variables",
        title: "guide.editorGuides.variables.steps.manage_variables.title",
        description:
          "guide.editorGuides.variables.steps.manage_variables.description",
        selectors: ['[data-tour="editor-variables"]'],
        editor: {
          sidebar: "variabl",
        },
        example: "guide.editorGuides.variables.steps.manage_variables.example",
      },
      {
        id: "insert-variables",
        title: "guide.editorGuides.variables.steps.insert_variables.title",
        description:
          "guide.editorGuides.variables.steps.insert_variables.description",
        selectors: [
          '[data-tour="editor-content"] .tiptap > p',
          '[data-tour="editor-content"] .tiptap',
        ],
        editor: {
          chapter: "normal",
        },
        example: "guide.editorGuides.variables.steps.insert_variables.example",
      },
    ],
  },
  {
    id: "editor-review-save",
    revision: 1,
    name: "guide.editorGuides.reviewSave.name",
    summary: "guide.editorGuides.reviewSave.summary",
    scope: "editor",
    steps: [
      {
        id: "find",
        title: "guide.editorGuides.reviewSave.steps.find.title",
        description: "guide.editorGuides.reviewSave.steps.find.description",
        selectors: ['[data-tour="editor-search"]'],
        editor: {
          chapter: "normal",
        },
      },
      {
        id: "save",
        title: "guide.editorGuides.reviewSave.steps.save.title",
        description: "guide.editorGuides.reviewSave.steps.save.description",
        selectors: ['[data-tour="editor-save"]'],
        editor: {
          chapter: "normal",
        },
      },
      {
        id: "preview",
        title: "guide.editorGuides.reviewSave.steps.preview.title",
        description: "guide.editorGuides.reviewSave.steps.preview.description",
        selectors: ['[data-tour="editor-tab-previewer"]'],
        editor: {
          sidebar: "chapterTree",
        },
      },
      {
        id: "pdf",
        title: "guide.editorGuides.reviewSave.steps.pdf.title",
        description: "guide.editorGuides.reviewSave.steps.pdf.description",
        selectors: ['[data-tour="editor-pdf"]'],
        editor: {
          chapter: "normal",
        },
      },
    ],
  },
  {
    id: "editor-sidebar",
    revision: 1,
    name: "guide.features.chapterTree.name",
    summary: "guide.features.chapterTree.summary",
    scope: "editor",
    steps: [
      {
        id: "chapterTree",
        title: "guide.steps.chapterTree.title",
        description: "guide.steps.chapterTree.description",
        selectors: ['[data-tour="editor-sidebar"]'],
      },
    ],
  },
] satisfies UIGuide[];
