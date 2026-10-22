/* 尺素 · 案边事：自署、守灯、信使、观感、卷宗。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore, U = W.ChisuUtil, St = W.ChisuState, E = W.ChisuEngine, K;
  var $ = U.$, h = U.h;
  var sec = 'self';

  function sw(key, label, note, onChange) {
    var S = St.S.settings;
    var b = h('button', { class: 'seal-toggle', type: 'button', role: 'switch', 'aria-label': label });
    function paint() { b.setAttribute('aria-checked', S[key] ? 'true' : 'false'); b.textContent = S[key] ? '启' : '闭'; }
    b.addEventListener('click', function () {
      var next = !S[key];
      var p = onChange ? onChange(next) : null;
      Promise.resolve(p).then(function (ok) { if (ok === false) return; S[key] = next; St.save('settings'); paint(); applyLook(); });
    });
    paint();
    return h('div', { class: 'row' }, [h('span', { class: 'row-label' }, [label, note ? h('small', { html: note }) : null]), b]);
  }

  function render() {
    K = W.ChisuKeep;
    var S = St.S.settings, pane = U.clear($('#set-pane'));
    U.$$('#set-tabs .tab-v').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-sec') === sec); });
    if (sec === 'self') {
      pane.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '一' }), '自署']));
      var img = h('img', { src: St.selfAvatar(), alt: '' });
      pane.appendChild(h('div', { class: 'avatar-edit' }, [img, h('div', { class: 'acts' }, [
        h('button', { class: 'link ink', type: 'button', text: '换像', onclick: function () {
          U.pickFile('image/*').then(function (f) { if (!f[0]) return; return U.compressImage(f[0], { square: 256, quality: 0.86 }).then(function (src) { S.selfAvatar = src; St.save('settings'); img.src = src; }); }).catch(function (e) { U.toast(e.message); });
        } }),
        h('button', { class: 'link', type: 'button', text: '复为字印', onclick: function () { S.selfAvatar = ''; St.save('settings'); img.src = St.selfAvatar(); } })
      ])]));
      var name = h('input', { class: 'field', style: 'width:100%', maxlength: '16', value: S.selfName });
      name.addEventListener('change', function () { S.selfName = name.value.trim() || '我'; St.save('settings'); W.ChisuChat.resetCache(); if (!S.selfAvatar) img.src = St.selfAvatar(); U.toast('已署名。'); });
      pane.appendChild(h('div', { class: 'row name-row' }, [h('span', { class: 'row-label', text: '署名' }), name]));
      pane.appendChild(h('p', { class: 'ed-note', text: '人物的名号、作息与回笔节奏，在案头灯（人物）里各自设定。' }));
    }
    if (sec === 'lamp') {
      pane.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '二' }), '守灯', h('small', { text: '后台保活' })]));
      pane.appendChild(sw('wakeLock', '夜不熄灯', K.wakeSupported() ? '页面开着时屏幕常亮，回笔准时。' : '此器不支持常亮，可改用下一项。', function (on) { setTimeout(K.applyWake, 0); }));
      pane.appendChild(sw('silentAudio', '静音续航', '循环一段无声之音，切到后台也不停笔。<b>较耗电</b>，通知栏会显示「尺素 · 守灯中」。', function (on) { setTimeout(function () { K.applyAudio(true); }, 0); }));
      pane.appendChild(h('p', { class: 'ed-note', html: '<b>须知：</b>网页无法真正常驻后台。页面被系统关闭后不会回笔；重新展卷时，误了的回笔会补上。<br>安卓用户另可在系统设置里，为浏览器（或已安装的尺素）关闭「电池优化」，并允许后台活动。' }));
      pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['候笔中', h('small', { text: '所有人物尚待回笔的张数' })]), h('span', { class: 'range-line', text: (function (n) { return n ? C.hanNum(n) + ' 张' : '无'; })(St.S.pending.filter(function (j) { return j.kind === 'chat'; }).reduce(function (n, j) { return n + j.remaining; }, 0)) })]));
      pane.appendChild(h('div', { class: 'seal-row', style: 'justify-content:flex-start' }, h('button', { class: 'link red', type: 'button', text: '撤回一切待回', onclick: function () { E.cancel(); render(); U.toast('已撤回。'); } })));
    }
    if (sec === 'post') {
      pane.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '三' }), '信使', h('small', { text: '消息提醒' })]));
      pane.appendChild(sw('notify', '系统传书', K.notifySupported() ? '页面在后台时，回笔与来书以系统通知送达。' : '此器不支持系统通知。', function (on) {
        if (!on) return true;
        return K.askNotify().then(function (p) {
          if (p === 'granted') return true;
          U.toast(p === 'denied' ? '通知已被拒，请到浏览器设置中允许。' : '此器不支持系统通知。');
          return false;
        });
      }));
      pane.appendChild(sw('floatNote', '悬浮信笺', '不在共书页时，新回笔从屏幕右侧探出，可上下拖动，轻触即往。'));
      pane.appendChild(h('div', { class: 'seal-row', style: 'justify-content:flex-start' }, h('button', { class: 'link ink', type: 'button', text: '试遣一封', onclick: function () {
        var r = St.currentRole();
        if (S.notify) K.sendNotice(r.name + ' 回笔', '见字如晤。（此为试信）', 'chisu-test');
        E.emit('message', { roleId: r.id, msg: { kind: 'text', text: '见字如晤。（此为试信）' }, test: true });
        U.toast(S.notify ? '已遣，请看通知栏与右侧。' : '已遣，请看右侧。');
      } })));
      pane.appendChild(h('p', { class: 'ed-note', text: '浏览器所限：真正的「悬浮于其他应用之上」须原生应用方能做到。此处的悬浮信笺仅在尺素之内；离开尺素时由系统通知代劳。' }));
    }
    if (sec === 'look') {
      pane.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '四' }), '观感']));
      var style = h('select', { class: 'field', 'aria-label': '案式' }, [
        h('option', { value: 'ornate', text: '雅集 · 繁式' }),
        h('option', { value: 'simple', text: '素笺 · 简式' })
      ]);
      style.value = S.bookStyle === 'simple' ? 'simple' : 'ornate';
      style.addEventListener('change', function () {
        S.bookStyle = style.value === 'simple' ? 'simple' : 'ornate';
        S.bookStyleChosen = true;
        St.save('settings'); applyLook();
        W.ChisuChat.resetCache();
        U.toast(S.bookStyle === 'simple' ? '已换素笺案式。' : '已复雅集案式。');
      });
      pane.appendChild(h('div', { class: 'row desk-style-row' }, [h('span', { class: 'row-label' }, ['案式', h('small', { text: '雅集陈笔墨，素笺留清白。随心换案，往来如故。' })]), style]));
      pane.appendChild(sw('lite', '轻墨', '简去内页纸纹与光影，旧手机更顺；开场仍用繁式。初次按本机性能择定。'));
      pane.appendChild(sw('reduced', '少动', '开场与翻卷只留淡入淡出，逐字落墨即时显出。'));
      pane.appendChild(sw('tts', '传音诵读', '传音时以系统语音念出对方的话。'));
      pane.appendChild(h('div', { class: 'seal-row', style: 'justify-content:flex-start' }, h('button', { class: 'link ink', type: 'button', text: '重看开场', onclick: function () { W.ChisuApp.replayIntro(); } })));
    }
    if (sec === 'author') {
      pane.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '六' }), '作者', h('small', { text: '识得执笔人' })]));
      var bio = h('article', { class: 'author-note' });
      bio.appendChild(h('small', { class: 'author-kicker', text: '尺素 · 制作者' }));
      bio.appendChild(h('h2', { text: '小狗咖啡猫' }));
      bio.appendChild(h('p', { text: '案上尺素，为小狗咖啡猫所制。借一纸笔墨，安放几句闲话；若能与君换得片刻清欢，便不负此番折腾。' }));
      bio.appendChild(h('div', { class: 'author-links' }, [
        h('a', { href: 'https://xhslink.cn/o/8PBH9m493hk', target: '_blank', rel: 'noopener noreferrer', text: '赴小红书 · 寻制作者' }),
        h('a', { href: 'https://github.com/MewoCafe/chisu', target: '_blank', rel: 'noopener noreferrer', text: '往 GitHub · 阅尺素原稿' })
      ]));
      bio.appendChild(h('p', { class: 'author-aside', text: '小红书已有一千六百八十八位同好相伴。点上方链接，即可来访。' }));
      bio.appendChild(h('h3', { text: '内测小聚' }));
      bio.appendChild(h('p', { text: '尺素内测 QQ 群' }));
      bio.appendChild(h('div', { class: 'author-group-number', text: '1063822040' }));
      bio.appendChild(h('p', { text: '尺素尚在内测，先邀同好共试。群满二百人即锁群，届时再议正式上线；若未满员，亦可能暂不公开发行。去留未定，诸事以作者后续告知为准。' }));
      pane.appendChild(bio);
    }
    if (sec === 'file') {
      pane.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '五' }), '卷宗', h('small', { text: '备份与迁移' })]));
      pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['誊出全部', h('small', { text: '人物、墨藏、往来书信，一卷带走' })]), h('button', { class: 'link ink', type: 'button', text: '誊出', onclick: function () {
        var d = new Date();
        U.download('尺素卷宗-' + d.getFullYear() + (d.getMonth() + 1) + d.getDate() + '.json', St.exportAll());
      } })]));
      pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['收入卷宗', h('small', { text: '以卷宗覆盖此处；旧版字卡 JSON 则并入' })]), h('button', { class: 'link ink', type: 'button', text: '收入', onclick: function () {
        U.pickFile('.json,application/json').then(function (f) {
          if (!f[0]) return;
          return U.readText(f[0]).then(function (t) {
            U.confirmSheet('收入此卷？若为完整卷宗，此处现有内容将被替换。', '收入', function () {
              try { U.toast(St.importAll(t)); W.ChisuApp.refreshAll(); } catch (e) { U.toast(e.message || '此卷无法读取。'); }
            });
          });
        });
      } })]));
      var inst = h('div', { class: 'install-tip' });
      if (K.standalone()) inst.textContent = '尺素已留于桌前。';
      else if (K.canInstall()) inst.appendChild(h('button', { class: 'link ink', type: 'button', text: '留此案于桌前（安装）', onclick: function () { K.install().then(function (ok) { if (ok) U.toast('已留于桌前。'); render(); }); } }));
      else inst.innerHTML = '<b>留此案于桌前：</b>以浏览器菜单「添加到主屏幕 / 安装应用」，即可如应用般展卷，离线亦可用。';
      pane.appendChild(inst);
      pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['此卷 ' + W.ChisuUpdater.version, h('small', { text: '版号与离线卷同步核验' })]), h('button', { class: 'link ink', type: 'button', text: '检查新卷', onclick: function () { W.ChisuUpdater.check(true); } })]));
      pane.appendChild(h('p', { class: 'ed-note', text: '一切只存于本机此浏览器之中。清理浏览器数据前，请先誊出卷宗。' }));
    }
  }

  function applyLook() {
    var S = St.S.settings, b = document.body;
    b.classList.toggle('book-simple', S.bookStyle === 'simple');
    W.ChisuDesk.applyStyle();
    b.classList.toggle('lite', !!S.lite);
    b.classList.toggle('reduced', !!S.reduced);
  }

  function init() {
    U.$$('#set-tabs .tab-v').forEach(function (b) { b.addEventListener('click', function () { sec = b.getAttribute('data-sec'); render(); }); });
    applyLook();
  }

  W.ChisuSettings = { init: init, render: render, enter: render, applyLook: applyLook };
})(window);
