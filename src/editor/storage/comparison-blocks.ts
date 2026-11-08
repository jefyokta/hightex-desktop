/** UI-only matching of normalized top-level blocks. The stored comparison is unchanged. */
export function changedChapterBlocks(before: unknown[], after: unknown[]) {
  const main = before.map(() => true);
  const branch = after.map(() => true);
  const left = before.map((node) => JSON.stringify(node));
  const right = after.map((node) => JSON.stringify(node));
  let start = 0,
    leftEnd = left.length,
    rightEnd = right.length;
  while (start < leftEnd && start < rightEnd && left[start] === right[start]) {
    main[start] = branch[start] = false;
    start++;
  }
  while (
    leftEnd > start &&
    rightEnd > start &&
    left[leftEnd - 1] === right[rightEnd - 1]
  ) {
    main[--leftEnd] = branch[--rightEnd] = false;
  }
  if ((leftEnd - start) * (rightEnd - start) > 100_000) return { main, branch };
  const matrix = Array.from(
    { length: leftEnd - start + 1 },
    () => new Uint32Array(rightEnd - start + 1),
  );
  for (let i = leftEnd - start - 1; i >= 0; i--)
    for (let j = rightEnd - start - 1; j >= 0; j--)
      matrix[i][j] =
        left[start + i] === right[start + j]
          ? matrix[i + 1][j + 1] + 1
          : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
  let i = start,
    j = start;
  while (i < leftEnd && j < rightEnd) {
    if (left[i] === right[j]) {
      main[i++] = branch[j++] = false;
    } else if (
      matrix[i - start + 1][j - start] >= matrix[i - start][j - start + 1]
    )
      i++;
    else j++;
  }
  return { main, branch };
}
