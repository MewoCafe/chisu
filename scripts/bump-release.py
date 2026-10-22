"""统一更新发布版号；不触碰人物、字卡或本机卷宗。"""
from pathlib import Path
import json,re,sys
version=sys.argv[1]
if not re.fullmatch(r'\d+\.\d+\.\d+',version):raise SystemExit('需填写 x.y.z 版号')
root=Path(__file__).resolve().parents[1]/'dist'
previous=json.loads((root/'release.json').read_text())['version'] if (root/'release.json').exists() else re.search(r'chisu-v(\d+\.\d+\.\d+)',(root/'sw.js').read_text())[1]
for name in ['index.html','sw.js','manifest.webmanifest','js/almanac.js','js/updater.js']:
 p=root/name;p.write_text(p.read_text().replace(previous,version))
(root/'release.json').write_text(json.dumps({'version':version},ensure_ascii=False)+'\n')
