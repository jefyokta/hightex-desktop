// Shared local-only input copies. Never include archive names/content in fixtures.
const { createHash } = require("node:crypto");
const {
  readdirSync,
  readFileSync,
  copyFileSync,
  mkdirSync,
} = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
exports.hash = hash;
exports.prepare = ({ artifacts }) => {
  assert(
    process.env.HIGHTEX_PAGINATION_CATEGORIES,
    "A local category directory is required",
  );
  const directory = path.resolve(process.env.HIGHTEX_PAGINATION_DOCUMENTS);
  const inputs = readdirSync(directory)
    .filter((name) => name.endsWith(".hightex"))
    .sort();
  assert(inputs.length, "No .hightex archives found");
  const copies = path.join(artifacts, "private-inputs");
  mkdirSync(copies);
  const files = inputs.map((name, index) => {
    const label = `doc-${String(index + 1).padStart(2, "0")}`,
      source = path.join(directory, name),
      copy = path.join(copies, label + ".hightex");
    const originalHash = hash(readFileSync(source));
    copyFileSync(source, copy);
    return { label, source, copy, originalHash };
  });
  const categories = readFileSync(process.env.HIGHTEX_PAGINATION_CATEGORIES);
  return {
    files,
    categories,
    unchanged: () =>
      files.every(
        (file) => hash(readFileSync(file.source)) === file.originalHash,
      ),
    serve(req, res) {
      if (req.url === "/document-test/categories") {
        res.setHeader("content-type", "application/json");
        res.end(categories);
        return true;
      }
      const file = files.find(
        (file) => req.url === `/document-test/${file.label}`,
      );
      if (!file) return false;
      res.setHeader("content-type", "application/octet-stream");
      res.end(readFileSync(file.copy));
      return true;
    },
  };
};
