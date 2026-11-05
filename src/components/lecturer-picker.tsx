import { useId, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import { useLecturerDirectory } from "@/hooks/use-lecturer-directory";
import { name } from "@/utils/name";
import { t } from "@/utils/lang";
import { LecturerEditor } from "./lecturer-editor";
import { Link } from "react-router-dom";

export function LecturerDirectoryStatus() {
  const directory = useLecturerDirectory();
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
      data-lecturer-directory-status
    >
      <span>
        {directory.loading
          ? t("lecturers.loading")
          : directory.error
            ? t("lecturers.storage_error")
            : t("lecturers.local_status", { count: directory.data.length })}
      </span>
      <Button type="button" variant="ghost" size="sm" asChild>
        <Link to="/dashboard/lecturers">{t("lecturers.manage")}</Link>
      </Button>
    </div>
  );
}

export function LecturerPicker({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: AcademicPerson;
  onChange(value: AcademicPerson): void;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<{ name: string } | null>(null);
  const directory = useLecturerDirectory();
  const search = query.trim().toLocaleLowerCase();
  const matches = directory.data.filter((row) =>
    `${row.name} ${row.nip}`.toLocaleLowerCase().includes(search),
  );
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            variant="outline"
            disabled={disabled}
            className="h-auto min-h-9 w-full justify-between gap-2 text-left font-normal"
          >
            <span className="min-w-0 whitespace-normal wrap-break-word">
              {value.name ? name(value.name) : t("lecturers.choose")}
            </span>
            <ChevronsUpDown className="shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-64 max-w-[calc(100vw-2rem)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("lecturers.search")}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {!matches.length && (
                <div
                  className="px-3 py-5 text-center text-xs text-muted-foreground"
                  role="status"
                >
                  {directory.loading
                    ? t("lecturers.loading")
                    : directory.error
                      ? t("lecturers.storage_error")
                      : directory.data.length
                        ? t("lecturers.none")
                        : t("lecturers.empty_hint")}
                </div>
              )}
              <CommandGroup>
                {matches.slice(0, 100).map((row) => (
                  <CommandItem
                    key={row.id}
                    value={row.id}
                    disabled={!row.nip.trim()}
                    onSelect={() => {
                      // Local directory IDs are not server lecturer IDs.
                      onChange({ name: row.name, nip: row.nip });
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="whitespace-normal wrap-break-word">
                        {name(row.name)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        NIP / NIK: {row.nip || t("lecturers.nip_missing")}
                      </div>
                    </div>
                    {row.name === value.name && row.nip === value.nip && (
                      <Check className="shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {matches.length > 100 && (
                <p className="p-3 text-xs text-muted-foreground">
                  {t("lecturers.refine_search")}
                </p>
              )}
              <CommandGroup>
                <CommandItem
                  value="add-local-lecturer"
                  disabled={directory.loading || !!directory.error}
                  onSelect={() => {
                    setAdding({ name: query.trim() });
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Plus />
                  {t("lecturers.add")}
                </CommandItem>
              </CommandGroup>
              {(value.name || value.nip) && (
                <CommandGroup>
                  <CommandItem
                    value="clear-selection"
                    onSelect={() => {
                      onChange({ name: "", nip: "" });
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    {t("lecturers.clear")}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        NIP / NIK: {value.nip || "—"}
      </p>
      {adding && (
        <LecturerEditor
          initialName={adding.name}
          onClose={() => setAdding(null)}
          onSaved={(row) => onChange({ name: row.name, nip: row.nip })}
        />
      )}
    </div>
  );
}
