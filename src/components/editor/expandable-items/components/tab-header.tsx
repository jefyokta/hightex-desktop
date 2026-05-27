import { PropsWithChildren } from "react";

export const TabHeader: React.FC<
  PropsWithChildren & { title: string; desc: string }
> = ({ children, title, desc }) => {
  return (
    <div className="border-b px-4 pb-3 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
};
