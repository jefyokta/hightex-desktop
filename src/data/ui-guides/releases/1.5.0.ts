export default {
  version: "1.5.0",
  guides: [
    {
      id: "experimental-editor-pagination",
      revision: 1,
      name: "guide.release150.pagination.name",
      summary: "guide.release150.pagination.summary",
      scope: "editor",
      steps: [
        {
          id: "pagination-settings",
          title: "guide.release150.pagination.settings.title",
          description: "guide.release150.pagination.settings.description",
          selectors: ['[data-tour="editor-settings-trigger"]'],
          editor: { chapter: "normal" },
        },
        {
          id: "pagination-opt-in",
          title: "guide.release150.pagination.opt_in.title",
          description: "guide.release150.pagination.opt_in.description",
          selectors: [
            '[data-tour="editor-pagination-setting"]',
            '[data-tour="editor-settings-trigger"]',
          ],
          fallbackDescription: "guide.release150.pagination.opt_in.fallback",
        },
        {
          id: "pagination-feedback",
          title: "guide.release150.pagination.feedback.title",
          description: "guide.release150.pagination.feedback.description",
          selectors: [
            "[data-pagination-status]",
            '[data-tour="editor-pagination-setting"]',
            '[data-tour="editor-settings-trigger"]',
          ],
          fallbackDescription: "guide.release150.pagination.feedback.fallback",
        },
      ],
    },
  ],
} satisfies GuideRelease;
