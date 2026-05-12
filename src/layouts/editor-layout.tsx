import { EditorProvider } from "@/hooks/use-editor";
import { GraphContextProvider } from "@/hooks/use-graph";
import { useEffect } from "react";
import { Outlet, useSearchParams } from "react-router-dom";

export const EditorLayout: React.FC = () => {
  // const state = useGraph()
  const [search] = useSearchParams();
  useEffect(() => {
    // console.log(search);
    if (search.get("target")) {
      const target = search.get("target");
      // console.log(target);
      document.getElementById(target!)?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);
  return (
    <>
      <GraphContextProvider>
        <EditorProvider>
          <Outlet />
        </EditorProvider>
      </GraphContextProvider>
    </>
  );
};
