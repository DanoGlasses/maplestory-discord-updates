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
    url: 'PASTE_PATCH_URL_HERE',
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

    if (links.length === 0) return [];

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

  // FIRST RUN — initialize only
  if (!last) {
    console.log(`First run detected for ${board.name} — initializing.`);
    fs.writeFileSync(board.lastFile, posts[0].link);
    return;
  }

  const lastIndex = posts.findIndex(p => p.link === last);

  let newPosts = [];
  if (lastIndex === -1) {
    newPosts = posts.slice().reverse();
  } else {
    newPosts = posts.slice(0, lastIndex).reverse();
  }

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

for (const board of BOARDS) {
  await checkBoard(board, page);
}

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

  if (links.length === 0) return [];

  // Group by vertical proximity
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

  // Largest group = real update list
  groups.sort((a, b) => b.length - a.length);
  const postList = groups[0];

  // Sort newest → oldest (top → bottom)
  postList.sort((a, b) => a.top - b.top);

  return postList;
});

if (!posts || posts.length === 0) {
  console.log('No forum posts found.');
  return;
}

let last = '';
if (fs.existsSync(LAST_FILE)) {
  last = fs.readFileSync(LAST_FILE, 'utf8').trim();
}

// Find new posts
let newPosts = [];
if (last) {
  const lastIndex = posts.findIndex(p => p.link === last);
  if (lastIndex === -1) {
    // Last post not found — treat everything as new
    newPosts = posts.slice().reverse();
  } else {
    newPosts = posts.slice(0, lastIndex).reverse();
  }
} else {
  console.log('First run detected — initializing without posting.');
  fs.writeFileSync(LAST_FILE, posts[0].link);
  return;
}

if (newPosts.length === 0) {
  console.log('No new updates.');
  return;
}

// Post oldest → newest
    newPosts = newPosts.slice(0, 5);
for (const post of newPosts) {
  await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `📰 **New MapleStory Idle Update**\n${post.title}\n${post.link}`
    })
  });
  console.log('Posted:', post.title);
}

// Save newest post
fs.writeFileSync(LAST_FILE, posts[0].link);

console.log(`Posted ${newPosts.length} update(s) to Discord.`);
  } catch (err) {
    console.error('SCRIPT ERROR:', err);
  } finally {
    await browser.close();
  }
})();
