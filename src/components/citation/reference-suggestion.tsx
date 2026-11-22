import { forwardRef, useEffect, useState } from "react";
import { ReferencePicker, type ReferencePickerHandle, type ReferencePickerProps } from "./reference-picker";

/** Search inside the popup without changing the editor's trigger text or undo history. */
export const ReferenceSuggestion = forwardRef<ReferencePickerHandle, ReferencePickerProps>(function ReferenceSuggestion(
  { query, ...props }, ref,
) {
  const [search, setSearch] = useState(query);
  useEffect(() => setSearch(query), [query]);

  return (
    <div className="w-[min(26rem,calc(100vw-24px))]">
      <ReferencePicker {...props} ref={ref} query={search} onQueryChange={setSearch} />
    </div>
  );
});
