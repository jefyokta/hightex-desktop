import { useId, useState } from "react";
import { Check, ChevronsUpDown, RefreshCw } from "lucide-react";
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
import {
  useLecturerDirectory,
  refreshLecturerDirectory,
} from "@/hooks/use-lecturer-directory";
import { name } from "@/utils/name";
import { getCurrentLanguage, t } from "@/utils/lang";

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
            ? t("lecturers.offline_hint")
            : directory.fromSeed
              ? t("lecturers.seed")
              : directory.checkedAt
                ? t("lecturers.checked", {
                    date: new Date(directory.checkedAt).toLocaleDateString(
                      getCurrentLanguage() === "id" ? "id-ID" : "en-US",
                      { day: "numeric", month: "short", year: "numeric" },
                    ),
                  })
                : t("lecturers.empty_hint")}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={directory.refreshing}
        onClick={() => void refreshLecturerDirectory(true)}
      >
        <RefreshCw
          className={directory.refreshing ? "animate-spin" : undefined}
        />
        {t("lecturers.refresh")}
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
          if (next && navigator.onLine) void refreshLecturerDirectory();
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
            <span className="min-w-0 whitespace-normal break-words">
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
                    onSelect={() => {
                      onChange({ ...row });
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="whitespace-normal break-words">
                        {name(row.name)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        NIP / NIK: {row.nip || "—"}
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
    </div>
  );
}
