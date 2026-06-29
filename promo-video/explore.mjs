import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "http://localhost:3000";
const EMAIL = process.env.TD_EMAIL;
const PASS = process.env.TD_PASS;

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.waitForSelector("input[type=email]");
await page.waitForFunction(() => {
  const el = document.querySelector('button[type=submit]');
  return el && Object.keys(el).some((k) => k.startsWith("__reactProps$"));
}, { timeout: 30000, polling: 200 });
await page.evaluate((email, pass) => {
  const set = (el, v) => {
    const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
    d.set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  set(document.querySelector('input[type=email]'), email);
  set(document.querySelector('input[type=password]'), pass);
}, EMAIL, PASS);
await page.click('button[type=submit]');
await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
await sleep(2500);
console.log("URL:", page.url());

await page.goto(`${BASE}/recipes`, { waitUntil: "networkidle2" });
await sleep(2500);

// dump top action buttons
const buttons = await page.evaluate(() =>
  Array.from(document.querySelectorAll("button")).slice(0, 16).map((b) => ({
    t: b.textContent.trim().slice(0, 24),
    aria: b.getAttribute("aria-label"),
  }))
);
console.log("BUTTONS:", JSON.stringify(buttons));

// try open the add-product modal: click the '+' (usually a primary button)
const opened = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll("button"));
  const plus = btns.find((b) => b.textContent.trim() === "Produk Baru");
  if (plus) { plus.click(); return true; }
  return false;
});
console.log("Produk Baru clicked:", opened);
await sleep(2000);

const modal = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll("input,select,textarea")).map((el) => ({
    tag: el.tagName, type: el.type, ph: el.placeholder, name: el.name,
    label: el.closest("label")?.textContent?.trim()?.slice(0, 30) ||
           el.previousElementSibling?.textContent?.trim()?.slice(0, 30),
    options: el.tagName === "SELECT" ? Array.from(el.options).slice(0, 8).map((o) => o.textContent.trim()) : undefined,
  }));
  const dialog = document.querySelector('[role=dialog]') || document.querySelector('.fixed');
  return { inputCount: inputs.length, inputs: inputs.slice(0, 20), modalText: dialog?.textContent?.slice(0, 200) };
});
console.log("MODAL:", JSON.stringify(modal, null, 1));

await page.screenshot({ path: "public/shots/recipe-modal-explore.png" });
await browser.close();
console.log("done");
