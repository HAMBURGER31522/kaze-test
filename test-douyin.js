const { chromium } = require('playwright-core');
const mode = process.argv[2];
const urls = {
  user: 'https://www.douyin.com/user/MS4wLjABAAAAnKeRN8QUgooS1pPRqOf_N_jnuztzUyocl0_vUndQFJs',
  video: 'https://www.douyin.com/video/7641899791145289701'
};
(async () => {
  let browser, ctx;
  if (mode === 'kaze') {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    ctx = browser.contexts()[0];
  } else {
    browser = await chromium.launch({ channel: 'chrome', headless: false });
    ctx = await browser.newContext({ locale: 'zh-CN' });
  }
  for (const [k, u] of Object.entries(urls)) {
    let page;
    try {
      try { page = await ctx.newPage(); } catch (e) { page = ctx.pages()[0]; }
      const api = [];
      page.on('response', async r => {
        const url = r.url();
        if (/aweme\/v1\/web\/(aweme\/post|aweme\/detail|user\/profile|comment\/list)/.test(url)) {
          let len = 0, sample = '';
          try { const t = await r.text(); len = t.length; sample = t.slice(0, 300); } catch (e) {}
          api.push(r.status() + ' ' + url.split('?')[0] + ' len=' + len + ' ' + sample.replace(/\s+/g, ' '));
        }
      });
      await page.goto(u, { timeout: 60000, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(15000);
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(5000);
      const title = await page.title();
      const text = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 1500);
      console.log('=== [' + mode + '] ' + k + ' | ' + title);
      console.log('TEXT: ' + text);
      console.log('API: ' + (api.length ? '\n' + api.join('\n') : 'none'));
      const shot = await page.screenshot({ type: 'jpeg', quality: 35 });
      console.log('SHOT_BEGIN ' + mode + '-' + k + ' ' + shot.toString('base64') + ' SHOT_END');
    } catch (e) {
      console.log('=== [' + mode + '] ' + k + ' ERROR ' + e.message.split('\n')[0]);
    }
  }
  if (mode !== 'kaze') await browser.close();
  process.exit(0);
})();
