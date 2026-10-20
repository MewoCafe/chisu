# 尺素 · chisu

一张书案，笔墨纸砚，与故人共书。

在线访问：**https://mewocafe.github.io/chisu/**

## 功能

- 多角色编辑：名号、头像、回笔节奏、作息与性情，新角色默认名为「君」。
- 字笺、颜文字、图片和印章四库，支持分组、导入导出。
- 字卡在读取、新增、编辑和导入时自动去重，保留首张编号并合并所属分组。
- 尺牍往来、朱批与本地收藏。
- 文武线图标，支持 PWA 安装和离线使用。

数据保存在当前设备和浏览器中；切换域名或设备后，可通过「案边事」导出、导入卷宗迁移数据。

## 本地运行

无需安装依赖：

```sh
python3 -m http.server 4173 --directory dist
```

打开 http://localhost:4173/。

## 测试

使用 Node.js 22 或更新版本：

```sh
node --test tests/*.test.mjs
```

## 发布

`main` 分支更新后，GitHub Actions 运行测试并将 `dist/` 发布至 GitHub Pages。
