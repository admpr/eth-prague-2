import type { JimpInstance } from "jimp";
import type { RGBA } from "./color.js";
import type { Image } from "./image.js";
export declare class ImageRGBA implements Image {
    #private;
    readonly width: number;
    readonly height: number;
    constructor(width: number, height: number, pixels: Array<RGBA>);
    _addSize(data: Array<number>): void;
    _addAlpha(data: Array<number>): void;
    _addRgb(data: Array<number>): void;
    get bytes(): Uint8Array;
    static fromImage(jimp: JimpInstance): ImageRGBA;
}
export declare class ImageRGB extends ImageRGBA {
    get bytes(): Uint8Array;
}
//# sourceMappingURL=image-rgb.d.ts.map