import { useIPC } from "@/hooks/use-ipc";
import { Button } from "./button";

export const OpenFileButton = ({ title = "open", filePath = "" }) => {
  return (
    <Button
      onClick={async () => {
        await useIPC("file").file.openPath(filePath);
      }}
    >
      {title}
    </Button>
  );
};
