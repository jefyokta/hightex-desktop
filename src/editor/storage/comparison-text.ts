/** Inline comparison presentation; bounded LCS keeps long paragraphs responsive. */
export type DiffSegment = { type: "same" | "added" | "removed"; text: string };

function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  return segments.reduce<DiffSegment[]>((result, segment) => {
    if (!segment.text) return result;
    const previous = result[result.length - 1];
    if (previous?.type === segment.type) previous.text += segment.text;
    else result.push({ ...segment });
    return result;
  }, []);
}

function tokenize(text: string) {
  return text.match(/[\p{L}\p{N}_]+|\s+|[^\s\p{L}\p{N}_]/gu) ?? [];
}

function diffMiddle(before: string[], after: string[]): DiffSegment[] {
  if (before.length * after.length > 80_000)
    return [
      { type: "removed", text: before.join("") },
      { type: "added", text: after.join("") },
    ];

  const matrix = Array.from(
    { length: before.length + 1 },
    () => new Uint32Array(after.length + 1),
  );
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      matrix[i][j] =
        before[i] === after[j]
          ? matrix[i + 1][j + 1] + 1
          : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      segments.push({ type: "same", text: before[i++] });
      j++;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      segments.push({ type: "removed", text: before[i++] });
    } else {
      segments.push({ type: "added", text: after[j++] });
    }
  }
  while (i < before.length)
    segments.push({ type: "removed", text: before[i++] });
  while (j < after.length) segments.push({ type: "added", text: after[j++] });
  return mergeSegments(segments);
}

export function diffText(beforeText: string, afterText: string): DiffSegment[] {
  const before = tokenize(beforeText);
  const after = tokenize(afterText);
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start++;

  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (
    beforeEnd > start &&
    afterEnd > start &&
    before[beforeEnd - 1] === after[afterEnd - 1]
  ) {
    beforeEnd--;
    afterEnd--;
  }

  return mergeSegments([
    { type: "same", text: before.slice(0, start).join("") },
    ...diffMiddle(before.slice(start, beforeEnd), after.slice(start, afterEnd)),
    { type: "same", text: before.slice(beforeEnd).join("") },
  ]);
}
