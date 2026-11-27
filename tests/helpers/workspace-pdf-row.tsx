import { MemoryRouter } from "react-router-dom";
import { ConfigContextProvider } from "@/context/config-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Row } from "@/components/local/rows";

export function workspacePDFRow(document: HighTexDocument) {
  return <ConfigContextProvider><TooltipProvider><MemoryRouter>
    <Row doc={document} branches={[]} categories={[]} selectMode={false} selected={false} disabled={false}
      onSelect={() => {}} onEdit={() => {}} onDelete={async () => {}} onExport={async () => true} />
  </MemoryRouter></TooltipProvider></ConfigContextProvider>;
}
