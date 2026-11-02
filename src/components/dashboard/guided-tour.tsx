import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/react";
import { ArrowLeft, ArrowRight, Focus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { t, useAppLanguage } from "@/utils/lang";

const focusable =
  'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])';
const externalPopup = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="dialog"]:not([data-tour-panel]):not([data-state="closed"]),[role="menu"][data-state="open"],[role="listbox"][data-state="open"],[data-guide-popup]',
    ),
  ).find(isVisible);
const isVisible = (element: HTMLElement) =>
  element.getClientRects().length > 0 &&
  getComputedStyle(element).visibility !== "hidden";
const controls = (element: HTMLElement) =>
  [
    ...(element.matches(focusable) ? [element] : []),
    ...Array.from(element.querySelectorAll<HTMLElement>(focusable)),
    ...(element.closest<HTMLElement>('[contenteditable="true"]')
      ? [element.closest<HTMLElement>('[contenteditable="true"]')!]
      : []),
  ].filter(isVisible);

export function GuidedTour({
  eyebrow,
  steps,
  guides,
  activeGuideId,
  onGuide,
  index,
  onIndex,
  onPreviousGuide,
  onNextGuide,
  onDismiss,
}: GuidedTourProps) {
  useAppLanguage();
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const [box, setBox] = useState<GuideTargetBox | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [fallback, setFallback] = useState(false);
  const [paused, setPaused] = useState(false);
  const headerInset = Math.max(
    0,
    document.querySelector("[data-editor-titlebar]")?.getBoundingClientRect()
      .bottom ?? 0,
  );
  const step = steps[index];
  const selectors = JSON.stringify(step.selectors);

  useLayoutEffect(() => {
    let disposed = false;
    let offPosition: (() => void) | undefined;
    let frame: number | undefined;
    const card = panel.current;
    if (!card) return;
    const update = () => {
      if (disposed || !target.current) return;
      const rect = target.current.getBoundingClientRect();
      const left = Math.max(6, rect.left - 6),
        top = Math.max(6, rect.top - 6);
      const right = Math.min(window.innerWidth - 6, rect.right + 6),
        bottom = Math.min(window.innerHeight - 6, rect.bottom + 6);
      const next = {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
      setBox((previous) =>
        previous &&
        Object.keys(next).every(
          (key) =>
            previous[key as keyof GuideTargetBox] ===
            next[key as keyof GuideTargetBox],
        )
          ? previous
          : next,
      );
      const headerBottom =
        document
          .querySelector("[data-editor-titlebar]")
          ?.getBoundingClientRect().bottom ?? 0;
      const padding = {
        top: Math.max(12, headerBottom + 12),
        right: 12,
        bottom: 12,
        left: 12,
      };
      void computePosition(target.current, card, {
        placement: "bottom-start",
        strategy: "fixed",
        middleware: [
          offset(14),
          flip({
            padding,
            fallbackPlacements: [
              "right-start",
              "left-start",
              "top-start",
              "bottom-end",
              "top-end",
            ],
          }),
          shift({ padding, crossAxis: true }),
        ],
      }).then(({ x, y }) => {
        if (!disposed)
          setPosition((previous) =>
            previous?.x === x && previous?.y === y ? previous : { x, y },
          );
      });
    };
    const find = () => {
      if (disposed) return;
      setPaused(Boolean(externalPopup()));
      const candidates: string[] = JSON.parse(selectors);
      let found: HTMLElement | null = null;
      let foundIndex = -1;
      for (const [candidateIndex, selector] of candidates.entries()) {
        found =
          Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
            isVisible,
          ) ?? null;
        if (found) {
          foundIndex = candidateIndex;
          break;
        }
      }
      if (found !== target.current) {
        offPosition?.();
        target.current = found;
        setBox(null);
        setPosition(null);
        if (found) {
          const rect = found.getBoundingClientRect();
          if (
            rect.top < 16 ||
            rect.bottom > window.innerHeight - 16 ||
            rect.left < 16 ||
            rect.right > window.innerWidth - 16
          )
            found.scrollIntoView({
              block: "center",
              inline: "nearest",
              behavior: "instant",
            });
          offPosition = autoUpdate(found, card, update);
        }
      }
      setFallback(foundIndex > 0);
      if (found) update();
    };
    const observer = new MutationObserver(() => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(find);
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "disabled", "data-state", "style"],
    });
    find();
    return () => {
      disposed = true;
      observer.disconnect();
      offPosition?.();
      if (frame !== undefined) cancelAnimationFrame(frame);
      target.current = null;
    };
  }, [selectors, index]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (!externalPopup()) panel.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (externalPopup()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
        return;
      }
      const card = panel.current,
        current = target.current;
      if (!card) return;
      if (event.key === "Tab") {
        const choices = [
          ...new Set([
            ...(current ? controls(current) : []),
            ...controls(card),
          ]),
        ];
        if (!choices.length) return;
        const active = choices.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        const next =
          active < 0
            ? event.shiftKey
              ? choices.length - 1
              : 0
            : (active + (event.shiftKey ? -1 : 1) + choices.length) %
              choices.length;
        choices[next].focus();
      }
      if (
        card.contains(document.activeElement) &&
        !document.activeElement?.matches(
          'input,select,textarea,[contenteditable="true"]',
        )
      ) {
        if (event.key === "ArrowRight" && current) {
          if (index < steps.length - 1) {
            event.preventDefault();
            onIndex(index + 1);
          } else if (onNextGuide) {
            event.preventDefault();
            onNextGuide();
          }
        }
        if (event.key === "ArrowLeft") {
          if (index > 0) {
            event.preventDefault();
            onIndex(index - 1);
          } else if (onPreviousGuide) {
            event.preventDefault();
            onPreviousGuide();
          }
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [index, onDismiss, onIndex, onPreviousGuide, onNextGuide, steps.length]);

  return createPortal(
    <div
      className="workspace"
      style={{ visibility: paused ? "hidden" : undefined }}
      data-tour-overlay
    >
      {box && (
        <>
          <div
            className="fixed inset-x-0 top-0 z-[2100]"
            style={{ height: box.top }}
          />
          <div
            className="fixed left-0 z-[2100]"
            style={{ top: box.top, width: box.left, height: box.height }}
          />
          <div
            className="fixed right-0 z-[2100]"
            style={{
              top: box.top,
              left: box.left + box.width,
              height: box.height,
            }}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[2100]"
            style={{ top: box.top + box.height }}
          />
          <div
            data-tour-highlight
            className="pointer-events-none fixed z-[2100] rounded-xl border-2 border-foreground/70"
            style={{ ...box, boxShadow: "0 0 0 9999px rgb(0 0 0 / 32%)" }}
          />
        </>
      )}
      <div
        ref={panel}
        data-tour-panel
        data-tour-step={step.id}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="fixed z-[2101] w-[min(360px,calc(100vw-24px))] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl bg-popover p-5 text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none"
        style={{
          maxHeight: `calc(100dvh - ${headerInset + 24}px)`,
          ...(position
            ? { left: position.x, top: position.y }
            : { right: 12, bottom: 12 }),
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="workspace-eyebrow">{eyebrow}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("guide.skip")}
            onClick={onDismiss}
          >
            <X />
          </Button>
        </div>
        <NativeSelect
          aria-label={t("guide.feature")}
          wrapperClassName="mt-3"
          className="h-8 text-xs"
          value={activeGuideId}
          onChange={(event) => onGuide(event.target.value)}
        >
          {guides.map((guide) => (
            <option key={guide.id} value={guide.id}>
              {guide.name}
            </option>
          ))}
        </NativeSelect>
        <div aria-live="polite" aria-atomic="true">
          <h2 id={titleId} className="mt-3 text-sm font-semibold">
            {step.title}
          </h2>
          <p
            id={descriptionId}
            className="mt-2 text-xs leading-relaxed text-muted-foreground"
          >
            {fallback && step.fallbackDescription
              ? step.fallbackDescription
              : step.description}
          </p>
        </div>
        {step.example && (
          <pre
            data-guide-example
            className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-muted px-3 py-2.5 text-[11px] leading-relaxed"
          >
            <code>{step.example}</code>
          </pre>
        )}
        {!box && (
          <p
            role="status"
            className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Loader2 className="size-3 animate-spin" />
            {t("guide.waiting")}
          </p>
        )}
        {box && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 -ml-2 text-xs"
            onClick={() => {
              const element = target.current;
              if (element) {
                element.scrollIntoView({
                  block: "nearest",
                  inline: "nearest",
                  behavior: "instant",
                });
                (controls(element)[0] ?? element).focus({
                  preventScroll: true,
                });
              }
            }}
          >
            <Focus className="size-3" />
            {t("guide.focus_control")}
          </Button>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
          <p className="text-[11px] text-muted-foreground">
            {t("guide.position", { current: index + 1, total: steps.length })}
          </p>
          <div className="flex items-center gap-1">
            {(index > 0 || onPreviousGuide) && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("guide.previous")}
                onClick={() =>
                  index > 0 ? onIndex(index - 1) : onPreviousGuide?.()
                }
              >
                <ArrowLeft />
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="workspace-primary"
              disabled={!box}
              onClick={() =>
                index < steps.length - 1
                  ? onIndex(index + 1)
                  : onNextGuide
                    ? onNextGuide()
                    : onDismiss()
              }
            >
              {t(
                index === steps.length - 1 && !onNextGuide
                  ? "guide.done"
                  : "guide.next",
              )}
              <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
