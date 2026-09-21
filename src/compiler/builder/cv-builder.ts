import { Engine } from "../engine";
import { ImageQueue } from "../queues/image-queue";

export class CVPageBuilder {
    static async create(engine: Engine) {
        const api = engine.isInFrame() ? window.parent : window;

        const profile = await api.profile.get();
        const profilePicture = await api.profile.picture();

        const page = document.createElement("div");

        Object.assign(
            page.style,
            {
                height: "297mm",
                maxWidth: "210mm",
                padding: "3cm 3cm 4cm 3cm",
                fontFamily: "'Times New Roman', serif",
                textAlign: "justify",
                fontSize: "12pt",
                backgroundColor: "white",
                // border:"1px solid black",
                lineHeight:"24px"
            } satisfies Partial<CSSStyleDeclaration>,
        );

        const heading = document.createElement("h1");
        // heading.classList.add("chapter");
        heading.textContent = "DAFTAR RIWAYAT HIDUP";

        Object.assign(
            heading.style,
            {
                fontSize: "14pt",
                fontWeight: "700",
                textAlign: "center",
                marginTop: "10pt",
                marginBottom: "10pt",
            } satisfies Partial<CSSStyleDeclaration>,
        );

        page.appendChild(heading);

        const imageWrapper = document.createElement("div");

        Object.assign(
            imageWrapper.style,
            {
                float: "left",
                width: "3cm",
                height: "4cm",
                marginRight: "10pt",
                marginBottom: "5pt",
            } satisfies Partial<CSSStyleDeclaration>,
        );

        if (profilePicture) {
            const blob = new Blob(
                [new Uint8Array(profilePicture)],
                {
                    type: "image/webp",
                },
            );

            const url = URL.createObjectURL(blob);

            ImageQueue.objectUrls.push(url);

            const image = document.createElement("img");

            image.src = url;
            image.alt = "Profile";

            Object.assign(
                image.style,
                {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                } satisfies Partial<CSSStyleDeclaration>,
            );

            imageWrapper.appendChild(image);
        }

        page.appendChild(imageWrapper);

        const contentEl = document.createElement("div");
        contentEl.innerHTML = profile.cv;

        page.appendChild(contentEl);
        if(engine.config.paged?.renderTo){
            
            engine.config.paged.renderTo.appendChild(page)
        }
        return page;
    }
}