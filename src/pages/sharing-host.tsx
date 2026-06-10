import { ContextMenuResolver } from "@/compiler/resolver/context-menu-resolver";
import { SelectionResolver } from "@/compiler/resolver/selection-resolver";
import { SharingException } from "@/exception/sharing-exception";
import { useSharing } from "@/hooks/use-sharing";
import { useEffect, useRef } from "react";

export const SharingHost = () => {
    const { connectHost, } = useSharing();

    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let disposed = false;

        (async () => {
            try {
                const info = await window.sharing.info();

                if (disposed) return;

                if (!info) {
                    throw new SharingException(
                        "You are not sharing any document"
                    );
                }

                await connectHost(info.port);

                if (disposed) return;

                const snapshot = await window.sharing.getSnapshot();

                if (disposed) return;
                const style = document.createElement("style")
                style.innerHTML = snapshot.css
                document.head.append(style)
                ref.current?.replaceChildren();

                if (ref.current) {
                    ref.current.innerHTML = snapshot.html;
                    ref.current.style.paddingBottom = "432px";
                }

                const imgs =
                    document.querySelectorAll<HTMLImageElement>("img[data-img-id]");

                await Promise.all(
                    Array.from(imgs).map(async (img) => {
                        const id = img.dataset.imgId;
                        if (!id) return;

                        const res = await fetch(
                            `http://127.0.0.1:${info.port}/share/image/${id}`
                        );

                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);

                        img.src = url;

                        new ContextMenuResolver().resolve()
                        await new SelectionResolver().resolve()
                    })
                ).catch(() => { });
            } catch (e) {
                if (e instanceof SharingException) {
                    throw e
                }
                if (e instanceof Error) {
                    throw new SharingException(e.message)
                }
                if (typeof e == 'string') {
                    throw new SharingException(e)

                }
            }
        })();

        return () => {
            disposed = true;
        };
    }, [connectHost]);


    return <>
        <div ref={ref} className=" mx-auto" />
    </>
};