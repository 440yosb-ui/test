// Keepa の CSV をリサーチツールのすべての手法で絞り込み、仕入れ候補と「規制解除の候補ブランド」を JSON で出す。
// 毎朝の定期作業で使う補助スクリプト（画面と同じ計算をそのまま使うため、ブラウザでページを開いて結果を読む）。
// 使い方: リポジトリの一番上で `python3 -m http.server 8765` を動かしてから
//   node sedori/tools/research.js <KeepaのCSVファイル> [ポート番号]
// 出力: { modes: { 手法名: { warning, items: [...] } }, unlock: [...], sellerBrands: [{ brand, items }] }
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

  const readRows = () => page.$$eval('#rows tr', rows => rows.map(tr => {
    const td = tr.children;
    const a = td[0].querySelector('a');
    const m = a && a.href.match(/\/dp\/([A-Z0-9]{10})/i);
    const num = s => { const n = (s || '').replace(/[^0-9]/g, ''); return n ? Number(n) : null; };
    return {
      title: a ? a.textContent.trim() : '',
      asin: m ? m[1].toUpperCase() : '',
      brand: tr.dataset.brand || '',
      price: num(td[1].childNodes[0] && td[1].childNodes[0].textContent),
      sold: num(td[2].textContent),
      sellers: num(td[3].textContent),
      fees: num(td[4].childNodes[0] && td[4].childNodes[0].textContent),
      limit: num(td[5].textContent),
      notes: Array.from(td[0].querySelectorAll('div')).map(d => d.textContent.trim()).filter(Boolean)
    };
  }));
  const readUnlock = () => page.$$eval('#unlock-rows tr', rows => rows.map(tr => {
    const td = tr.children;
    const a = td[3].querySelector('a');
    const m = a && a.href.match(/product\/5-([A-Z0-9]{10})/i);
    return {
      brand: td[0].childNodes[0].textContent.trim(),
      brandNotes: Array.from(td[0].querySelectorAll('div')).map(d => d.textContent.trim()),
      items: Number(td[1].textContent.replace(/[^0-9]/g, '')),
      sold: Number(td[2].textContent.replace(/[^0-9]/g, '')),
      pickTitle: a ? a.textContent.trim() : '',
      pickAsin: m ? m[1].toUpperCase() : '',
      pickNote: (td[3].querySelector('div') || {}).textContent || ''
    };
  }));

  const out = { modes: {}, unlock: null, errors };
  const count = (await page.$$('.mode-btn')).length;
  for (let i = 0; i < count; i++) {
    const b = (await page.$$('.mode-btn'))[i];
    const name = (await b.textContent()).trim();
    await b.click();
    await page.waitForTimeout(400);
    const warning = await page.$eval('#mode-warn', e => (e.hidden ? '' : e.innerText.trim())).catch(() => '');
    out.modes[name] = { warning, items: await readRows() };
    // 規制解除の候補ブランドは表示中の手法に関係なく「リピート向き」の結果で並ぶので、1回読めばよい
    if (name.startsWith('通常')) out.unlock = await readUnlock();
  }
  // 出品者の商品一覧（seller_ で始まるファイル）向け: 「セラー」の結果に多いブランドを数える
  const counts = {};
  ((out.modes['セラー'] || {}).items || []).forEach(it => { if (it.brand) counts[it.brand] = (counts[it.brand] || 0) + 1; });
  out.sellerBrands = Object.keys(counts).sort((x, y) => counts[y] - counts[x]).slice(0, 10).map(b => ({ brand: b, items: counts[b] }));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
