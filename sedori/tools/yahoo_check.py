# -*- coding: utf-8 -*-
"""Yahoo!ショッピングで、仕入れ候補が Amazon の「仕入れ上限」より安く買えるかを確かめる（毎朝の定期作業用）。

使い方:
    python3 sedori/tools/yahoo_check.py <候補のJSON>
候補のJSON は [{"asin":..., "jan":..., "limit": 仕入れ上限}, ...]。結果を JSON で出す。

決まり（利用者と決めたこと 2026-11-28）:
- JAN（バーコードの番号）が一致する新品だけを見る（中古は除く。2026-11-28 の試しで中古が最安値に出たため）。見つからなければ「見つからず」。
- 値段は税込。送料無料と分かるものだけ、そのまま仕入れ上限と比べる。送料がかかる・分からないものは「送料を確かめる」とする。
- ポイントは利益に一切数えない。もらえるポイントは参考として別に出すだけ。
- アプリIDは環境変数 YAHOO_APP_ID から読む（リポジトリ・画面・ログには書かない）。Yahoo! の決まりに合わせ、1秒に1回まで。
- Yahoo! のお店のページは開かない（API の結果だけを使う）。はじめてのお店は利用者が「新しいお店で買う前のチェック」で確かめる。
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

URL = 'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch'


def search(jan):
    app = os.environ.get('YAHOO_APP_ID')
    if not app:
        sys.exit('環境変数 YAHOO_APP_ID がありません')
    q = urllib.parse.urlencode({'appid': app, 'jan_code': jan, 'condition': 'new', 'in_stock': 'true', 'sort': '+price', 'results': 10})
    try:
        body = urllib.request.urlopen(URL + '?' + q, timeout=60).read()
    except urllib.error.HTTPError as e:
        return {'error': 'HTTP %d' % e.code}
    return json.loads(body)


def shipping_free(hit):
    ship = hit.get('shipping') or {}
    name = ship.get('name') or ''
    return ship.get('code') == 2 or name == '送料無料'


def check(item):
    jan = str(item.get('jan') or '').strip()
    if not jan:
        return dict(item, result='JANなし')
    data = search(jan)
    if data.get('error'):
        return dict(item, result='エラー: ' + data['error'])
    hits = [h for h in (data.get('hits') or []) if str(h.get('janCode') or '') == jan and h.get('condition', 'new') == 'new']
    if not hits:
        return dict(item, result='見つからず')
    best = hits[0]
    price = best.get('price')
    point = (best.get('point') or {}).get('amount')
    free = shipping_free(best)
    limit = item.get('limit')
    if limit and price is not None and price > limit:
        verdict = '仕入れ上限より高い'  # 送料を足す前から高いので、送料に関係なく高い
    elif not free:
        verdict = '送料を確かめる'
    elif limit and price is not None:
        verdict = '仕入れ上限より安い'
    else:
        verdict = '仕入れ上限が分からない'
    return dict(item, result=verdict, price=price, shippingFree=free,
                shop=(best.get('seller') or {}).get('name'), url=best.get('url'),
                pointRef=point, name=best.get('name'))


def main():
    if len(sys.argv) < 2:
        sys.exit('候補の JSON を指定してください')
    items = json.load(open(sys.argv[1], encoding='utf-8'))
    out = []
    for it in items:
        out.append(check(it))
        time.sleep(1.1)
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
