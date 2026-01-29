console.log("SCRIPT FILE LOADED");

import { chromium } from "playwright";
import fetch from "node-fetch";
import fs from "fs";

// ======================
// CONFIG
// ======================

const WEBHOOK =
  "https://discord.com/api/webhooks/1461880288387792899/oAry0PaXKltXJhMldTYAIH9na4UV0hvGslwI_KvJgUT18i3zA2sO-7lfmUwyh1fKftm6";

const BOARDS = [
  {
    name: "Event",
    url: "https://forum.nexon.com/maplestoryidle/board_list?board=6676",
    lastFile: "last_update.txt",
    emoji: "🎉",
  },
  {
    name: "Patches",
    url: "https://forum.nexon.com/maplestoryidle/board_list?board=6675",
    lastFile: "last_patch.txt",
    emoji: "🛠️",
  },
  {
    name: "Announcements",
    url: "https://forum.nexon.com/maplestoryidle/board_list?board=6653",
    lastFile: "last_announcement.txt",
    emoji: "📢",
  },
];

// ======================
// HELPERS
// ======================

function extractThreadId(url) {
  const match = url.match(/thread=(\d+)/);
  return match ? Number(match[1]) : 0;
}

// ======================
// CORE LOGIC
// ======================

async function checkBoard(board, page) {
  console.log(`\nChecking ${board.name} board...`);

  await page.goto(board.url, { waitUntil: "networkidle" });

  await page.waitForSelector('a[href*="board_view"]', {
    timeout: 15000,
  });

  const posts = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll('a[href*="board_view"]')
    )
      .map(a => ({
        title: a.innerText.trim(),
        link: a.href,
      }))
      .filter(p => p.title.length > 5)
      .filter(
        (p, i, arr) =>
          i === arr.findIndex(x => x.link === p.link)
      );
  });

  if (!posts.length) {
    console.log(`No posts found for ${board.name}`);
    return;
  }

  // Sort newest → oldest using thread ID
  posts.sort(
    (a, b) =>
      extractThreadId(b.link) - extractThreadId(a.link)
  );

  let lastLink = "";
  if (fs.existsSync(board.lastFile)) {
    lastLink = fs.readFileSync(board.lastFile, "utf8").trim();
  }

  const lastId = extractThreadId(lastLink);

  // First run → baseline only
  if (!lastId) {
    console.log(`First run for ${board.name}. Saving baseline.`);
    fs.writeFileSync(board.lastFile, posts[0].link);
    return;
  }

  const newPosts = posts
    .filter(p => extractThreadId(p.link) > lastId)
    .sort(
      (a, b) =>
        extractThreadId(a.link) - extractThreadId(b.link)
    ); // oldest → newest

  if (!newPosts.length) {
    console.log(`No new ${board.name} updates.`);
    return;
  }

  for (const post of newPosts) {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `${board.emoji} **New MapleStory Idle ${board.name} Update**\n**${post.title}**\n${post.link}`,
      }),
    });

    console.log(`Posted ${board.name}: ${post.title}`);
  }

  // Save newest post
  fs.writeFileSync(board.lastFile, posts[0].link);
}

// ======================
// RUNNER
// ======================

(async () => {
  console.log("Starting MapleStory Idle update check...");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    for (const board of BOARDS) {
      await checkBoard(board, page);
    }
  } catch (err) {
    console.error("SCRIPT ERROR:", err);
  } finally {
    await browser.close();
  }
})();

