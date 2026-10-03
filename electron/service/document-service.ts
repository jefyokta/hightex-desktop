import { PushResponse } from "@main/types/server-responses/push-response";
import { HasStorage } from "./concerns/has-storage";
import { ServerService } from "./server-service";

export class DocumentService extends HasStorage<Record<string, string>> {
    protected storageName: string = "document_sha256";

    static pull(){}

    static async push(file: Uint8Array, hash: string, document: HighTexDocument): Promise<any> {
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(file)]), `${document.id}.hightex`);

        const response = await ServerService.request<PushResponse>("/v2/documents/sync", {
            method: "POST",
            headers: {
                "X-Document-ID": document.id,
                "X-HighTex-SHA256": hash,
                "X-HighTex-Base-SHA256": this.getBaseSHA256(document.id) ?? "",
                "X-Document-Title": encodeURIComponent(document.title),
                "X-Document-Category-ID": String(document.category ?? ""),
                "X-Document-Keywords-ID": encodeURIComponent(document.keywords.indonesian.join(",")),
                "X-Document-Keywords-EN": encodeURIComponent(document.keywords.english.join(",")),
            },
            body: form,
        });

        this.setBaseSHA256(document.id, hash);

        return response;
    }

    private static getBaseSHA256(documentId: string): string | undefined {
        const store = this.instance().storage.get() || {};
        return store[documentId];
    }

    private static setBaseSHA256(documentId: string, hash: string): void {
        const store = this.instance().storage.get() || {};
        store[documentId] = hash;
        this.instance().storage.set(store);
    }
}