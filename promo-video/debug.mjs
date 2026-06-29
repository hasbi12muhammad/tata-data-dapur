import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 160)));
page.on("pageerror", (e) => console.log("PAGEERR", e.message.slice(0, 200)));
page.on("requestfailed", (r) => console.log("REQFAIL", r.url().slice(0, 80), r.failure()?.errorText));
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle2" });
await sleep(9000);
const info = await page.evaluate(() => {
  let reactNodes = 0;
  document.querySelectorAll("*").forEach((el) => {
    if (Object.keys(el).some((k) => k.startsWith("__react"))) reactNodes++;
  });
  const btn = document.querySelector('button[type=submit]');
  return { reactNodes, totalEls: document.querySelectorAll("*").length, btnText: btn?.textContent };
});
console.log("INFO", JSON.stringify(info));
await browser.close();
