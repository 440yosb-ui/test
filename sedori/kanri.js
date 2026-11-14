(function () {
  'use strict';

  var KEY = 'sedori-ledger-v1';
  var DAY_MS = 24 * 60 * 60 * 1000;

  // purchases: 仕入れ1回分（同じ商品をまとめて買った単位）
  // sales: 売れた記録。どの仕入れ分が売れたかを purchaseId で結びつける
  var data = load();
  var openSaleForm = null;  // 「売れた」入力欄を開いている仕入れのID

  function $(id) { return document.getElementById(id); }

  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    return normalize(d);
  }
  function normalize(d) {
    d = d || {};
    return { purchases: Array.isArray(d.purchases) ? d.purchases : [], sales: Array.isArray(d.sales) ? d.sales : [] };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { alert('保存できませんでした。ブラウザの空き容量や、プライベートブラウズになっていないかを確認してください。'); return false; }
  }

  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function int(v) { var n = Math.round(Number(v)); return isFinite(n) && String(v).trim() !== '' ? n : null; }
  function yen(n) { return n == null ? '—' : '¥' + Math.round(n).toLocaleString('ja-JP'); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- 計算 ----------

  // 1個あたりの仕入れ額（送料などの経費を個数で割って上乗せ）
  function unitTotalCost(p) { return p.unitCost + (p.extra || 0) / p.qty; }
  function salesOf(p) { return data.sales.filter(function (s) { return s.purchaseId === p.id; }); }
  function soldQty(p) { return salesOf(p).reduce(function (a, s) { return a + s.qty; }, 0); }
  function remaining(p) { return p.qty - soldQty(p); }
  function saleProfit(s, p) { return (s.price - s.fee) * s.qty - unitTotalCost(p) * s.qty; }
  function findPurchase(id) {
    for (var i = 0; i < data.purchases.length; i++) if (data.purchases[i].id === id) return data.purchases[i];
    return null;
  }
  function daysBetween(from, to) { return Math.max(0, Math.round((new Date(to) - new Date(from)) / DAY_MS)); }

  function summarize(period) {
    var r = { sales: 0, fees: 0, cost: 0, qty: 0, dayQty: 0 };
    data.sales.forEach(function (s) {
      if (period !== 'all' && s.date.slice(0, period.length) !== period) return;
      var p = findPurchase(s.purchaseId);
      if (!p) return;
      r.sales += s.price * s.qty;
      r.fees += s.fee * s.qty;
      r.cost += unitTotalCost(p) * s.qty;
      r.qty += s.qty;
      r.dayQty += daysBetween(p.date, s.date) * s.qty;
    });
    r.profit = r.sales - r.fees - r.cost;
    r.stock = 0; r.stockValue = 0;
    data.purchases.forEach(function (p) {
      var rem = remaining(p);
      r.stock += rem;
      r.stockValue += rem * unitTotalCost(p);
    });
    return r;
  }

  // ---------- 表示 ----------

  function renderPeriods() {
    var sel = $('period');
    var keep = sel.value;
    var months = {}, years = {};
    months[today().slice(0, 7)] = true;
    data.sales.forEach(function (s) { months[s.date.slice(0, 7)] = true; years[s.date.slice(0, 4)] = true; });
    years[today().slice(0, 4)] = true;
    sel.textContent = '';
    Object.keys(months).sort().reverse().forEach(function (m) {
      sel.add(new Option(m.slice(0, 4) + '年' + Number(m.slice(5)) + '月', m));
    });
    Object.keys(years).sort().reverse().forEach(function (y) { sel.add(new Option(y + '年（1年間）', y)); });
    sel.add(new Option('全期間', 'all'));
    if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
  }

  function renderSummary() {
    var r = summarize($('period').value);
    $('t-sales').textContent = yen(r.sales);
    $('t-fees').textContent = yen(r.fees);
    $('t-cost').textContent = yen(r.cost);
    $('t-profit').textContent = yen(r.profit);
    $('t-profit').className = r.profit < 0 ? 'minus' : '';
    $('t-rate').textContent = r.sales > 0 ? '利益率 ' + (r.profit / r.sales * 100).toFixed(1) + '%' : '';
    $('t-qty').textContent = r.qty.toLocaleString('ja-JP') + '個';
    $('t-days').textContent = r.qty > 0 ? (r.dayQty / r.qty).toFixed(1) + '日' : '—';
    $('t-stock').textContent = r.stock.toLocaleString('ja-JP') + '個';
    $('t-stockValue').textContent = yen(r.stockValue);
  }

  function field(labelText, type, value, attrs) {
    var label = el('label', '', labelText);
    var input = document.createElement('input');
    input.type = type;
    input.value = value == null ? '' : value;
    Object.keys(attrs || {}).forEach(function (k) { input.setAttribute(k, attrs[k]); });
    label.appendChild(input);
    return { label: label, input: input };
  }

  function renderSaleForm(box, p) {
    var rem = remaining(p);
    var form = el('form', 'sale-form');
    var grid = el('div', 'grid');
    var fDate = field('売れた日', 'date', today(), { required: '' });
    var fQty = field('売れた個数（残り ' + rem + '個）', 'number', 1, { min: 1, max: rem, step: 1, inputmode: 'numeric', required: '' });
    var fPrice = field('売れた価格（1個あたり・円）', 'number', p.sellPrice, { min: 0, step: 1, inputmode: 'numeric', required: '' });
    var fFee = field('Amazon手数料（1個あたり・円）', 'number', p.fee, { min: 0, step: 1, inputmode: 'numeric', required: '' });
    [fDate, fQty, fPrice, fFee].forEach(function (f) { grid.appendChild(f.label); });
    form.appendChild(grid);
    var ok = el('button', 'file-btn', '売れた記録を保存');
    ok.type = 'submit';
    var cancel = el('button', 'sub-btn', 'やめる');
    cancel.type = 'button';
    cancel.addEventListener('click', function () { openSaleForm = null; render(); });
    form.appendChild(ok);
    form.appendChild(cancel);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var qty = int(fQty.input.value), price = int(fPrice.input.value), fee = int(fFee.input.value);
      if (!fDate.input.value || qty == null || qty < 1 || qty > rem || price == null || price < 0 || fee == null || fee < 0) {
        alert('入力内容を確認してください。個数は 1〜' + rem + ' の範囲で入力します。');
        return;
      }
      data.sales.push({ id: newId(), purchaseId: p.id, date: fDate.input.value, qty: qty, price: price, fee: fee });
      if (save()) { openSaleForm = null; render(); }
    });
    box.appendChild(form);
  }

  function renderLots() {
    var mode = $('lot-filter').value;
    var list = data.purchases.filter(function (p) {
      var rem = remaining(p);
      return mode === 'all' || (mode === 'stock' ? rem > 0 : rem === 0);
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

    $('lot-count').textContent = data.purchases.length ? '（' + data.purchases.length + '件中 ' + list.length + '件）' : '';
    $('lot-empty').hidden = list.length > 0;
    $('lot-empty').textContent = data.purchases.length ? 'この条件に合う商品はありません。' : 'まだ記録がありません。上の「2」から仕入れを記録してください。';

    var wrap = $('lots');
    wrap.textContent = '';
    list.forEach(function (p) {
      var sales = salesOf(p);
      var sold = soldQty(p), rem = p.qty - sold;
      var profit = sales.reduce(function (a, s) { return a + saleProfit(s, p); }, 0);
      var card = el('div', 'lot');

      card.appendChild(el('div', 'lot-title', p.title));
      var sub = [p.brand, p.supplier ? '仕入れ先: ' + p.supplier : '', '仕入れ日: ' + p.date, p.asin].filter(Boolean).join(' ／ ');
      card.appendChild(el('div', 'sub', sub));

      var facts = el('div', 'facts');
      [
        ['仕入れ値', yen(p.unitCost) + ' × ' + p.qty + '個' + (p.extra ? '（＋経費 ' + yen(p.extra) + '）' : '')],
        ['残り', rem + '個'],
        ['売れた', sold + '個'],
        ['ここまでの利益', sold ? yen(profit) : '—']
      ].forEach(function (f, i) {
        var d = el('div');
        d.appendChild(el('span', '', f[0]));
        d.appendChild(el('strong', i === 3 && profit < 0 ? 'minus' : (i === 3 && sold ? 'plus' : ''), f[1]));
        facts.appendChild(d);
      });
      card.appendChild(facts);

      if (p.sellPrice != null && p.fee != null) {
        var plan = p.sellPrice - p.fee - unitTotalCost(p);
        card.appendChild(el('div', 'sub', '予定どおり売れた場合の利益: 1個あたり ' + yen(plan)));
      }

      if (openSaleForm === p.id && rem > 0) renderSaleForm(card, p);
      else {
        var btns = el('div', 'lot-btns');
        if (rem > 0) {
          var sell = el('button', 'file-btn', '売れた');
          sell.type = 'button';
          sell.addEventListener('click', function () { openSaleForm = p.id; render(); });
          btns.appendChild(sell);
        }
        var del = el('button', 'sub-btn danger', 'この仕入れを削除');
        del.type = 'button';
        del.addEventListener('click', function () {
          var msg = '「' + p.title + '」の仕入れ記録を削除します。' + (sales.length ? 'この商品の売れた記録 ' + sales.length + '件も一緒に消えます。' : '') + 'よろしいですか？';
          if (!confirm(msg)) return;
          data.purchases = data.purchases.filter(function (x) { return x.id !== p.id; });
          data.sales = data.sales.filter(function (s) { return s.purchaseId !== p.id; });
          if (save()) render();
        });
        btns.appendChild(del);
        card.appendChild(btns);
      }

      if (sales.length) {
        var det = el('details');
        det.appendChild(el('summary', '', '売れた記録（' + sales.length + '件）'));
        sales.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (s) {
          var line = el('div', 'sale-line');
          line.appendChild(el('span', '', s.date + '　' + s.qty + '個 × ' + yen(s.price) + '（手数料 ' + yen(s.fee) + '）→ 利益 ' + yen(saleProfit(s, p))));
          var undo = el('button', 'mini', '取り消す');
          undo.type = 'button';
          undo.addEventListener('click', function () {
            if (!confirm(s.date + ' の売れた記録（' + s.qty + '個）を取り消しますか？')) return;
            data.sales = data.sales.filter(function (x) { return x.id !== s.id; });
            if (save()) render();
          });
          line.appendChild(undo);
          det.appendChild(line);
        });
        card.appendChild(det);
      }
      wrap.appendChild(card);
    });
  }

  function render() { renderPeriods(); renderSummary(); renderLots(); }

  // ---------- 仕入れの入力 ----------

  var P_FIELDS = ['title', 'brand', 'asin', 'date', 'supplier', 'unitCost', 'qty', 'extra', 'sellPrice', 'fee'];

  function addPurchase(e) {
    e.preventDefault();
    var v = {};
    P_FIELDS.forEach(function (k) { v[k] = $('p-' + k).value.trim(); });
    var unitCost = int(v.unitCost), qty = int(v.qty);
    var status = $('add-status');
    if (!v.title || !v.date || unitCost == null || unitCost < 0 || qty == null || qty < 1) {
      status.className = 'status err';
      status.textContent = '商品名・仕入れ日・仕入れ値・個数を入力してください。';
      return;
    }
    data.purchases.push({
      id: newId(), title: v.title, brand: v.brand, asin: v.asin.toUpperCase(), date: v.date, supplier: v.supplier,
      unitCost: unitCost, qty: qty, extra: Math.max(0, int(v.extra) || 0),
      sellPrice: int(v.sellPrice), fee: int(v.fee)
    });
    if (!save()) return;
    $('add-form').reset();
    $('p-date').value = today();
    status.className = 'status';
    status.textContent = '「' + v.title + '」を記録しました。';
    $('lot-filter').value = 'stock';
    render();
  }

  // リサーチ画面の「仕入れを記録」ボタンから来たときは、商品の情報を入力欄に入れておく
  function prefillFromUrl() {
    var q = new URLSearchParams(location.search);
    if (!q.has('add')) return;
    ['title', 'brand', 'asin', 'sellPrice', 'fee'].forEach(function (k) {
      if (q.get(k)) $('p-' + k).value = q.get(k);
    });
    $('add-box').open = true;
    history.replaceState(null, '', location.pathname);
    $('add-box').scrollIntoView();
  }

  // ---------- 書き出し・バックアップ ----------

  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function csv(rows) {
    // 先頭の目印(BOM)は Excel で日本語が文字化けしないようにするため
    return '﻿' + rows.map(function (r) {
      return r.map(function (v) {
        var s = v == null ? '' : String(v);
        // 表計算ソフトが数式として実行しないよう、記号で始まる文字には ' を付ける
        if (/^[=+\-@]/.test(s) && typeof v !== 'number') s = "'" + s;
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }

  function exportPurchases() {
    var rows = [['仕入れ日', '商品名', 'メーカー', '商品番号', '仕入れ先', '仕入れ値(1個)', '個数', '経費合計', '仕入れ額合計', '売れた個数', '残り個数', '在庫金額']];
    data.purchases.forEach(function (p) {
      var rem = remaining(p);
      rows.push([p.date, p.title, p.brand, p.asin, p.supplier, p.unitCost, p.qty, p.extra || 0,
        p.unitCost * p.qty + (p.extra || 0), p.qty - rem, rem, Math.round(rem * unitTotalCost(p))]);
    });
    download('仕入れ一覧-' + today() + '.csv', csv(rows), 'text/csv');
  }
  function exportSales() {
    var rows = [['売れた日', '商品名', 'メーカー', '商品番号', '個数', '販売価格(1個)', '売上', 'Amazon手数料', '仕入れ額', '利益', '仕入れ日']];
    data.sales.forEach(function (s) {
      var p = findPurchase(s.purchaseId);
      if (!p) return;
      rows.push([s.date, p.title, p.brand, p.asin, s.qty, s.price, s.price * s.qty, s.fee * s.qty,
        Math.round(unitTotalCost(p) * s.qty), Math.round(saleProfit(s, p)), p.date]);
    });
    download('売上一覧-' + today() + '.csv', csv(rows), 'text/csv');
  }

  function exportBackup() {
    download('rieki-backup-' + today() + '.json',
      JSON.stringify({ type: 'sedori-ledger-backup', version: 1, savedAt: new Date().toISOString(), data: data }, null, 2), 'application/json');
    $('backup-status').className = 'status';
    $('backup-status').textContent = '仕入れ ' + data.purchases.length + '件・売上 ' + data.sales.length + '件を保存しました。';
  }

  function validPurchase(p) {
    return p && typeof p.id === 'string' && typeof p.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) &&
      Number.isFinite(p.unitCost) && Number.isInteger(p.qty) && p.qty > 0;
  }
  function validSale(s) {
    return s && typeof s.id === 'string' && typeof s.purchaseId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
      Number.isInteger(s.qty) && s.qty > 0 && Number.isFinite(s.price) && Number.isFinite(s.fee);
  }

  function importBackup(file) {
    var status = $('backup-status');
    file.text().then(function (text) {
      var b = JSON.parse(text);
      if (!b || b.type !== 'sedori-ledger-backup') throw new Error('形式が違います');
      var incoming = normalize(b.data);
      var purchases = incoming.purchases.filter(validPurchase);
      var ids = {};
      purchases.forEach(function (p) { ids[p.id] = true; });
      var sales = incoming.sales.filter(function (s) { return validSale(s) && ids[s.purchaseId]; });
      var msg = 'いまこのスマホにある記録（仕入れ ' + data.purchases.length + '件・売上 ' + data.sales.length + '件）を、' +
        'ファイルの内容（仕入れ ' + purchases.length + '件・売上 ' + sales.length + '件）に置き換えます。よろしいですか？';
      if ((data.purchases.length || data.sales.length) && !confirm(msg)) return;
      data = { purchases: purchases, sales: sales };
      if (!save()) return;
      status.className = 'status';
      status.textContent = '仕入れ ' + purchases.length + '件・売上 ' + sales.length + '件を戻しました。';
      render();
    }).catch(function () {
      status.className = 'status err';
      status.textContent = 'このファイルは読み込めませんでした。この画面のバックアップで保存したファイルを選んでください。';
    });
  }

  // ---------- 画面とつなぐ ----------

  $('p-date').value = today();
  $('add-form').addEventListener('submit', addPurchase);
  $('period').addEventListener('change', renderSummary);
  $('lot-filter').addEventListener('change', renderLots);
  $('csv-purchases').addEventListener('click', exportPurchases);
  $('csv-sales').addEventListener('click', exportSales);
  $('export-btn').addEventListener('click', exportBackup);
  $('import-input').addEventListener('change', function (e) {
    if (e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = '';
  });
  render();
  prefillFromUrl();
})();
