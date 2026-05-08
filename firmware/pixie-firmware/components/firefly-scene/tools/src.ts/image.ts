
import type { JimpInstance } from "jimp";

import type { RGBA } from "./color.js";


export const VERSION_TAG      = 0x01

export const FORMAT_ALPHA     = 0x01;

// RGB565
// If FORMAT_ALPHA, upper table indicates 4-bit alpha
export const FORMAT_RGB565    = 0x04;

// Palette modes:
// PALETTEn indicates bit-width; 2, 4, 16 and 256 colors
// To compute size from FORMAT `count = (1 << (format >> 4))`
// If FORMAT_ALPHA, color 0 is fully transparent
export const FORMAT_PALETTE1  = 0x08;
export const FORMAT_PALETTE2  = 0x18;
export const FORMAT_PALETTE4  = 0x28;
export const FORMAT_PALETTE8  = 0x38;


export interface Image {
    width: number;
    height: number;
    bytes: Uint8Array;
}

export type ImageData = {
    width: number;
    height: number;
    pixels: Array<RGBA>;
};

/*
import type { BitMap } from "@jimp/types";

export type JimpType {
    bitmap: Bitmap;
    height: number;
    width: number;
}
*/
export function getPixels(jimp: JimpInstance): ImageData {
    const { data, width, height } = jimp.bitmap;

    const size = width * height;
    const pixels: Array<RGBA> = [ ];
    for (let i = 0; i < size; i++) {
        const r = data[4 * i + 0];
        const g = data[4 * i + 1];
        const b = data[4 * i + 2];
        const a = data[4 * i + 3];
        pixels.push({ r, g, b, a });
    }

    return { width, height, pixels };
}
