// Generates PWA icons from logo.png
// Run with:  node scripts/gen-icons.js
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function makeIcon(size) {
  const img = await loadImage(path.join(__dirname, '..', 'public', 'logo.png'));
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');

  // Fill black background (matches logo background)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  // Draw the logo scaled to fill the square
  ctx.drawImage(img, 0, 0, size, size);

  return c.toBuffer('image/png');
}

(async () => {
  const outDir = path.join(__dirname, '..', 'public');

  for (const size of [192, 512]) {
    const buf = await makeIcon(size);
    const out = path.join(outDir, `icon-${size}.png`);
    fs.writeFileSync(out, buf);
    console.log(`Written ${out} (${buf.length} bytes)`);
  }

  const appleBuf = await makeIcon(180);
  fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), appleBuf);
  console.log('Written apple-touch-icon.png');
})();
