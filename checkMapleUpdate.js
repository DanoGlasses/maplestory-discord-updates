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
      .map((a) => ({
        title: a.innerText.trim(),
        link: a.href,
      }))
      .filter((p) => p.title.length > 5)
      .filter(
        (p, i, arr) =>
          i === arr.findIndex((x) => x.link === p.link)
      );
  });

  console.log(`${board.name} posts found: ${posts.length}`);

  if (!posts.length) return;

  let last = "";
  if (fs.existsSync(board.lastFile)) {
    last = fs.readFileSync(board.lastFile, "utf8").trim();
  }

  // First run = baseline
  if (!last) {
    console.log(`First run for ${board.name}. Saving baseline.`);
    fs.writeFileSync(board.lastFile, posts[0].link);
    return;
  }

  const newPosts = [];
  for (const post of posts) {
    if (post.link === last) break;
    newPosts.push(post);
  }

  if (!newPosts.length) {
    console.log(`No new ${board.name} updates.`);
    return;
  }

  newPosts.reverse();

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

  fs.writeFileSync(
    board.lastFile,
    newPosts[newPosts.length - 1].link
  );
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
