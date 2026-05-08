import type { JimpInstance } from "jimp";
import type { RGBA } from "./color.js";
export declare const VERSION_TAG = 1;
export declare const FORMAT_ALPHA = 1;
export declare const FORMAT_RGB565 = 4;
export declare const FORMAT_PALETTE1 = 8;
export declare const FORMAT_PALETTE2 = 24;
export declare const FORMAT_PALETTE4 = 40;
export declare const FORMAT_PALETTE8 = 56;
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
export declare function getPixels(jimp: JimpInstance): ImageData;
//# sourceMappingURL=image.d.ts.map