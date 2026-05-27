import { PageOverflow } from "@/exception/page-overflow";
import { FrameManager } from "@/frame/manager";
import { useEffect } from "react";

export const FrameSlave = () => {
  useEffect(() => {
    return FrameManager.onMessaged((e) => {
      if (e.type == "page:overflow") {
        throw new PageOverflow(e.data.page);
      }
    });
  }, []);
  return null;
};
