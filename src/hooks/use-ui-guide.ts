import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { guidePlan, guideAcknowledgments } from "@/data/ui-guides";
import { t } from "@/utils/lang";

export function useUIGuide(scope: GuideScope = "workspace"): GuideController {
  const [status, setStatus] = useState<OnboardingStatus>();
  const [session, setSession] = useState<GuideSession | null>(null);
  const saving = useRef(false);
  const visited = useRef(new Set<string>());

  const open = useCallback((plan: GuidePlan | null) => {
    visited.current = new Set();
    setSession(
      plan
        ? { plan, phase: "queued", activeGuideId: plan.guides[0].id, index: 0 }
        : null,
    );
  }, []);

  useEffect(() => {
    let alive = true;
    const api = window.hightex.onboarding;
    if (!api) return;
    void Promise.all([api.status(), window.workspaces.state()])
      .then(([value, workspaces]) => {
        if (!alive) return;
        setStatus(value);
        const workspaceType = workspaces.profiles.find(
          (profile) => profile.id === workspaces.activeId,
        )?.type;
        open(guidePlan(value, scope, false, undefined, workspaceType));
      })
      .catch(() => {
        /* Onboarding must not block writing. */
      });
    return () => {
      alive = false;
    };
  }, [scope, open]);

  // Wait for an existing import, confirmation or mobile drawer to close first.
  const phase = session?.phase ?? null;
  useEffect(() => {
    if (phase !== "queued") return;
    const show = () => {
      if (
        document.querySelector(
          '[role="dialog"]:not([data-state="closed"]),[role="menu"][data-state="open"]',
        )
      )
        return;
      setSession((current) =>
        current?.phase === "queued" ? { ...current, phase: "intro" } : current,
      );
    };
    const observer = new MutationObserver(show);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    show();
    return () => observer.disconnect();
  }, [phase]);

  const replay = useCallback(async () => {
    if (saving.current) return;
    try {
      const [value, workspaces] = await Promise.all([
        window.hightex.onboarding.status(),
        window.workspaces.state(),
      ]);
      setStatus(value);
      const workspaceType = workspaces.profiles.find(
        (profile) => profile.id === workspaces.activeId,
      )?.type;
      open(guidePlan(value, scope, true, undefined, workspaceType));
    } catch {
      toast.error(t("guide.load_failed"));
    }
  }, [scope, open]);

  const selectGuide = useCallback(
    (id: string) => {
      if (!session?.plan.guides.some((guide) => guide.id === id)) return;
      if (session.phase === "tour") visited.current.add(id);
      setSession({ ...session, activeGuideId: id, index: 0 });
    },
    [session],
  );

  const startTour = useCallback(() => {
    if (!session) return;
    visited.current.add(session.activeGuideId);
    setSession({ ...session, phase: "tour" });
  }, [session]);

  const setIndex = useCallback((index: number) => {
    setSession((current) => {
      const guide = current?.plan.guides.find(
        (guide) => guide.id === current.activeGuideId,
      );
      return current && guide && index >= 0 && index < guide.steps.length
        ? { ...current, index }
        : current;
    });
  }, []);

  const dismiss = useCallback(async () => {
    if (!session || saving.current) return;
    const acknowledgments = guideAcknowledgments(session.plan, visited.current);
    saving.current = true;
    setSession(null);
    try {
      if (acknowledgments.length)
        setStatus(await window.hightex.onboarding.acknowledge(acknowledgments));
    } catch {
      toast.error(t("guide.save_failed"));
    } finally {
      saving.current = false;
    }
  }, [session]);

  const plan = session?.plan ?? null;
  const activeIndex =
    plan?.guides.findIndex((guide) => guide.id === session?.activeGuideId) ??
    -1;
  const automatic = plan?.mode !== "replay";
  const previous = automatic ? plan?.guides[activeIndex - 1] : undefined;
  const following = automatic ? plan?.guides[activeIndex + 1] : undefined;
  return {
    status,
    plan,
    phase,
    activeGuide: plan?.guides[activeIndex],
    index: session?.index ?? 0,
    setIndex,
    selectGuide,
    startTour,
    replay,
    dismiss,
    previousGuide: previous ? () => selectGuide(previous.id) : undefined,
    nextGuide: following ? () => selectGuide(following.id) : undefined,
  };
}
