import { open } from "node:fs/promises";

export function machoArchitectures(bytes: Buffer): string[] {
  if (bytes.length < 8)
    throw Error("The update executable is not a Mach-O binary.");
  const magic = bytes.readUInt32BE(0);
  const little = [0xcefaedfe, 0xcffaedfe, 0xbebafeca, 0xbfbafeca].includes(
    magic,
  );
  const read = (offset: number) =>
    little ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset);
  const names = (cpu: number) =>
    cpu === 0x0100000c ? "arm64" : cpu === 0x01000007 ? "x64" : "unknown";
  if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe].includes(magic))
    return [names(read(4))];
  if (![0xcafebabe, 0xcafebabf, 0xbebafeca, 0xbfbafeca].includes(magic))
    throw Error("The update executable is not a Mach-O binary.");
  const count = read(4);
  const size = [0xcafebabf, 0xbfbafeca].includes(magic) ? 32 : 20;
  if (!count || count > 32 || 8 + count * size > bytes.length)
    throw Error("The update executable has an invalid architecture header.");
  return Array.from({ length: count }, (_, index) =>
    names(read(8 + index * size)),
  );
}

export async function checkMacArchitecture(file: string, arch: string) {
  const handle = await open(file, "r");
  try {
    const bytes = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (!machoArchitectures(bytes.subarray(0, bytesRead)).includes(arch))
      throw Error("The update does not support this Mac's architecture.");
  } finally {
    await handle.close();
  }
}
