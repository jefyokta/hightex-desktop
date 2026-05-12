import "./App.css";
import { Routes, Route, HashRouter } from "react-router-dom";
import { Splash } from "./pages/splash";
import { Dashboard } from "./pages/local";
import { Editor } from "./pages/editor";
import { AppLayout } from "./layouts/app-layout";
import { RemoteDocuments } from "./pages/remote";
import { AuthModalProvider } from "./context/auth-modal-context";
import { LoginModal } from "./components/login-modal";
import { UserProvider } from "./context/user-context";
import { LogoutModalProvider } from "./context/logout-modal-context";
import { Citation } from "./pages/citation";
import { EditorLayout } from "./layouts/editor-layout";
import { ErrorProvider } from "./context/error-context";
import { TooltipProvider } from "./components/ui/tooltip";

function App() {
  return (
    <TooltipProvider>
      <ErrorProvider>
        <UserProvider>
          <AuthModalProvider>
            <LogoutModalProvider>
              <HashRouter>
                <Routes>
                  <Route path="/" element={<Splash />} />
                  <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route
                      path="/dashboard/projects/cloud"
                      element={<RemoteDocuments />}
                    />
                    <Route
                      path="/dashboard/projects/local"
                      element={<Dashboard />}
                    />
                    <Route path="/dashboard/citation" element={<Citation />} />
                  </Route>
                  <Route element={<EditorLayout />}>
                    <Route
                      path="/document/:id/:chapter?/:version?"
                      element={<Editor />}
                    />
                  </Route>
                </Routes>
              </HashRouter>
            </LogoutModalProvider>
            <LoginModal />
          </AuthModalProvider>
        </UserProvider>
      </ErrorProvider>
    </TooltipProvider>
  );
}

export default App;
