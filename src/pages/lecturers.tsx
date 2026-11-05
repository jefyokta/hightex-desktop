import { LecturerDirectoryManager } from "@/components/lecturer-directory-manager";
import { useAppLanguage } from "@/utils/lang";

export function Lecturers() {
  useAppLanguage();
  return <LecturerDirectoryManager />;
}
