import { useCallback, useState, type ChangeEvent } from "react";
import { bibToObject } from "bibtex.js";
import { ShouldNotified } from "@/exception/interfaces/should-notified";

export function useBibtexImport() {
  const [open, setOpen] = useState(false);
  const [bibText, setBibText] = useState("");
  const [doiLink, setDoiLink] = useState("");
  const resetText = useCallback(() => setBibText(""), []);

  const close = () => {
    resetText();
    setOpen(false);
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
    bibText,
    setBibText,
    doiLink,
    setDoiLink,
    resetText,
    close,
    handleFileChange,
    fetchFromDoi,
  };
}
