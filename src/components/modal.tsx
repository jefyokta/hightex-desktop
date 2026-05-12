import { X } from "lucide-react";
import { useEffect } from "react";

export const Modal = ({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // console.log(open);
    if (open) window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/10 backdrop-blur-sm"
      />

      <div className="relative z-10 bg-white rounded-2xl p-3 shadow">
        <div className="w-full justify-end flex">
          <button>
            <X size={15} onClick={onClose}></X>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
