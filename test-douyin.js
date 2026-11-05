const { chromium } = require('playwright-core');
const mode = process.argv[2];
const urls = {
  user: 'https://www.douyin.com/user/MS4wLjABAAAAnKeRN8QUgooS1pPRqOf_N_jnuztzUyocl0_vUndQFJs',
  video: 'https://www.douyin.com/video/7641899791145289701'
};
function summarize(url, t) {
  try {
    const j = JSON.parse(t);
    if (url.includes('aweme/post')) return 'aweme_list=' + (j.aweme_list || []).length + ' has_more=' + j.has_more + ' | ' + (j.aweme_list || []).slice(0, 5).map(a => a.aweme_id + ' ' + (a.desc || '').slice(0, 25) + ' 赞' + (a.statistics || {}).digg_count + ' 评' + (a.statistics || {}).comment_count).join(' || ');
    if (url.includes('aweme/detail')) { const a = j.aweme_detail || {}; return 'id=' + a.aweme_id + ' ' + (a.desc || '').slice(0, 40) + ' 作者=' + ((a.author || {}).nickname) + ' 赞' + (a.statistics || {}).digg_count + ' 评' + (a.statistics || {}).comment_count + ' filter=' + JSON.stringify(j.filter_detail || null).slice(0, 150); }
    if (url.includes('comment/list')) return 'comments=' + (j.comments || []).length + ' total=' + j.total + ' | ' + (j.comments || []).slice(0, 3).map(c => (c.text || '').slice(0, 25)).join(' || ');
    if (url.includes('user/profile')) { const u = j.user || {}; return u.nickname + ' 粉丝' + u.follower_count + ' 作品' + u.aweme_count; }
  } catch (e) { return 'non-json: ' + t.slice(0, 120).replace(/\s+/g, ' '); }
  return '';
}
(async () => {
  let browser, ctx;
  if (mode === 'kaze') {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    ctx = browser.contexts()[0];
  } else {
    browser = await chromium.launch({ channel: 'chrome', headless: false });
    ctx = await browser.newContext({ locale: 'zh-CN' });
  }
  // warm-up: visit the home page once so cookies (ttwid, msToken) get set
  try {
    const w = await ctx.newPage();
    await w.goto('https://www.douyin.com/', { timeout: 90000, waitUntil: 'commit' });
    await w.waitForTimeout(15000);
    console.log('=== [' + mode + '] warmup ok ' + w.url());
    await w.close();
  } catch (e) { console.log('=== [' + mode + '] warmup ERROR ' + e.message.split('\n')[0]); }
  for (const [k, u] of Object.entries(urls)) {
    let page;
    try {
      page = await ctx.newPage();
      const api = [];
      page.on('response', async r => {
        const url = r.url();
        if (/aweme\/v1\/web\/(aweme\/post|aweme\/detail|user\/profile|comment\/list)/.test(url)) {
          let t = '';
          try { t = await r.text(); } catch (e) {}
          api.push(r.status() + ' ' + url.split('?')[0].replace(/^https:\/\/[^/]+/, '') + ' len=' + t.length + ' ' + summarize(url, t));
        }
      });
      await page.goto(u, { timeout: 90000, waitUntil: 'commit' });
      await page.waitForTimeout(25000);
      for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(4000); }
      const title = await page.title();
      const text = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 800);
      console.log('=== [' + mode + '] ' + k + ' | ' + title + ' | final url: ' + page.url());
      console.log('TEXT: ' + text);
      console.log('API: ' + (api.length ? '\n' + api.join('\n') : 'none'));
      const shot = await page.screenshot({ type: 'jpeg', quality: 35 });
      console.log('SHOT_BEGIN ' + mode + '-' + k + ' ' + shot.toString('base64') + ' SHOT_END');
    } catch (e) {
      console.log('=== [' + mode + '] ' + k + ' ERROR ' + e.message.split('\n')[0]);
      if (page) { try { console.log('final url: ' + page.url()); const shot = await page.screenshot({ type: 'jpeg', quality: 35 }); console.log('SHOT_BEGIN ' + mode + '-' + k + '-err ' + shot.toString('base64') + ' SHOT_END'); } catch (e2) {} }
    }
  }
  if (mode !== 'kaze') await browser.close();
  process.exit(0);
})();
