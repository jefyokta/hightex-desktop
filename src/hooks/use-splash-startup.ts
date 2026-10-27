import { useEffect, useRef, useState } from "react";
import { CategoryEmpty } from "@/exception/categories-empty";

type StartupPhase = "preparing" | "ready" | "local";

export function useSplashStartup(online: boolean) {
  const [phase, setPhase] = useState<StartupPhase>(() =>
    online && navigator.onLine ? "preparing" : "local",
  );
  const [progress, setProgress] = useState(0);
  const [version, setVersion] = useState("");
  const preparation = useRef<Promise<boolean> | null>(null);
  const metadata = useRef<Promise<[string, Category[]]> | null>(null);

  useEffect(() => {
    let active = true;
    metadata.current ??= Promise.all([
      window.hightex.version().catch(() => ""),
      window.hightex.categories(),
    ]);
    void metadata.current
      .then(([value, categories]) => {
        if (!active) return;
        setVersion(value);
        if (!categories?.length) throw new CategoryEmpty();
      })
      .catch((error: unknown) => {
        if (active) window.dispatchEvent(new ErrorEvent("error", { error }));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!online || !navigator.onLine) {
      preparation.current = null;
      setPhase("local");
      return;
    }
    setPhase("preparing");
    setProgress(0);
    const unsubscribe = window.hightex.onPrefetchProgress((data) => {
      if (!active || !Number.isFinite(data.progress)) return;
      setProgress(Math.max(0, Math.min(100, data.progress ?? 0)));
    });
    // Reuse the same request when StrictMode replays the mount effect.
    preparation.current ??= Promise.resolve().then(() =>
      window.hightex.prefetch(),
    );
    void preparation.current
      .then((success) => {
        if (!active) return;
        if (success) setProgress(100);
        setPhase(success ? "ready" : "local");
      })
      .catch(() => {
        if (active) setPhase("local");
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [online]);

  return { phase, progress, version };
}
