// Keepa の CSV をリサーチツールの「刈り取り」手法で絞り込み、トラッキング（値下がり通知）候補を JSON で出す。
// 毎朝の定期作業で使う補助スクリプト（ツールの画面と同じ計算をそのまま使うため、ブラウザでページを開いて結果を読む）。
// 使い方: リポジトリの一番上で `python3 -m http.server 8765` を動かしてから
//   node sedori/tools/tracking-candidates.js <KeepaのCSVファイル> [ポート番号]
// 出力: [{ title, asin, target, current, sold, sellers, limit, notes: [...] }]
const { chromium } = require('playwright');

(async () => {
  const file = process.argv[2];
  const port = process.argv[3] || '8765';
  if (!file) { console.error('CSVファイルを指定してください'); process.exit(2); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:' + port + '/sedori/index.html');
  await page.setInputFiles('#file-input', file);
  await page.waitForTimeout(800);
  const buttons = await page.$$('.mode-btn');
  let clicked = false;
  for (const b of buttons) {
    if ((await b.textContent()).trim().startsWith('刈り取り')) { await b.click(); clicked = true; break; }
  }
  if (!clicked) { console.error('「刈り取り」の手法が見つかりません'); process.exit(1); }
  await page.waitForTimeout(500);
  const warn = await page.$eval('#mode-warn', e => (e.hidden ? '' : e.innerText.trim())).catch(() => '');
  const items = await page.$$eval('#rows tr', rows => rows.map(tr => {
    const td = tr.children;
    const a = td[0].querySelector('a');
    const m = a && a.href.match(/\/dp\/([A-Z0-9]{10})/i);
    const lines = Array.from(td[0].querySelectorAll('div')).map(d => d.textContent.trim());
    const hl = lines.find(t => t.indexOf('Keepaで') === 0) || '';
    const yenNum = s => { const n = (s || '').replace(/[^0-9]/g, ''); return n ? Number(n) : null; };
    const tm = hl.match(/¥([0-9,]+)/);
    return {
      title: a ? a.textContent.trim() : '',
      asin: m ? m[1].toUpperCase() : '',
      target: tm ? yenNum(tm[1]) : null,
      current: yenNum(td[1].childNodes[0] && td[1].childNodes[0].textContent),
      sold: yenNum(td[2].textContent),
      sellers: yenNum(td[3].textContent),
      limit: yenNum(td[5].textContent),
      notes: lines.filter(t => t && t !== hl)
    };
  }));
  console.log(JSON.stringify({ count: items.length, modeWarning: warn, errors, items }, null, 1));
  await browser.close();
})();
