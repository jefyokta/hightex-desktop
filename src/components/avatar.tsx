import { initials } from "../utils/sharing";

export const AVATAR_PALETTES = [
  "bg-violet-100 text-violet-600 ring-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:ring-violet-900",
  "bg-sky-100 text-sky-600 ring-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:ring-sky-900",
  "bg-rose-100 text-rose-600 ring-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:ring-rose-900",
  "bg-amber-100 text-amber-600 ring-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-900",
  "bg-emerald-100 text-emerald-600 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-900",
];

export const Avatar = ({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "md";
}) => {
  const palette = AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];
  const dim = size === "md" ? "h-9 w-9 text-xs" : "h-7 w-7 text-[10px]";
  return (
    <div
      className={`${dim} ${palette} rounded-full flex items-center justify-center font-semibold shrink-0 ring-1`}
    >
      {initials(name)}
    </div>
  );
};
