export const LoadingDocument = () => {
  return (
    <div
      className="
        page
        bg-white dark:bg-neutral-900!
        rounded-xl
        border border-neutral-200 dark:border-neutral-800
        shadow-[0_10px_40px_rgba(0,0,0,0.06)]
        dark:shadow-[0_10px_40px_rgba(0,0,0,0.35)]
        overflow-hidden
        transition-colors duration-300
      "
    >
      <div className="py-14">
        <div className="animate-pulse">
          <div className="h-8 w-64 rounded-xl bg-neutral-100 dark:bg-neutral-800 mb-10" />

          <div className="space-y-4">
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-full" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[95%]" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[90%]" />
          </div>

          <div className="space-y-4 mt-10">
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-full" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[92%]" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[85%]" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[88%]" />
          </div>

          <div className="space-y-4 mt-10">
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-full" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[96%]" />
            <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 w-[82%]" />
          </div>
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
          <div className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
          Loading document...
        </div>
      </div>
    </div>
  );
};
