import { useState, useCallback } from "react";
import { useSharing } from "@/hooks/use-sharing";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { SelectionResolver } from "@/compiler/resolver/selection-resolver";
interface FixedCommentPanelProps {
  isHost?: boolean;
  userRole?: SharingGuestRole;
}

export const FixedCommentPanel = ({
  isHost = false,
  userRole,
}: FixedCommentPanelProps) => {
  const { send, connected } = useSharing();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const canComment = true
  const isReadOnly = !isHost && !!userRole;

  const handleSubmit = useCallback(async () => {
    if (!comment.trim() || !canComment || !connected) return;

    try {
      setLoading(true);

      const payload: WSMessage = {
        type: "comment",
        payload: SelectionResolver.instance?.selectionData,
      };

      send(payload);
      setComment("");
    } catch (error) {
      console.error("Failed to send comment:", error);
    } finally {
      setLoading(false);
    }
  }, [comment, canComment, connected, send, userRole]);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 0,
    right: 0,
    width: "384px",
    padding: "16px",
    background: "#fff",
    borderLeft: "1px solid #e5e7eb",
    borderTop: "1px solid #e5e7eb",
    borderTopLeftRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    boxSizing: "border-box",
    fontFamily: "ui-sans-serif"
  };

  if (!connected) {
    return (
      <div
        style={{
          ...panelStyle,
          height: "128px",
          background: "#f5f5f5",
        }}
      >
        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: 0,
          }}
        >
          Connecting...
        </p>
      </div>
    );
  }

  // if ( !userRole) {
  //   return (
  //     <div
  //       style={{
  //         ...panelStyle,
  //         height: "128px",
  //         background: "#f5f5f5",
  //       }}
  //     >
  //       <p
  //         style={{
  //           fontSize: "14px",
  //           color: "#6b7280",
  //           margin: 0,
  //         }}
  //       >
  //         You don't have permission to comment on this document.
  //       </p>
  //     </div>
  //   );
  // }

  return (
    <div style={panelStyle} className="panel">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {isHost ? "Host Comment" : `Comment as ${userRole}`}
          </h3>

          {isReadOnly && (
            <p
              style={{
                marginTop: "4px",
                marginBottom: 0,
                fontSize: "12px",
                color: "#6b7280",
              }}
            >
              Anonymous viewers cannot comment
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <Textarea
            placeholder="Write your comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={loading || !canComment}
       
          />

          <Button
            variant={'destructive'}
            onClick={handleSubmit}
            disabled={!comment.trim() || loading || !canComment}
          
          >
            {loading ? "Sending..." : "Send Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
};