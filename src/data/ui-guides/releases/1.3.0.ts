const formsRoute = "/dashboard/forms";
const profileRoute = "/profile";
const formsFallback = [
  "#forms-document:not(:disabled)",
  '[data-tour="forms-empty"]',
];

export default {
  version: "1.3.0",
  guides: [
    {
      id: "form-generation",
      welcomeOrder: 1,
      revision: 2,
      name: "guide.release130.forms.name",
      summary: "guide.release130.forms.summary",
      scope: "workspace",
      steps: [
        {
          id: "forms-stage",
          title: "guide.release130.forms.stage.title",
          description: "guide.release130.forms.stage.description",
          selectors: ['[data-tour="forms-stage"]', ...formsFallback],
          fallbackDescription: "guide.release130.forms.empty",
          route: formsRoute,
        },
        {
          id: "forms-data",
          title: "guide.release130.forms.data.title",
          description: "guide.release130.forms.data.description",
          selectors: ['[data-tour="forms-inputs"]', ...formsFallback],
          route: formsRoute,
        },
        {
          id: "forms-document",
          title: "guide.release130.forms.document.title",
          description: "guide.release130.forms.document.description",
          selectors: formsFallback,
          fallbackDescription: "guide.release130.forms.empty",
          route: formsRoute,
          advanceWhen: '[data-tour="forms-workspace"]',
          waitingDescription: "guide.release130.forms.select_first",
        },
        {
          id: "forms-selection",
          title: "guide.release130.forms.selection.title",
          description: "guide.release130.forms.selection.description",
          selectors: ['[data-tour="forms-selection"]', ...formsFallback],
          fallbackDescription: "guide.release130.forms.empty",
          route: formsRoute,
        },
        {
          id: "forms-preview",
          title: "guide.release130.forms.preview.title",
          description: "guide.release130.forms.preview.description",
          selectors: ['[data-tour="forms-preview"]', ...formsFallback],
          fallbackDescription: "guide.release130.forms.empty",
          route: formsRoute,
        },
        {
          id: "forms-export",
          title: "guide.release130.forms.export.title",
          description: "guide.release130.forms.export.description",
          selectors: ['[data-tour="forms-export"]', ...formsFallback],
          fallbackDescription: "guide.release130.forms.empty",
          route: formsRoute,
        },
      ],
    },
    {
      id: "lecturer-directory",
      welcomeOrder: 0,
      revision: 4,
      name: "guide.release130.lecturers.name",
      summary: "guide.release130.lecturers.summary",
      scope: "workspace",
      workspaceType: "local",
      steps: [
        {
          id: "profile-identity",
          title: "guide.release130.lecturers.identity.title",
          description: "guide.release130.lecturers.identity.description",
          selectors: ['[data-tour="default-profile-identity"]'],
          route: profileRoute,
        },
        {
          id: "profile-advisors",
          title: "guide.release130.lecturers.advisors.title",
          description: "guide.release130.lecturers.advisors.description",
          selectors: [
            '[data-tour="profile-advisors"] [role="combobox"]',
            '[data-tour="default-profile"] [data-slot="card-header"]',
          ],
          route: profileRoute,
        },
        {
          id: "lecturer-manage",
          title: "guide.release130.lecturers.manage.title",
          description: "guide.release130.lecturers.manage.description",
          selectors: ["[data-lecturer-directory-status]"],
          route: profileRoute,
        },
        {
          id: "profile-committee",
          title: "guide.release130.lecturers.committee.title",
          description: "guide.release130.lecturers.committee.description",
          selectors: [
            '[data-tour="profile-committee"] [data-slot="collapsible-trigger"]',
          ],
          route: profileRoute,
        },
        {
          id: "default-profile-save",
          title: "guide.release130.lecturers.save.title",
          description: "guide.release130.lecturers.save.description",
          selectors: ['[data-tour="default-profile-save"]'],
          route: profileRoute,
        },
      ],
    },
    {
      id: "document-author-profile",
      revision: 3,
      name: "guide.release130.documentProfile.name",
      summary: "guide.release130.documentProfile.summary",
      scope: "editor",
      steps: [
        {
          id: "document-profile",
          title: "guide.release130.documentProfile.profile.title",
          description: "guide.release130.documentProfile.profile.description",
          selectors: [
            '[data-tour="document-profile"] [data-slot="card-header"]',
          ],
          editor: { sidebar: "setting" },
        },
        {
          id: "document-profile-source",
          title: "guide.release130.documentProfile.source.title",
          description: "guide.release130.documentProfile.source.description",
          selectors: ['[data-tour="document-profile-source"]'],
          editor: { sidebar: "setting" },
        },
        {
          id: "document-profile-save",
          title: "guide.release130.documentProfile.save.title",
          description: "guide.release130.documentProfile.save.description",
          selectors: ['[data-tour="document-settings-save"]'],
          editor: { sidebar: "setting" },
        },
      ],
    },
  ],
} satisfies GuideRelease;
