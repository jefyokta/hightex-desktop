import { useAppLanguage } from "@/hooks/use-app-language";
import { LecturerDirectoryManager } from "@/components/lecturer-directory-manager";
export function Lecturers() {
  useAppLanguage();
  return <LecturerDirectoryManager />;
}
