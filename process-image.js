const sharp = require('sharp');
const fs = require('fs');

async function processImage() {
    try {
        const inputPath = './public/images/custom-n.png';
        const outputPath = './public/images/custom-n-transparent.png';
        
        // Remove white background (make #ffffff transparent)
        // We'll threshold to grab the black N, then use it as alpha
        await sharp(inputPath)
            .flatten({ background: '#ffffff' })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })
            .then(({ data, info }) => {
                for (let i = 0; i < data.length; i += info.channels) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    
                    // If the pixel is mostly white, make it transparent
                    if (r > 200 && g > 200 && b > 200) {
                        data[i+3] = 0; // alpha = 0 (transparent)
                    } else if (r < 50 && g < 50 && b < 50) {
                        // Keep it black, alpha = 255
                        data[i] = 0;
                        data[i+1] = 0;
                        data[i+2] = 0;
                        data[i+3] = 255;
                    }
                }
                return sharp(data, {
                    raw: {
                        width: info.width,
                        height: info.height,
                        channels: info.channels
                    }
                }).png().toFile(outputPath);
            });
            
        console.log("Image processed successfully!");
    } catch(e) {
        console.error(e);
    }
}

processImage();
