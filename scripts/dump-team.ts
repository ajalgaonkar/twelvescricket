import puppeteer from "puppeteer";
import * as fs from "fs";

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );

  // Fetch team page
  const url = "https://cricclubs.com/NWCL/viewTeam.do?teamId=1455&league=160&clubId=232";
  console.log("Fetching team page:", url);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector("table", { timeout: 15000 });
  const teamHtml = await page.content();
  fs.writeFileSync("/tmp/cricclubs-team.html", teamHtml);
  console.log("Saved team HTML:", teamHtml.length, "bytes");

  // Fetch a player page
  const playerUrl = "https://cricclubs.com/NWCL/viewPlayer.do?playerId=3345305&clubId=232";
  console.log("\nFetching player page:", playerUrl);
  await page.goto(playerUrl, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector("table", { timeout: 15000 });
  const playerHtml = await page.content();
  fs.writeFileSync("/tmp/cricclubs-player.html", playerHtml);
  console.log("Saved player HTML:", playerHtml.length, "bytes");

  await browser.close();
}

main().catch(console.error);
