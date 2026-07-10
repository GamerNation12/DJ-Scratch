const sharp = require('sharp');
const fs = require('fs');

const svgText = Buffer.from(`<svg width="680" height="240">
  <rect x="0" y="0" width="680" height="240" fill="#020617" opacity="0.4"/>
  <text x="340" y="125" font-family="Arial, sans-serif" font-weight="bold" font-size="90" fill="#ffffff" text-anchor="middle">DJ</text>
  <text x="340" y="190" font-family="Arial, sans-serif" font-weight="bold" font-size="45" fill="#22d3ee" text-anchor="middle" letter-spacing="12">SCRATCH</text>
</svg>`);

sharp('dj_scratch_reference.jpg')
  .resize(680, 240, { fit: 'cover' })
  .modulate({ saturation: 0.2, brightness: 1.2 }) // lower original saturation
  .tint({ r: 20, g: 100, b: 255 }) // apply cool blue tint
  .composite([
    { input: svgText, blend: 'over' }
  ])
  .png()
  .toFile('discord_banner.png')
  .then(() => {
    console.log('Successfully created discord_banner.png!');
    fs.copyFileSync('discord_banner.png', process.argv[2] + '/discord_banner.png');
  })
  .catch(err => console.error(err));
