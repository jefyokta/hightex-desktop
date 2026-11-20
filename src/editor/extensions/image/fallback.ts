/** A portable, deterministic content placeholder shared by editor and layout. */
export const MISSING_IMAGE_SOURCE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><rect x="1" y="1" width="398" height="238" fill="#fff" stroke="#b91c1c"/><text x="200" y="124" text-anchor="middle" font-family="serif" font-size="20" fill="#b91c1c">Gambar tidak tersedia</text></svg>',
  );

export function missingImage(image: HTMLImageElement) {
  image.src = MISSING_IMAGE_SOURCE;
  image.alt = "Gambar tidak tersedia";
}
