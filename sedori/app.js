(function () {
  'use strict';

  var STORE_KEY = 'sedori-research-settings-v1';
  var MAX_ROWS = 300;      // 画面に並べる最大件数
  var BULK_COUNT = 20;     // まとめて取得する件数
  var API_WAIT_MS = 1100;  // 他サイトへの問い合わせ間隔（負荷をかけないため）

  // Keepa のファイルの列名（英語・日本語どちらでも）から、使う項目を自動で探すためのパターン。
  // 上にあるパターンほど優先される。
  var FIELDS = [
    { key: 'title', label: '商品名', pats: [/^title$/i, /^商品名$/, /タイトル/] },
    { key: 'asin', label: 'ASIN（Amazonの商品番号）', pats: [/^asin$/i] },
    { key: 'price', label: '販売価格', pats: [/^buy box.*current/i, /カート.*現在/, /^new: current/i, /^新品: 現在/, /^new.*current/i, /新品.*現在/] },
    { key: 'amazon', label: 'Amazon本体の価格', pats: [/^amazon: current/i, /^amazon: 現在/i, /^amazon.*現在/i] },
    { key: 'sold', label: '月の販売数', pats: [/bought in past month/i, /過去1か月.*購入/, /先月.*購入/, /sales rank: drops last 30/i, /ランキング.*30日.*(下落|ドロップ)/, /drops.*30/i] },
    { key: 'sellers', label: '出品者の数', pats: [/^new offer count: current/i, /新品.*出品者数.*現在/, /offer count.*current/i, /出品者数.*現在/, /offer count/i, /出品者数/] },
    { key: 'fba', label: 'FBA手数料', pats: [/fba.*fee/i, /fba.*手数料/i] },
    { key: 'pct', label: '販売手数料の割合（％）', pats: [/referral fee %/i, /紹介料 ?%/, /販売手数料.*%/] },
    { key: 'jan', label: 'JANコード（バーコード番号）', pats: [/codes: ean/i, /^ean$/i, /ean/i, /jan/i] },
    { key: 'model', label: '型式', pats: [/^model$/i, /^モデル$/, /型番/, /partnumber/i, /部品番号/, /model/i] },
    { key: 'brand', label: 'ブランド', pats: [/^brand$/i, /^ブランド$/, /manufacturer/i, /メーカー/] }
  ];

  var DEFAULTS = {
    minSold: 100, maxSellers: 15, minPrice: 1000, maxPrice: '', minProfit: 200, otherCost: 50,
    defPct: 10, defFba: 500, keyword: '', noAmazon: true, checkFilter: 'all',
    rakutenAppId: '', rakutenKey: '', yahooAppId: '',
    rakutenUrl: 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601',
    mapping: {}
  };

  var settings = loadSettings();
  var headers = [];
  var rawRows = [];
  var mapping = {};       // 項目キー → 列番号
  var shown = [];         // いま表に出している商品
  var sortKey = 'sold';
  var sortDesc = true;
  var shopCache = {};     // 取得済みの他サイト価格
  var lastCall = 0;

  // 出品チェックの記録。商品番号(ASIN)ごとに「出品できたか」を覚えておく。
  var CHECK_KEY = 'sedori-listing-checks-v1';
  var STATUSES = [
    { key: 'ok', label: '出品できる', pass: true },
    { key: 'applied', label: '申請で通った', pass: true },
    { key: 'docs', label: '書類が必要', pass: false },
    { key: 'ng', label: '不可', pass: false }
  ];
  var checks = loadChecks();

  function loadChecks() {
    try { return JSON.parse(localStorage.getItem(CHECK_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveChecks() {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(checks)); } catch (e) { /* 保存できなくても動作は続ける */ }
  }
  function isPass(status) {
    return STATUSES.some(function (s) { return s.key === status && s.pass; });
  }
  function brandKey(name) { return String(name || '').trim().toLowerCase(); }

  // メーカーごとに、通った件数・通らなかった件数を数える
  function brandStats() {
    var stats = {};
    Object.keys(checks).forEach(function (asin) {
      var c = checks[asin];
      var k = brandKey(c.brand);
      if (!k) return;
      if (!stats[k]) stats[k] = { name: c.brand, ok: 0, applied: 0, docs: 0, ng: 0, pass: 0, fail: 0 };
      stats[k][c.status]++;
      if (isPass(c.status)) stats[k].pass++; else stats[k].fail++;
    });
    return stats;
  }
  function isGoodBrand(stat) { return !!stat && stat.pass > stat.fail; }

  function $(id) { return document.getElementById(id); }

  function loadSettings() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { s = {}; }
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = (k in s) ? s[k] : DEFAULTS[k]; });
    return out;
  }
  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* 保存できなくても動作は続ける */ }
  }

  // ---------- ファイルの読み込み ----------

  function parseCsv(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [], row = [], cell = '', inQuote = false, i = 0, c;
    // Keepa はカンマ区切りが基本だが、タブやセミコロン区切りにも対応する
    var firstLine = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : text.length);
    var sep = ',';
    if (firstLine.split('\t').length > firstLine.split(',').length) sep = '\t';
    else if (firstLine.split(';').length > firstLine.split(',').length) sep = ';';
    for (; i < text.length; i++) {
      c = text[i];
      if (inQuote) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else inQuote = false;
        } else cell += c;
      } else if (c === '"') inQuote = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return v.trim() !== ''; }); });
  }

  function decodeFile(buffer) {
    var text = new TextDecoder('utf-8').decode(buffer);
    if (text.indexOf('�') !== -1) {
      try { text = new TextDecoder('shift_jis').decode(buffer); } catch (e) { /* UTF-8 のまま使う */ }
    }
    return text;
  }

  function autoMap() {
    mapping = {};
    FIELDS.forEach(function (f) {
      var saved = settings.mapping[f.key];
      var idx = saved ? headers.indexOf(saved) : -1;
      for (var p = 0; idx < 0 && p < f.pats.length; p++) {
        for (var h = 0; h < headers.length; h++) {
          if (f.pats[p].test(headers[h].trim())) { idx = h; break; }
        }
      }
      mapping[f.key] = idx;
    });
  }

  function renderMapping() {
    var grid = $('mapping-grid');
    grid.textContent = '';
    FIELDS.forEach(function (f) {
      var label = document.createElement('label');
      label.textContent = f.label;
      var sel = document.createElement('select');
      var none = new Option('（使わない）', '-1');
      sel.add(none);
      headers.forEach(function (h, i) { sel.add(new Option(h, String(i))); });
      sel.value = String(mapping[f.key]);
      sel.addEventListener('change', function () {
        mapping[f.key] = Number(sel.value);
        if (mapping[f.key] >= 0) settings.mapping[f.key] = headers[mapping[f.key]];
        else delete settings.mapping[f.key];
        saveSettings();
        render();
      });
      label.appendChild(sel);
      grid.appendChild(label);
    });
    $('mapping-box').hidden = false;
  }

  function handleFile(file) {
    var status = $('file-status');
    status.className = 'status';
    status.textContent = '読み込み中…';
    file.arrayBuffer().then(function (buf) {
      var rows = parseCsv(decodeFile(buf));
      if (rows.length < 2) throw new Error('商品のデータが見つかりませんでした。CSV形式で保存したファイルか確認してください。');
      headers = rows[0];
      rawRows = rows.slice(1);
      autoMap();
      renderMapping();
      var missing = ['title', 'asin', 'price', 'sold'].filter(function (k) { return mapping[k] < 0; })
        .map(function (k) { return FIELDS.filter(function (f) { return f.key === k; })[0].label; });
      if (missing.length) {
        status.className = 'status err';
        status.textContent = rawRows.length + '件を読み込みましたが、「' + missing.join('」「') + '」の列が見つかりません。下の「列の割り当て」を開いて選んでください。';
        $('mapping-box').open = true;
      } else {
        status.textContent = '「' + file.name + '」から ' + rawRows.length + ' 件を読み込みました。';
      }
      render();
    }).catch(function (e) {
      status.className = 'status err';
      status.textContent = '読み込めませんでした: ' + e.message;
    });
  }

  // ---------- 計算と絞り込み ----------

  // 「¥ 1,234」「10 %」「1,000+」のような表記から数字だけを取り出す。空欄や「-」は null。
  function num(v) {
    if (v == null) return null;
    var s = String(v).replace(/[^\d.\-]/g, '');
    if (s === '' || s === '-' || s === '.') return null;
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  function cell(row, key) {
    var i = mapping[key];
    return (i >= 0 && i < row.length) ? row[i].trim() : '';
  }
  function settingNum(key) {
    var n = num(settings[key]);
    return n == null ? null : n;
  }

  function buildItems() {
    var defPct = settingNum('defPct') || 0;
    var defFba = settingNum('defFba') || 0;
    var other = settingNum('otherCost') || 0;
    var profit = settingNum('minProfit') || 0;
    return rawRows.map(function (r) {
      var price = num(cell(r, 'price'));
      var pct = num(cell(r, 'pct'));
      var fba = num(cell(r, 'fba'));
      var estimated = (pct == null || fba == null);
      if (pct == null) pct = defPct;
      if (fba == null) fba = defFba;
      var fees = price == null ? null : Math.round(price * pct / 100 + fba);
      // JAN が複数入っている場合は先頭の1つを使う
      var jan = (cell(r, 'jan').match(/\d{8,13}/) || [''])[0];
      return {
        title: cell(r, 'title'), asin: cell(r, 'asin'), brand: cell(r, 'brand'),
        model: cell(r, 'model'), jan: jan,
        price: price, sold: num(cell(r, 'sold')), sellers: num(cell(r, 'sellers')),
        amazon: num(cell(r, 'amazon')),
        fees: fees, feesEstimated: estimated,
        limit: fees == null ? null : Math.round(price - fees - other - profit)
      };
    });
  }

  function applyFilters(items) {
    var minSold = settingNum('minSold'), maxSellers = settingNum('maxSellers');
    var minPrice = settingNum('minPrice'), maxPrice = settingNum('maxPrice');
    var kw = String(settings.keyword || '').trim().toLowerCase();
    var cf = settings.checkFilter;
    var stats = cf === 'goodBrand' ? brandStats() : null;
    return items.filter(function (it) {
      var chk = checks[it.asin];
      if (cf === 'unchecked' && chk) return false;
      if (cf === 'passed' && !(chk && isPass(chk.status))) return false;
      if (cf === 'goodBrand' && !isGoodBrand(stats[brandKey(it.brand)])) return false;
      if (it.price == null) return false;                 // 価格が不明な商品は計算できない
      if (it.limit == null || it.limit <= 0) return false; // どう仕入れても利益が残らない
      if (minSold != null && minSold > 0 && (it.sold == null || it.sold < minSold)) return false;
      if (maxSellers != null && it.sellers != null && it.sellers > maxSellers) return false;
      if (minPrice != null && it.price < minPrice) return false;
      if (maxPrice != null && it.price > maxPrice) return false;
      if (settings.noAmazon && it.amazon != null && it.amazon > 0) return false;
      if (kw && (it.title + ' ' + it.brand + ' ' + it.model).toLowerCase().indexOf(kw) === -1) return false;
      return true;
    });
  }

  function sortItems(items) {
    var dir = sortDesc ? -1 : 1;
    return items.sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      if (x == null && y == null) return 0;
      if (x == null) return 1;   // 不明な値は常に下へ
      if (y == null) return -1;
      if (typeof x === 'string') return x.localeCompare(y, 'ja') * dir;
      return (x - y) * dir;
    });
  }

  // ---------- 表示 ----------

  function yen(n) { return n == null ? '—' : '¥' + Math.round(n).toLocaleString('ja-JP'); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(text, url, cls) {
    var a = el('a', cls, text);
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    return a;
  }

  // 他サイトで探すときの検索語。バーコード番号があれば最も正確。
  function shopQuery(it) { return it.jan || it.model || it.title; }

  function render() {
    if (!rawRows.length) return;
    var all = sortItems(applyFilters(buildItems()));
    shown = all.slice(0, MAX_ROWS);
    $('count').textContent = '（' + rawRows.length + '件中 ' + all.length + '件）';
    $('empty').hidden = all.length > 0;
    $('empty').textContent = '条件に合う商品がありません。条件をゆるめてみてください。';
    $('result').hidden = all.length === 0;
    $('more').hidden = all.length <= MAX_ROWS;
    $('more').textContent = '件数が多いため、上位 ' + MAX_ROWS + ' 件だけを表示しています。条件を厳しくすると絞り込めます。';
    $('bulk-btn').hidden = all.length === 0 || !hasShopApi();
    $('sort-box').hidden = all.length === 0;

    var stats = brandStats();
    var tbody = $('rows');
    tbody.textContent = '';
    shown.forEach(function (it) {
      var tr = document.createElement('tr');

      var tdTitle = el('td', 'title');
      tdTitle.appendChild(link(it.title || it.asin, 'https://www.amazon.co.jp/dp/' + encodeURIComponent(it.asin)));
      var sub = [it.brand, it.model ? '型式: ' + it.model : '', it.jan ? 'JAN: ' + it.jan : ''].filter(Boolean).join(' ／ ');
      if (sub) tdTitle.appendChild(el('div', 'sub', sub));
      tr.appendChild(tdTitle);

      tr.appendChild(el('td', 'num', yen(it.price)));
      tr.appendChild(el('td', 'num', it.sold == null ? '—' : it.sold.toLocaleString('ja-JP')));
      tr.appendChild(el('td', 'num', it.sellers == null ? '—' : String(it.sellers)));
      var tdFees = el('td', 'num', yen(it.fees));
      if (it.feesEstimated) tdFees.appendChild(el('div', 'sub', '概算'));
      tr.appendChild(tdFees);
      tr.appendChild(el('td', 'num limit', yen(it.limit)));

      var tdLinks = el('td');
      var gq = it.model || it.title;
      var g = link(it.model ? 'Google（型式）' : 'Google（商品名）', 'https://www.google.com/search?q=' + encodeURIComponent(gq), 'mini');
      g.title = '「' + gq + '」をGoogleで検索します';
      tdLinks.appendChild(g);
      var q = shopQuery(it);
      tdLinks.appendChild(link('楽天', 'https://search.rakuten.co.jp/search/mall/' + encodeURIComponent(q) + '/?s=2', 'mini'));
      tdLinks.appendChild(link('Yahoo!', 'https://shopping.yahoo.co.jp/search?p=' + encodeURIComponent(q) + '&sort=%2Bprice', 'mini'));
      tdLinks.appendChild(link('Keepa', 'https://keepa.com/#!product/5-' + encodeURIComponent(it.asin), 'mini'));
      tr.appendChild(tdLinks);

      var tdShop = el('td');
      tdShop.dataset.asin = it.asin;
      renderShopCell(tdShop, it);
      tr.appendChild(tdShop);

      // スマホではカード表示になり見出し行が消えるため、各マスに項目名を持たせる
      var tdCheck = el('td');
      renderCheckCell(tdCheck, it, stats);
      tr.appendChild(tdCheck);

      ['', '販売価格', '月の販売数', '出品者', '手数料', '仕入れ上限', '', '他サイトの最安値', '出品チェック'].forEach(function (label, i) {
        if (label) tr.children[i].dataset.label = label;
      });
      tbody.appendChild(tr);
    });
  }

  // ---------- 出品チェックの記録 ----------

  function copyText(text, btn) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = 'コピーしました';
      setTimeout(function () { btn.textContent = old; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt('この番号をコピーしてください', text); });
    } else window.prompt('この番号をコピーしてください', text);
  }

  function renderCheckCell(td, it, stats) {
    td.textContent = '';
    var tools = el('div');
    var copy = el('button', 'mini', '商品番号をコピー');
    copy.type = 'button';
    copy.title = 'セラーアプリの検索欄に貼り付けて、出品できるか確認します';
    copy.addEventListener('click', function () { copyText(it.asin, copy); });
    tools.appendChild(copy);
    tools.appendChild(link('セラーセントラルで確認', 'https://sellercentral.amazon.co.jp/product-search/search?q=' + encodeURIComponent(it.asin), 'mini'));
    td.appendChild(tools);

    var current = checks[it.asin] && checks[it.asin].status;
    var box = el('div');
    STATUSES.forEach(function (s) {
      var b = el('button', 'st ' + (s.pass ? 'good' : 'bad') + (current === s.key ? ' on' : ''), s.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', current === s.key ? 'true' : 'false');
      b.addEventListener('click', function () {
        // 同じボタンをもう一度押すと記録を取り消す
        if (current === s.key) delete checks[it.asin];
        else checks[it.asin] = { status: s.key, brand: it.brand, title: it.title, date: new Date().toISOString().slice(0, 10) };
        saveChecks();
        // 一覧全体は並べ直さない（作業中に商品が動くと押し間違えるため）。このマスと集計だけ更新する。
        renderCheckCell(td, it, brandStats());
        renderBrands();
      });
      box.appendChild(b);
    });
    td.appendChild(box);

    var st = stats[brandKey(it.brand)];
    if (st) td.appendChild(el('div', 'brand-hint', 'このメーカーの記録: 通った ' + st.pass + '件 ／ 通らなかった ' + st.fail + '件'));
  }

  function renderBrands() {
    var stats = brandStats();
    var list = Object.keys(stats).map(function (k) { return stats[k]; })
      .sort(function (a, b) { return (b.pass - b.fail) - (a.pass - a.fail) || a.name.localeCompare(b.name, 'ja'); });
    $('brand-empty').hidden = list.length > 0;
    $('brand-table').hidden = list.length === 0;
    var tbody = $('brand-rows');
    tbody.textContent = '';
    list.forEach(function (s) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', '', s.name));
      ['ok', 'applied', 'docs', 'ng'].forEach(function (k) { tr.appendChild(el('td', 'num', String(s[k]))); });
      tr.appendChild(isGoodBrand(s) ? el('td', 'judge-good', '通りやすい') : el('td', 'judge-bad', s.pass ? '半々' : '通りにくい'));
      tbody.appendChild(tr);
    });
  }

  function exportBackup() {
    var data = { type: 'sedori-backup', version: 1, savedAt: new Date().toISOString(), checks: checks };
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'sedori-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    $('backup-status').className = 'status';
    $('backup-status').textContent = Object.keys(checks).length + '件の記録を保存しました。';
  }

  function importBackup(file) {
    var status = $('backup-status');
    file.text().then(function (text) {
      var data = JSON.parse(text);
      if (!data || data.type !== 'sedori-backup' || typeof data.checks !== 'object' || !data.checks) throw new Error('形式が違います');
      var added = 0;
      Object.keys(data.checks).forEach(function (asin) {
        var c = data.checks[asin];
        var valid = c && STATUSES.some(function (s) { return s.key === c.status; });
        // いまスマホにある記録は消さず、ファイルにしかない記録だけを足す
        if (valid && !checks[asin]) {
          checks[asin] = { status: c.status, brand: String(c.brand || ''), title: String(c.title || ''), date: String(c.date || '') };
          added++;
        }
      });
      saveChecks();
      status.className = 'status';
      status.textContent = added + '件の記録を戻しました。';
      renderBrands();
      render();
    }).catch(function () {
      status.className = 'status err';
      status.textContent = 'このファイルは読み込めませんでした。バックアップで保存したファイルを選んでください。';
    });
  }

  // ---------- 他サイトの価格（楽天・Yahoo!） ----------

  function hasShopApi() {
    return !!((settings.rakutenAppId && settings.rakutenKey) || settings.yahooAppId);
  }

  function renderShopCell(td, it, fresh) {
    td.textContent = '';
    if (!hasShopApi()) { td.appendChild(el('span', 'sub', '（上の「3」で設定すると自動表示）')); return; }
    var res = fresh || shopCache[it.asin];
    if (!res) {
      var b = el('button', 'mini', '価格を取得');
      b.type = 'button';
      b.addEventListener('click', function () { fetchShops(it, td); });
      td.appendChild(b);
      return;
    }
    res.forEach(function (r) {
      var line = el('div', 'shop-line');
      line.appendChild(document.createTextNode(r.shop + ': '));
      if (r.error) line.appendChild(el('span', 'err', r.error));
      else if (r.price == null) line.appendChild(el('span', 'sub', '見つかりません'));
      else {
        line.appendChild(link(yen(r.price), r.url));
        if (r.price <= it.limit) { line.appendChild(document.createTextNode(' ')); line.appendChild(el('span', 'ok', '上限以下')); }
        if (r.seller) line.appendChild(el('div', 'sub', r.seller + (r.note ? '・' + r.note : '')));
      }
      td.appendChild(line);
    });
  }

  // 連続して問い合わせすぎないよう、前回から一定時間あけて実行する
  function throttled(fn) {
    var wait = Math.max(0, lastCall + API_WAIT_MS - Date.now());
    lastCall = Date.now() + wait;
    return new Promise(function (resolve) { setTimeout(resolve, wait); }).then(fn);
  }

  function getJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) {
        var e = new Error(res.status === 429 ? '混み合っています。少し待ってください'
          : (res.status === 401 || res.status === 403) ? 'IDが正しくないか、利用が許可されていません（' + res.status + '）'
          : 'エラー（' + res.status + '）');
        throw e;
      }
      return res.json();
    }, function () {
      // 通信そのものが拒否された場合（ブラウザからの直接利用を相手が認めていない等）
      throw new Error('このページから直接つなげませんでした');
    });
  }

  function fetchRakuten(query) {
    var url = settings.rakutenUrl + '?format=json&formatVersion=2&hits=5&availability=1&sort=' + encodeURIComponent('+itemPrice') +
      '&applicationId=' + encodeURIComponent(settings.rakutenAppId) +
      '&accessKey=' + encodeURIComponent(settings.rakutenKey) +
      '&keyword=' + encodeURIComponent(query);
    return getJson(url).then(function (data) {
      var first = (data.Items || [])[0];
      if (first && first.Item) first = first.Item;
      if (!first) return { shop: '楽天', price: null };
      return { shop: '楽天', price: Number(first.itemPrice), url: first.itemUrl, seller: first.shopName,
        note: first.postageFlag === 0 ? '送料込み' : '送料別' };
    });
  }

  function fetchYahoo(it) {
    var url = 'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?results=5&condition=new&in_stock=true&sort=' +
      encodeURIComponent('+price') + '&appid=' + encodeURIComponent(settings.yahooAppId) +
      (it.jan ? '&jan_code=' + encodeURIComponent(it.jan) : '&query=' + encodeURIComponent(shopQuery(it)));
    return getJson(url).then(function (data) {
      var first = (data.hits || [])[0];
      if (!first) return { shop: 'Yahoo!', price: null };
      return { shop: 'Yahoo!', price: Number(first.price), url: first.url, seller: first.seller && first.seller.name,
        note: first.shipping && first.shipping.name };
    });
  }

  function fetchShops(it, td) {
    td.textContent = '取得中…';
    var jobs = [];
    if (settings.rakutenAppId && settings.rakutenKey) {
      jobs.push(throttled(function () { return fetchRakuten(shopQuery(it)); })
        .catch(function (e) { return { shop: '楽天', error: e.message }; }));
    }
    if (settings.yahooAppId) {
      jobs.push(throttled(function () { return fetchYahoo(it); })
        .catch(function (e) { return { shop: 'Yahoo!', error: e.message }; }));
    }
    return Promise.all(jobs).then(function (res) {
      // 失敗を含む結果は覚えておかず、もう一度試せるようにする
      var failed = res.some(function (r) { return r.error; });
      if (!failed) shopCache[it.asin] = res;
      renderShopCell(td, it, res);
      if (failed) {
        var b = el('button', 'mini', 'もう一度試す');
        b.type = 'button';
        b.addEventListener('click', function () { fetchShops(it, td); });
        td.appendChild(b);
      }
      return res;
    });
  }

  function bulkFetch() {
    var btn = $('bulk-btn');
    btn.disabled = true;
    var targets = shown.filter(function (it) { return !shopCache[it.asin]; }).slice(0, BULK_COUNT);
    var chain = Promise.resolve();
    targets.forEach(function (it) {
      chain = chain.then(function () {
        var td = document.querySelector('td[data-asin="' + CSS.escape(it.asin) + '"]');
        return td ? fetchShops(it, td) : null;
      });
    });
    chain.then(function () { btn.disabled = false; });
  }

  function testConnection() {
    var status = $('test-status');
    if (!hasShopApi()) { status.className = 'status err'; status.textContent = 'IDが入力されていません。'; return; }
    status.className = 'status';
    status.textContent = 'テスト中…';
    // どの店にもありそうな商品のバーコード番号ではなく、一般的な言葉で試す
    var sample = { asin: '', jan: '', model: '', title: 'コラーゲン ドリンク', limit: 0 };
    var jobs = [];
    if (settings.rakutenAppId && settings.rakutenKey) jobs.push(fetchRakuten(sample.title).catch(function (e) { return { shop: '楽天', error: e.message }; }));
    if (settings.yahooAppId) jobs.push(fetchYahoo(sample).catch(function (e) { return { shop: 'Yahoo!', error: e.message }; }));
    Promise.all(jobs).then(function (res) {
      var bad = res.some(function (r) { return r.error; });
      status.className = bad ? 'status err' : 'status';
      status.textContent = res.map(function (r) { return r.shop + ': ' + (r.error ? '失敗（' + r.error + '）' : '成功'); }).join('　');
    });
  }

  // ---------- 画面の入力とつなぐ ----------

  var FILTER_IDS = ['minSold', 'maxSellers', 'minPrice', 'maxPrice', 'minProfit', 'otherCost', 'defPct', 'defFba', 'keyword'];
  var API_IDS = ['rakutenAppId', 'rakutenKey', 'rakutenUrl', 'yahooAppId'];

  function init() {
    FILTER_IDS.forEach(function (k) {
      var input = $('f-' + k);
      input.value = settings[k];
      input.addEventListener('input', function () { settings[k] = input.value; saveSettings(); render(); });
    });
    var chk = $('f-noAmazon');
    chk.checked = !!settings.noAmazon;
    chk.addEventListener('change', function () { settings.noAmazon = chk.checked; saveSettings(); render(); });

    API_IDS.forEach(function (k) {
      var input = $('s-' + k);
      input.value = settings[k];
      input.addEventListener('change', function () {
        settings[k] = input.value.trim() || (k === 'rakutenUrl' ? DEFAULTS.rakutenUrl : '');
        input.value = settings[k];
        saveSettings();
        shopCache = {};
        render();
      });
    });

    $('file-input').addEventListener('change', function (e) {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });
    var cf = $('f-checkFilter');
    cf.value = settings.checkFilter;
    cf.addEventListener('change', function () { settings.checkFilter = cf.value; saveSettings(); render(); });
    $('export-btn').addEventListener('click', exportBackup);
    $('import-input').addEventListener('change', function (e) {
      if (e.target.files[0]) importBackup(e.target.files[0]);
      e.target.value = '';
    });
    renderBrands();
    $('bulk-btn').addEventListener('click', bulkFetch);
    $('test-btn').addEventListener('click', testConnection);

    Array.prototype.forEach.call(document.querySelectorAll('th[data-sort]'), function (th) {
      th.addEventListener('click', function () {
        var k = th.dataset.sort;
        if (sortKey === k) sortDesc = !sortDesc;
        else { sortKey = k; sortDesc = k !== 'title' && k !== 'sellers'; }
        render();
      });
    });
    $('sort-select').addEventListener('change', function (e) {
      var parts = e.target.value.split(':');
      sortKey = parts[0];
      sortDesc = parts[1] === 'd';
      render();
    });
  }

  init();
})();
