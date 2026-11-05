const { chromium } = require('playwright-core');
const fs = require('fs');
const mode = process.argv[2];
const urls = {
  google: 'https://www.google.com/search?q=kaze+browser',
  bing: 'https://www.bing.com/search?q=kaze+browser',
  ddg: 'https://duckduckgo.com/?q=kaze+browser',
  baidu: 'https://www.baidu.com/s?wd=kaze',
  sannysoft: 'https://bot.sannysoft.com/',
  creepjs: 'https://abrahamjuliot.github.io/creepjs/',
  cf: 'https://nowsecure.nl/'
};
(async () => {
  fs.mkdirSync('shots', { recursive: true });
  let browser, ctx;
  if (mode === 'kaze') {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    ctx = browser.contexts()[0];
  } else {
    browser = await chromium.launch({ channel: 'chrome', headless: false });
    ctx = await browser.newContext();
  }
  for (const [k, u] of Object.entries(urls)) {
    let page;
    try {
      try { page = await ctx.newPage(); }
      catch (e) { page = ctx.pages().find(p => p.url().startsWith('http')) || ctx.pages()[0]; }
      await page.goto(u, { timeout: 45000, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(8000);
      const title = await page.title();
      const wd = await page.evaluate(() => navigator.webdriver).catch(() => 'n/a');
      const text = (await page.innerText('body').catch(() => '')).slice(0, 300).replace(/\s+/g, ' ');
      console.log('[' + mode + '] ' + k + ' | webdriver=' + wd + ' | ' + title + ' | ' + text);
      await page.screenshot({ path: 'shots/' + mode + '-' + k + '.png' });
    } catch (e) {
      console.log('[' + mode + '] ' + k + ' ERROR ' + e.message.split('\n')[0]);
    }
  }
  if (mode !== 'kaze') await browser.close();
  process.exit(0);
})();
