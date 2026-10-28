# How it work?

in client side we count the hash of hightex package's content

it based on it's entry

## We dont compare the binary file

```ts
const sha256 = hash(archive); // no

//yes
const entries = await importHightexPackageV2(archive);

const sha256 = createFingerPrint(entries);
```

### what kind of entry will we count?

almost all of json file, except profile.json, meta.json, and manifest.json. Profile and meta are mutable, while document IDs in the manifest may differ between local and server copies of the same content.

## why we need sha256 ?

if user had document that saved in cloud

the content containt

```text
hello world
```

then user when trying to save to the cloud,

it will create the fingerprint and send to the server, if the server latest cloud archive is equivalent with the user current hash content, the server will reject to save due to nothing to save

## Confirmed entry rules

`files/config.json` participates in the fingerprint. Config affects document output (for example approval and statement
dates), so changing config alone must create a new cloud version.

The client fingerprints the validated importer model with deterministic entry
ordering and canonical JSON keys. It includes chapters, references, variables,
aliases, config, and illustration content. The entire `manifest.json` is excluded
because local and server document IDs may differ. Profile JSON, profile pictures, and export metadata are
excluded. ZIP timestamps, compression, entry ordering, JSON formatting, and the
`version`/`schema_version` alias do not change the fingerprint.

The server stores `X-HighTex-SHA256` supplied by the client; it does not calculate
the fingerprint. Equal hashes return `changed: false` without replacing the
stored archive. Pull validates the downloaded package using the same content
fingerprint before it can become a local sync base. A binary archive checksum is
not interchangeable with this content fingerprint.

Use `tests/integration/cloud-content-hash.ts` with a dedicated empty test account
to verify the real HTTP contract. The scenario covers mutable-only changes,
config changes, manifest/ID independence, conflicts, archives, and backup before force recovery
of an older package whose stored hash does not match the current policy.
