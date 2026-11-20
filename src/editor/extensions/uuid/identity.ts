import type { JSONContent } from "@tiptap/core";
import { uniqId } from "@/utils/uniq-id";

export function needsNodeIdentity(attrs?: Record<string, unknown>): boolean {
  return (
    attrs?.shouldUnique !== false && Boolean(attrs?.shouldUnique || attrs?.id)
  );
}

export const identityNodes = function* (
  content: readonly JSONContent[],
): Generator<JSONContent> {
  for (const node of content) {
    if (needsNodeIdentity(node.attrs)) yield node;
    if (node.content) yield* identityNodes(node.content);
  }
};

/** Reserve every existing ID before generating replacements, including later nodes. */
export class NodeIdentityAllocator {
  private readonly used = new Set<string>();
  private readonly unavailable: Set<string>;
  private readonly owners = new Map<string, string>();

  constructor(
    private readonly reserved: Pick<ReadonlySet<string>, "has"> = new Set(),
    existing: Iterable<string> = [],
    private readonly generate = uniqId,
  ) {
    this.unavailable = new Set(existing);
  }

  assign(type: string, candidate: unknown): string {
    if (
      typeof candidate === "string" &&
      candidate &&
      !this.reserved.has(candidate) &&
      !this.used.has(candidate) &&
      !(/^\d/.test(candidate) && candidate.includes(":"))
    ) {
      return this.claim(candidate, candidate);
    }
    for (let attempt = 0; attempt < 128; attempt++) {
      const id = `${type}-${this.generate()}`;
      if (this.unavailable.has(id) || this.reserved.has(id)) continue;
      return this.claim(candidate, id);
    }
    throw Error("Unable to allocate a unique node identity");
  }

  reference(candidate: unknown) {
    if (typeof candidate !== "string") return undefined;
    return this.reserved.has(candidate)
      ? candidate
      : this.owners.get(candidate);
  }

  private claim(candidate: unknown, id: string) {
    this.used.add(id);
    this.unavailable.add(id);
    if (
      typeof candidate === "string" &&
      candidate &&
      !this.owners.has(candidate)
    )
      this.owners.set(candidate, id);
    return id;
  }
}
