import puppeteer from "puppeteer";
import * as fs from "fs";

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );

  const url = "https://cricclubs.com/NWCL/teamSchedule.do?teamId=1455&league=160&clubId=232";
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector("table", { timeout: 15000 });

  const html = await page.content();
  fs.writeFileSync("/tmp/cricclubs-team-schedule.html", html);
  console.log("Saved HTML to /tmp/cricclubs-team-schedule.html");
  console.log(`HTML length: ${html.length}`);

  await browser.close();
}

main().catch(console.error);
