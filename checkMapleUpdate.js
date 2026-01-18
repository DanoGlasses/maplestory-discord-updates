console.log("SCRIPT FILE LOADED");

import { chromium } from 'playwright';
import fetch from 'node-fetch';
import fs from 'fs';

const BOARDS = [
  {
    name: 'Event',
    url: 'https://forum.nexon.com/maplestoryidle/board_list?board=6676',
    lastFile: 'last_event.txt',
    emoji: '🎉'
  },
  {
    name: 'Patches',
    url: 'https://forum.nexon.com/maplestoryidle/board_list?board=6675',
    lastFile: 'last_patch.txt',
    emoji: '🛠️'
  }
];

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

async function checkBoard(board, page) {
  console.log(`Checking ${board.name} board...`);

  await page.goto(board.url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const posts = await page.evaluate(() => {
    const MIN_TOP = 300;

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
          top: r.top
        };
      })
      .filter(a => a.top > MIN_TOP);

    if (!links.length) return [];

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

    groups.sort((a, b) => b.length - a.length);
    const postList = groups[0];
    postList.sort((a, b) => a.top - b.top);

    return postList;
  });

  if (!posts.length) {
    console.log(`No posts found for ${board.name}`);
    return;
  }

  let last = '';
  if (fs.existsSync(board.lastFile)) {
    last = fs.readFileSync(board.lastFile, 'utf8').trim();
  }

  if (!last) {
    console.log(`First run detected for ${board.name} — initializing.`);
    fs.writeFileSync(board.lastFile, posts[0].link);
    return;
  }

  const lastIndex = posts.findIndex(p => p.link === last);
  const newPosts =
    lastIndex === -1
      ? posts.slice().reverse()
      : posts.slice(0, lastIndex).reverse();

  if (!newPosts.length) {
    console.log(`No new ${board.name} updates.`);
    return;
  }

  for (const post of newPosts) {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `${board.emoji} **New MapleStory Idle ${board.name} Update**\n${post.title}\n${post.link}`
      })
    });
    console.log(`Posted ${board.name}:`, post.title);
  }

  fs.writeFileSync(board.lastFile, posts[0].link);
}

(async () => {
  console.log('Starting MapleStory Idle update check...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    for (const board of BOARDS) {
      await checkBoard(board, page);
    }
  } catch (err) {
    console.error('SCRIPT ERROR:', err);
  } finally {
    await browser.close();
  }
})();
