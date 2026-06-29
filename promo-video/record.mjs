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
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

// ---- login ----
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.waitForSelector("input[type=email]");
await page.waitForFunction(() => { const el = document.querySelector('button[type=submit]'); return el && Object.keys(el).some((k) => k.startsWith("__reactProps$")); }, { timeout: 30000, polling: 200 });
await page.evaluate((email, pass) => { const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value"); d.set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }; set(document.querySelector('input[type=email]'), email); set(document.querySelector('input[type=password]'), pass); }, "akun-demo@tatadata-dapur.com", "hasbi123456");
await page.click('button[type=submit]');
await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
await sleep(1500);
await page.goto(`${BASE}/recipes`, { waitUntil: "networkidle2" });
await sleep(1800);

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
const clickText = (t) => page.evaluate((t) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === t)?.click(), t);
const scrollModalBottom = () => page.evaluate(() => {
  const d = document.querySelector('[role=dialog]') || document.querySelector('.fixed .overflow-y-auto') || document.querySelector('.overflow-y-auto');
  if (d) d.scrollTop = d.scrollHeight;
});

// open modal
await clickText("Produk Baru");
await sleep(1200);

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
await sleep(400);
const nameInput = await page.$('input[placeholder="mis. Nasi Goreng"]');
await nameInput.click();
await page.type('input[placeholder="mis. Nasi Goreng"]', "Pancake Susu Cokelat", { delay: 55 });
await sleep(450);

const bahan = [
  { t: "Tepung", q: 50 },
  { t: "Susu UHT", q: 100 },
  { t: "Telur", q: 1 },
  { t: "Topping", q: 20 },
];
for (let i = 0; i < bahan.length; i++) {
  if (i > 0) { await clickText("Tambah baris"); await sleep(350); await scrollModalBottom(); await sleep(150); }
  await setSelect(i, bahan[i].t);
  await sleep(280);
  await setQty(i, bahan[i].q);
  await sleep(550);
}
await sleep(400);
await scrollModalBottom();
await sleep(2200); // hold on the computed HPP

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
