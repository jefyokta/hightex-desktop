import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  MessageCircle,
  Send,
  UsersRound,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { useSharing } from "@/hooks/use-sharing";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Avatar } from "../avatar";
import { Comment } from "./comment";
import {
  getNearestPageNum,
  resolveSelectionText,
  scrollToPage,
} from "@/utils/sharing";
import { RoleBadge } from "./role-bage";
import { truncate } from "@/utils/truncate";
import { sharingTypeLabel } from "@/utils/sharing-labels";
import { useNavigate } from "react-router-dom";

export const ExpandableSharingSidebar = () => {
  const {
    participants,
    identity,
    comments,
    send,
    rename,
    canComment,
    connected,
    generalInfo,
  } = useSharing();

  const navigate = useNavigate();
  const [name, setName] = useState(identity.name);
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    setName(identity.name);
  }, [identity]);

  useEffect(() => {
    const listener = (e: any) => setSelection(e.detail ?? null);
    document.addEventListener("selection:change", listener);
    return () => document.removeEventListener("selection:change", listener);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLDivElement | null;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [comments]);

  function handleSend() {
    if (!comment.trim() || !selection) return;
    send("comment", { ...selection, text: comment.trim() });
    setSelection(null);
    setComment("");
  }

  return (
    <div className="flex h-full w-full flex-col border-l bg-background">
      {generalInfo && (
        <div className="shrink-0 border-b px-4 py-3 space-y-0.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {sharingTypeLabel(generalInfo.type)}
          </div>
          <div className="text-sm font-semibold leading-snug truncate text-foreground">
            {generalInfo.document.title}
          </div>
          {generalInfo.document.category?.name && (
            <div className="text-xs text-muted-foreground truncate">
              {generalInfo.document.category.name}
            </div>
          )}
        </div>
      )}

      <div className="shrink-0 border-b p-4 space-y-3">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 border px-3 py-2.5">
          <Avatar name={name} size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">
              {identity.name}
            </div>
            <div className="mt-0.5">
              <RoleBadge role={identity.role} />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rename(name)}
            placeholder="Display name..."
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="h-8 shrink-0 px-3"
            onClick={() => rename(name)}
          >
            Save
          </Button>
        </div>
      </div>

      <Tabs defaultValue="comments" className="flex flex-1 flex-col min-h-0">
        <TabsList className="shrink-0 grid w-full grid-cols-2 rounded-none border-b bg-muted/50">
          <TabsTrigger value="comments">
            <MessageCircle />
          </TabsTrigger>
          <TabsTrigger value="info">
            <UsersRound />
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="comments"
          className="flex flex-1 flex-col min-h-0 mt-0 data-[state=inactive]:hidden"
        >
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-3">
              {comments.map((c, i) =>
                c.type === "comment" ? (
                  <Comment comment={c} key={i} />
                ) : (
                  <div
                    key={i}
                    className="flex gap-2 items-center text-muted-foreground"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <p className="text-[11px]">
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="font-medium text-foreground">
                            {c.payload.name ?? c.payload.role}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{c.payload.role}</TooltipContent>
                      </Tooltip>
                      {" want you to see "}
                      <span
                        className="font-medium text-foreground underline cursor-pointer"
                        onClick={() => scrollToPage(Number(c.payload.page))}
                      >
                        page {c.payload.page}
                      </span>
                    </p>
                  </div>
                ),
              )}
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t p-3">
            {selection && (
              <div className="mb-2 rounded-lg bg-muted border border-border overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    selection
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {(() => {
                        const s = getNearestPageNum(selection.start) ?? "";
                        const e = getNearestPageNum(selection.end) ?? "";
                        return s === e ? `page ${s}` : `page ${s} – ${e}`;
                      })()}
                    </span>
                    <button
                      onClick={() => setSelection(null)}
                      className="h-3.5 w-3.5 rounded-full bg-red-400 hover:bg-red-500 transition-colors flex items-center justify-center shadow-sm group"
                      aria-label="Clear selection"
                    >
                      <span className="text-white text-[14px] leading-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        ×
                      </span>
                    </button>
                  </div>
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {truncate(
                      resolveSelectionText({
                        start: selection.start,
                        end: selection.end,
                      }),
                      160,
                    )}
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-2 items-center">
              <Avatar name={name} />
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Write a comment..."
                disabled={!connected || !canComment}
                className="h-8 text-sm flex-1"
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleSend}
                disabled={!connected || !canComment || !comment.trim()}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="info"
          className="flex flex-1 flex-col min-h-0 mt-0 data-[state=inactive]:hidden"
        >
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                {participants.length} participants
              </div>
              {participants.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/40"
                >
                  <Avatar name={u.name} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.name}</div>
                    <div className="mt-0.5">
                      <RoleBadge role={u.role} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t p-3 space-y-2">
            {identity.role !== "host" && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {}}
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave session
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => navigate("/dashboard/present")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
