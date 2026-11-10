import { createHash } from "node:crypto";
import { normalizeWorkspaceServer } from "./identity";

export function cloudWorkspace(
  serverUrl: string,
  accountId: string,
  allowedServerUrl?: string,
): WorkspaceProfile {
  serverUrl = normalizeWorkspaceServer(serverUrl);
  if (
    allowedServerUrl &&
    normalizeWorkspaceServer(allowedServerUrl) !== serverUrl
  )
    throw Error("This cloud server is not supported by this build");
  if (!accountId) throw Error("Missing cloud account");
  return {
    id: `cloud-${createHash("sha256")
      .update(JSON.stringify([serverUrl, accountId]))
      .digest("hex")
      .slice(0, 32)}`,
    name: "Profil Cloud",
    type: "cloud",
    serverUrl,
    accountId,
  };
}

export function planWorkspaceMigration(
  documents: HighTexDocument[],
  bindings: CloudBinding[],
  allowedServerUrl?: string,
): WorkspaceMigrationPlan {
  const profiles = new Map<string, WorkspaceProfile>([
    [
      "local",
      {
        id: "local",
        name: "Lokal",
        type: "local",
        serverUrl: null,
        accountId: null,
      },
    ],
  ]);
  const byId = new Map(documents.map((document) => [document.id, document]));
  const assignments: Record<string, string> = Object.create(null);
  const conflicts: WorkspaceMigrationPlan["conflicts"] = [];
  const family = new Map<string, HighTexDocument[]>();
  const brokenRoots = new Set<string>();
  for (const document of documents) {
    const visited: string[] = [];
    let root = document;
    while (
      root.parentId &&
      byId.has(root.parentId) &&
      !visited.includes(root.id)
    ) {
      visited.push(root.id);
      root = byId.get(root.parentId)!;
    }
    if (visited.includes(root.id)) {
      root = byId.get(visited.slice(visited.indexOf(root.id)).sort()[0])!;
      brokenRoots.add(root.id);
    } else if (root.parentId && !byId.has(root.parentId)) {
      brokenRoots.add(root.id);
    }
    family.set(root.id, [...(family.get(root.id) ?? []), document]);
  }
  for (const [rootId, members] of family) {
    const ids = new Set(members.map((document) => document.id));
    const candidates = new Set<string>();
    let invalid = false;
    for (const binding of bindings.filter((binding) =>
      ids.has(binding.localDocumentId),
    )) {
      try {
        const profile = cloudWorkspace(
          binding.serverUrl,
          binding.accountId,
          allowedServerUrl,
        );
        if (!profiles.has(profile.id)) {
          const number = [...profiles.values()].filter(
            (item) => item.type === "cloud",
          ).length + 1;
          profiles.set(profile.id, { ...profile, name: `Cloud ${number}` });
        }
        candidates.add(profile.id);
      } catch {
        invalid = true;
      }
    }
    const target = candidates.size === 1 ? [...candidates][0] : "local";
    const profile = profiles.get(target)!;
    const academicConflict = members.some((document) => {
      if (!document.cloudAcademic) return false;
      try {
        return (
          document.cloudAcademic.accountId !== profile.accountId ||
          normalizeWorkspaceServer(document.cloudAcademic.serverUrl) !==
            profile.serverUrl
        );
      } catch {
        return true;
      }
    });
    const bindingConflict =
      invalid ||
      candidates.size > 1 ||
      (candidates.size > 0 && academicConflict);
    if (bindingConflict || brokenRoots.has(rootId))
      conflicts.push({
        documentId: rootId,
        title: byId.get(rootId)!.title,
        reason: [
          brokenRoots.has(rootId) ? "parent" : "",
          bindingConflict ? "binding" : "",
        ]
          .filter(Boolean)
          .join("-"),
      });
    members.forEach((document) => {
      assignments[document.id] = target;
    });
  }
  return { profiles: [...profiles.values()], assignments, conflicts };
}

export function selectWorkspaceData(
  snapshot: WorkspaceDataSnapshot,
  assignments: Record<string, string>,
  profileId: string,
): WorkspaceDataSnapshot {
  const owned = new Set(
    Object.keys(assignments).filter((id) => assignments[id] === profileId),
  );
  const ids = Object.keys(assignments).sort((a, b) => b.length - a.length);
  const ownerOf = (id: unknown) =>
    typeof id === "string"
      ? ids.find((owner) => id === owner || id.startsWith(`${owner}.`))
      : undefined;
  const referencedImages = new Set<string>();
  const referencedCites = new Set<string>();
  const scanImages = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const node = value as {
      type?: string;
      attrs?: { src?: string; cite?: string };
      content?: unknown[];
    };
    if (node.type === "image" && node.attrs?.src)
      referencedImages.add(node.attrs.src);
    if (node.type === "cite" && node.attrs?.cite)
      node.attrs.cite.split("|").forEach((key) => referencedCites.add(key));
    node.content?.forEach(scanImages);
  };
  (snapshot.tables.chapters ?? [])
    .filter((row) => owned.has(ownerOf(row.id) ?? ""))
    .forEach((row) =>
      (row.content as unknown[] | undefined)?.forEach(scanImages),
    );

  const tables = Object.fromEntries(
    Object.entries(snapshot.tables).map(([table, rows]) => [
      table,
      rows.filter((row) => {
        if (table === "documents") return owned.has(String(row.id));
        if (table === "images" && referencedImages.has(String(row.id)))
          return true;
        if (table === "cite" && referencedCites.has(String(row.key)))
          return true;
        if (
          ["cite", "variables", "documentVariables"].includes(table) &&
          (!row.documentId || row.documentId === "global")
        )
          return true;
        const owner =
          typeof row.documentId === "string" && row.documentId !== "global"
            ? row.documentId
            : ownerOf(row.id);
        return owner && assignments[owner]
          ? owned.has(owner)
          : profileId === "local";
      }),
    ]),
  );
  const localStorage = Object.fromEntries(
    Object.entries(snapshot.localStorage).filter(([key]) => {
      if (!key.startsWith("hightex:forms:v1:")) return profileId === "local";
      const owner = key.slice("hightex:forms:v1:".length);
      return assignments[owner] ? owned.has(owner) : profileId === "local";
    }),
  );
  return { tables, localStorage };
}
