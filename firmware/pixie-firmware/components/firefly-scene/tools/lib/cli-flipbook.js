import { readFileSync } from "fs";
import { toDotH } from "./dot-h.js";
import { readGif } from "./gif.js";
import { ImagePalette } from "./image-palette.js";
const filename = process.argv[2]; //"../examples/flipbook/demo-images/giphy.gif";
(async function () {
    const imgs = await readGif(readFileSync(filename));
    const frames = imgs.map(({ image, duration }, index) => {
        console.log({ duration });
        //const { width, height } = image.bitmap;
        //const y = Math.trunc(height * 0.2);
        //image = <JimpInstance>image.crop({
        //    x: 0, y, w: width, h: height - y
        //});
        return ImagePalette.fromImage(image.cover({
            w: 240, h: 240 //, align: 2 | 16
        }));
    });
    const output = [];
    frames.forEach((image, index) => {
        output.push(toDotH(image.bytes, `nyan_${index}`));
    });
    console.log(output.join("\n\n"));
})();
//# sourceMappingURL=cli-flipbook.js.map