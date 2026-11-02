import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GuidePlanTour } from "./guide-plan-tour";

export const WorkspaceGuide = ({ guide }: { guide: GuideController }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const origin = useRef<string>();
  const { activeGuide, phase, index } = guide;
  const touring = phase === "tour";
  const destination = activeGuide?.steps[index]?.route;
  useEffect(() => {
    if (!touring) {
      const previous = origin.current;
      origin.current = undefined;
      if (previous && pathname !== previous) navigate(previous);
      return;
    }
    origin.current ??= pathname;
    if (destination && pathname !== destination) navigate(destination);
  }, [touring, pathname, destination, navigate]);
  return <GuidePlanTour guide={guide} />;
};
