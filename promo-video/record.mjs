import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, rmSync } from "fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "http://localhost:3000";
const FR = "frames";
try { rmSync(FR, { recursive: true }); } catch {}
mkdirSync(FR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
});
const page = await browser.newPage();
// Next.js dev mode hydrates via eval(); the app sets a CSP without
// 'unsafe-eval', which headless Chrome enforces and blocks hydration.
// Bypass CSP so the client bundle runs and the login handler attaches.
await page.setBypassCSP(true);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

// ---- login ----
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.waitForSelector("input[type=email]");
await sleep(4500); // let the client bundle hydrate the form handler
// Type natively so the form's React state updates the normal way.
await page.type('input[type=email]', "akun-demo@tatadata-dapur.com", { delay: 25 });
await page.type('input[type=password]', "hasbi123456", { delay: 25 });
const authOk = page
  .waitForResponse((r) => r.url().includes("/auth/v1/token") && r.status() === 200, { timeout: 30000 })
  .then(() => console.log("  auth 200 OK"))
  .catch(() => console.log("  WARN: no auth 200"));
await sleep(300);
await page.click('button[type=submit]');
await authOk;
await sleep(2000);
await page.goto(`${BASE}/recipes`, { waitUntil: "networkidle2" });
await sleep(4000); // let the recipes page hydrate so the button handler attaches

// helpers
const setSelect = (idx, text) => page.evaluate((idx, text) => {
  const s = document.querySelectorAll("select")[idx];
  const opt = Array.from(s.options).find((o) => o.textContent.includes(text));
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
  setter.call(s, opt.value);
  s.dispatchEvent(new Event("change", { bubbles: true }));
  s.dispatchEvent(new Event("input", { bubbles: true }));
}, idx, text);
const setQty = (row, val) => page.evaluate((row, val) => {
  const q = Array.from(document.querySelectorAll('input[placeholder="Qty"]'))[row];
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(q, String(val));
  q.dispatchEvent(new Event("input", { bubbles: true }));
}, row, val);
// Use a real (trusted) mouse click — evaluate().click() does not open the
// modal or add rows because the handlers ignore synthetic clicks.
const clickText = async (t) => {
  const h = await page.evaluateHandle((t) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === t), t);
  const el = h.asElement();
  if (el) await el.click();
};
const scrollModalBottom = () => page.evaluate(() => {
  const d = document.querySelector('[role=dialog]') || document.querySelector('.fixed .overflow-y-auto') || document.querySelector('.overflow-y-auto');
  if (d) d.scrollTop = d.scrollHeight;
});

// open modal — wait for it to actually appear before recording
await clickText("Produk Baru");
await page.waitForSelector('input[placeholder="mis. Nasi Goreng"]', { timeout: 15000 });
await sleep(600);

// ---- start screencast ----
const client = await page.target().createCDPSession();
const frames = [];
client.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
  frames.push({ data, t: metadata.timestamp });
  try { await client.send("Page.screencastFrameAck", { sessionId }); } catch {}
});
await client.send("Page.startScreencast", { format: "jpeg", quality: 88, everyNthFrame: 1 });
const T0 = Date.now();

// ---- the recipe-building performance ----
// Paced so each ingredient is a readable beat (select -> qty -> short hold),
// then a clear hold on the computed HPP at the end.
await sleep(350);
const nameInput = await page.$('input[placeholder="mis. Nasi Goreng"]');
await nameInput.click();
await page.type('input[placeholder="mis. Nasi Goreng"]', "Pancake Susu Cokelat", { delay: 42 });
await sleep(500);

const bahan = [
  { t: "Tepung", q: 50 },
  { t: "Susu UHT", q: 100 },
  { t: "Telur", q: 1 },
  { t: "Topping", q: 20 },
];
for (let i = 0; i < bahan.length; i++) {
  if (i > 0) { await clickText("Tambah baris"); await sleep(250); await scrollModalBottom(); await sleep(120); }
  await setSelect(i, bahan[i].t);
  await sleep(260);
  await setQty(i, bahan[i].q);
  await sleep(620); // hold so the row + updating HPP is readable
}
await sleep(350);
await scrollModalBottom();
await sleep(1700); // hold on the computed HPP

// ---- stop ----
await client.send("Page.stopScreencast");
const TEND = Date.now();
await sleep(200);

// write frames + concat list (variable durations from timestamps)
let list = "";
const base = frames[0].t;
for (let i = 0; i < frames.length; i++) {
  const fn = `f${String(i).padStart(4, "0")}.jpg`;
  writeFileSync(`${FR}/${fn}`, Buffer.from(frames[i].data, "base64"));
  const next = i < frames.length - 1 ? frames[i + 1].t : base + (TEND - T0) / 1000;
  const dur = Math.max(0.016, next - frames[i].t);
  list += `file '${fn}'\nduration ${dur.toFixed(3)}\n`;
}
list += `file 'f${String(frames.length - 1).padStart(4, "0")}.jpg'\n`;
writeFileSync(`${FR}/list.txt`, list);
console.log("frames:", frames.length, "realtime:", ((TEND - T0) / 1000).toFixed(1) + "s");
await browser.close();
