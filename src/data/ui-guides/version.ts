function versionParts(value: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+.+)?$/.exec(value);
  return match
    ? { core: match.slice(1, 4).map(Number), prerelease: match[4]?.split(".") }
    : undefined;
}

export function versionAtLeast(current: string, required: string): boolean {
  const left = versionParts(current),
    right = versionParts(required);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index++) {
    if (left.core[index] !== right.core[index])
      return left.core[index] > right.core[index];
  }
  if (!left.prerelease) return true;
  if (!right.prerelease) return false;
  for (
    let index = 0;
    index < Math.max(left.prerelease.length, right.prerelease.length);
    index++
  ) {
    const a = left.prerelease[index],
      b = right.prerelease[index];
    if (a === b) continue;
    if (a === undefined) return false;
    if (b === undefined) return true;
    const numericA = /^\d+$/.test(a),
      numericB = /^\d+$/.test(b);
    if (numericA && numericB) return Number(a) > Number(b);
    if (numericA !== numericB) return !numericA;
    return a > b;
  }
  return true;
}
