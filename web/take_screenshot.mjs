import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://localhost:3000/?frame_id=123&instance_id=456&platform=desktop', { waitUntil: 'networkidle0' });
  
  await page.screenshot({ path: 'screenshot.png' });
  
  await browser.close();
})();
