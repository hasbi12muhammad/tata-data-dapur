import puppeteer from "puppeteer-core";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const EMAIL = process.env.TD_EMAIL;
const PASS = process.env.TD_PASS;
const OUT = "public/shots";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
page.on("console", (m) => console.log("  [page]", m.text()));

console.log("login…");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.waitForSelector('input[type=email]');
// Wait until React has actually hydrated the submit button (props attached),
// otherwise clicking triggers a native GET form submit.
await page.waitForFunction(
  () => {
    const el = document.querySelector('button[type=submit]');
    return el && Object.keys(el).some((k) => k.startsWith("__reactProps$"));
  },
  { timeout: 30000, polling: 200 }
);
console.log("  hydrated");
await sleep(500);

// Set controlled-input values the React way, then submit
await page.evaluate(
  (email, pass) => {
    const set = (el, v) => {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      desc.set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set(document.querySelector('input[type=email]'), email);
    set(document.querySelector('input[type=password]'), pass);
  },
  EMAIL,
  PASS
);
await sleep(300);

const tokenResp = page
  .waitForResponse(
    (r) => r.url().includes("/auth/v1/token") && r.status() === 200,
    { timeout: 30000 }
  )
  .then(() => console.log("  auth 200 OK"))
  .catch(() => console.log("  WARN: no auth 200"));

await page.click('button[type=submit]');
await tokenResp;
await sleep(3500);
console.log("after login URL:", page.url());

const routes = [
  { path: "/recipes", name: "recipes" },
  { path: "/sales", name: "sales" },
  { path: "/items", name: "items" },
  { path: "/dashboard", name: "dashboard" },
];

for (const r of routes) {
  console.log("shoot", r.path);
  await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle2" });
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/${r.name}.png` });
}

await browser.close();
console.log("done");
