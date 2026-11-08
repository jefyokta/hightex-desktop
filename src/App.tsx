import {
  //  HashRouter,
  Routes,
  Route,
  BrowserRouter,
  Navigate,
  useNavigate,
  useLocation,
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Outlet,
} from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { MainLayout } from "./layouts/main-layout";
import { AppLayout } from "./layouts/app-layout";
import { EditorLayout } from "./layouts/editor-layout";
import { PrintLayout } from "./layouts/print-layout";

import { Splash } from "./pages/splash";
import { Dashboard } from "./pages/local";
import { RemoteDocuments } from "./pages/remote";
import { Citation } from "./pages/citation";
import { Settings } from "./pages/settings";
import { Profile } from "./pages/profile";
import { ProfileCV } from "./pages/profile-cv";
import { Lecturers } from "./pages/lecturers";
import { Editor } from "./pages/editor";
import { FullDocument } from "./components/printable";
import { Single } from "./components/printable/single";
//@ts-expect-error citation-js does not ship a clean typed config entry here
import { plugins } from "citation-js";
// import { Print } from "./pages/print";
import xml from "@/assets/locales-id-ID.xml?raw";
import { Present } from "./pages/sharing";
import { SharingLayout } from "./layouts/sharing-layout";
import { SharingGuest } from "./pages/sharing-guest";
import { SharingHost } from "./pages/sharing-host";
import { Snapshot } from "./pages/snapshot";
import { SnapshotViewer } from "./pages/snapshot-viewer";
import { Splitter } from "./pages/splitter";
import { Forms } from "./pages/forms";
import { FormsPrint } from "./pages/forms-print";
import { Submission } from "./pages/submission";
import { Review } from "./pages/review";
import { SubmissionPrint } from "./pages/submission-print";
import { WorkspaceMigrationPage } from "./pages/workspace-migration";
import { Workspaces } from "./pages/workspaces";
import { isEditorDocumentPath } from "./workspaces/editor-navigation";
const config = plugins.config.get("@csl");
config.locales.add("id-ID", xml);

function MainWindowNavigation() {
  const navigate = useNavigate();

  useEffect(
    () =>
      window.application?.onNavigate((route) => {
        if (route === "/profile") navigate(route);
      }),
    [navigate],
  );

  return null;
}

function EditorWindowRoutes({ documentId }: { documentId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const lastEditorLocation = useRef({
    ...location,
    pathname: `/document/${encodeURIComponent(documentId)}`,
    search: "",
    hash: "",
  });
  const allowed = isEditorDocumentPath(location.pathname, documentId);
  if (allowed) lastEditorLocation.current = location;

  useLayoutEffect(() => {
    if (!allowed) navigate(lastEditorLocation.current, { replace: true });
  }, [allowed, navigate]);

  // Keep the mounted editor and its draft when another page is requested.
  return (
    <Routes location={lastEditorLocation.current}>
      <Route element={<MainLayout />}>
        <Route element={<EditorLayout />}>
          <Route
            path="/document/:id/:chapter?/:version?"
            element={<Editor />}
          />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  const editorDocumentId = window.application?.editorDocumentId;
  if (editorDocumentId)
    return (
      <BrowserRouter>
        <EditorWindowRoutes documentId={editorDocumentId} />
      </BrowserRouter>
    );
  return <MainApplication />;
}

function MainWindowRoot() {
  return (
    <>
      <MainWindowNavigation />
      <Outlet />
    </>
  );
}

function MainApplication() {
  const [router] = useState(() =>
    createBrowserRouter(
      createRoutesFromElements(
        <Route element={<MainWindowRoot />}>
          <Route
            path="/profiles/migration"
            element={<WorkspaceMigrationPage />}
          />
          <Route
            path="/profiles/migration/target"
            element={<WorkspaceMigrationPage target />}
          />
          <Route path="/forms/print" element={<FormsPrint />} />
          <Route path="/submission/print/:id" element={<SubmissionPrint />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<Splash />} />
            <Route element={<SharingLayout />}>
              <Route path="/share/:host/:port" element={<SharingGuest />} />
              <Route
                path="/share/:host/:port/:code"
                element={<SharingGuest />}
              />
              <Route path="/shared" element={<SharingHost />} />
            </Route>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route
                path="/dashboard/projects/cloud"
                element={<RemoteDocuments />}
              />
              <Route path="/dashboard/submissions" element={<Submission />} />
              <Route
                path="/dashboard/submissions/:documentId/:submissionId"
                element={<Review />}
              />

              <Route path="/dashboard/present" element={<Present />} />
              <Route path="/dashboard/projects/local" element={<Dashboard />} />
              <Route path="/dashboard/citation" element={<Citation />} />
              <Route path="/dashboard/splitter" element={<Splitter />} />
              <Route path="/dashboard/snapshots" element={<Snapshot />} />
              <Route path="/dashboard/forms" element={<Forms />} />
              <Route path="/dashboard/lecturers" element={<Lecturers />} />
              <Route
                path="/dashboard/cloud/cv"
                element={<Navigate to="/profile/cv" replace />}
              />

              <Route path="/settings" element={<Settings />} />
              <Route path="/workspaces" element={<Workspaces />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/cv" element={<ProfileCV />} />
              <Route
                path="/dashboard/snapshots/:id"
                element={<SnapshotViewer />}
              ></Route>
            </Route>
            <Route element={<EditorLayout />}>
              <Route
                path="/document/:id/:chapter?/:version?"
                element={<Editor />}
              />
            </Route>
          </Route>
          <Route element={<PrintLayout />}>
            <Route
              path="/document/:id/print/:waterMark?"
              element={<FullDocument />}
            />
            <Route path="/print/:chapterId" element={<Single />} />
          </Route>
        </Route>,
      ),
    ),
  );
  return <RouterProvider router={router} />;
}

export default App;
