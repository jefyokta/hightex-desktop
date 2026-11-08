import type { SidebarTab } from "@/hooks/use-expandable-sidebar";
import type { LocaleKey } from "@/utils/lang";

export {};

declare global {
  type GuideScope = "workspace" | "editor";
  type GuidePhase = "queued" | "intro" | "tour";

  interface GuideAcknowledgment {
    id: string;
    revision: number;
  }

  interface OnboardingStatus {
    time: string;
    firstInstalled: boolean;
    installedVersion: string | null;
    currentVersion: string;
    previousVersion: string | null;
    versionChanged: boolean;
    seenGuides: Record<string, number>;
    profileSetupPending?: boolean;
  }

  interface GuideInstallationRecord {
    schema: 1;
    installedAt: string;
    installedVersion: string | null;
    lastVersion: string;
    seenGuides: Record<string, number>;
    profileSetupPending: boolean;
  }

  interface GuideStep {
    id: string;
    title: LocaleKey;
    description: LocaleKey;
    selectors: string[];
    route?: string;
    fallbackDescription?: LocaleKey;
    frozenDescription?: LocaleKey;
    example?: LocaleKey;
    advanceWhen?: string;
    waitingDescription?: LocaleKey;
    editor?: { sidebar?: SidebarTab; chapter?: "normal" | "abstract" };
  }

  interface UIGuide extends GuideAcknowledgment {
    welcomeOrder?: number;
    name: LocaleKey;
    summary: LocaleKey;
    scope: GuideScope;
    workspaceType?: "local" | "cloud";
    steps: GuideStep[];
  }

  interface GuideRelease {
    version: string;
    guides: UIGuide[];
  }

  interface AvailableGuide extends UIGuide {
    version: string;
  }

  interface GuidePlan {
    mode: "welcome" | "updates" | "replay";
    guides: AvailableGuide[];
  }

  interface GuideSession {
    plan: GuidePlan;
    phase: GuidePhase;
    activeGuideId: string;
    index: number;
  }

  interface GuideController {
    status?: OnboardingStatus;
    plan: GuidePlan | null;
    phase: GuidePhase | null;
    activeGuide?: AvailableGuide;
    index: number;
    setIndex(index: number): void;
    selectGuide(id: string): void;
    startTour(): void;
    previousGuide?: () => void;
    nextGuide?: () => void;
    replay(): Promise<void>;
    dismiss(): Promise<void>;
  }

  interface LocalizedGuideStep {
    id: string;
    title: string;
    description: string;
    selectors: string[];
    fallbackDescription?: string;
    example?: string;
    advanceWhen?: string;
    waitingDescription?: string;
  }

  interface GuideTargetBox {
    left: number;
    top: number;
    width: number;
    height: number;
  }

  interface GuidedTourProps {
    eyebrow: string;
    guides: { id: string; name: string }[];
    activeGuideId: string;
    onGuide(id: string): void;
    steps: LocalizedGuideStep[];
    index: number;
    onIndex(index: number): void;
    onPreviousGuide?: () => void;
    onNextGuide?: () => void;
    onDismiss(): void;
  }
}
