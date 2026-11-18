import urllib.request
import re
import json

url = 'https://weibo-trending-hot-history.vercel.app/hots/2024-08-29?sort=hot'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=10) as resp:
    html = resp.read().decode('utf-8')

m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
if m:
    data = json.loads(m.group(1))
    props = data.get('props', {}).get('pageProps', {})
    items = props.get('items', []) or props.get('data', []) or props.get('archive', {}).get('data', [])
    if not items:
        for k, v in props.items():
            if isinstance(v, list) and len(v) > 0:
                print(f"Key {k} has {len(v)} items")
                items = v
                break
            elif isinstance(v, dict):
                for subk, subv in v.items():
                    if isinstance(subv, list) and len(subv) > 0:
                        print(f"Key {k}.{subk} has {len(subv)} items")
                        items = subv
                        break

    print(f"Total items found: {len(items)}")
    relevant = []
    for it in items:
        s = json.dumps(it, ensure_ascii=False)
        if any(k in s for k in ['韩国', '换脸', 'Deepfake', '深度伪造', '韩女性']):
            relevant.append(it)
    print(f"Relevant items found: {len(relevant)}")
    for r in relevant:
        print(r)
