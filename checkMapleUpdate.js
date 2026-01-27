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

  console.log(`${board.name} posts found: ${posts.length}`);

  if (!posts.length) return;

