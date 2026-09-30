
import { describe, expect, test } from "bun:test";

const images = new Map<string, ImageRecord>();

const HighTexDB = {
  getInstance: () => ({
    images: {
      put: async (record: ImageRecord) => {
        images.set(record.id, record);
      },
      get: async (id: string) => images.get(id),
    },
  }),
};

async function saveImage(blob: Blob, documentId: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const id = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const record: ImageRecord = {
    id,
    blob,
    documentId,
    createdAt: Date.now(),
  };

  await HighTexDB.getInstance().images.put(record);

  return id;
}

describe("HighTexDB.saveImage", () => {
  test("saves image and returns SHA-256 hash", async () => {
    images.clear();

    const blob = new Blob(["hello world"]);
    const id = await saveImage(blob, "document-123");

    expect(id).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );

    const record = await HighTexDB.getInstance().images.get(id);

    expect(record).toBeDefined();
    expect(record?.id).toBe(id);
    expect(record?.documentId).toBe("document-123");
    expect(await record?.blob.text()).toBe("hello world");
    expect(record?.createdAt).toBeGreaterThan(0);
  });

  test("returns the same id for the same content", async () => {
    images.clear();

    const id1 = await saveImage(
      new Blob(["same content"]),
      "document-1",
    );

    const id2 = await saveImage(
      new Blob(["same content"]),
      "document-2",
    );

    expect(id1).toBe(id2);
  });

  test("returns different ids for different content", async () => {
    images.clear();

    const id1 = await saveImage(
      new Blob(["image one"]),
      "document-1",
    );

    const id2 = await saveImage(
      new Blob(["image two"]),
      "document-1",
    );

    expect(id1).not.toBe(id2);
  });
});

