"""CI：静态站点有变更时，版号必须高于前一提交。"""
from pathlib import Path
import json,re,subprocess
root=Path(__file__).resolve().parents[1]
current=json.loads((root/'dist/release.json').read_text())['version']
changed=subprocess.check_output(['git','diff','--name-only','HEAD^','HEAD','--','dist'],cwd=root,text=True).strip()
if changed:
 try:previous=json.loads(subprocess.check_output(['git','show','HEAD^:dist/release.json'],cwd=root,text=True,stderr=subprocess.DEVNULL))['version']
 except subprocess.CalledProcessError:previous=re.search(r'chisu-v(\d+\.\d+\.\d+)',subprocess.check_output(['git','show','HEAD^:dist/sw.js'],cwd=root,text=True))[1]
 if tuple(map(int,current.split('.'))) <= tuple(map(int,previous.split('.'))):raise SystemExit('站点已改动，但版号未升级；请运行 scripts/bump-release.py 新版号')
print('发布版号核验通过：'+current)
