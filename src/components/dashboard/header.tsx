import { CloudOff, Cloud } from "lucide-react";
import { useOnline } from "../../hooks/use-online";

export const Header = () => {
  const online = useOnline();
  return (
    <div className="px-6 h-24">
      <div className="flex justify-between  bg-gray-50 items-center sticky top-0 mb-6 p-6 rounded-2xl shadow- border border-gray-100">
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Dashboard</div>

          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            {online ? (
              <>
                <Cloud size={12} className="text-green-500" />
                Online
              </>
            ) : (
              <>
                <CloudOff size={12} />
                Offline
              </>
            )}
          </div>
        </div>
        <div className="relative group flex items-center"></div>
      </div>
    </div>
  );
};
