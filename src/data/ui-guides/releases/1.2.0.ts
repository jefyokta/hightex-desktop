import { editorGuides } from "./1.2.0/editor";

const documents: GuideStep = {
  id: "documents",
  title: "guide.steps.documents.title",
  description: "guide.steps.documents.description",
  selectors: ['[data-tour="document-create"]'],
  route: "/dashboard",
};
const organize: GuideStep = {
  id: "organize",
  title: "guide.steps.organize.title",
  description: "guide.steps.organize.description",
  selectors: [
    '[data-tour="document-filters"]',
    '[data-tour="document-create"]',
  ],
  fallbackDescription: "guide.empty_organize",
  route: "/dashboard",
};
const references: GuideStep = {
  id: "references",
  title: "guide.steps.references.title",
  description: "guide.steps.references.description",
  selectors: ['[data-tour="reference-add"]'],
  route: "/dashboard/citation",
};
const exports: GuideStep = {
  id: "exports",
  title: "guide.steps.exports.title",
  description: "guide.steps.exports.description",
  selectors: [
    '[data-tour="document-actions"]',
    '[data-tour="document-create"]',
  ],
  fallbackDescription: "guide.empty_exports",
  route: "/dashboard",
};

export default {
  version: "1.2.0",
  guides: [
    {
      id: "documents",
      revision: 1,
      name: "guide.features.documents.name",
      summary: "guide.features.documents.summary",
      scope: "workspace",
      steps: [documents],
    },
    {
      id: "document-filters",
      revision: 1,
      name: "guide.features.organize.name",
      summary: "guide.features.organize.summary",
      scope: "workspace",
      steps: [organize],
    },
    {
      id: "references",
      revision: 1,
      name: "guide.features.references.name",
      summary: "guide.features.references.summary",
      scope: "workspace",
      steps: [references],
    },
    {
      id: "document-exports",
      revision: 1,
      name: "guide.features.exports.name",
      summary: "guide.features.exports.summary",
      scope: "workspace",
      steps: [exports],
    },
    ...editorGuides,
  ],
} satisfies GuideRelease;
