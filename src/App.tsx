import {
  //  HashRouter,
  Routes,
  Route,
  BrowserRouter,
} from "react-router-dom";

import { MainLayout } from "./layouts/main-layout";
import { AppLayout } from "./layouts/app-layout";
import { EditorLayout } from "./layouts/editor-layout";
import { PrintLayout } from "./layouts/print-layout";

import { Splash } from "./pages/splash";
import { Dashboard } from "./pages/local";
import { RemoteDocuments } from "./pages/remote";
import { Citation } from "./pages/citation";
import { Settings } from "./pages/settings";
import { Editor } from "./pages/editor";
import { FullDocument } from "./components/printable";
import { Single } from "./components/printable/single";
//@ts-ignore
import { plugins } from "citation-js";
// import { Print } from "./pages/print";
import xml from "@/assets/locales-id-ID.xml?raw";
import { Present } from "./pages/sharing";
import { SharingLayout } from "./layouts/sharing-layout";
import { SharingGuest } from "./pages/sharing-guest";
import { SharingHost } from "./pages/sharing-host";
const config = plugins.config.get("@csl");
config.locales.add("id-ID", xml);
function App() {
  // console.log(lang)

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Splash />} />
          <Route element={<SharingLayout />}>
            <Route path="/share/:host/:port" element={<SharingGuest />} />
            <Route path="/share/:host/:port/:code" element={<SharingGuest />} />
            <Route path="/shared" element={<SharingHost />} />
          </Route>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/dashboard/projects/cloud"
              element={<RemoteDocuments />}
            />

            <Route path="/dashboard/present" element={<Present />} />
            <Route path="/dashboard/projects/local" element={<Dashboard />} />
            <Route path="/dashboard/citation" element={<Citation />} />
            <Route path="/dashboard/splitter" element={<>comming soon</>} />

            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route element={<EditorLayout />}>
            <Route
              path="/document/:id/:chapter?/:version?"
              element={<Editor />}
            />
          </Route>
        </Route>
        <Route element={<PrintLayout />}>
          <Route path="/document/:id/print" element={<FullDocument />} />
          <Route path="/print/:chapterId" element={<Single />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
