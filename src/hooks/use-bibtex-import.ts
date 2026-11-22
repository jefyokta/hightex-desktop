import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { bibToObject } from "bibtex.js";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { toast } from "sonner";

export function useBibtexImport(importBibtex: (content: string) => Promise<number>) {
  const [open, setOpen] = useState(false);
  const [bibText, setBibText] = useState("");
  const [doiLink, setDoiLink] = useState("");
  const [importing, setImporting] = useState(false);
  const pending = useRef(false);
  const resetText = useCallback(() => setBibText(""), []);

  const close = () => {
    if (pending.current) return;
    resetText();
    setOpen(false);
  };

  const onOpenChange = (open: boolean) => {
    if (!pending.current) setOpen(open);
  };

  const submit = async () => {
    if (pending.current) return;
    pending.current = true;
    setImporting(true);
    try {
      const count = await importBibtex(bibText);
      if (count > 0) {
        resetText();
        setOpen(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      pending.current = false;
      setImporting(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setBibText((await file.text()).trim());
  };

  const fetchFromDoi = async () => {
    const response = await fetch(doiLink, {
      method: "GET",
      headers: { Accept: "application/x-bibtex" },
    });
    if (!response.ok) {
      throw new ShouldNotified({
        message: "Unable to get BibTeX from DOI",
        description:
          "Ensure the DOI link is correct and you have a network connection.",
      });
    }
    const bib = await response.text();
    try {
      if (!bibToObject(bib).length) throw new Error("No BibTeX entry found");
      setBibText(bib);
    } catch {
      throw new ShouldNotified({
        message: "Invalid BibTeX response",
        description: "The DOI service did not return a valid BibTeX entry.",
      });
    }
  };

  return {
    open,
    setOpen,
    onOpenChange,
    importing,
    submit,
    bibText,
    setBibText,
    doiLink,
    setDoiLink,
    close,
    handleFileChange,
    fetchFromDoi,
  };
}
