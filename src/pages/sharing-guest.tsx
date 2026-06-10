import { SharingException } from "@/exception/sharing-exception";
import { useSharing } from "@/hooks/use-sharing";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { SelectionResolver } from "@/compiler/resolver/selection-resolver";

export const SharingGuest = () => {
    const { connectGuest, disconnect, send } = useSharing();
    const { host, port, code } = useParams();

    const ref = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let disposed = false;

        const run = async () => {
            try {
                setLoading(true);

                if (!host || !port || !code) {
                    const missing: string[] = [];

                    if (!host) missing.push("host");
                    if (!port) missing.push("port");
                    if (!code) missing.push("code");

                    throw new SharingException(
                        "Missing required params: " + missing.join(", ")
                    );
                }

                await connectGuest(host, port, code);
                if (disposed) return;

                const hostUrl = `http://${host}:${port}`;

                const url = `${hostUrl}/snapshot?code=${encodeURIComponent(code)}`;

                const res = await fetch(url);

                if (!res.ok) {
                    throw new SharingException(
                        `Failed to load snapshot (${res.status})`
                    );
                }

                const data: {
                    snapshot: Snapshot;
                    guest: {
                        role: SharingGuestRole;
                        invitationCode: string;
                    };
                } = await res.json();

                if (disposed) return;


                if (!ref.current) return;

                const parser = new DOMParser();
                const doc = parser.parseFromString(data.snapshot.html, "text/html");

                const imgs =
                    doc.querySelectorAll<HTMLImageElement>("img[data-img-id]");

                await Promise.all(
                    Array.from(imgs).map(async (img) => {
                        const id = img.dataset.imgId;
                        if (!id) return;

                        const res = await fetch(
                            `${hostUrl}/share/image/${id}`
                        );

                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);

                        img.src = url;
                    })
                ).catch(() => { });


                ref.current.innerHTML = doc.body.innerHTML;
                const singleStyle = document.createElement("style")
                singleStyle.innerHTML = data.snapshot.css
                document.head.append(singleStyle)


                await new SelectionResolver().resolve();
            } catch (e) {
                if (e instanceof SharingException) {
                    throw e;
                }

                if (e instanceof Error) {
                    throw new SharingException(e.message);
                }

                if (typeof e === "string") {
                    throw new SharingException(e);
                }
            } finally {
                if (!disposed) setLoading(false);
            }
        };

        run();

        return () => {
            disposed = true;
            disconnect();
        };
    }, [host, port, code, connectGuest, disconnect]);

    useEffect(() => {

        const timer = setInterval(() => {
            send({ type: "info", payload: { role: "" } })

        }, 1000);

        return ()=>{
            clearInterval(timer)
        }

    }, [])

    return (
        <div className="flex justify-center items-center min-h-screen">
            {loading && <div>Loading...</div>}

            <div
                ref={ref}
                className={loading ? "hidden" : ""}
                style={{ paddingBottom: "432px" }}
            />
        </div>
    );
};