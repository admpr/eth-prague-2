import { getPixels } from "./image.js";
import { ImageRGB } from "./image-rgb.js";
export class ImageSubPixel extends ImageRGB {
    static fromImage(jimp) {
        const { width, height, pixels } = getPixels(jimp);
        if ((width % 3) || (height % 3)) {
            throw new Error(`sub-pixel image must be 3x`);
        }
        const getPixel = (x, y) => {
            const p = pixels[y * width + x];
            return (p.r + p.g + p.b) / 3;
        };
        // Scaled parameters
        const sh = height / 3, sw = width / 3;
        const sp = [];
        for (let y = 0; y < height; y += 3) {
            for (let x = 0; x < width; x += 3) {
                const rgb = [];
                for (let sx = 0; sx < 3; sx++) {
                    let p = 0;
                    for (let sy = 0; sy < 3; sy++) {
                        p += getPixel(x + sx, y + sy);
                    }
                    rgb.push(Math.round(p / 3));
                }
                sp.push({ r: rgb[0], g: rgb[1], b: rgb[2], a: 255 });
            }
        }
        return new this(sw, sh, sp);
    }
}
//# sourceMappingURL=image-subpixel.js.map