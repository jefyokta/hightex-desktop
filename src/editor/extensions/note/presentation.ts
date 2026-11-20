import { getRandomColor } from "@/utils/sharing";

export function notePresentation(id?: string) {
  return {
    backgroundColor: getRandomColor(id || "note"),
    mixBlendMode: "multiply" as const,
  };
}
