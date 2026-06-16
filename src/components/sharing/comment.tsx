import { resolveSelectionText, scrollToUuid } from "../../utils/sharing";
import { Avatar } from "../avatar";
import { RoleBadge } from "./role-bage";
import { useEffect, useState } from "react";

export const Comment = ({
  comment,
  ...props
}: { comment: CommentMessage<"server"> } & React.ComponentProps<"div">) => {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(
      resolveSelectionText({
        start: comment.payload.start,
        end: comment.payload.end,
      }),
    );

    const listener = () => {
      setText(
        resolveSelectionText({
          start: comment.payload.start,
          end: comment.payload.end,
        }),
      );
    };

    document.addEventListener("shadow:rendered", listener);
    return () => document.removeEventListener("shadow:rendered", listener);
  }, []);

  return (
    <div className="flex gap-2.5 p-3 rounded-lg border bg-card" {...props}>
      <Avatar name={comment.payload.name ?? "User"} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium leading-none">
            {comment.payload.name ?? comment.payload.role ?? "User"}
          </span>
          {comment.payload.role && <RoleBadge role={comment.payload.role} />}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {comment.payload.text}
        </p>
        {comment.payload.start && comment.payload.end && (
          <button
            onClick={() => scrollToUuid(comment.payload.start.uuid)}
            className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-2 text-left hover:text-foreground transition-colors w-full"
          >
            {text}
          </button>
        )}
      </div>
    </div>
  );
};
