export const commentEntityToMessage = (
  comment: CommentEntity,
): CommentMessage<"server"> => {
  return {
    type: "comment",
    payload: {
      participantId: comment.participantId,
      role: comment.role as SharingParticipantRole,
      start: comment.data.start,
      spanningUUIDs: comment.data.spanningUUIDs,
      end: comment.data.end,
      name: comment.role || "anonymous",
      text: comment.text,
      id: comment.id,
    },
  };
};
