const workspacesRoute = "/workspaces";
const profileRoute = "/profile";
const cvRoute = "/profile/cv";
const formsRoute = "/dashboard/forms";
const formsFallback = ["#forms-document", '[data-tour="forms-empty"]'];

export default {
  version: "1.4.0",
  guides: [
    {
      id: "workspace-management",
      revision: 1,
      name: "guide.release140.workspace.name",
      summary: "guide.release140.workspace.summary",
      scope: "workspace",
      steps: [
        {
          id: "workspace-list",
          title: "guide.release140.workspace.list.title",
          description: "guide.release140.workspace.list.description",
          selectors: ["[data-workspace-profiles]"],
          route: workspacesRoute,
        },
        {
          id: "workspace-create",
          title: "guide.release140.workspace.create.title",
          description: "guide.release140.workspace.create.description",
          selectors: ['[data-tour="workspace-create"]'],
          route: workspacesRoute,
        },
        {
          id: "workspace-author-profile",
          title: "guide.release140.workspace.profile.title",
          description: "guide.release140.workspace.profile.description",
          selectors: ["[data-profile-cv-link]"],
          route: profileRoute,
        },
        {
          id: "workspace-cv",
          title: "guide.release140.workspace.cv.title",
          description: "guide.release140.workspace.cv.description",
          selectors: ['[data-tour="workspace-cv-editor"]'],
          route: cvRoute,
        },
      ],
    },
    {
      id: "shared-form-data",
      revision: 1,
      name: "guide.release140.forms.name",
      summary: "guide.release140.forms.summary",
      scope: "workspace",
      steps: [
        {
          id: "forms-stage",
          title: "guide.release140.forms.stage.title",
          description: "guide.release140.forms.stage.description",
          selectors: ['[data-tour="forms-stage"]', ...formsFallback],
          fallbackDescription: "guide.release140.forms.empty",
          route: formsRoute,
        },
        {
          id: "forms-shared-values",
          title: "guide.release140.forms.values.title",
          description: "guide.release140.forms.values.description",
          selectors: ['[data-tour="forms-inputs"]', ...formsFallback],
          fallbackDescription: "guide.release140.forms.empty",
          advanceWhen: '[data-tour="forms-inputs"]',
          waitingDescription: "guide.release140.forms.select_document",
          route: formsRoute,
        },
        {
          id: "forms-validation",
          title: "guide.release140.forms.validation.title",
          description: "guide.release140.forms.validation.description",
          selectors: ["[data-form-data-review]", ...formsFallback],
          fallbackDescription: "guide.release140.forms.empty",
          route: formsRoute,
        },
      ],
    },
    {
      id: "branch-comparison",
      revision: 1,
      name: "guide.release140.branch.name",
      summary: "guide.release140.branch.summary",
      scope: "editor",
      steps: [
        {
          id: "branch-manager",
          title: "guide.release140.branch.manager.title",
          description: "guide.release140.branch.manager.description",
          selectors: ['[data-tour="branch-manager-trigger"]'],
          advanceWhen: '[data-tour="branch-manager-dialog"]',
          waitingDescription: "guide.release140.branch.open_manager",
        },
        {
          id: "branch-create",
          title: "guide.release140.branch.create.title",
          description: "guide.release140.branch.create.description",
          selectors: ['[data-tour="branch-create"]'],
        },
        {
          id: "branch-compare",
          title: "guide.release140.branch.compare.title",
          description: "guide.release140.branch.compare.description",
          selectors: [
            '[data-tour="branch-compare-action"]',
            '[data-tour="branch-create"]',
            '[data-tour="branch-manager-trigger"]',
          ],
          fallbackDescription: "guide.release140.branch.compare_fallback",
          advanceWhen: '[data-tour="branch-comparison-dialog"]',
          waitingDescription: "guide.release140.branch.open_comparison",
        },
        {
          id: "branch-navigation",
          title: "guide.release140.branch.navigation.title",
          description: "guide.release140.branch.navigation.description",
          selectors: [
            "[data-comparison-navigation]",
            '[data-tour="branch-comparison-dialog"]',
          ],
          fallbackDescription: "guide.release140.branch.no_changes",
        },
        {
          id: "branch-content",
          title: "guide.release140.branch.content.title",
          description: "guide.release140.branch.content.description",
          selectors: [
            "[data-comparison-entry]",
            '[data-tour="branch-comparison-dialog"]',
          ],
          fallbackDescription: "guide.release140.branch.no_changes",
        },
      ],
    },
  ],
} satisfies GuideRelease;