import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Modal } from "./modal";
import { useAuthModal } from "../context/auth-modal-context";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { t } from "@/utils/lang";

export const LoginModal = () => {
  const { loginOpen, closeLogin } = useAuthModal();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [browser, setBrowser] = useState<BrowserLoginState>({ status: "idle" });
  const [error, setError] = useState<string>();
  const operation = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    if (!loginOpen) {
      setPassword("");
      setBusy(false);
      setError(undefined);
      return;
    }
    let active = true;
    const check = async () => {
      try {
        const next = await window.session.browser.status();
        if (!active) return;
        setBrowser(next);
        if (next.status === "authenticated") closeLogin();
      } catch {
        if (active) setError(t("desktop_auth.errors.request_failed"));
      }
    };
    void check();
    const timer = setInterval(() => void check(), 1000);
    return () => {
      active = false;
      clearInterval(timer);
      generation.current += 1;
    };
  }, [loginOpen, closeLogin]);
  const run = async (kind: "direct" | "browser" | "cancel") => {
    if (operation.current) return;
    operation.current = true;
    const request = generation.current;
    setBusy(true);
    setError(undefined);
    try {
      if (kind === "cancel") {
        await window.session.browser.cancel();
        setBrowser({ status: "idle" });
        return;
      }
      const result =
        kind === "browser"
          ? await window.session.browser.start()
          : await window.session.signIn(email, password);
      if (request !== generation.current) return;
      if (!result.ok) setError(t(`desktop_auth.errors.${result.error}`));
      else if (kind === "direct") {
        setPassword("");
        closeLogin();
      } else setBrowser(result.data as BrowserLoginState);
    } catch {
      if (request === generation.current)
        setError(t("desktop_auth.errors.request_failed"));
    } finally {
      operation.current = false;
      if (request === generation.current) setBusy(false);
    }
  };
  const waiting =
    browser.status === "waiting" || browser.status === "exchanging";
  return (
    <Modal open={loginOpen} onClose={closeLogin}>
      <div className="w-95 p-6 space-y-5">
        <div>
          <div className="text-lg font-semibold">{t("desktop_auth.title")}</div>
          <div className="text-xs text-muted-foreground">
            {t("desktop_auth.description")}
          </div>
        </div>
        {(error || browser.error) && (
          <p role="alert" className="text-sm text-destructive">
            {error ||
              (browser.error && t(`desktop_auth.errors.${browser.error}`))}
          </p>
        )}
        {waiting ? (
          <div className="space-y-3">
            <p role="status" className="text-sm text-muted-foreground">
              {t(
                browser.status === "exchanging"
                  ? "desktop_auth.exchanging"
                  : "desktop_auth.waiting",
              )}
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => void run("cancel")}
            >
              {t("desktop_auth.cancel")}
            </Button>
          </div>
        ) : (
          <Button
            className="w-full"
            variant="outline"
            disabled={busy}
            onClick={() => void run("browser")}
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {t("desktop_auth.browser")}
          </Button>
        )}
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run("direct");
          }}
        >
          <Input
            value={email}
            type="email"
            autoComplete="username"
            placeholder="Email"
            aria-label="Email"
            required
            disabled={busy || waiting}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            value={password}
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            required
            disabled={busy || waiting}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" className="w-full" disabled={busy || waiting}>
            {t("desktop_auth.direct")}
          </Button>
        </form>
      </div>
    </Modal>
  );
};
