import type { JimpInstance } from "jimp";
export interface Frame {
    image: JimpInstance;
    duration: number;
}
export declare function readGif(data: Uint8Array): Promise<Array<Frame>>;
//# sourceMappingURL=gif.d.ts.map