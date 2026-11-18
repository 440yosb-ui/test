(function () {
  'use strict';

  var STORE_KEY = 'sedori-research-settings-v1';
  var MAX_ROWS = 300;      // 画面に並べる最大件数
  var BULK_COUNT = 20;     // まとめて取得する件数
  var AMAZON_SHARE_LIMIT = 30; // Amazon本体が過去90日のうちこの割合(%)以上で販売していたら「Amazon本体あり」とみなす
  var PRICE_SPIKE = 1.15;      // いまの価格が計算用の価格のこの倍率を超えたら「一時的に高い」と表示
  // 出品者の数が30日平均からこの割合以上、かつこの人数以上増減したら「増加中／減少中」とみなす
  // （資料：出品者が増えると価格が下がり、減ると上がる）
  var SELLER_TREND_RATE = 0.3;
  var SELLER_TREND_MIN = 2;
  var API_WAIT_MS = 1100;  // 他サイトへの問い合わせ間隔（負荷をかけないため）

  // Keepa のファイルの列名（英語・日本語どちらでも）から、使う項目を自動で探すためのパターン。
  // 上にあるパターンほど優先される。
  var FIELDS = [
    { key: 'title', label: '商品名', pats: [/^title$/i, /^商品名$/, /タイトル/] },
    { key: 'asin', label: 'ASIN（Amazonの商品番号）', pats: [/^asin$/i] },
    { key: 'price', label: 'いまの販売価格（カート価格）', pats: [/^buy box: ?(current|現在)/i, /^buy box.*current/i, /カート.*現在/] },
    { key: 'priceNew', label: 'いまの販売価格（新品の最安値）', pats: [/^new: ?current/i, /^新品: ?現在/] },
    { key: 'avg', label: '90日間の平均価格（カート価格）', pats: [/^buy box: ?90 ?(days avg|日平均)/i] },
    { key: 'avgNew', label: '90日間の平均価格（新品の最安値）', pats: [/^new: ?90 ?days avg/i, /^新品: ?90 ?日平均/] },
    { key: 'amazon', label: 'Amazon本体の価格', pats: [/^amazon: current/i, /^amazon: 現在/i, /^amazon.*現在/i] },
    { key: 'amazonShare', label: 'Amazon本体が販売していた割合（90日）', pats: [/^buy box: ?% ?amazon/i] },
    { key: 'avgNew30', label: '30日間の平均価格（新品の最安値）', pats: [/^new: ?30 ?days avg/i, /^新品: ?30 ?日平均/] },
    { key: 'drop1', label: '新品価格の下落率（1日・％）', pats: [/^new: ?1 ?days?.*drop/i, /^新品: ?1 ?日.*下落/] },
    { key: 'drop30', label: '新品価格の下落率（30日・％）', pats: [/^new: ?30 ?days?.*drop/i, /^新品: ?30 ?日.*下落/] },
    { key: 'drop90', label: '新品価格の下落率（90日・％）', pats: [/^new: ?90 ?days?.*drop/i, /^新品: ?90 ?日.*下落/] },
    { key: 'amazonOos', label: 'Amazon本体の在庫切れ率（90日・％）', pats: [/^amazon: ?90 ?days? ?oos/i, /^amazon.*90.*oos/i, /^amazon.*90.*在庫切れ/i] },
    { key: 'amazonAvg', label: 'Amazon本体の90日平均価格', pats: [/^amazon: ?90 ?days avg/i, /^amazon: ?90 ?日平均/i] },
    { key: 'rank', label: '売れ筋ランキング（現在）', pats: [/^sales rank: ?current/i, /ランキング: ?現在/] },
    { key: 'rankAvg', label: '売れ筋ランキング（90日平均）', pats: [/^sales rank: ?90 ?days avg/i, /ランキング: ?90 ?日平均/] },
    { key: 'rankDrop1', label: 'ランキングの上昇率（1日・％）', pats: [/^sales rank: ?1 ?days?.*drop.*%/i, /ランキング: ?1 ?日.*(下落|低下).*[%％]/] },
    { key: 'drops90', label: '90日間に売れた回数（ランキングの低下回数）', pats: [/^sales rank: ?drops last 90/i, /^(?!.*[%％]).*ランキング.*90 ?日.*(減少|低下|ドロップ)/, /drops.*90/i] },
    { key: 'sellersAvg', label: '出品者の数（30日平均）', pats: [/^new offer count: ?30 ?days avg/i, /^新品アイテム数: ?30 ?日平均/] },
    { key: 'couponAbs', label: 'クーポンの割引額（円）', pats: [/^one time coupon: ?absolute/i, /^(ワンタイム)?クーポン.*(絶対|金額|割引額|円)/] },
    { key: 'couponPct', label: 'クーポンの割引率（％）', pats: [/^one time coupon: ?percentage/i, /^(ワンタイム)?クーポン.*([%％]|パーセント|割合)/] },
    { key: 'sold', label: '月の販売数', pats: [/bought in past month/i, /過去1か月.*購入/, /先月.*購入/, /sales rank: drops last 30/i, /ランキング.*30日.*(下落|ドロップ)/, /drops.*30/i] },
    { key: 'sellers', label: '出品者の数', pats: [/^new offer count: current/i, /^新品アイテム数: ?現在/, /新品.*出品者数.*現在/, /offer count.*current/i, /出品者数.*現在/, /offer count/i, /出品者数/] },
    { key: 'fba', label: 'FBA手数料', pats: [/fba pick ?& ?pack/i, /fba.*fee/i, /fba.*手数料/i] },
    { key: 'pct', label: '販売手数料の割合（％）', pats: [/referral fee %/i, /^紹介料 ?[%％]/, /販売手数料.*[%％]/] },
    { key: 'jan', label: 'JANコード（バーコード番号）', pats: [/codes: ean/i, /^ean$/i, /ean/i, /jan/i] },
    { key: 'model', label: '型式', pats: [/^model$/i, /^モデル$/, /型番/] },
    { key: 'part', label: '型式の代わり（部品番号）', pats: [/partnumber/i, /部品番号/] },
    { key: 'category', label: 'カテゴリー', pats: [/^(categories|カテゴリ): ?(root|ルート)/i] },
    { key: 'brand', label: 'ブランド', pats: [/^brand$/i, /^ブランド$/, /manufacturer/i, /メーカー/] }
  ];

  var DEFAULTS = {
    minSold: 100, maxSellers: 15, minPrice: 1000, maxPrice: '', minProfit: 200, otherCost: 50,
    defPct: 10, defFba: 500, keyword: '', noAmazon: true, checkFilter: 'all',
    noRisingSellers: true, showUnknownSold: false,
    // 自己配送（自分で発送）した場合の計算。送料の初期値はリベ大「自己配送 始め方 マニュアル」（じゅんK）の「ネコポスだと送料200円/個弱」より
    selfShipOn: false, selfShip: 200,
    rakutenAppId: '', rakutenKey: '', yahooAppId: '',
    rakutenUrl: 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601',
    mapping: {}, mode: 'basic', modeParams: {}
  };

  var VARIATION_TIP = 'バリエーション：「1製品につき1バリエーションのみ表示」にチェック';

  // リサーチの手法。手法ごとに、絞り込みの条件・計算に使う販売価格・表示する見どころが変わる。
  // keepa: Keepa の製品ファインダーに入れる検索条件の目安（ドライブの資料より）
  // needs: この列がファイルに無いと探せない／soft: 無ければその条件だけ使わずに表示する
  var MODES = [
    { key: 'basic', label: '通常', sort: 'sold:d',
      desc: 'よく売れていて、手数料を引いても利益が残る商品を広く探します。',
      basis: '販売価格は「いまの価格」と「過去90日の平均」の低いほうで計算します（品切れで一時的に値上がりした価格をあてにしないため）。',
      keepa: [], params: [], needs: [], soft: [] },
    { key: 'rise', label: '値上がり', sort: 'score:d',
      desc: 'Amazonで最近値上がりした商品を探します。他のネットショップや店舗に、値上がり前の安い値段のまま残っている在庫を仕入れる方法です。',
      basis: '販売価格は「値上がり後のいまの価格」で計算します。相場が戻ると利益が減るため、値上がり前との差が大きい商品を優先してください。',
      keepa: ['Amazon：「在庫切れ」にチェック', '新品（現在価格）：3000 から', '新品「30日間の下落％」：-1000 から -20', '新品アイテム数（30日平均）：2 から', '先月の購入：50 から', VARIATION_TIP],
      params: [
        { key: 'minPrice', label: 'いまの価格（下限）', unit: '円以上', def: 3000, step: 500 },
        { key: 'minRise', label: '30日間の値上がり率（最低）', unit: '％以上', def: 20, step: 5 },
        { key: 'minGap', label: '値上がり前との価格差（最低）', unit: '円以上', def: 1500, step: 100 },
        { key: 'minSold', label: '月に売れている個数（最低）', unit: '個以上', def: 50, step: 10 },
        { key: 'minSellers', label: '出品者の数（最低）', unit: '人以上（メーカー独占の商品を除く）', def: 2, step: 1 }
      ], needs: ['rise30'], soft: [] },
    { key: 'trend', label: 'トレンド', sort: 'score:d',
      desc: 'SNSやテレビで話題になり、この1日で急に値上がりして売れ始めた商品を探します。毎日見て「いつもと違う商品」に気づくのがコツです。なお、リベ大の記事（じゅんK「月100万円を稼いだ手法3選…」）では、ランキングから探す方法は誰でもできて競争が激しく、価格が急落しやすいとして、やめたことに挙げられています。',
      basis: '販売価格は「いまの価格」で計算します。話題が落ち着くと相場が戻りやすいので、少ない個数から試してください。',
      keepa: ['売れ筋ランキング（現在）：1 から 5000', '売れ筋ランキング「1日間の下落％」：30 から 99', 'Amazon：「在庫切れ」にチェック', '新品「1日間の下落％」：-1000 から -30', 'カテゴリー：選ばない（全ジャンル）', VARIATION_TIP],
      params: [
        { key: 'minRise', label: '1日間の値上がり率（最低）', unit: '％以上', def: 30, step: 5 },
        { key: 'maxRank', label: '売れ筋ランキング（最大）', unit: '位以内', def: 5000, step: 1000 },
        { key: 'minRankUp', label: 'ランキングの上昇率（最低）', unit: '％以上', def: 30, step: 5 },
        { key: 'minPrice', label: 'いまの価格（下限）', unit: '円以上', def: 1000, step: 500 }
      ], needs: ['rise1'], soft: ['rank', 'rankUp'] },
    { key: 'kari', label: '刈り取り', sort: 'score:d',
      desc: 'Amazon本体が在庫切れで値上がりしている商品を探し、Keepaの「トラッキング（値下がり通知）」に登録します。Amazonが安い値段で在庫を戻したときにAmazonで買い、また在庫が切れて値上がりしたときに売る方法です。',
      basis: '販売価格は「値上がりしているいまの価格」で計算します。表示される金額以下でAmazonが在庫を戻したら通知が来るように、Keepaで登録してください。',
      keepa: ['Amazon：「在庫切れ」にチェック', '新品（現在価格）：5000 から', '新品「90日間の下落％」：-1000 から -30', '90日間の在庫切れ率（OOS）のAmazon：50 から 80', '売れ筋ランキングの低下（過去90日間）：90 から', VARIATION_TIP],
      params: [
        { key: 'minPrice', label: 'いまの価格（下限）', unit: '円以上', def: 5000, step: 500 },
        { key: 'minRise', label: '90日間の値上がり率（最低）', unit: '％以上', def: 30, step: 5 },
        { key: 'minOos', label: 'Amazonの在庫切れ率（最低）', unit: '％以上', def: 50, step: 5 },
        { key: 'maxOos', label: 'Amazonの在庫切れ率（最大）', unit: '％以下', def: 80, step: 5 },
        { key: 'minDrops', label: '90日間に売れた回数（最低）', unit: '回以上', def: 90, step: 10 }
      ], needs: ['rise90'], soft: ['amazonOos', 'drops'] },
    { key: 'soku', label: '即刈り', sort: 'score:d',
      desc: 'いまAmazonで一時的に大きく値下がりしている商品を探します。その場でAmazonから買い、値段が元に戻ってから売る方法です。',
      basis: '販売価格は「過去90日の平均（元に戻ると見込む価格）」、仕入れ値は「いまの価格」で計算します。安い出品が残っている間は高く売れないので、Amazonの商品ページで安い出品者の人数と在庫を確かめてください。',
      keepa: ['Amazonの在庫切れ：チェックしない', '新品（90日平均）：5000 から', '新品「1日間の下落％」：30 から 99', '90日間の在庫切れ率（OOS）のAmazon：60 から', '売れ筋ランキングの低下（過去90日間）：90 から', VARIATION_TIP],
      params: [
        { key: 'minAvg', label: '90日間の平均価格（下限）', unit: '円以上', def: 5000, step: 500 },
        { key: 'minDrop', label: '1日間の値下がり率（最低）', unit: '％以上', def: 30, step: 5 },
        { key: 'minOos', label: 'Amazonの在庫切れ率（最低）', unit: '％以上', def: 60, step: 5 },
        { key: 'minDrops', label: '90日間に売れた回数（最低）', unit: '回以上', def: 90, step: 10 }
      ], needs: ['rise1', 'avg90'], soft: ['amazonOos', 'drops'] },
    // 根拠: リベシティ ノウハウ図書館「電脳せどりはたった一つのことだけやっておけば必ず稼げる！」（じゅんK）と
    // YouTube「【セラーリサーチ】トップセラーの戦略をKeepaで丸裸に…」。月販50個は合宿スライド4コマ目より。
    { key: 'seller', label: 'セラー', sort: 'sold:d',
      desc: 'リベ大の記事で最も勧められている方法です（じゅんKさんは月100万円の仕入れをほぼこれだけで行っているそうです）。利益が出た商品を1つ見つけたら、その商品を売っている出品者（セラー）の商品一覧から、ほかの利益商品を拾います。出品数が100件前後の、自分より少し上くらいの個人の出品者を選びます（数千件の業者は手法が違うので避ける）。',
      basis: '販売価格は「いまの価格」と「過去90日の平均」の低いほうで計算します。出品者が仕入れに失敗している商品もあるので、最後は必ず自分でKeepaのグラフを見て判断してください。自己発送で最安値より高い出品や、相場より明らかに高い出品は、リサーチよけの「ダミー商品」のことがあります。',
      keepa: ['出品者のIDを調べる：Amazonの出品者ページのURLの「seller=」のあとにある、Aから始まる文字', 'Keepaの「出品者検索」にIDを入れると「重複の多い競合」に似た出品者が出る（有料プラン）', '製品ファインダーの「販売者ID」にIDを入れる（有料プラン）', 'Amazon：「在庫切れ」にチェック（任意。Amazonがいない商品に絞る）', '売れ筋ランキングの低下 または 先月の購入：50 から', VARIATION_TIP],
      params: [
        { key: 'minSold', label: '月に売れている個数（最低）', unit: '個以上', def: 50, step: 10 }
      ], needs: [], soft: [] },
    { key: 'coupon', label: 'クーポン', sort: 'score:d',
      desc: 'Amazonの割引クーポンが付いている商品を探します。クーポンで安く買い、通常の値段で売る方法です。ドライブの資料に具体的な条件が見当たらなかったため、一般的な考え方で作っています。',
      basis: '販売価格は「いまの価格」と「過去90日の平均」の低いほう、仕入れ値は「いまの価格 − クーポンの割引」で計算します。クーポンは1人1回までのことが多く、同じ商品を何個も買えないことがあります。',
      keepa: ['ワンタイムクーポン：1 から（クーポン付きの商品だけにする）', '先月の購入：30 から', VARIATION_TIP],
      params: [
        { key: 'minOff', label: 'クーポンの割引率（最低）', unit: '％以上', def: 15, step: 5 },
        { key: 'minSold', label: '月に売れている個数（最低）', unit: '個以上', def: 30, step: 10 }
      ], needs: ['coupon'], soft: [] }
  ];

  // ファイルに列が無いときに、Keepa のどの列が必要かを伝えるための名前
  var METRIC_NAMES = {
    rise1: '「新品: 1日間の下落％」', rise30: '「新品: 30日間の下落％」または「新品: 30日平均」',
    rise90: '「新品: 90日間の下落％」または「新品: 90日平均」', avg90: '「新品: 90日平均」',
    amazonOos: '「Amazon: 90日間の在庫切れ率（OOS）」', rank: '「売れ筋ランキング: 現在」',
    rankUp: '「売れ筋ランキング: 90日平均」', drops: '「売れ筋ランキングの低下（90日間）」', coupon: '「ワンタイムクーポン」'
  };

  var settings = loadSettings();
  var headers = [];
  var rawRows = [];
  var mapping = {};       // 項目キー → 列番号
  var shown = [];         // いま表に出している商品
  var sortKey = 'sold';
  var sortDesc = true;
  var avail = {};         // 読み込んだファイルに、各手法で使う数字が入っているか
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
      var hasPrice = ['price', 'priceNew', 'avg', 'avgNew'].some(function (k) { return mapping[k] >= 0; });
      var missing = ['title', 'asin', 'price', 'sold'].filter(function (k) { return k === 'price' ? !hasPrice : mapping[k] < 0; })
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

  // Keepa の型式欄には「100g」「-」「99-99」やバーコード番号など、検索に使えない値も入っている。
  // 英字と数字の両方を含む5文字以上、または5〜7桁の数字だけを型式として扱う。
  function usableModel(v) {
    v = String(v || '').trim();
    if (/^\d{5,7}$/.test(v)) return v;
    return (v.length >= 5 && /[a-z]/i.test(v) && /\d/.test(v)) ? v : '';
  }

  function currentMode() {
    return MODES.filter(function (m) { return m.key === settings.mode; })[0] || MODES[0];
  }
  // 手法ごとの条件の値。利用者が変えていなければ初期値を使う。空欄は「制限なし」。
  function modeParams(mode) {
    var stored = settings.modeParams[mode.key] || {};
    var p = {};
    mode.params.forEach(function (d) { p[d.key] = num((d.key in stored) ? stored[d.key] : d.def); });
    return p;
  }
  // 「最低○○」の条件。条件が空欄や0なら通す。数字が不明な商品は通さない。
  function atLeast(v, min) { return min == null || min <= 0 || (v != null && v >= min); }
  // 月の販売数の条件。Keepaに販売数が出ていなくても売れている商品はあるため、設定しだいで通す。
  function soldOk(it, min) {
    if (it.sold == null && settings.showUnknownSold) return true;
    return atLeast(it.sold, min);
  }
  // 出品者の数の動き。'up'＝増加中、'down'＝減少中、null＝大きな変化なし・不明
  function sellerTrend(it) {
    if (it.sellers == null || it.sellersAvg == null || it.sellersAvg <= 0) return null;
    var diff = it.sellers - it.sellersAvg;
    if (Math.abs(diff) < SELLER_TREND_MIN || Math.abs(diff) / it.sellersAvg < SELLER_TREND_RATE) return null;
    return diff > 0 ? 'up' : 'down';
  }
  // どの手法でも共通で出す注意書き
  function addCommonLines(it) {
    var t = sellerTrend(it);
    var avgText = '30日平均 ' + Math.round(it.sellersAvg) + '人 → いま ' + it.sellers + '人';
    // 複数買いを控える注意はリベ大ノウハウ図書館「ドンキホーテで月10万円稼ぐ方法」（全国同時セールで出品者が急増→価格急落）より
    if (t === 'up') it.lines.push({ text: '出品者が増えています（' + avgText + '）。値下がりしやすいので様子見がおすすめ。仕入れるときも複数買いは控えめに', warn: true });
    if (t === 'down') it.lines.push({ text: '出品者が減っています（' + avgText + '）。値上がりしやすい一方、急に減ったときは偽物の取り締まりの可能性もあります' });
    if (it.limitSelf != null && it.limit != null && it.limitSelf > it.limit) {
      it.lines.push(it.limit <= 0
        ? { text: 'FBAでは利益が出ませんが、自己配送なら仕入れ上限 ' + yen(it.limitSelf), hl: true }
        : { text: '自己配送なら仕入れ上限 ' + yen(it.limitSelf) + '（FBAより ' + yen(it.limitSelf - it.limit) + ' 高い）' });
    }
    if (it.sold == null) it.lines.push({ text: '月の販売数が分かりません。Keepaの「DATA → オファー」で在庫が減っているか（売れているか）を確かめてください', warn: true });
  }
  function pctText(n) { return (n >= 0 ? '+' : '−') + Math.abs(Math.round(n)) + '%'; }

  function buildItems() {
    var defPct = settingNum('defPct') || 0;
    var defFba = settingNum('defFba') || 0;
    var other = settingNum('otherCost') || 0;
    var profit = settingNum('minProfit') || 0;
    var selfShip = settings.selfShipOn ? settingNum('selfShip') : null;
    return rawRows.map(function (r) {
      // いまの価格: カート価格が空なら新品の最安値を使う。平均価格も同じ考え方。
      var curNew = num(cell(r, 'priceNew'));
      var current = num(cell(r, 'price'));
      if (current == null) current = curNew;
      var avg = num(cell(r, 'avg'));
      var avgNew90 = num(cell(r, 'avgNew'));
      if (avg == null) avg = avgNew90;
      if (avgNew90 == null) avgNew90 = avg;
      // 値上がり率（％、プラスが値上がり）。Keepa の「下落％」は値上がりがマイナスで入っているので符号を逆にする。
      // 下落％の列が無いときは、いまの新品価格と期間の平均から計算する。
      var base = curNew != null ? curNew : current;
      var rise = function (dropKey, avgVal) {
        var d = num(cell(r, dropKey));
        if (d != null) return -d;
        return (base != null && avgVal) ? (base - avgVal) / avgVal * 100 : null;
      };
      var pct = num(cell(r, 'pct'));
      var fba = num(cell(r, 'fba'));
      var estimated = (pct == null || fba == null);
      if (pct == null) pct = defPct;
      if (fba == null) fba = defFba;
      // JAN が複数入っている場合は先頭の1つを使う
      var jan = (cell(r, 'jan').match(/\d{8,13}/) || [''])[0];
      // 型式が空なら部品番号で代用する。ただしバーコード番号と同じ数字だけのものは型式として扱わない
      var model = usableModel(cell(r, 'model')) || usableModel(cell(r, 'part'));
      var amazonPrice = num(cell(r, 'amazon'));
      var amazonShare = num(cell(r, 'amazonShare'));
      var amazonNow = amazonPrice != null && amazonPrice > 0;
      var rank = num(cell(r, 'rank')), rankAvg = num(cell(r, 'rankAvg'));
      var rankUp = num(cell(r, 'rankDrop1'));
      if (rankUp == null && rank != null && rankAvg) rankUp = (rankAvg - rank) / rankAvg * 100;
      var couponAbs = Math.abs(num(cell(r, 'couponAbs')) || 0);
      var couponPct = Math.abs(num(cell(r, 'couponPct')) || 0);
      var coupon = couponAbs > 0 ? couponAbs : (couponPct > 0 && current != null ? Math.round(current * couponPct / 100) : null);
      var sold = num(cell(r, 'sold'));
      var drops90 = num(cell(r, 'drops90'));
      var it = {
        title: cell(r, 'title'), asin: cell(r, 'asin'), brand: cell(r, 'brand'),
        model: model, jan: jan, category: cell(r, 'category'),
        current: current, avg: avg, avg90: avgNew90, amazonShare: amazonShare,
        amazonNow: amazonNow,
        // Amazon本体がいま販売中、または過去90日の3割以上でAmazon本体が売っていた商品
        amazonSells: amazonNow || (amazonShare != null && amazonShare >= AMAZON_SHARE_LIMIT),
        amazonOos: num(cell(r, 'amazonOos')), amazonAvg: num(cell(r, 'amazonAvg')),
        sold: sold, sellers: num(cell(r, 'sellers')), sellersAvg: num(cell(r, 'sellersAvg')),
        // 90日間に売れた回数。列が無ければ月の販売数の3か月分で代用する
        drops: drops90 != null ? drops90 : (sold != null ? sold * 3 : null),
        rise1: rise('drop1', null), rise30: rise('drop30', num(cell(r, 'avgNew30'))), rise90: rise('drop90', avgNew90),
        rank: rank, rankUp: rankUp, coupon: coupon,
        price: null, fees: null, limit: null, feesEstimated: estimated,
        buy: null, score: null, lines: [], priceNote: null
      };
      // 計算に使う販売価格を決め、手数料と仕入れ上限を出す
      it.setSell = function (sell) {
        it.price = sell;
        it.fees = sell == null ? null : Math.round(sell * pct / 100 + fba);
        it.limit = it.fees == null ? null : Math.round(sell - it.fees - other - profit);
        // 手数料と経費を引いて手元に残る金額。ここから仕入れ値を引いたものが利益。
        it.net = it.fees == null ? null : Math.round(sell - it.fees - other);
        // 自己配送ならFBA手数料の代わりに送料がかかる（リベ大「自己配送 始め方 マニュアル」）
        it.limitSelf = (sell == null || selfShip == null) ? null : Math.round(sell - sell * pct / 100 - selfShip - other - profit);
      };
      return it;
    });
  }

  // 手法ごとの判定。条件に合えば true を返し、販売価格・見どころ（lines）・並び順の点数（score）を商品に書き込む。
  var EVAL = {
    basic: function (it) {
      // 品切れなどで一時的に値上がりしていることがあるため、「いま」と「90日平均」の低いほうで計算する
      it.setSell((it.current != null && it.avg != null) ? Math.min(it.current, it.avg) : (it.current != null ? it.current : it.avg));
      if (it.price == null) return false;
      var minSold = settingNum('minSold'), maxSellers = settingNum('maxSellers'), minPrice = settingNum('minPrice');
      if (!soldOk(it, minSold)) return false;
      if (maxSellers != null && it.sellers != null && it.sellers > maxSellers) return false;
      if (minPrice != null && it.price < minPrice) return false;
      if (settings.noAmazon && it.amazonSells) return false;
      if (it.current != null && it.current > it.price * PRICE_SPIKE) it.priceNote = { text: 'いまは' + yen(it.current) + '（一時的に高い）', warn: true };
      else if (it.current == null) it.priceNote = { text: '90日平均' };
      it.score = it.sold;
      return true;
    },
    rise: function (it, p) {
      if (it.current == null || it.rise30 == null || it.amazonNow) return false;
      if (!atLeast(it.current, p.minPrice) || !atLeast(it.rise30, p.minRise) || !soldOk(it, p.minSold)) return false;
      var before = it.current / (1 + it.rise30 / 100);
      var gap = it.current - before;
      if (!atLeast(gap, p.minGap)) return false;
      var sellers = it.sellersAvg != null ? it.sellersAvg : it.sellers;
      if (sellers != null && p.minSellers != null && sellers < p.minSellers) return false;
      it.setSell(it.current);
      it.priceNote = { text: '値上がり後のいまの価格' };
      it.lines.push({ text: '30日で ' + pctText(it.rise30) + '（以前 約' + yen(before) + ' → いま ' + yen(it.current) + '、差 ' + yen(gap) + '）', hl: true });
      it.score = gap;
      return true;
    },
    trend: function (it, p) {
      if (it.current == null || it.rise1 == null || it.amazonNow) return false;
      if (!atLeast(it.current, p.minPrice) || !atLeast(it.rise1, p.minRise)) return false;
      if (avail.rank && p.maxRank != null && (it.rank == null || it.rank > p.maxRank)) return false;
      if (it.rankUp != null && p.minRankUp != null && it.rankUp < p.minRankUp) return false;
      var before = it.current / (1 + it.rise1 / 100);
      it.setSell(it.current);
      it.priceNote = { text: '急に上がったいまの価格' };
      it.lines.push({ text: '1日で ' + pctText(it.rise1) + '（約' + yen(before) + ' → ' + yen(it.current) + '）', hl: true });
      if (it.rank != null) it.lines.push({ text: 'ランキング ' + it.rank.toLocaleString('ja-JP') + '位' + (it.rankUp != null ? '（' + Math.round(it.rankUp) + '%上昇）' : '') });
      it.score = it.rise1;
      return true;
    },
    kari: function (it, p) {
      if (it.current == null || it.rise90 == null || it.amazonNow) return false;
      if (!atLeast(it.current, p.minPrice) || !atLeast(it.rise90, p.minRise)) return false;
      if (avail.amazonOos) {
        if (it.amazonOos == null || !atLeast(it.amazonOos, p.minOos)) return false;
        if (p.maxOos != null && it.amazonOos > p.maxOos) return false;
      }
      if (avail.drops && !atLeast(it.drops, p.minDrops)) return false;
      it.setSell(it.current);
      // Amazonがいつもの値段で在庫を戻しても利益が出ない商品は、待つ意味がない
      if (it.amazonAvg != null && it.amazonAvg > it.limit) return false;
      it.priceNote = { text: '値上がりしているいまの価格' };
      it.lines.push({ text: 'Keepaで「Amazonが ' + yen(it.amazonAvg != null ? it.amazonAvg : it.limit) + ' 以下」になったら通知が来るように登録', hl: true });
      it.lines.push({ text: '90日で ' + pctText(it.rise90) + (it.amazonOos != null ? ' ／ Amazonの在庫切れ ' + Math.round(it.amazonOos) + '%' : '') +
        (it.amazonAvg != null ? ' ／ Amazonのいつもの価格 ' + yen(it.amazonAvg) : '') });
      it.score = it.rise90;
      return true;
    },
    soku: function (it, p) {
      if (it.current == null || it.rise1 == null || it.avg90 == null) return false;
      if (!atLeast(it.avg90, p.minAvg) || !atLeast(-it.rise1, p.minDrop)) return false;
      if (avail.amazonOos && !atLeast(it.amazonOos, p.minOos)) return false;
      if (avail.drops && !atLeast(it.drops, p.minDrops)) return false;
      it.setSell(it.avg90);
      it.buy = it.current;
      if (it.buy > it.limit) return false;   // いま買っても欲しい利益が残らない
      it.priceNote = { text: '90日平均（戻ると見込む価格）' };
      it.lines.push({ text: 'いま ' + yen(it.buy) + ' で買い、' + yen(it.price) + ' に戻れば 見込み利益 ' + yen(it.net - it.buy), hl: true });
      it.lines.push({ text: '1日で ' + pctText(it.rise1) + (it.amazonNow ? ' ／ Amazon本体が販売中（売り切れるまでは高く売れません）' : ''), warn: it.amazonNow });
      it.score = it.net - it.buy;
      return true;
    },
    seller: function (it, p) {
      it.setSell((it.current != null && it.avg != null) ? Math.min(it.current, it.avg) : (it.current != null ? it.current : it.avg));
      if (it.price == null || !soldOk(it, p.minSold)) return false;
      // Amazon本体がいても、カートが分散していれば自分にも回ってくる（資料より）。除外はせず、商品名の下の表示で知らせる。
      if (it.current != null && it.current > it.price * PRICE_SPIKE) it.priceNote = { text: 'いまは' + yen(it.current) + '（一時的に高い）', warn: true };
      it.score = it.sold;
      return true;
    },
    coupon: function (it, p) {
      if (it.current == null || it.coupon == null) return false;
      var off = it.coupon / it.current * 100;
      if (!atLeast(off, p.minOff) || !soldOk(it, p.minSold)) return false;
      it.setSell(it.avg90 != null ? Math.min(it.current, it.avg90) : it.current);
      it.buy = Math.round(it.current - it.coupon);
      if (it.buy > it.limit) return false;
      it.lines.push({ text: 'クーポン ' + yen(it.coupon) + '引き（' + Math.round(off) + '%）→ ' + yen(it.buy) + ' で買い、' + yen(it.price) + ' で売ると 見込み利益 ' + yen(it.net - it.buy), hl: true });
      it.score = it.net - it.buy;
      return true;
    }
  };

  // 読み込んだファイルに、手法で使う数字が1件でも入っているかを調べる
  function checkAvailable(items) {
    avail = {};
    Object.keys(METRIC_NAMES).forEach(function (k) {
      avail[k] = items.some(function (it) { return it[k] != null; });
    });
    // 売れた回数は、月の販売数からも代用できる
    avail.drops = mapping.drops90 >= 0 || mapping.sold >= 0;
  }

  function applyFilters(items) {
    var mode = currentMode();
    var p = modeParams(mode);
    var maxPrice = settingNum('maxPrice');
    var kw = String(settings.keyword || '').trim().toLowerCase();
    var cf = settings.checkFilter;
    var stats = cf === 'goodBrand' ? brandStats() : null;
    return items.filter(function (it) {
      var chk = checks[it.asin];
      if (cf === 'unchecked' && chk) return false;
      if (cf === 'passed' && !(chk && isPass(chk.status))) return false;
      if (cf === 'goodBrand' && !isGoodBrand(stats[brandKey(it.brand)])) return false;
      if (kw && (it.title + ' ' + it.brand + ' ' + it.model).toLowerCase().indexOf(kw) === -1) return false;
      if (!EVAL[mode.key](it, p)) return false;
      // トレンドは「出品者が急に減る」のが特徴なので、増加中の除外だけを行い、どの手法でも同じ扱いにする
      if (settings.noRisingSellers && sellerTrend(it) === 'up') return false;
      addCommonLines(it);
      if (it.price == null) return false;                 // 価格が不明な商品は計算できない
      // どう仕入れても利益が残らない（自己配送の計算をオンにしていれば、自己配送で利益が残る商品は残す）
      if ((it.limit == null || it.limit <= 0) && !(it.limitSelf > 0)) return false;
      if (maxPrice != null && it.price > maxPrice) return false;
      return true;
    });
  }

  // 手法に必要な列がファイルに無いときの案内
  function renderModeWarn() {
    var mode = currentMode();
    var box = $('mode-warn');
    var hard = mode.needs.filter(function (k) { return !avail[k]; });
    var soft = mode.soft.filter(function (k) { return !avail[k]; });
    var names = function (keys) { return keys.map(function (k) { return METRIC_NAMES[k]; }).join('、'); };
    var msg = '';
    if (hard.length) msg = 'このファイルには ' + names(hard) + ' の列が無いため、「' + mode.label + '」では探せません。Keepaでエクスポートするときに、この列を含めてください（列の名前が違うだけなら、上の「列の割り当て」で選べます）。';
    else if (soft.length) msg = 'このファイルには ' + names(soft) + ' の列が無いため、その条件は使わずに表示しています。';
    box.hidden = !msg;
    box.textContent = msg;
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
    var items = buildItems();
    checkAvailable(items);
    renderModeWarn();
    var all = sortItems(applyFilters(items));
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
      var sub = [it.brand, it.category, it.model ? '型式: ' + it.model : '', it.jan ? 'JAN: ' + it.jan : ''].filter(Boolean).join(' ／ ');
      if (sub) tdTitle.appendChild(el('div', 'sub', sub));
      // 手法ごとの見どころ（値上がり率・通知を登録する価格・見込み利益など）
      it.lines.forEach(function (l) { tdTitle.appendChild(el('div', l.hl ? 'hl' : (l.warn ? 'sub warn' : 'sub'), l.text)); });
      if (it.amazonSells) {
        tdTitle.appendChild(el('div', 'sub warn', 'Amazon本体が販売' + (it.amazonShare != null ? '（過去90日の' + Math.round(it.amazonShare) + '%）' : '中')));
      }
      tr.appendChild(tdTitle);

      var tdPrice = el('td', 'num', yen(it.price));
      if (it.priceNote) tdPrice.appendChild(el('div', it.priceNote.warn ? 'sub warn' : 'sub', it.priceNote.text));
      tr.appendChild(tdPrice);
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
    // 利益管理の画面を別タブで開き、商品の情報を入力欄に引き継ぐ
    var q = new URLSearchParams({ add: '1', title: it.title, brand: it.brand, asin: it.asin });
    if (it.price != null) q.set('sellPrice', String(it.price));
    if (it.fees != null) q.set('fee', String(it.fees));
    tools.appendChild(link('仕入れを記録', 'kanri.html?' + q.toString(), 'mini'));
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

  var FILTER_IDS = ['minSold', 'maxSellers', 'minPrice', 'maxPrice', 'minProfit', 'otherCost', 'defPct', 'defFba', 'keyword', 'selfShip'];
  var API_IDS = ['rakutenAppId', 'rakutenKey', 'rakutenUrl', 'yahooAppId'];

  // 手法の切り替えボタンと、その手法の説明・条件の入力欄を作る
  function renderModeUi() {
    var mode = currentMode();
    var tabs = $('mode-tabs');
    tabs.textContent = '';
    MODES.forEach(function (m) {
      var b = el('button', 'mode-btn' + (m.key === mode.key ? ' on' : ''), m.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', m.key === mode.key ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (settings.mode === m.key) return;
        settings.mode = m.key;
        saveSettings();
        // 手法に合った並び順に切り替える（値上がりなら価格差、即刈りなら見込み利益の大きい順）
        $('sort-select').value = m.sort;
        applySort(m.sort);
        renderModeUi();
        render();
      });
      tabs.appendChild(b);
    });
    $('mode-desc').textContent = mode.desc;
    $('price-basis').textContent = mode.basis;

    var list = $('mode-keepa-list');
    list.textContent = '';
    mode.keepa.forEach(function (t) { list.appendChild(el('li', '', t)); });
    $('mode-keepa').hidden = mode.keepa.length === 0;

    var grid = $('mode-grid');
    grid.textContent = '';
    var stored = settings.modeParams[mode.key] || {};
    mode.params.forEach(function (d) {
      var label = el('label', '', d.label);
      var input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = String(d.step || 1);
      input.value = (d.key in stored) ? stored[d.key] : d.def;
      input.addEventListener('input', function () {
        if (!settings.modeParams[mode.key]) settings.modeParams[mode.key] = {};
        settings.modeParams[mode.key][d.key] = input.value;
        saveSettings();
        render();
      });
      label.appendChild(input);
      label.appendChild(el('small', '', d.unit));
      grid.appendChild(label);
    });
    grid.hidden = mode.params.length === 0;

    // 「通常」だけで使う条件は、ほかの手法では隠す（手法ごとの条件と二重になるため）
    Array.prototype.forEach.call(document.querySelectorAll('.basic-only'), function (e) { e.hidden = mode.key !== 'basic'; });
  }

  function applySort(value) {
    var parts = value.split(':');
    sortKey = parts[0];
    sortDesc = parts[1] === 'd';
  }

  function init() {
    if (!MODES.some(function (m) { return m.key === settings.mode; })) settings.mode = 'basic';
    if (!settings.modeParams || typeof settings.modeParams !== 'object') settings.modeParams = {};
    $('sort-select').value = currentMode().sort;
    applySort(currentMode().sort);
    renderModeUi();
    FILTER_IDS.forEach(function (k) {
      var input = $('f-' + k);
      input.value = settings[k];
      input.addEventListener('input', function () { settings[k] = input.value; saveSettings(); render(); });
    });
    ['noAmazon', 'noRisingSellers', 'showUnknownSold', 'selfShipOn'].forEach(function (k) {
      var box = $('f-' + k);
      box.checked = !!settings[k];
      box.addEventListener('change', function () { settings[k] = box.checked; saveSettings(); render(); });
    });

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
      applySort(e.target.value);
      render();
    });
  }

  init();
})();
