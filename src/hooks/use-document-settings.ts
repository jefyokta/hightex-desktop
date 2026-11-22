import { useCallback, useEffect, useState } from "react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { documentDrafts } from "@/editor/document-drafts";
import { Manager } from "@/editor/manager";
import { refreshCloudAcademic } from "@/cloud/academic-data";
import {
  getWorkspaceAuthorProfile,
  invalidateWorkspaceAuthorProfile,
  resolveAuthorProfile,
} from "@/utils/document-profile";

export type DocumentSettingsPatch = Partial<Pick<HighTexDocument, "title" | "altTitle">>;

interface SettingsDraft {
  document: HighTexDocument;
  original: HighTexDocument;
}

/** Own settings drafts and subscriptions; views never write document records directly. */
export function useDocumentSettings(documentId?: string) {
  const db = HighTexDB.getInstance();
  const [draft, setDraft] = useState<SettingsDraft>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [academic, setAcademic] = useState<Awaited<ReturnType<typeof refreshCloudAcademic>>>({ locked: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    let mounted = true;
    let profileRevision = 0;

    const load = async () => {
      const status = await refreshCloudAcademic(documentId);
      const stored = await db.documents.get(documentId);
      if (!stored || !mounted) return;
      const available = await window.hightex.categories();
      if (!mounted) return;
      const profile = await getWorkspaceAuthorProfile();
      if (!mounted) return;
      const document: HighTexDocument = {
        ...stored,
        authorProfileMode: "workspace",
        profile: resolveAuthorProfile(stored, profile),
      };
      setCategories(available);
      setAcademic(status);
      setDraft({ document, original: document });
    };

    const refreshProfile = () => {
      const revision = ++profileRevision;
      // The settings listener can run before the profile owner's cache listener.
      invalidateWorkspaceAuthorProfile();
      void getWorkspaceAuthorProfile().then(profile => {
        if (!mounted || revision !== profileRevision) return;
        setDraft(current => {
          if (!current || current.document.id !== documentId) return current;
          return {
            document: { ...current.document, profile: resolveAuthorProfile(current.document, profile) },
            original: { ...current.original, profile: resolveAuthorProfile(current.original, profile) },
          };
        });
      }).catch(error => console.error("Could not refresh workspace profile", error));
    };

    void load();
    const offProfile = window.profile.onChange?.(refreshProfile);
    const offSession = window.session.onChange?.(refreshProfile);
    const offCategories = window.hightex.onCategoriesChanged?.(() => {
      void window.hightex.categories().then(categories => {
        if (mounted) setCategories(categories);
      }).catch(error => console.error("Could not reload categories", error));
    });

    return () => {
      mounted = false;
      offProfile?.();
      offSession?.();
      offCategories?.();
    };
  }, [db, documentId]);

  const document = draft && draft.document.id === documentId ? draft.document : undefined;
  const dirty = Boolean(document && JSON.stringify(document) !== JSON.stringify(draft?.original));

  const persistDraft = useCallback(async () => {
    if (!document) return;
    const saved = await db.transaction("rw", db.documents, async () => {
      const current = await db.documents.get(document.id);
      return db.updateDocument({ ...document, keywords: current?.keywords ?? document.keywords, authorProfileMode: "workspace" });
    });
    const profile = await getWorkspaceAuthorProfile();
    const resolved: HighTexDocument = {
      ...saved, authorProfileMode: "workspace", profile: resolveAuthorProfile(saved, profile),
    };
    setDraft(current => {
      if (!current || current.document.id !== document.id) return current;
      return {
        // A completed save accepts its own snapshot, not edits made while it was writing.
        document: current.document === document ? resolved : current.document,
        original: resolved,
      };
    });
  }, [db, document]);

  useEffect(() => {
    if (!document || !dirty) return;
    const pending = { document, commit: persistDraft };
    documentDrafts.set(document.id, pending);
    Manager.app.dispatch("document:draft-changed", { documentId: document.id, pending: true });
    return () => {
      if (documentDrafts.get(document.id) !== pending) return;
      documentDrafts.delete(document.id);
      Manager.app.dispatch("document:draft-changed", { documentId: document.id, pending: false });
    };
  }, [document, dirty, persistDraft]);

  const save = async () => {
    setSaving(true);
    try {
      await persistDraft();
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: DocumentSettingsPatch) => {
    setDraft(current => current && { ...current, document: { ...current.document, ...patch } });
  };

  const updateConfig = (patch: Partial<HighTexConfig>) => {
    setDraft(current => current && {
      ...current,
      document: { ...current.document, config: { ...current.document.config, ...patch } },
    });
  };

  const selectCategory = (category: string) => {
    const selected = categories.find(item => String(item.id) === category);
    setDraft(current => current && {
      ...current,
      document: {
        ...current.document,
        category,
        config: {
          ...current.document.config,
          intern: selected?.variant === "intern"
            ? current.document.config.intern ?? {}
            : current.document.config.intern,
        },
      },
    });
  };

  const selectedCategory = categories.find(category => String(category.id) === document?.category);
  const isIntern = selectedCategory?.variant === "intern" || Boolean(document?.config.intern);

  return { document, categories, academic, dirty, saving, isIntern, save, update, updateConfig, selectCategory };
}
