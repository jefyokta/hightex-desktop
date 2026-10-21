// Opt-in: bun run tests/integration/local-server.ts. Never prints credentials.
import { SubmissionClient } from "../../electron/service/submission-client";
import { readSnapshot } from "../../src/review/snapshot-reader";
import { syncScenario } from "./sync-scenario";
import { submissionScenario } from "./submission-scenario";
import { academicScenario } from "./academic-scenario";
import { accountScenario } from "./account-scenario";
import { advisorScenario } from "./advisor-scenario";

const base = "http://127.0.0.1:8000/api/";
// Public local demo accounts; independent of the context file.
const demoAccounts = [
  {
    role: "student",
    email: "12250314612@students.uin-suska.ac.id",
    password: "jepiokta123",
  },
  {
    role: "advisor",
    email: "pakteng@gmail.com",
    password: "teungku123",
  },
];

const knownDocuments: { studentId: string; documentId: string }[] = [];
for (const { role, email, password } of demoAccounts) {
  const login = await fetch(`${base}login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`${role} login HTTP ${login.status}`);
  const { data } = (await login.json()) as {
    data: { token: string; user: { id: number } };
  };
  let active = true;
  const transport = {
    session: () =>
      active
        ? {
            serverUrl: base,
            accountId: String(data.user.id),
            token: data.token,
          }
        : null,
    request: async (endpoint: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${data.token}`);
      headers.set("Accept", "application/json");
      const response = await fetch(`${base}${endpoint.replace(/^\//, "")}`, {
        ...options,
        headers,
      });
      const binary = /application\/(x-hightex|octet-stream)/.test(
        response.headers.get("Content-Type") ?? "",
      );
      return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        data: binary
          ? new Uint8Array(await response.arrayBuffer())
          : response.status === 204
            ? {}
            : ((await response.json()) as unknown),
      };
    },
  };
  try {
    const client = new SubmissionClient(transport);
    const list = await client.list();
    if (!list.ok)
      throw new Error(
        `${role} list: ${list.error.code} HTTP ${list.error.status}`,
      );
    console.log(
      JSON.stringify({
        role,
        audience: list.data.audience,
        submissions: list.data.items.length,
      }),
    );
    if (role === "student") {
      for (const item of list.data.items) {
        if (
          item.ownerId &&
          !knownDocuments.some((doc) => doc.documentId === item.documentId)
        )
          knownDocuments.push({
            studentId: item.ownerId,
            documentId: item.documentId,
          });
      }
    }
    for (const item of list.data.items) {
      const result = await client.file({
        sessionId: list.data.session.sessionId,
        documentId: item.documentId,
        submissionId: item.id,
      });
      if (!result.ok) {
        console.log(
          JSON.stringify({
            role,
            snapshot: result.error.code,
            http: result.error.status,
          }),
        );
        continue;
      }
      const model = await readSnapshot(result.data.file, {
        kind: "submission",
        session: result.data.session,
        documentId: result.data.documentId,
        submissionId: result.data.submissionId,
        sha256: result.data.sha256,
      });
      console.log(
        JSON.stringify({
          role,
          snapshot: "verified",
          chapters: model.chapters.length,
          authorRecorded: Boolean(model.document.profile?.name),
        }),
      );
    }
    const missing = await client.file({
      sessionId: list.data.session.sessionId,
      documentId: "missing",
      submissionId: "999999999",
    });
    console.log(
      JSON.stringify({
        role,
        inaccessibleSnapshot: missing.ok
          ? "unexpected_success"
          : missing.error.code,
      }),
    );
    const commits = await transport.request("v2/documents/commits");
    console.log(
      JSON.stringify({
        role,
        commitsHTTP: commits.status,
        commits: (commits.data as { commits?: unknown[] }).commits?.length ?? 0,
      }),
    );
    if (role === "student" && process.argv.includes("--sync"))
      await syncScenario(transport);
    if (role === "student" && process.argv.includes("--submit"))
      await submissionScenario(transport);
    if (role === "student" && process.argv.includes("--academic"))
      await academicScenario(transport);
    if (role === "student" && process.argv.includes("--account"))
      await accountScenario(transport, client);
    if (role === "advisor" && process.argv.includes("--advisor"))
      await advisorScenario(transport, client, knownDocuments);
    active = false;
    const loggedOut = await client.list();
    if (loggedOut.ok || loggedOut.error.code !== "not_authenticated")
      throw new Error("Logout isolation failed");
  } finally {
    const logout = await fetch(`${base}logout`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${data.token}`,
        Accept: "application/json",
      },
    });
    console.log(JSON.stringify({ role, demoTokenLogoutHTTP: logout.status }));
  }
}
