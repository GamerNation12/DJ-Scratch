const https = require('https');
const fs = require('fs');
const sharp = require('sharp');

// URLs of 3 specific, very different DJ turntable/scratching photos from Unsplash
const images = [
  'https://images.unsplash.com/photo-1470229722913-7c090be5cbe5?w=800&q=80', // Close up of hand on vinyl
  'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&q=80', // Overhead shot of mixer and hands
  'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=800&q=80'  // Side angle of DJ playing
];

const svgText = Buffer.from(`<svg width="800" height="800">
  <rect x="0" y="0" width="800" height="800" fill="#020617" opacity="0.4"/>
  <text x="400" y="380" font-family="Arial, sans-serif" font-weight="bold" font-size="140" fill="#ffffff" text-anchor="middle">DJ</text>
  <text x="400" y="500" font-family="Arial, sans-serif" font-weight="bold" font-size="70" fill="#22d3ee" text-anchor="middle" letter-spacing="12">SCRATCH</text>
</svg>`);

const circleMask = Buffer.from(`<svg width="800" height="800">
  <circle cx="400" cy="400" r="400" fill="#fff" />
</svg>`);

async function processImage(url, index) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if(res.statusCode === 302 || res.statusCode === 301) {
        return processImage(res.headers.location, index).then(resolve).catch(reject);
      }
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', async () => {
        const buffer = Buffer.concat(data);
        try {
          await sharp(buffer)
            .resize(800, 800, { fit: 'cover' })
            .modulate({ saturation: 0.2, brightness: 1.2 })
            .tint({ r: 20, g: 100, b: 255 })
            .composite([
              { input: svgText, blend: 'over' },
              { input: circleMask, blend: 'dest-in' }
            ])
            .png()
            .toFile(`logo_opt${index}.png`);
          console.log(`Generated logo_opt${index}.png`);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  for (let i = 0; i < images.length; i++) {
    try {
      await processImage(images[i], i + 1);
    } catch (e) {
      console.error('Failed on image ' + (i+1), e);
    }
  }
}

main();
