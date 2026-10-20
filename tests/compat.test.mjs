// 旧安卓 WebView（约 Chrome 61）兼容守则：脚本与样式里不得出现以下写法。
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
const dir = new URL('../dist/', import.meta.url);
const read = p => readFileSync(new URL(p, dir), 'utf8');
const js = readdirSync(new URL('js/', dir)).map(f => ['js/' + f, read('js/' + f)]).concat([['sw.js', read('sw.js')]]);
const css = readdirSync(new URL('css/', dir)).map(f => ['css/' + f, read('css/' + f)]);
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const JS_BANNED = [[/\?\./, '可选链 ?.'], [/\?\?/, '空值合并 ??'], [/\.at\(/, '.at()'], [/replaceChildren/, 'replaceChildren'],
  [/replaceAll/, 'replaceAll'], [/fromEntries/, 'Object.fromEntries'], [/\.flat(Map)?\(/, 'flat'], [/catch\s*\{/, '省略 catch 参数'],
  [/\.finally\(/, 'Promise.finally'], [/\\p\{/, '\\p{} 正则'], [/Intl\.Segmenter/, 'Intl.Segmenter'], [/\bimport\s|\bexport\s/, 'ES 模块'],
  [/structuredClone/, 'structuredClone'], [/\.showModal\(/, 'dialog.showModal'], [/\{\s*\.\.\./, '对象展开']];
const CSS_BANNED = [[/[^-]\binset\s*:/, 'inset'], [/display:\s*flex[^}]*[;{]\s*gap:|[;{]gap:/, 'flex gap'], [/aspect-ratio/, 'aspect-ratio'],
  [/:has\(/, ':has'], [/backdrop-filter/, 'backdrop-filter'], [/clamp\(|[^-]min\(|[^-]max\(/, 'clamp/min/max'], [/color-mix/, 'color-mix'], [/\d+dvh/, 'dvh']];

for (const [name, src] of js) test('兼容 ' + name, () => {
  const s = strip(src);
  for (const [re, label] of JS_BANNED) assert.ok(!re.test(s), name + ' 用了 ' + label);
});
for (const [name, src] of css) test('兼容 ' + name, () => {
  const s = strip(src);
  for (const [re, label] of CSS_BANNED) assert.ok(!re.test(s), name + ' 用了 ' + label);
});
test('全站不用紫色', () => {
  for (const [name, src] of css) assert.ok(!/#(574552|9b7982|8b7c88|635a64|d4ced2)/i.test(src), name);
});
