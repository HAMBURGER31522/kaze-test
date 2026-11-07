// v4: capture the page's OWN aweme/post response inside the page (fetch/XHR tap),
// then ask the page to re-issue aweme/post itself so Douyin's SDK signs it.
const { chromium } = require('playwright-core');
const mode = process.argv[2];
const SEC_UID = 'MS4wLjABAAAAnKeRN8QUgooS1pPRqOf_N_jnuztzUyocl0_vUndQFJs';
const USER_URL = 'https://www.douyin.com/user/' + SEC_UID;

const TAP = `(() => {
  if (window.__dyTap) return; window.__dyTap = true; window.__dyCap = [];
  const want = u => /aweme\\/v1\\/web\\/aweme\\/post/.test(u || '');
  const save = (via, url, status, text) => { try { window.__dyCap.push({ via, url: String(url).split('?')[0], status, len: (text||'').length, text: (text||'').slice(0, 200000) }); } catch (e) {} };
  const of = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url);
    const r = await of.apply(this, arguments);
    if (want(url)) { try { const t = await r.clone().text(); save('fetch', url, r.status, t); } catch (e) { save('fetch-err', url, r.status, String(e)); } }
    return r;
  };
  const oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return oo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (want(this.__u)) this.addEventListener('loadend', () => { let t = ''; try { t = this.responseType === '' || this.responseType === 'text' ? this.responseText : JSON.stringify(this.response); } catch (e) {} save('xhr', this.__u, this.status, t); });
    return os.apply(this, arguments);
  };
})();`;

function summarize(t) {
  try {
    const j = JSON.parse(t);
    const l = j.aweme_list || [];
    return 'status_code=' + j.status_code + ' aweme_list=' + l.length + ' has_more=' + j.has_more + ' | ' +
      l.slice(0, 5).map(a => a.aweme_id + ' ' + (a.desc || '').slice(0, 20) + ' 赞' + (a.statistics || {}).digg_count).join(' || ');
  } catch (e) { return 'non-json: ' + (t || '').slice(0, 120).replace(/\s+/g, ' '); }
}

(async () => {
  let browser, ctx, page;
  if (mode === 'kaze') {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    ctx = browser.contexts()[0];
  } else {
    browser = await chromium.launch({ channel: 'chrome', headless: false });
    ctx = await browser.newContext({ locale: 'zh-CN' });
  }
  try { await ctx.addInitScript(TAP); console.log('=== [' + mode + '] tap installed'); } catch (e) { console.log('=== [' + mode + '] addInitScript ERROR ' + e.message.split('\n')[0]); }
  try {
    page = mode === 'kaze' && ctx.pages().length ? ctx.pages()[0] : await ctx.newPage();
    const net = [];
    page.on('response', r => { if (/aweme\/v1\/web\/aweme\/post/.test(r.url())) net.push(r.status() + ' len-hdr=' + (r.headers()['content-length'] || '?')); });
    await page.goto('https://www.douyin.com/', { timeout: 90000, waitUntil: 'commit' });
    await page.waitForTimeout(15000);
    await page.goto(USER_URL, { timeout: 90000, waitUntil: 'commit' });
    await page.waitForTimeout(25000);
    await page.evaluate(TAP).catch(() => {}); // in case init script didn't apply (Kaze)
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(4000); }

    // Step 2: let the page re-issue aweme/post itself (no a_bogus/msToken: page SDK should sign it)
    const refetch = await page.evaluate(async (sec) => {
      const qs = new URLSearchParams({ device_platform: 'webapp', aid: '6383', channel: 'channel_pc_web', sec_user_id: sec, max_cursor: '0', locate_query: 'false', show_live_replay_strategy: '1', need_time_list: '1', time_list_query: '0', whale_cut_token: '', cut_version: '1', count: '18', publish_video_strategy_type: '2', pc_client_type: '1', version_code: '290100', version_name: '29.1.0', cookie_enabled: 'true', platform: 'PC', downlink: '10' });
      try { const r = await fetch('/aweme/v1/web/aweme/post/?' + qs.toString(), { credentials: 'include' }); const t = await r.text(); return { status: r.status, len: t.length, text: t.slice(0, 200000), signed: !!window.byted_acrawler }; }
      catch (e) { return { status: -1, len: 0, text: String(e), signed: !!window.byted_acrawler }; }
    }, SEC_UID).catch(e => ({ status: -2, len: 0, text: e.message.split('\n')[0] }));

    const cap = await page.evaluate(() => window.__dyCap || null).catch(() => null);
    const text = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
    console.log('=== [' + mode + '] user | ' + (await page.title()) + ' | ' + page.url());
    console.log('TEXT: ' + text);
    console.log('NET (CDP view): ' + (net.join(', ') || 'none'));
    console.log('TAP (in-page view): ' + (cap === null ? 'unavailable' : cap.length + ' hits'));
    (cap || []).forEach((c, i) => console.log('  #' + i + ' ' + c.via + ' ' + c.status + ' len=' + c.len + ' ' + summarize(c.text)));
    console.log('REFETCH: status=' + refetch.status + ' len=' + refetch.len + ' sdk=' + refetch.signed + ' ' + summarize(refetch.text));
    try { const shot = await page.screenshot({ type: 'jpeg', quality: 35 }); console.log('SHOT_BEGIN ' + mode + '-user ' + shot.toString('base64') + ' SHOT_END'); } catch (e) { console.log('shot ERROR ' + e.message.split('\n')[0]); }
  } catch (e) {
    console.log('=== [' + mode + '] ERROR ' + e.message.split('\n')[0]);
  }
  if (mode !== 'kaze') await browser.close();
  process.exit(0);
})();
