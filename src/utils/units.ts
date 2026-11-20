const CSS_PIXELS_PER_INCH = 96;
const MILLIMETRES_PER_INCH = 25.4;

export const mmToPx = (millimetres: number): number =>
  (millimetres * CSS_PIXELS_PER_INCH) / MILLIMETRES_PER_INCH;

export const pxToMm = (pixels: number): number =>
  (pixels * MILLIMETRES_PER_INCH) / CSS_PIXELS_PER_INCH;
