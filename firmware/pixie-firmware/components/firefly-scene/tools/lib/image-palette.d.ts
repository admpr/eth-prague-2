import type { JimpInstance } from "jimp";
import type { Image } from "./image.js";
export declare class ImagePalette implements Image {
    #private;
    readonly width: number;
    readonly height: number;
    constructor(width: number, height: number, palette: Array<number>, indices: Array<number>);
    _addSize(data: Array<number>): void;
    _addPalette(data: Array<number>): void;
    _addPixels(data: Array<number>): void;
    get bytes(): Uint8Array;
    static fromImage(jimp: JimpInstance): ImagePalette;
}
//# sourceMappingURL=image-palette.d.ts.map