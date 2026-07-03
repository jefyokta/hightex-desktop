import { ShouldNavigated } from "@/exception/interfaces/should-navigated";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { strFromU8, unzipSync } from "fflate";
import { createMarker } from "@/utils/sharing";
import { createCommentClass } from "@/utils/custom-element/comment";
import { CommentResolver } from "@/compiler/resolver/comment-resolver";
import { Avatar } from "@/components/avatar";
import { RoleBadge } from "@/components/sharing/role-bage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  ChevronUp,
  FileArchive,
  MessageSquare,
  Minus,
} from "lucide-react";
import { ShouldNotifiedWithNativeComponent } from "@/exception/interfaces/should-notified-with-native-component";

const formatSnapshotType = (type: string) => {
  return type
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatRelativeDate = (value: Date | string | null | undefined) => {
  if (!value) return "Unknown time";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return formatDistanceToNow(date, { addSuffix: true });
};

export const SnapshotViewer = () => {
  const { id } = useParams();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const commentsRef = useRef<CommentEntity[]>([]);
  const [snapshot, setSnapshot] = useState<SnapshotEntity | null>(null);
  const [comments, setComments] = useState<CommentEntity[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      throw new ShouldNavigated("Snapshot not found", "/dashboard/snapshots");
    }

    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
    commentsRef.current = [];
    setSnapshot(null);
    setComments([]);

    let cancelled = false;

    window.ipcRenderer
      .invoke("snapshot:view", id)
      .then(async (r: ArrayBuffer) => {
        if (cancelled) return;

        const lists = unzipSync(new Uint8Array(r));

        const snap: SnapshotEntity & {
          comments: CommentEntity[];
        } = await window.ipcRenderer.invoke("snapshot", id);

        if (cancelled) return;

        commentsRef.current = snap.comments;
        setSnapshot(snap);
        setComments(snap.comments);

        const html = strFromU8(lists["document.html"]);
        delete lists["document.html"];

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        doc.body.style.background = "white";
        doc.body.style.justifyContent = "center";
        doc.body.style.display = "flex";

        if (lists["style.css"]) {
          const css =
            strFromU8(lists["style.css"]) +
            ".pagedjs_page{border:.5px solid black;}";

          delete lists["style.css"];

          const style = doc.createElement("style");
          style.innerHTML = css;
          doc.head.appendChild(style);
        }

        const imageMap = Object.fromEntries(
          Object.entries(lists).map(([key, val]) => {
            const imageId = key.slice(7, key.length - 5);

            const blob = new Blob([new Uint8Array(val)]);
            const url = URL.createObjectURL(blob);

            blobUrlsRef.current.push(url);

            return [imageId, url];
          }),
        );

        doc.querySelectorAll("img[data-img-id]").forEach((img) => {
          const imageId = img.getAttribute("data-img-id");

          if (!imageId) return;

          const url = imageMap[imageId];

          if (url) {
            (img as HTMLImageElement).src = url;
          }
        });

        if (iframeRef.current) {
          iframeRef.current.srcdoc = doc.documentElement.outerHTML;
        }
      })
      .catch((err) => {
        console.error(err);
        throw new ShouldNotifiedWithNativeComponent(
          ShouldNotifiedWithNativeComponent.normilize(err) ||
            "Snapshot Not found",
          "/dashboard/snapshots",
        );
      });

    return () => {
      cancelled = true;

      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));

      blobUrlsRef.current = [];
      commentsRef.current = [];
      setSnapshot(null);
      setComments([]);
      // CommentResolver.instance()?.destroy()
    };
  }, [id]);

  const toPayload = (comment: CommentEntity): CommentServerMessage => ({
    text: comment.text,
    ...comment.data,
    id: comment.id,
    role: comment.role as SharingParticipantRole,
    participantId: comment.participantId,
  });

  const scrollToComment = (comment: CommentEntity) => {
    const doc = iframeRef.current?.contentDocument;
    const uuid = comment.data.start?.uuid;

    if (!doc || !uuid) return;

    doc
      .querySelector(`[data-uuid="${uuid}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleLoad = () => {
    const iframe = iframeRef.current;

    if (!iframe) return;

    const doc = iframe.contentDocument;

    if (!doc) return;
    new CommentResolver(doc).resolve();
    doc.querySelectorAll("[href]").forEach((e) => {
      const id = (e.getAttribute("href") || "#").replace("#", "");
      e.addEventListener("click", (e) => {
        e.preventDefault();
        doc.getElementById(id)?.scrollIntoView();
      });
    });

    const win = iframe.contentWindow;

    if (!win) return;

    if (!win.customElements.get("ht-comment")) {
      const Comment = createCommentClass(doc);

      win.customElements.define("ht-comment", Comment);
    }

    for (const comment of commentsRef.current) {
      createMarker(toPayload(comment));
    }
  };

  const title = snapshot ? formatSnapshotType(snapshot.type) : "Snapshot";

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
            <FileArchive className="size-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-medium">{title}</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {snapshot?.documentId
                ? `Document ${snapshot.documentId}`
                : "Loading snapshot"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
          <span className="hidden items-center gap-1.5 sm:flex">
            <CalendarClock className="size-3.5" />
            {formatRelativeDate(snapshot?.updatedAt ?? snapshot?.createdAt)}
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2 py-1">
            <MessageSquare className="size-3.5" />
            {comments.length}
          </span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          className="w-full"
          onLoad={handleLoad}
        />

        <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex max-h-[calc(100%-2rem)] w-[min(22rem,calc(100%-2rem))] flex-col items-end">
          <section
            className={cn(
              "pointer-events-auto flex max-h-[min(34rem,calc(100vh-11rem))] w-full origin-bottom-right flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg transition-all duration-200 ease-out",
              commentsOpen
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none translate-y-3 scale-95 opacity-0",
            )}
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-medium">Comments</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {comments.length} saved comment
                    {comments.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setCommentsOpen(false)}
                title="Minimize comments"
              >
                <Minus />
                <span className="sr-only">Minimize comments</span>
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {comments.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center rounded-lg text-xs text-muted-foreground">
                  No comments in this snapshot.
                </div>
              ) : (
                <div className="space-y-2">
                  {comments.map((comment) => {
                    const payload = toPayload(comment);
                    const author =
                      payload.name ??
                      payload.role ??
                      comment.participantId ??
                      "User";

                    return (
                      <button
                        key={comment.id}
                        type="button"
                        onClick={() => scrollToComment(comment)}
                        className="flex w-full gap-2.5 rounded-lg border bg-card p-3 text-left transition hover:bg-muted/50"
                      >
                        <Avatar name={author} />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-medium leading-none">
                              {author}
                            </span>
                            {payload.role && <RoleBadge role={payload.role} />}
                          </div>
                          <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                            {comment.text}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <Button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className={cn(
              "pointer-events-auto absolute bottom-0 right-0 h-9 origin-bottom-right gap-2 border bg-popover text-popover-foreground shadow-lg transition-all duration-200 ease-out hover:bg-muted",
              commentsOpen
                ? "pointer-events-none translate-y-2 scale-95 opacity-0"
                : "translate-y-0 scale-100 opacity-100",
            )}
            title="Open comments"
          >
            <MessageSquare />
            Comments
            <span
              className={cn(
                "ml-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 text-[10px]",
                comments.length === 0 && "text-primary-foreground/70",
              )}
            >
              {comments.length}
            </span>
            <ChevronUp />
          </Button>
        </div>
      </div>
    </div>
  );
};
