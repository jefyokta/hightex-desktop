import {
  sectionLayoutKey,
  type SectionLayoutIdentity,
  type SectionLayoutResult,
} from "../../../shared/section-layout";
import type { PageLayout } from "@/editor/pagination/flow/page-planner";

interface Entry {
  result: Readonly<SectionLayoutResult>;
  plan: string;
  bytes: number;
}

/** Bounded LRU of published data. It never retains a measuring view or mutable DOM. */
export class SectionLayoutCache {
  private readonly entries = new Map<string, Entry>();
  private bytes = 0;
  private hits = 0;
  private misses = 0;

  constructor(private readonly budget = 32 * 1024 * 1024) {}

  get stats() {
    return {
      entries: this.entries.size,
      bytes: this.bytes,
      hits: this.hits,
      misses: this.misses,
    };
  }

  get(identity: SectionLayoutIdentity) {
    const key = sectionLayoutKey(identity),
      entry = this.entries.get(key);
    if (!entry) {
      this.misses++;
      return;
    }
    this.hits++;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { result: entry.result, plan: JSON.parse(entry.plan) as PageLayout };
  }

  set(result: Readonly<SectionLayoutResult>, plan: PageLayout) {
    if (result.html.length * 2 > this.budget) return;
    const key = sectionLayoutKey(result.identity),
      serialized = JSON.stringify(plan);
    const bytes = 2 * (JSON.stringify(result).length + serialized.length);
    if (bytes > this.budget) return;
    const previous = this.entries.get(key);
    if (previous) {
      this.bytes -= previous.bytes;
      this.entries.delete(key);
    }
    while (this.entries.size && this.bytes + bytes > this.budget) {
      const oldest = this.entries.keys().next().value!;
      this.bytes -= this.entries.get(oldest)!.bytes;
      this.entries.delete(oldest);
    }
    this.entries.set(key, { result, plan: serialized, bytes });
    this.bytes += bytes;
  }

  clear() {
    this.entries.clear();
    this.bytes = 0;
  }
}
