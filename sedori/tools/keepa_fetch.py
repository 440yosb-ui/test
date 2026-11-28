# -*- coding: utf-8 -*-
"""Keepa API から商品を取ってきて、リサーチツールが読める CSV に書き出す（毎朝の定期作業用）。

使い方（リポジトリの一番上で）:
    python3 sedori/tools/keepa_fetch.py <書き出すCSVのパス> [--page N] [--max N]
そのあと `node sedori/tools/research.js <CSV>` で、画面と同じ計算で全手法の結果を出す。

- API キーは環境変数 KEEPA_API_KEY から読む（リポジトリ・画面・ログには書かない）。
- 調べる条件の出発点は、利用者が週1回 Keepa Product Finder で書き出していた条件と同じ
  （先月の購入50以上・新品3,000円以上・新品アイテム数30日平均2以上・色やサイズ違いも含める）。
  手法ごとの絞り込みは research.js（画面と同じ計算）で行う。
- トークン: Product Finder 1回で約11、商品1件で1（stats=90、history=0）。利用者のプランは
  ためておける上限60・1分に1回復（2026-11-28 確認）なので、1回の作業で残りトークンの範囲だけ調べる。
- 毎日同じ商品ばかりにならないよう、販売数の多い順の結果を日付で1ページずつ（50件）ずらして見る。
- 列名は Keepa の英語の書き出しの列名に合わせ、app.js の FIELDS で自動判定されるようにしている。
  Buy Box の価格・Amazon の販売割合は追加のトークンが要るので取らない（ツールは「新品: 現在」で補い、
  Amazon本体は「Amazon: 現在」の有無で見る）。
"""
import csv
import datetime
import gzip
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = 'https://api.keepa.com/'
DOMAIN_JP = 5
# 週1回の書き出し条件（sedori/README.md「週1回のリサーチ」と同じ）
SELECTION = {
    'monthlySold_gte': 50,
    'current_NEW_gte': 3000,
    'avg30_COUNT_NEW_gte': 2,
    'sort': [['monthlySold', 'desc']],
    'perPage': 50,
}
PAGES_TO_ROTATE = 100  # 販売数の多い上位 5,000 件を100日で一巡する
FINDER_COST = 11

# Keepa の csv の種類（stats.current などの並び）
AMAZON, NEW, SALES, COUNT_NEW = 0, 1, 3, 11

HEADERS = [
    'Title', 'ASIN', 'Brand', 'Categories: Root', 'Parent ASIN', 'Color', 'Size',
    'New: Current', 'New: 90 days avg.', 'New: 30 days avg.', 'New: Lowest',
    'Amazon: Current', 'Amazon: 90 days avg.', 'Amazon: 90 days OOS',
    'Sales Rank: Current', 'Sales Rank: 90 days avg.', 'Sales Rank: Drops last 90 days',
    'New Offer Count: Current', 'New Offer Count: 30 days avg.',
    'Bought in past month', 'FBA Pick&Pack Fee', 'Referral Fee %',
    'One Time Coupon: Absolute', 'One Time Coupon: Percentage',
    'Product Codes: EAN', 'Model', 'PartNumber',
]


def call(path, params):
    key = os.environ.get('KEEPA_API_KEY')
    if not key:
        sys.exit('環境変数 KEEPA_API_KEY がありません')
    url = API + path + '?' + urllib.parse.urlencode(dict(params, key=key))
    req = urllib.request.Request(url, headers={'Accept-Encoding': 'gzip'})
    try:
        body = urllib.request.urlopen(req, timeout=120).read()
    except urllib.error.HTTPError as e:
        body = e.read()
    try:
        body = gzip.decompress(body)
    except OSError:
        pass
    data = json.loads(body)
    if data.get('error'):
        # エラーの文面にキーは含まれないが、念のため伏せる
        sys.exit('Keepa のエラー: ' + json.dumps(data['error'], ensure_ascii=False).replace(key, '[KEY]'))
    return data


def val(arr, i):
    """Keepa の -1 / -2（データなし）は空欄にする。"""
    if not arr or i >= len(arr) or arr[i] is None or arr[i] < 0:
        return ''
    return arr[i]


def row(p):
    s = p.get('stats') or {}
    cur, avg90, avg30 = s.get('current'), s.get('avg90'), s.get('avg30')
    low = (s.get('min') or [])
    low_new = low[NEW][1] if len(low) > NEW and low[NEW] and low[NEW][1] >= 0 else ''
    oos = s.get('outOfStockPercentage90')
    tree = p.get('categoryTree') or []
    coupon = p.get('coupon') or []
    one_time = coupon[0] if coupon else 0
    fees = p.get('fbaFees') or {}
    sold = p.get('monthlySold')
    return [
        p.get('title') or '', p.get('asin') or '', p.get('brand') or p.get('manufacturer') or '',
        tree[0]['name'] if tree else '', p.get('parentAsin') or '', p.get('color') or '', p.get('size') or '',
        val(cur, NEW), val(avg90, NEW), val(avg30, NEW), low_new,
        val(cur, AMAZON), val(avg90, AMAZON), val(oos, AMAZON),
        val(cur, SALES), val(avg90, SALES), s.get('salesRankDrops90') if isinstance(s.get('salesRankDrops90'), int) and s.get('salesRankDrops90') >= 0 else '',
        val(cur, COUNT_NEW), val(avg30, COUNT_NEW),
        sold if sold and sold > 0 else '', fees.get('pickAndPackFee') or '',
        p.get('referralFeePercentage') or p.get('referralFeePercent') or '',
        one_time if one_time > 0 else '', -one_time if one_time < 0 else '',
        (p.get('eanList') or [''])[0], p.get('model') or '', p.get('partNumber') or '',
    ]


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit('書き出す CSV のパスを指定してください')
    out = args[0]
    page = None
    max_products = None
    if '--page' in args:
        page = int(args[args.index('--page') + 1])
    if '--max' in args:
        max_products = int(args[args.index('--max') + 1])
    if page is None:
        # 日本時間の日付で決める（定期作業は日本時間の朝4時台で、UTC だと前日の日付になり同じページを2日続けて見てしまうため）
        jst_today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date()
        page = jst_today.toordinal() % PAGES_TO_ROTATE

    left = call('token', {}).get('tokensLeft', 0)
    budget = left - FINDER_COST
    if budget < 5:
        sys.exit('Keepa のトークンが足りません（残り %d）。1分に1ずつ回復します' % left)

    sel = dict(SELECTION, page=page)
    found = call('query', {'domain': DOMAIN_JP, 'selection': json.dumps(sel)})
    asins = found.get('asinList') or []
    take = min(len(asins), found.get('tokensLeft', budget), max_products or 10 ** 6)
    asins = asins[:take]

    products = []
    for i in range(0, len(asins), 20):
        chunk = asins[i:i + 20]
        data = call('product', {'domain': DOMAIN_JP, 'asin': ','.join(chunk), 'stats': 90, 'history': 0})
        products.extend(data.get('products') or [])
        if data.get('tokensLeft', 1) <= 0:
            break
        time.sleep(1)

    with open(out, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(HEADERS)
        for p in products:
            w.writerow(row(p))
    info = {'page': page, 'totalResults': found.get('totalResults'), 'products': len(products),
            'tokensLeft': call('token', {}).get('tokensLeft')}
    print(json.dumps(info, ensure_ascii=False))


if __name__ == '__main__':
    main()
