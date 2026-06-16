import http from "node:http";
import type { IncomingMessage } from "node:http";
import { type GuestState } from "../utils";

type FindGuestFn = (code: string | null) => GuestState | undefined;
type ValidateHostTokenFn = (token: string | null) => boolean;

export class OnRequest {
  constructor(
    private readonly snapshot: Snapshot,
    private readonly images: SerialableImageRecord[],
    private readonly findGuest: FindGuestFn,
    private readonly validateHostToken: ValidateHostTokenFn,
    private readonly sharingId: string,
  ) {}

  handle(req: IncomingMessage, res: http.ServerResponse): void {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");

      const url = new URL(req.url ?? "", "http://localhost");
      const { pathname } = url;
      const guest = this.findGuest(url.searchParams.get("code"));
      const isHost = this.validateHostToken(url.searchParams.get("token"));
      if (this.match(pathname, "/__ht_check")) {
        res.end(this.sharingId);
        return;
      }
      if (this.match(pathname, "/snapshot")) {
        return this.snapshot_(res, guest);
      }

      if (this.match(pathname, "/share/image/")) {
        return this.image(res, pathname.split("/share/image/")[1]);
      }

      if (!guest && !isHost) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Invalid sharing credential" }));
        return;
      }

      res.statusCode = 404;
      res.end("Not found");
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }

  private snapshot_(res: http.ServerResponse, guest?: GuestState): void {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        snapshot: this.snapshot,
        guest: guest
          ? { role: guest.role, invitationCode: guest.invitationCode }
          : null,
      }),
    );
  }

  private image(res: http.ServerResponse, id: string): void {
    const image = this.images.find((i) => i.id === id);

    if (!image) {
      res.statusCode = 404;
      res.end("Image not found");
      return;
    }

    res.setHeader("Content-Type", "image/webp");
    res.end(image.buffer);
  }

  private match(pathname: string, prefix: string): boolean {
    return pathname === prefix || pathname.startsWith(prefix);
  }
}
