import { Settings } from "lucide-react";
import { isMac } from "../utils/is-mac";
import Hightex from "./../assets/hightex.svg";

export const Navbar = () => {
  if (!isMac) {
    return null;
  }
  return (
    <div className="relative w-full h-14 bg-gray-50 px-4 flex items-center">
      <div className="flex-1 h-full drag-bar" />

      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2">
        <img src={Hightex} className="w-8" />
        <span>HighTex</span>
      </div>

      <div
        onClick={() => confirm("hei")}
        className="no-drag flex w-10 h-10 rounded-full hover:bg-gray-100 justify-center cursor-pointer items-center"
      >
        <button>
          <Settings size={20} className="text-gray-500" />
        </button>
      </div>
    </div>
  );
};
