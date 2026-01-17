console.log("SCRIPT FILE LOADED");

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
  const MIN_TOP = 300; // ignore featured / header posts

  // 1. Collect all real forum post links below header area
  const links = Array.from(document.querySelectorAll('a'))
    .filter(a =>
      a.href &&
      a.href.includes('/board_view') &&
      a.innerText &&
      a.innerText.trim().length > 0
    )
    .map(a => {
      const r = a.getBoundingClientRect();
      return {
        title: a.innerText.trim(),
        link: a.href,
        top: r.top,
        bottom: r.bottom
      };
    })
    // 🔑 THIS IS THE IMPORTANT FILTER
    .filter(a => a.top > MIN_TOP && a.bottom > 0);

  if (links.length === 0) return null;

  // 2. Group by vertical proximity
  const groups = [];
  const threshold = 30;

  for (const link of links) {
    let placed = false;
    for (const group of groups) {
      if (Math.abs(group[0].top - link.top) < threshold) {
        group.push(link);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([link]);
  }

  if (groups.length === 0) return null;

  // 3. Largest group = real update list
  groups.sort((a, b) => b.length - a.length);
  const postList = groups[0];

  // 4. Newest update = top-most in that list
  postList.sort((a, b) => a.top - b.top);

  return {
    title: postList[0].title,
    link: postList[0].link
  };
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
