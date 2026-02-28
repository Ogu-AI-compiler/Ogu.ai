/**
 * Color Palette Generator — generate color palettes from a base color.
 */
import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex } from "./color-space-converter.mjs";

function hslShift(hex, hDelta) {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newH = ((hsl.h + hDelta) % 360 + 360) % 360;
  const newRgb = hslToRgb(newH, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

export function complementary(hex) {
  return [hex, hslShift(hex, 180)];
}

export function analogous(hex) {
  return [hslShift(hex, -30), hex, hslShift(hex, 30)];
}

export function triadic(hex) {
  return [hex, hslShift(hex, 120), hslShift(hex, 240)];
}
