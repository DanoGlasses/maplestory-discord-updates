import { chromium } from 'playwright';
import fetch from 'node-fetch';
import fs from 'fs';

const UPDATE_PAGE = 'https://forum.nexon.com/maplestoryidle/board_list?board=6676';
const LAST_FILE = 'last_update.txt';
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(UPDATE_PAGE, { waitUntil: 'networkidle' });

const latest = await page.evaluate(() => {
  const firstRow = document.querySelector('table.board_list tbody tr');
  if (!firstRow) return null;

  const linkElement = firstRow.querySelector('td.subject a');
  const title = linkElement?.innerText.trim();
  const link = linkElement ? linkElement.href : null;

  return { title, link };
});

  await browser.close();

  if (!latest) return;

  let last = '';
  if (fs.existsSync(LAST_FILE)) {
    last = fs.readFileSync(LAST_FILE, 'utf8');
  }

  if (latest.link === last) {
    console.log('No new MapleStory update.');
    return;
  }

  await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: latest.title,
        url: latest.link,
        color: 3447003,
        footer: { text: 'MapleStory Updates' },
        timestamp: new Date().toISOString()
      }]
    })
  });

  fs.writeFileSync(LAST_FILE, latest.link);
  console.log('New update posted to Discord!');
})();
