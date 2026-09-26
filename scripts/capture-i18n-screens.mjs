import { chromium } from "playwright-core";
import { mkdirSync } from "fs";

const ORIGIN = process.env.OCLAUNCH_ORIGIN || "http://localhost:8787";
const OUT = "/cursor/stores/self/media";
mkdirSync(OUT, { recursive: true });

async function setLang(page, lang) {
  await page.evaluate((l) => {
    localStorage.setItem("oclaunch.lang", l);
  }, lang);
}

async function shot(page, name) {
  const path = `${OUT}/${name}`;
  await page.screenshot({ path, fullPage: false });
  console.log("wrote", path);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // Desktop Vietnamese homepage
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(ORIGIN, { waitUntil: "networkidle" });
    await setLang(page, "vi");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Thêm dự án");
    await shot(page, "oclaunch-homepage-vi-desktop.png");

    await page.goto(`${ORIGIN}/signin`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /founder|founder cục bộ/i }).click();
    await page.waitForURL("**/app**");
    await page.waitForSelector("text=Dự án của tôi");
    await shot(page, "oclaunch-workspace-vi-desktop.png");

    // Form state across lang switch (no full reload)
    await page.goto(`${ORIGIN}/app/new`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Thêm dự án");
    const nameInput = page.locator("form input").first();
    await nameInput.fill("KeepState");
    await page.locator("header select").selectOption("en");
    await page.waitForSelector("text=Add your project");
    const nameVal = await nameInput.inputValue();
    if (nameVal !== "KeepState") {
      throw new Error(`Form state lost after lang switch: got ${nameVal}`);
    }
    console.log("form state preserved across lang switch: OK");

    // Finish create in Vietnamese
    await page.locator("header select").selectOption("vi");
    await page.waitForSelector("text=Thêm dự án");
    await nameInput.fill("VI Demo");
    const inputs = page.locator("form input");
    await inputs.nth(1).fill(`vi-demo-${Date.now().toString(36)}`);
    await page.locator("form textarea").first().fill("Demo Vietnamese UI");
    await inputs.nth(2).fill("Founders");
    await page.getByRole("button", { name: /Tạo dự án/i }).click();
    await page.waitForURL("**/overview**", { timeout: 15000 });
    await page.waitForSelector("text=Vòng cải tiến");
    await shot(page, "oclaunch-overview-vi-desktop.png");

    await context.close();
  }

  // Mobile 390 Vietnamese
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(ORIGIN, { waitUntil: "networkidle" });
    await setLang(page, "vi");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Thêm dự án");
    await shot(page, "oclaunch-homepage-vi-mobile.png");

    const headerBox = await page.locator("header").boundingBox();
    console.log("mobile homepage header width:", headerBox?.width);

    await page.goto(`${ORIGIN}/signin`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /founder|founder cục bộ/i }).click();
    await page.waitForURL("**/app**");
    await page.waitForSelector("text=Dự án của tôi");

    const menuBtn = page.locator("header button", { hasText: /Menu|Đóng|Close/i });
    const logoutOutside = page.locator("header > div > div > span.hidden button, header > div > div.flex > span.hidden");
    const menuCount = await menuBtn.count();
    console.log("mobile menu buttons:", menuCount);
    // Visible Log out in the top bar row (not in open menu) should be 0 when md:hidden wrapper works
    const topLogout = page.locator("header .hidden.md\\:inline-flex button");
    // Also check computed visibility of any Log out next to Menu
    const visibleLogout = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("header button")];
      return buttons
        .filter((b) => /Đăng xuất|Log out/i.test(b.textContent || ""))
        .map((b) => ({
          text: b.textContent?.trim(),
          display: getComputedStyle(b).display,
          parentDisplay: getComputedStyle(b.parentElement).display,
          visible: !!(b.offsetWidth || b.offsetHeight),
        }));
    });
    console.log("logout visibility:", JSON.stringify(visibleLogout));
    const bothVisible =
      visibleLogout.some((b) => b.visible) &&
      (await menuBtn.first().isVisible().catch(() => false));
    if (bothVisible) {
      // Menu open would show logout inside — ensure menu is closed
      const menuLabel = await menuBtn.first().innerText();
      if (/Menu/i.test(menuLabel) && visibleLogout.some((b) => b.visible)) {
        throw new Error("Mobile header shows both Menu and Log out when menu closed");
      }
    }

    await shot(page, "oclaunch-workspace-vi-mobile.png");
    await context.close();
  }

  // English desktop homepage
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(ORIGIN, { waitUntil: "networkidle" });
    await setLang(page, "en");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Add your project");
    await shot(page, "oclaunch-homepage-desktop.png");
    await context.close();
  }

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
