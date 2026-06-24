import { truncate } from "@/utils/truncate";
import { confirm } from "./confirm";
import { ask } from "./ask";

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getRoot(): Document {
  return document.querySelector("iframe")?.contentDocument || document;
}

export function scrollToUuid(uuid: string): void {
  getRoot()
    ?.querySelector(`[data-uuid="${uuid}"]`)
    ?.scrollIntoView({ behavior: "smooth" });
}

export function scrollToPage(page: number): void {
  getRoot()
    .querySelector(`[data-page-number="${page}"]`)
    ?.scrollIntoView({ behavior: "smooth" });
}

export function resolveSelectionText({
  start,
  end,
}: {
  start: SelectionAnchor;
  end: SelectionAnchor;
}): string {
  const root = getRoot();
  if (!root) return "-";

  const s = resolveOffset(start.uuid, start.offset);
  const e = resolveOffset(end.uuid, end.offset);
  if (!s || !e) return "";
  const range = root.createRange();
  range.setStart(s.node, s.offset);
  range.setEnd(e.node, e.offset);
  const text =
    e.node == s.node
      ? range.toString()
      : getTextNodesInRange(range)
          .map((t) => t.textContent)
          .join("");
  return truncate(text, 100);
}

export const getNearestPageNum = (
  anchor: SelectionAnchor,
): string | null | undefined => {
  const { offset, uuid } = anchor;
  const root = getRoot();
  if (!root) return null;

  const els = Array.from(root.querySelectorAll(`[data-uuid="${uuid}"]`)).sort(
    (a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );

  let currentStart = 0;

  for (const el of els) {
    const len = el.textContent?.length || 0;
    const currentEnd = currentStart + len;
    if (offset >= currentStart && offset < currentEnd) {
      const pageEl = el.closest(".pagedjs_page");
      return pageEl?.querySelector(".hasContent")?.textContent;
    }

    if (offset === currentEnd && el === els[els.length - 1]) {
      const pageEl = el.closest(".pagedjs_page");
      return pageEl?.querySelector(".hasContent")?.textContent;
    }

    currentStart = currentEnd;
  }

  return null;
};

export const parseInvitationCode = (code: string) => {
  try {
    const decoder = new TextDecoder("utf-8");
    const binaryString = atob(code);

    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const result = decoder.decode(bytes);

    return JSON.parse(result) as InvitationJson;
  } catch (error) {
    throw new Error("Invalid Invitation");
  }
};

export const connectToHost = async (invdCode: string) => {
  const data = parseInvitationCode(invdCode);
  const { code = "", ssid, host, sharingId } = data;
  const scanned = await window.sharing.wifi.scan();
  const reachable = scanned.some((s) => s.ssid == ssid);
  if (!reachable) throw new Error("Host Network is not reachable");
  const currentNetwork = await window.sharing.wifi.current();
  if (currentNetwork && currentNetwork?.ssid == ssid) {
    await checkForHostServer(host, sharingId);
    return { ip: data.ip, port: data.host.split(":")[1], code };
  }

  const confirmed = await confirm("want to join to host network " + ssid + "?");
  if (!confirmed) throw new Error("Canceled");

  const pass = await ask(`password for ${ssid}`, true);
  if (typeof pass == "undefined") throw new Error("Canceled");
  const connetion = await window.sharing.wifi.connect(ssid, pass);
  if (!connetion.changed) throw new Error("Failed to connect");
  await checkForHostServer(host, sharingId);
  return { ip: data.ip, port: data.host.split(":")[1], code };
};

const checkForHostServer = async (host: string, sharingId: string) => {
  const res = await fetch(host + "/__ht_check")
    .then((r) => r.text())
    .catch((_e) => "kotnoleodnaisrghayudsagmanungkubninsiresponenya");
  if (res !== sharingId) throw new Error("Invalid server host");
};

const createCommentWrapper = (comm: CommentServerMessage) => {
  const document = getRoot();
  const comment = document.createElement("ht-comment") as CommentElement;
  comment.addComment(comm);
  comment.style.background = getRandomColor(comm.id);

  return comment;
};

export const createMarker = (payload: CommentServerMessage) => {
  const root = getRoot();
  const { start, end } = payload;
  const st = resolveOffset(start.uuid, start.offset);
  const en = resolveOffset(end.uuid, end.offset);
  if (!st || !en) return;
  const range = root!.createRange();
  range.setStart(st.node, st.offset);
  range.setEnd(en.node, en.offset);

  if (st.node == en.node) {
    const span = createCommentWrapper(payload);
    span.addComment(payload);
    range.surroundContents(span);
    return;
  }
  const textNodes = getTextNodesInRange(range);

  for (const node of textNodes) {
    const full = node.textContent || "";

    const nodeRange = root.createRange();

    const start = node === range.startContainer ? range.startOffset : 0;

    const end = node === range.endContainer ? range.endOffset : full.length;

    if (start >= end) continue;

    nodeRange.setStart(node, start);
    nodeRange.setEnd(node, end);

    const span = createCommentWrapper(payload);

    const frag = nodeRange.extractContents();
    span.addComment(payload);
    span.appendChild(frag);

    nodeRange.insertNode(span);
  }
};

function resolveOffset(uuid: string, offset: number) {
  const els = Array.from(getRoot().querySelectorAll(`[data-uuid="${uuid}"]`));

  let current = 0;

  for (const el of els) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);

    let node: Text | null;

    while ((node = walker.nextNode() as Text | null)) {
      const len = node.data.length;

      if (offset <= current + len) {
        return {
          node,
          offset: offset - current,
        };
      }

      current += len;
    }
  }

  return null;
}

function getTextNodesInRange(range: Range) {
  const nodes: Text[] = [];

  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
  );

  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    if (
      range.intersectsNode(node) &&
      node.parentElement?.closest("[data-uuid]")
    ) {
      nodes.push(node);
    }
  }

  return nodes;
}

function getRandomColor(seed?: string) {
  const hash = seed
    ? [...seed].reduce((a, c) => a + c.charCodeAt(0), 0)
    : Math.random() * 360;

  const hue = hash % 360;

  return `hsl(${hue}, 85%, 75%)`;
}
