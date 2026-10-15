export const ZoomUI = ({
  zoom,
  visible,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number;
  visible: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) => {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-10 transition-all duration-300 ${visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-3 pointer-events-none"
        }`}
    >
      <div className="flex items-center gap-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 shadow-xl shadow-black/5 dark:shadow-black/30 rounded-2xl px-3 py-2 transition-colors duration-300">
        <button
          onClick={onZoomOut}
          className="text-sm px-2.5 py-1 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          −
        </button>

        <div className="text-xs w-12 text-center text-neutral-600 dark:text-neutral-400">
          {Math.round(zoom * 100)}%
        </div>

        <button
          onClick={onZoomIn}
          className="text-sm px-2.5 py-1 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
};
