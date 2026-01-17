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
  // 1. Get all links
  const allLinks = Array.from(document.querySelectorAll('a'));

  // 2. Keep only forum post links with text
  const forumLinks = allLinks.filter(a => {
    return (
      a.href &&
      a.href.includes('/board_view') &&
      a.innerText &&
      a.innerText.trim().length > 0
    );
  });

  // 3. Map links to usable objects
  const mapped = forumLinks.map(a => {
    const r = a.getBoundingClientRect();
    return {
      title: a.innerText.trim(),
      link: a.href,
      top: r.top,
      bottom: r.bottom,
      visible: r.top > 0 && r.bottom > 0
    };
  });

  // 4. Only visible links
  const visibleLinks = mapped.filter(a => a.visible);

  if (visibleLinks.length === 0) {
    return null;
  }

  // 5. Group by vertical position (real post list is the densest group)
  const groups = [];
  const threshold = 30;

  for (const link of visibleLinks) {
    let added = false;

    for (const group of groups) {
      if (Math.abs(group[0].top - link.top) < threshold) {
        group.push(link);
        added = true;
        break;
      }
    }

    if (!added) {
      groups.push([link]);
    }
  }

  if (groups.length === 0) {
    return null;
  }

  // 6. Largest group = actual forum list
  groups.sort((a, b) => b.length - a.length);
  const postList = groups[0];

  // 7. Newest post = top-most in that list
  postList.sort((a, b) => a.top - b.top);

  return {
    title: postList[0].title,
    link: postList[0].link
  };
});


    .filter(a => a.visible);

  if (candidates.length === 0) return null;

  // Sort by vertical position — topmost visible post is newest
  candidates.sort((a, b) => a.top - b.top);

  return {
    title: candidates[0].title,
    link: candidates[0].link
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
