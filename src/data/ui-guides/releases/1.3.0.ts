const formsRoute = "/dashboard/forms";
const profileRoute = "/settings";
const formsFallback = ["#forms-document", '[data-tour="forms-empty"]'];

export default {
  version: "1.3.0",
  guides: [
    {
      id: "form-generation",
      revision: 1,
      name: "guide.release130.forms.name",
      summary: "guide.release130.forms.summary",
      scope: "workspace",
      steps: [
        {
          id: "forms-document",
          title: "guide.release130.forms.document.title",
          description: "guide.release130.forms.document.description",
          selectors: formsFallback,
          fallbackDescription: "guide.release130.forms.empty",
          route: formsRoute,
        },
        {
          id: "forms-stage",
          title: "guide.release130.forms.stage.title",
          description: "guide.release130.forms.stage.description",
          selectors: ['[data-tour="forms-stage"]', ...formsFallback],
          fallbackDescription: "guide.release130.forms.empty",
          route: formsRoute,
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
          id: "forms-data",
          title: "guide.release130.forms.data.title",
          description: "guide.release130.forms.data.description",
          selectors: ['[data-tour="forms-inputs"]', ...formsFallback],
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
      revision: 1,
      name: "guide.release130.lecturers.name",
      summary: "guide.release130.lecturers.summary",
      scope: "workspace",
      steps: [
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
          id: "lecturer-refresh",
          title: "guide.release130.lecturers.refresh.title",
          description: "guide.release130.lecturers.refresh.description",
          selectors: ["[data-lecturer-directory-status]"],
          route: profileRoute,
        },
        {
          id: "profile-committee",
          title: "guide.release130.lecturers.committee.title",
          description: "guide.release130.lecturers.committee.description",
          selectors: ['[data-tour="profile-committee"] > summary'],
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
      revision: 1,
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
          id: "document-profile-default",
          title: "guide.release130.documentProfile.defaults.title",
          description: "guide.release130.documentProfile.defaults.description",
          selectors: [
            '[data-tour="document-profile-default"]',
            '[data-tour="document-profile"] [data-slot="card-header"]',
          ],
          fallbackDescription: "guide.release130.documentProfile.locked",
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
