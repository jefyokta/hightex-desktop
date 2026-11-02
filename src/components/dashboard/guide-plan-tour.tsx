import { GuidedTour } from "./guided-tour";
import { GuideAnnouncement } from "./guide-announcement";
import { t, useAppLanguage } from "@/utils/lang";

// Release definitions supply the text and targets; rendering needs no step switch.
export function GuidePlanTour({
  guide,
  frozen = false,
  ready = true,
}: {
  guide: GuideController;
  frozen?: boolean;
  ready?: boolean;
}) {
  useAppLanguage();
  const {
    plan,
    activeGuide,
    phase,
    index,
    setIndex,
    selectGuide,
    previousGuide,
    nextGuide,
    dismiss,
  } = guide;
  if (!plan || !activeGuide) return null;
  return (
    <>
      <GuideAnnouncement guide={guide} />
      {phase === "tour" && (
        <GuidedTour
          eyebrow={t("guide.welcome_eyebrow", { version: activeGuide.version })}
          guides={plan.guides.map((item) => ({
            id: item.id,
            name: t(item.name),
          }))}
          activeGuideId={activeGuide.id}
          onGuide={selectGuide}
          steps={activeGuide.steps.map((step) => ({
            ...step,
            selectors: ready ? step.selectors : [],
            title: t(step.title),
            example: step.example ? t(step.example) : undefined,
            description: t(
              frozen && step.frozenDescription
                ? step.frozenDescription
                : step.description,
            ),
            fallbackDescription: step.fallbackDescription
              ? t(step.fallbackDescription)
              : undefined,
          }))}
          index={index}
          onIndex={setIndex}
          onPreviousGuide={previousGuide}
          onNextGuide={nextGuide}
          onDismiss={() => void dismiss()}
        />
      )}
    </>
  );
}
