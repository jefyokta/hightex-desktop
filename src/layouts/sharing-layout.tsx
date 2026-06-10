import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo } from "react";

import { SharingContextProvider } from "@/hooks/use-sharing";
import { FixedCommentPanel } from "@/components/share/fixed-comment-panel";
import sharingCss from "@/css/sharing.css?url"
import { createElementFromUrl } from "@/utils/create-element-from-url";
export const SharingLayout = () => {
  const location = useLocation();

  const { isHost, userRole } = useMemo(() => {
    const isHost = location.pathname === "/shared";
    const userRole = location.state?.role as SharingGuestRole | undefined;

    return { isHost, userRole };
  }, [location.pathname, location.state?.role]);

  useEffect(() => {
    let htmlel: HTMLElement | undefined
    (async () => {

      document.body.dataset.mode = "print";
      document.querySelectorAll("style").forEach((el) => el.remove());
      document
        .querySelectorAll('link[rel="stylesheet"]')
        .forEach((el) => el.remove());

      htmlel = await createElementFromUrl(sharingCss)
      if (htmlel) document.head.append(htmlel)
    })()

    return () => {
      htmlel?.remove();
    }


  }, []);

  return (
    <SharingContextProvider>
      <section style={{ height: "100vh", overflow: "scroll", display: "flex", justifyContent: "center" }}>
        <Outlet />
        <FixedCommentPanel isHost={isHost} userRole={userRole} />
      </section>
    </SharingContextProvider>
  );
};
