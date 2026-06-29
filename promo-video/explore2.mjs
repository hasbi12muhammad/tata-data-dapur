import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "http://localhost:3000";
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.waitForSelector("input[type=email]");
await page.waitForFunction(() => { const el = document.querySelector('button[type=submit]'); return el && Object.keys(el).some((k) => k.startsWith("__reactProps$")); }, { timeout: 30000, polling: 200 });
await page.evaluate((email, pass) => { const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value"); d.set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }; set(document.querySelector('input[type=email]'), email); set(document.querySelector('input[type=password]'), pass); }, "akun-demo@tatadata-dapur.com", "hasbi123456");
await page.click('button[type=submit]');
await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
await sleep(2000);
await page.goto(`${BASE}/recipes`, { waitUntil: "networkidle2" });
await sleep(2000);
await page.evaluate(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "Produk Baru")?.click());
await sleep(1800);

const info = await page.evaluate(() => {
  const sel = document.querySelector("select");
  const opts = sel ? Array.from(sel.options).map((o) => o.textContent.trim()) : [];
  const btns = Array.from(document.querySelectorAll("button")).map((b) => b.textContent.trim()).filter((t) => t);
  // find element mentioning HPP
  const hpp = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /HPP/i.test(e.textContent)).map((e) => e.textContent.trim()).slice(0, 6);
  return { bahanOptions: opts.slice(0, 25), optCount: opts.length, modalButtons: btns.slice(0, 20), hppTexts: hpp };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
