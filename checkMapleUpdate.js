import { chromium } from 'playwright';
import fetch from 'node-fetch';
import fs from 'fs';

const UPDATE_PAGE = 'https://forum.nexon.com/maplestoryidle/board_list?board=6676';
const LAST_FILE = 'last_update.txt';
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

(async () => {
  console.log('Starting MapleStory Idle update check...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(UPDATE_PAGE, { waitUntil: 'domcontentloaded' });

    // IMPORTANT: wait for the board to exist
    await page.waitForTimeout(5000);

    const debug = await page.evaluate(() => {
      return {
        title: document.title,
        rowCount: document.querySelectorAll('tr').length,
        hasLinks: document.querySelectorAll('a').length
      };
    });

    console.log('DEBUG:', debug);

    const latest = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const postRow = rows.find(r => r.querySelector('a'));

      if (!postRow) return null;

      const linkEl = postRow.querySelector('a');
      const title = linkEl.innerText.trim();
      let link = linkEl.getAttribute('href');

      if (link && !link.startsWith('http')) {
        link = 'https://forum.nexon.com' + link;
      }

      return { title, link };
    });

    if (!latest) {
      console.log('No forum post found.');
      return;
    }

    console.log('LATEST FOUND:', latest);

    let last = '';
    if (fs.existsSync(LAST_FILE)) {
      last = fs.readFileSync(LAST_FILE, 'utf8');
    }

    if (latest.link === last) {
      console.log('No new update.');
      return;
    }

    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `📰 **New MapleStory Idle Update**\n${latest.title}\n${latest.link}`
      })
    });

    fs.writeFileSync(LAST_FILE, latest.link);
    console.log('Posted to Discord!');
  } catch (err) {
    console.error('SCRIPT ERROR:', err);
  } finally {
    await browser.close();
  }
})();
