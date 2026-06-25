import { expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";

mock.module("../src/editor/storage/hightex-db.ts", () => ({
  HighTexDB: {
    getInstance: () => ({
      documents: { toArray: async () => [] },
      cite: { toArray: async () => [] },
    }),
  },
}));

mock.module("../src/editor/storage/index.ts", () => ({
  Storage: class {
    static instance = null;
  },
}));

mock.module("../src/hooks/use-user", () => ({
  useUser: () => ({ user: false }),
}));

mock.module("../src/context/auth-modal-context", () => ({
  useAuthModal: () => ({ openLogin: () => {} }),
}));

mock.module("../src/hooks/use-online", () => ({
  useOnline: () => true,
}));

import { RemoteDocuments } from "../src/pages/remote";

test("remote dashboard renders login prompt when user is not authenticated", () => {
  const html = renderToString(<RemoteDocuments />);

  expect(html).toContain("Login Required");
  expect(html).toContain("Connect your cloud workspace");
});
