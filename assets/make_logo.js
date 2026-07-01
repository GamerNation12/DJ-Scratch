const sharp = require('sharp');
const fs = require('fs');

const svgText = Buffer.from(`<svg width="800" height="800">
  <rect x="0" y="0" width="800" height="800" fill="#020617" opacity="0.4"/>
  <text x="400" y="380" font-family="Arial, sans-serif" font-weight="bold" font-size="140" fill="#ffffff" text-anchor="middle">DJ</text>
  <text x="400" y="500" font-family="Arial, sans-serif" font-weight="bold" font-size="70" fill="#22d3ee" text-anchor="middle" letter-spacing="12">SCRATCH</text>
</svg>`);

const circleMask = Buffer.from(`<svg width="800" height="800">
  <circle cx="400" cy="400" r="400" fill="#fff" />
</svg>`);

sharp('dj_scratch_reference.jpg')
  .resize(800, 800, { fit: 'cover' })
  .modulate({ saturation: 0.2, brightness: 1.2 }) // lower original saturation
  .tint({ r: 20, g: 100, b: 255 }) // apply cool blue tint
  .composite([
    { input: svgText, blend: 'over' },
    { input: circleMask, blend: 'dest-in' }
  ])
  .png()
  .toFile('logo_photo.png')
  .then(() => console.log('Successfully created logo_photo.png!'))
  .catch(err => console.error(err));
