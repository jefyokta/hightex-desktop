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

export function getRoot(): Document | null {
  const host = document.querySelector("iframe")?.contentDocument || null;
  return host;
}

export function scrollToUuid(uuid: string): void {
  getRoot()
    ?.querySelector(`[data-uuid="${uuid}"]`)
    ?.scrollIntoView({ behavior: "smooth" });
}

export function scrollToPage(page: number): void {
  getRoot()
    ?.querySelector(`[data-page-number="${page}"]`)
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
  if (!root) return "";

  const all = Array.from(root.querySelectorAll<HTMLElement>("[data-uuid]"));
  const startIndex = all.findIndex(
    (el) => el.getAttribute("data-uuid") === start.uuid,
  );
  const endIndex = all.findIndex(
    (el) => el.getAttribute("data-uuid") === end.uuid,
  );

  if (startIndex === -1 || endIndex === -1) return "";

  const forward = startIndex <= endIndex;
  const slice = forward
    ? all.slice(startIndex, endIndex + 1)
    : all.slice(endIndex, startIndex + 1).reverse();

  let result = "";

  for (let i = 0; i < slice.length; i++) {
    const el = slice[i];
    const uuid = el.getAttribute("data-uuid");
    if (!uuid) continue;

    const text = el.textContent ?? "";

    if (i === 0 && uuid === start.uuid) {
      const from = Math.min(start.offset, text.length);
      if (slice.length === 1 && start.uuid === end.uuid) {
        result += text.slice(from, Math.min(end.offset, text.length));
        return truncate(result, 100);
      }
      result += text.slice(from);
      continue;
    }

    if (i === slice.length - 1 && uuid === end.uuid) {
      result += text.slice(0, Math.min(end.offset, text.length));
      break;
    }

    result += text;
  }

  return truncate(result, 100);
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

  const pass = await ask(`password for ${ssid}`);
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
