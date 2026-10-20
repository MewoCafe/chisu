/* 尺素 · 逐字落墨：每个字一个 span，按标点停顿排出延时；多条回笔依次接续。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore;
  var busyUntil = 0;

  function schedule(text) {
    var t = 0, out = [];
    C.graphemes(text).forEach(function (g) {
      out.push({ g: g, at: t });
      var step = 46 + Math.random() * 24;
      if (/[。！？!?]/.test(g)) step += 200 + Math.random() * 100;
      else if (/[，、,；;：:]/.test(g)) step += 100 + Math.random() * 70;
      else if (g === '\n') step += 200;
      else if (/\s/.test(g)) step = 10;
      t += step;
    });
    return { glyphs: out, duration: t + 320 };
  }

  /* 给新消息排定起笔时刻（绝对时间），返回 {start, duration}。 */
  function reserve(text) {
    var s = schedule(text), now = Date.now();
    var start = Math.max(now, busyUntil + 160);
    busyUntil = start + s.duration;
    return { start: start, sched: s };
  }

  /* 渲染到元素：已过去的字直接显示，未写的字带剩余延时。 */
  function paint(el, text, plan, highlight) {
    var now = Date.now();
    var frag = document.createDocumentFragment();
    var offset = 0;
    plan.sched.glyphs.forEach(function (gl) {
      var node;
      var inQuan = highlight && offset >= highlight.start && offset < highlight.start + highlight.length;
      var delay = plan.start + gl.at - now;
      if (gl.g === '\n') node = document.createTextNode('\n');
      else if (delay <= -320) node = document.createTextNode(gl.g);
      else {
        node = document.createElement('span');
        node.className = 'g';
        node.textContent = gl.g;
        node.style.webkitAnimationDelay = node.style.animationDelay = Math.round(delay) + 'ms';
      }
      if (inQuan && node.nodeType === 3) { var q = document.createElement('span'); q.className = 'quan'; q.appendChild(node); node = q; }
      frag.appendChild(node);
      offset += gl.g.length;
    });
    el.appendChild(frag);
    return plan.start + plan.sched.duration - now;
  }

  function writing() { return Date.now() < busyUntil; }
  function finishAll() { busyUntil = 0; }

  W.ChisuInk = { reserve: reserve, paint: paint, writing: writing, finishAll: finishAll, busyUntil: function () { return busyUntil; } };
})(window);
