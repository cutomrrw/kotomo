import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ═══════════════════════════════════════════════════════════
//  ことも（词崽）· 第 0 步验证版
//  电子日语单词本 · 自建词库 + 科学重复(SRS) + 消除式复习 + 傲娇猫
//  宪法：用户获得实打实的学习成果，不是玩乐，一种成人的高效学习法。
//  本版严格遵循 PRD v1.0 + 开发施工文档·第0步
//  · 纯本地(window.storage)、零注册、离线可用、AI真/模拟一键切换
// ═══════════════════════════════════════════════════════════

const C = {
  cream: "#fdf6ec", paper: "#fffdf8", honey: "#e8a85c", honeyDk: "#c98a3e",
  matcha: "#8fb878", matchaDk: "#6f9a59", wood: "#a9805a", ink: "#5a4634",
  inkSoft: "#9b8674", blush: "#e89b86", sky: "#7bb4c4", grape: "#c79bd4",
};
const POS = [
  { key: "noun", label: "名词", emoji: "🍙", color: "#e8a85c" },
  { key: "verb", label: "动词", emoji: "🏃", color: "#8fb878" },
  { key: "adj", label: "形容词", emoji: "🌈", color: "#7bb4c4" },
  { key: "phrase", label: "短语·寒暄", emoji: "💬", color: "#c79bd4" },
  { key: "other", label: "其他", emoji: "📎", color: "#b0a08c" },
];
const posInfo = (k) => POS.find((p) => p.key === k) || POS[4];
// 外来词内嵌显示：トイレ（toilet）
const termWithLoan = (w) => (w && w.loan && w.loan.word) ? (w.term + "（" + w.loan.word + "）") : (w ? w.term : "");
const uid = () => Math.random().toString(36).slice(2, 9);
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const DAY = 864e5;
const todayStr = () => new Date().toDateString();
const now = () => Date.now();

// 兴趣场景
const INTERESTS = [
  { id: "life", emoji: "🍜", label: "吃喝玩乐" },
  { id: "beauty", emoji: "💄", label: "美" },
  { id: "medical", emoji: "🏥", label: "医院医疗" },
  { id: "affairs", emoji: "🏛️", label: "办事" },
  { id: "work", emoji: "💼", label: "工作" },
  { id: "acg", emoji: "🎮", label: "二次元" },
];

// ── 清脆利落的音效（解压感）──────────────────────────────
const Sfx = (() => {
  let ctx = null;
  const ensure = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (ctx && ctx.state === "suspended") ctx.resume(); return ctx; };
  const tone = (f, t0, dur, type = "sine", vol = 0.14) => {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, c.currentTime + t0);
    g.gain.setValueAtTime(0, c.currentTime + t0);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.02);
  };
  return {
    tap: () => tone(880, 0, 0.05, "sine", 0.1),
    pop: () => { tone(1046, 0, 0.05, "triangle", 0.12); tone(1568, 0.03, 0.05, "triangle", 0.08); },
    match: () => { tone(1046, 0, 0.06, "sine", 0.14); tone(1318, 0.05, 0.08, "sine", 0.12); },
    correct: () => { tone(784, 0, 0.07, "sine", 0.14); tone(1046, 0.06, 0.07, "sine", 0.14); tone(1318, 0.12, 0.12, "sine", 0.13); },
    wrong: () => { tone(330, 0, 0.1, "triangle", 0.09); tone(247, 0.07, 0.12, "triangle", 0.09); },
    win: () => { [659, 784, 988, 1318].forEach((f, i) => tone(f, i * 0.09, 0.2, "sine", 0.13)); },
    coin: () => { tone(1318, 0, 0.05, "square", 0.07); tone(1760, 0.04, 0.08, "square", 0.06); },
    happy: () => { tone(880, 0, 0.1, "sine", 0.1); tone(1100, 0.08, 0.14, "sine", 0.1); },
    listen: () => tone(988, 0, 0.08, "sine", 0.08),
  };
})();
const vibrate = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch {} };
const speakJa = (t) => { try { const u = new SpeechSynthesisUtterance(t); u.lang = "ja-JP"; u.rate = 0.85; speechSynthesis.speak(u); } catch {} };

// ── 120 词初始库（六场景 × 20）──────────────────────────
const SEED_BANK = {
  life: [
    ["ごはん","gohan","米饭/饭","noun",1],["みず","mizu","水","noun",1],["たべる","taberu","吃","verb",1],["のむ","nomu","喝","verb",1],
    ["おいしい","oishii","好吃的","adj",1],["メニュー","menyuu","菜单","noun",1,["en","menu"]],["ビール","biiru","啤酒","noun",1,["nl","bier"]],
    ["いただきます","itadakimasu","我开动了","phrase",1],["ごちそうさま","gochisousama","吃饱了/谢款待","phrase",1],["おかわり","okawari","再来一份","noun",0],
    ["やすい","yasui","便宜的","adj",1],["たかい","takai","贵的/高的","adj",1],["カフェ","kafe","咖啡馆","noun",1,["fr","café"]],
    ["コーヒー","koohii","咖啡","noun",1,["en","coffee"]],["おかね","okane","钱","noun",1],["かいけい","kaikei","结账","noun",1],
    ["よやく","yoyaku","预约","noun",1],["せき","seki","座位","noun",1],["おすすめ","osusume","推荐","noun",1],["たのしい","tanoshii","快乐的","adj",1],
  ],
  beauty: [
    ["かわいい","kawaii","可爱的","adj",1],["きれい","kirei","漂亮/干净","adj",1],["けしょう","keshou","化妆","noun",1],["かみ","kami","头发","noun",1],
    ["ファンデーション","fandeeshon","粉底","noun",0,["en","foundation"]],["くちべに","kuchibeni","口红","noun",1],["はだ","hada","皮肤","noun",1],
    ["びよういん","biyouin","美容院","noun",1],["まゆげ","mayuge","眉毛","noun",0],["まつげ","matsuge","睫毛","noun",0],
    ["スキンケア","sukinkea","护肤","noun",1,["en","skincare"]],["かみがた","kamigata","发型","noun",1],["きる","kiru","剪/穿","verb",1],
    ["にあう","niau","适合/相称","verb",1],["おしゃれ","oshare","时髦","adj",1],["クリーム","kuriimu","面霜","noun",1,["en","cream"]],
    ["びはく","bihaku","美白","noun",0],["ダイエット","daietto","减肥","noun",1,["en","diet"]],["かがみ","kagami","镜子","noun",1],["ネイル","neiru","美甲","noun",0,["en","nail"]],
  ],
  medical: [
    ["びょういん","byouin","医院","noun",1],["いたい","itai","疼","adj",1],["くすり","kusuri","药","noun",1],["ねつ","netsu","发烧","noun",1],
    ["ほけんしょう","hokenshou","保险证","noun",1],["かぜ","kaze","感冒","noun",1],["せき","seki","咳嗽","noun",1],["びょうき","byouki","生病","noun",1],
    ["いしゃ","isha","医生","noun",1],["かんごし","kangoshi","护士","noun",0],["しょほうせん","shohousen","处方","noun",0],["やっきょく","yakkyoku","药店","noun",1],
    ["ちゅうしゃ","chuusha","打针","noun",0],["あたまがいたい","atama ga itai","头疼","phrase",1],["はきけ","hakike","恶心","noun",0],
    ["アレルギー","arerugii","过敏","noun",1,["de","Allergie"]],["けが","kega","受伤","noun",1],["きゅうきゅうしゃ","kyuukyuusha","救护车","noun",0],
    ["よやく","yoyaku","预约","noun",1],["だいじょうぶ","daijoubu","没事/没关系","adj",1],
  ],
  affairs: [
    ["やくしょ","yakusho","区役所/政府机构","noun",1],["てつづき","tetsuzuki","手续","noun",1],["じゅうしょ","juusho","住址","noun",1],["ぎんこう","ginkou","银行","noun",1],
    ["しょるい","shorui","文件/资料","noun",1],["はんこ","hanko","印章","noun",1],["こうざ","kouza","账户","noun",0],["みぶんしょう","mibunshou","身份证件","noun",1],
    ["きにゅう","kinyuu","填写","noun",1],["まどぐち","madoguchi","窗口","noun",1],["ざいりゅうカード","zairyuu kaado","在留卡","noun",1,["en","card"]],
    ["てんにゅう","tennyuu","迁入","noun",0],["てんしゅつ","tenshutsu","迁出","noun",0],["しょうめいしょ","shoumeisho","证明书","noun",1],["きょか","kyoka","许可","noun",0],
    ["しんせい","shinsei","申请","noun",1],["ひつよう","hitsuyou","必要","adj",1],["ていしゅつ","teishutsu","提交","noun",1],["よやく","yoyaku","预约","noun",1],["なまえ","namae","名字","noun",1],
  ],
  work: [
    ["しごと","shigoto","工作","noun",1],["かいぎ","kaigi","会议","noun",1],["メール","meeru","邮件","noun",1,["en","mail"]],["おつかれさま","otsukaresama","辛苦了","phrase",1],
    ["きゅうりょう","kyuuryou","工资","noun",1],["ざんぎょう","zangyou","加班","noun",1],["やすみ","yasumi","休息/假","noun",1],["どうりょう","douryou","同事","noun",1],
    ["じょうし","joushi","上司","noun",1],["かくにん","kakunin","确认","noun",1],["れんらく","renraku","联系","noun",1],["しめきり","shimekiri","截止","noun",1],
    ["パソコン","pasokon","电脑","noun",1,["en","personal computer"]],["でんわ","denwa","电话","noun",1],["しりょう","shiryou","资料","noun",1],
    ["ミーティング","miitingu","会议","noun",1,["en","meeting"]],["ほうこく","houkoku","报告","noun",1],["そうだん","soudan","商量","noun",1],
    ["ありがとうございます","arigatou gozaimasu","谢谢(敬)","phrase",1],["よろしくおねがいします","yoroshiku onegaishimasu","请多关照","phrase",1],
  ],
  acg: [
    ["アニメ","anime","动画","noun",1,["en","animation"]],["まんが","manga","漫画","noun",1],["すき","suki","喜欢","adj",1],["キャラ","kyara","角色","noun",1,["en","character"]],
    ["こえ","koe","声音","noun",1],["せいゆう","seiyuu","声优","noun",1],["かみ","kami","神/头发","noun",1],["かわいい","kawaii","可爱的","adj",1],
    ["かっこいい","kakkoii","帅气的","adj",1],["げーむ","geemu","游戏","noun",1,["en","game"]],["はなし","hanashi","故事/话","noun",1],["みる","miru","看","verb",1],
    ["すごい","sugoi","厉害/好棒","adj",1],["イベント","ibento","活动","noun",1,["en","event"]],["グッズ","guzzu","周边","noun",1,["en","goods"]],
    ["おすすめ","osusume","推荐","noun",1],["はまる","hamaru","入坑/沉迷","verb",1],["なかま","nakama","伙伴","noun",1],["せかい","sekai","世界","noun",1],["がんばる","ganbaru","加油","verb",1],
  ],
};
function buildSeedWords(interestIds) {
  const words = [];
  interestIds.forEach((id) => {
    (SEED_BANK[id] || []).forEach((r) => {
      words.push({ id: uid(), type: "word", term: r[0], reading: r[1], meaning: r[2], pos: r[3],
        freq: !!r[4], loan: r[5] ? { from: r[5][0], word: r[5][1] } : null,
        mastered: false, source: "", expanded: null, isSeed: true,
        seen: 0, wrong: 0, srs: { level: 0, dueAt: now(), lastReviewedAt: 0 } });
    });
  });
  return words;
}
const LOAN_SRC = { en: "英语", pt: "葡萄牙语", fr: "法语", de: "德语", nl: "荷兰语", it: "意大利语", zh: "中文" };

// ── 存储（适配层）──────────────────────────────────────
// window.storage 是原型/沙箱宿主注入的 KV，真机浏览器没有它（真机恰恰支持 localStorage）。
// 三级降级：window.storage → localStorage → 内存，保证沙箱与真机都能存住数据。
const SKEY = "kotomo:v3";
const Store = (() => {
  const hasWS = (() => { try { return !!(typeof window !== "undefined" && window.storage && typeof window.storage.get === "function"); } catch { return false; } })();
  const hasLS = (() => { try { localStorage.setItem("__k_probe", "1"); localStorage.removeItem("__k_probe"); return true; } catch { return false; } })();
  const mem = {};
  return {
    kind: hasWS ? "window.storage" : hasLS ? "localStorage" : "memory",
    async get(k) {
      if (hasWS) { const r = await window.storage.get(k); return r ? r.value : null; }
      if (hasLS) return localStorage.getItem(k);
      return k in mem ? mem[k] : null;
    },
    async set(k, v) {
      if (hasWS) return window.storage.set(k, v);
      if (hasLS) return localStorage.setItem(k, v);
      mem[k] = v;
    },
  };
})();
async function loadState() { try { const v = await Store.get(SKEY); return v ? JSON.parse(v) : null; } catch (e) { console.error("[kotomo] loadState 失败", e); return null; } }
// 返回 true/false：失败不再静默吞，交给上层提示用户（避免数据无声丢失）
async function saveState(s) { try { await Store.set(SKEY, JSON.stringify(s)); return true; } catch (e) { console.error("[kotomo] saveState 失败", e); return false; } }

// ── AI 调用（OpenAI 与 Anthropic 都支持，按密钥前缀自动识别）─────────────
const OPENAI_MODEL = "gpt-5.4";               // OpenAI：查词/读音准确度优先（学习类应用错读音=学错，比省钱重要）；想更省可降 gpt-5.4-mini，想更强可升 gpt-5.5
const ANTHROPIC_MODEL = "claude-haiku-4-5";   // Anthropic：又快又便宜；想更准可换 claude-sonnet-4-6 / claude-opus-4-8
const AKEY = "kotomo:aikey";                  // API 密钥单独存（不进词库状态、不随数据导出）
// 判家：sk-ant- 开头 = Anthropic(Claude)；其余 sk-（含 sk-proj-/sk-svcacct-/sk-admin-）当作 OpenAI
const providerOf = (key) => ((key || "").trim().startsWith("sk-ant-") ? "anthropic" : "openai");
async function getApiKey() { try { return (await Store.get(AKEY)) || ""; } catch { return ""; } }
async function saveApiKey(v) { try { await Store.set(AKEY, (v || "").trim()); return true; } catch { return false; } }

async function callAI(system, userMsg) {
  const key = (await getApiKey()).trim();
  if (!key) throw new Error("未配置 API 密钥");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000); // 30 秒超时，避免请求挂死冻住页面
  try {
    if (providerOf(key) === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true", // 浏览器直连（个人自用；密钥只在你本机）
        },
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1000, system, messages: [{ role: "user", content: userMsg }] }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error("AI 请求失败 " + res.status);
      const data = await res.json();
      return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    }
    // OpenAI：浏览器可直连，无需特殊头（密钥错误时聊天端点会被当成 CORS 报错，故在保存时用 validateKey 先校验）
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_completion_tokens: 4096,
        messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error("AI 请求失败 " + res.status);
    const data = await res.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error("AI 返回为空");
    return text;
  } finally { clearTimeout(timer); }
}

// 保存密钥时校验：用 GET /v1/models —— 即使密钥错误也带 CORS 头、能拿到清晰的 401，
// 避免聊天端点遇到错误密钥时只抛模糊的 CORS 错误，让用户摸不着头脑。
async function validateKey(key) {
  key = (key || "").trim();
  if (!key) return { ok: false, msg: "请先粘贴密钥" };
  const prov = providerOf(key);
  const label = prov === "anthropic" ? "Claude" : "OpenAI";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = prov === "anthropic"
      ? await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, signal: ctrl.signal })
      : await fetch("https://api.openai.com/v1/models", { headers: { "Authorization": "Bearer " + key }, signal: ctrl.signal });
    if (res.ok) return { ok: true, provider: prov, msg: "✓ " + label + " 密钥有效" };
    if (res.status === 401 || res.status === 403) return { ok: false, provider: prov, msg: "✗ " + label + " 密钥无效，请检查" };
    return { ok: true, provider: prov, msg: "已保存（" + label + "，服务返回 " + res.status + "）" };
  } catch (e) {
    return { ok: null, provider: prov, msg: "已保存（" + label + "），但没连上网、暂时无法验证" };
  } finally { clearTimeout(timer); }
}
const stripFence = (t) => t.replace(/```json|```/g, "").trim();

// ── 离线词典 kuromoji（跑在 Web Worker：十几MB词典的下载与构建都在后台线程，绝不卡住界面）──
let _kuroWorker = null, _kuroReady = null, _kuroReqId = 0;
const _kuroReqs = {};
const KURO_WORKER_SRC = [
  'importScripts("https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js");',
  'var tk=null;',
  'self.onmessage=function(e){var d=e.data;',
  ' if(d.type==="init"){',
  '  kuromoji.builder({dicPath:"https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/"}).build(function(err,t){',
  '   if(err){self.postMessage({type:"ready",ok:false});return;}',
  '   tk=t;self.postMessage({type:"ready",ok:true});});',
  ' }else if(d.type==="tok"){',
  '  if(!tk){self.postMessage({type:"res",id:d.id,tokens:null});return;}',
  '  var toks=tk.tokenize(d.text).map(function(x){return {reading:x.reading,surface_form:x.surface_form,pos:x.pos};});',
  '  self.postMessage({type:"res",id:d.id,tokens:toks});}',
  '};'
].join("\n");
function loadKuromoji() {
  if (_kuroReady) return _kuroReady;
  _kuroReady = new Promise((resolve, reject) => {
    try {
      if (typeof Worker === "undefined") { _kuroReady = null; reject(new Error("不支持 Worker")); return; }
      _kuroWorker = new Worker(URL.createObjectURL(new Blob([KURO_WORKER_SRC], { type: "application/javascript" })));
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; _kuroReady = null; reject(new Error("离线词典加载超时")); } }, 40000);
      _kuroWorker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "ready") { if (settled) return; settled = true; clearTimeout(timer); if (m.ok) resolve(true); else { _kuroReady = null; reject(new Error("词典构建失败")); } }
        else if (m.type === "res") { const cb = _kuroReqs[m.id]; if (cb) { delete _kuroReqs[m.id]; cb(m.tokens); } }
      };
      _kuroWorker.onerror = (err) => { if (!settled) { settled = true; clearTimeout(timer); _kuroReady = null; reject(err); } };
      _kuroWorker.postMessage({ type: "init" });
    } catch (e) { _kuroReady = null; reject(e); }
  });
  return _kuroReady;
}
function kuroTokenize(text) {
  return new Promise((resolve) => {
    const id = ++_kuroReqId; _kuroReqs[id] = resolve;
    try { _kuroWorker.postMessage({ type: "tok", id, text }); } catch { delete _kuroReqs[id]; resolve(null); return; }
    setTimeout(() => { if (_kuroReqs[id]) { delete _kuroReqs[id]; resolve(null); } }, 8000);
  });
}
const kataToHira = (s) => (s || "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const KURO_POS = { "名詞": "noun", "動詞": "verb", "形容詞": "adj", "感動詞": "phrase" };
async function localAutoFill(term) {
  const t = (term || "").trim();
  try {
    await loadKuromoji();
    const toks = await kuroTokenize(t);
    if (toks && toks.length) {
      const reading = kataToHira(toks.map((x) => (x.reading && x.reading !== "*") ? x.reading : x.surface_form).join(""));
      const pos = toks.length === 1 ? (KURO_POS[toks[0].pos] || "other") : "phrase";
      return { term: t, reading, meaning: "", pos, freq: false };
    }
  } catch (e) { console.warn("[kotomo] kuromoji 离线注音不可用", e); }
  return { term: t, reading: "", meaning: "", pos: "other", freq: false };
}
const MOCK_DICT = {
  "猫":["ねこ","neko","noun"],"狗":["いぬ","inu","noun"],"水":["みず","mizu","noun"],"吃":["たべる","taberu","verb"],
  "喝":["のむ","nomu","verb"],"可爱":["かわいい","kawaii","adj"],"谢谢":["ありがとう","arigatou","phrase"],"你好":["こんにちは","konnichiwa","phrase"],
  "书":["ほん","hon","noun"],"学校":["がっこう","gakkou","noun"],"看":["みる","miru","verb"],"买":["かう","kau","verb"],
};
function mockAutoFill(term) {
  const hit = MOCK_DICT[term];
  if (hit) return { term: hit[0], reading: hit[1], meaning: term, pos: hit[2], freq: true };
  return { term, reading: "", meaning: "（待补充）", pos: "other", freq: false };
}
function mockExpand(w) {
  return {
    examples: [
      { jp: w.term + "が すきです。", zh: "我喜欢" + (w.meaning || w.term) + "。" },
      { jp: "これは " + w.term + " です。", zh: "这是" + (w.meaning || w.term) + "。" },
    ],
    synonyms: [{ term: "（近义示例）", reading: "", meaning: "模拟版示例，接入真AI后更准" }],
    grammar: [{ point: "～が好きです", note: "表示喜欢某物，AI真版会给更贴合的语法点" }],
  };
}
// 关联词推荐（Pingo式：一次给一批，批量勾选添加）模拟版
const RELATED_BANK = {
  noun: [["かいもの","kaimono","购物","noun"],["おみせ","omise","店铺","noun"],["ねだん","nedan","价格","noun"],["じかん","jikan","时间","noun"],["ばしょ","basho","地点","noun"],["ひと","hito","人","noun"],["ともだち","tomodachi","朋友","noun"],["かぞく","kazoku","家人","noun"]],
  verb: [["いく","iku","去","verb"],["くる","kuru","来","verb"],["する","suru","做","verb"],["みる","miru","看","verb"],["きく","kiku","听/问","verb"],["はなす","hanasu","说","verb"],["かう","kau","买","verb"],["まつ","matsu","等","verb"]],
  adj: [["おおきい","ookii","大的","adj"],["ちいさい","chiisai","小的","adj"],["あたらしい","atarashii","新的","adj"],["たかい","takai","贵/高","adj"],["やすい","yasui","便宜","adj"],["はやい","hayai","快的","adj"],["おそい","osoi","慢的","adj"],["いい","ii","好的","adj"]],
  phrase: [["こんにちは","konnichiwa","你好","phrase"],["すみません","sumimasen","不好意思","phrase"],["おねがいします","onegaishimasu","拜托了","phrase"],["だいじょうぶ","daijoubu","没关系","phrase"],["わかりました","wakarimashita","明白了","phrase"],["ちょっとまって","chotto matte","稍等","phrase"]],
};
function mockRelated(w) {
  const base = RELATED_BANK[w.pos] || RELATED_BANK.noun;
  const all = [...base, ...RELATED_BANK.verb.slice(0, 4), ...RELATED_BANK.adj.slice(0, 4), ...RELATED_BANK.phrase.slice(0, 3)];
  return all.map((r) => ({ term: r[0], reading: r[1], meaning: r[2], pos: r[3], freq: false })).slice(0, 18);
}

// ── SRS 引擎 ──────────────────────────────────────────
const SRS_INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60]; // 天，按 level 取
const MASTER_LEVEL = 4; // level≥4 视为"完全掌握"
function nextDue(level) { const days = SRS_INTERVALS[Math.min(level, SRS_INTERVALS.length - 1)]; return now() + days * DAY; }
function applyAnswer(w, correct) {
  const srs = { ...(w.srs || { level: 0, dueAt: now(), lastReviewedAt: 0 }) };
  if (correct) srs.level = Math.min(srs.level + 1, SRS_INTERVALS.length - 1);
  else srs.level = Math.max(srs.level - 1, 0);
  srs.lastReviewedAt = now();
  srs.dueAt = nextDue(srs.level);
  return { ...w, srs, seen: (w.seen || 0) + 1, wrong: (w.wrong || 0) + (correct ? 0 : 1) };
}
// 掌握计数：用户手动标 mastered 也算掌握；或 SRS 到阈值
const countMastered = (words) => words.filter((w) => w.mastered || (w.srs && w.srs.level >= MASTER_LEVEL)).length;
const _due = (words) => { const t = now(); return words.filter((w) => !w.mastered && w.srs && w.srs.dueAt <= t); };
function dueWords(words, mode) {
  let due = _due(words).sort((a, b) => (b.wrong || 0) - (a.wrong || 0) || (a.srs.level - b.srs.level));
  if (mode === "low") return due.slice(0, 5);
  if (mode === "super") return due;
  return due.slice(0, 20);
}
const wrongWords = (words) => words.filter((w) => ((w.wrong || 0) > 0 || w.hesitant) && !w.mastered);
// 复习选词：到期词优先（犹豫/错多/level低/到期久 在前），不够就用其余未掌握词凑够一组，
// 所以"开始复习"永远不止 1 个、且没到期也能"再复习/巩固"（无限复习）；最后打乱呈现顺序。
function reviewPool(words, mode, wrongOnly) {
  const t = now();
  const reviewable = words.filter((w) => !w.mastered);
  const score = (w) => (w.hesitant ? 100 : 0) + (w.wrong || 0) * 10 + (MASTER_LEVEL - ((w.srs && w.srs.level) || 0)) + ((w.srs && w.srs.dueAt <= t) ? 2 : 0);
  const byPrio = (arr) => [...arr].sort((a, b) => score(b) - score(a));
  if (wrongOnly) return shuffle(byPrio(reviewable.filter((w) => (w.wrong || 0) > 0 || w.hesitant)).slice(0, mode === "low" ? 5 : 40));
  const cap = mode === "low" ? 5 : mode === "super" ? reviewable.length : 20;
  let sel = byPrio(_due(words)).slice(0, cap);
  const target = Math.min(reviewable.length, mode === "low" ? 5 : 8);
  if (sel.length < target) {
    const ids = new Set(sel.map((w) => w.id));
    sel = sel.concat(byPrio(reviewable.filter((w) => !ids.has(w.id))).slice(0, target - sel.length));
  }
  return shuffle(sel);
}

// ── 宠物 ──────────────────────────────────────────────
const SEGMENTS = [
  { min: 0, title: "日语萌新", emoji: "🥚" },
  { min: 10, title: "会点皮毛", emoji: "🐣" },
  { min: 30, title: "敢开口了", emoji: "🐾" },
  { min: 60, title: "渐入佳境", emoji: "🌿" },
  { min: 100, title: "生活无碍", emoji: "🌸" },
  { min: 200, title: "如鱼得水", emoji: "🎐" },
  { min: 400, title: "本地达人", emoji: "🏯" },
];
const segOf = (n) => { let s = SEGMENTS[0]; for (const x of SEGMENTS) if (n >= x.min) s = x; return s; };
const nextSeg = (n) => SEGMENTS.find((x) => x.min > n) || null;
const catSizeOf = (n) => Math.min(1 + n / 120, 2.0); // 体型随掌握词数变大
// 窝装饰按掌握词数自动解锁
const DECOR_UNLOCK = [{ at: 20, id: "cushion" }, { at: 50, id: "plant" }, { at: 100, id: "lamp" }];
function decorFor(n) { return DECOR_UNLOCK.filter((d) => n >= d.at).map((d) => d.id); }

// 傲娇盲盒回归消息（虐而不压，过得好+留痕迹+好奇）
const NAUGHTY = [
  "你没来，我偷偷吃了好几根猫条，嘻嘻。",
  "我趁你不在睡了你的床，超舒服的。",
  "我出门浪了一圈才回来，外面真好玩。",
  "我抓了只大耗子放进你被窝里，谢礼，收好。",
  "我在你枕头上拉了个屎……当作想你的纪念吧。",
  "你的拖鞋被我藏起来了，找不到别怪我哦。",
  "我把你桌上的笔全扒到地上了，玩得可开心了。",
];
function moodState(pet) {
  const since = now() - (pet.lastSeenAt || now());
  const days = since / DAY;
  let happy = pet.mood ?? 75;
  let face = "(=・ω・=)", word = "悠闲发呆";
  if (days >= 1.5) { face = "(=｀ω´=)"; word = "想你了…"; }      // 蔫蔫想你（不惩罚）
  else if (happy >= 80) { face = "(=^‥^=)♪"; word = "心满意足"; }
  else if (happy >= 50) { face = "(=・ω・=)"; word = "悠闲发呆"; }
  return { face, word, happy, awayDays: days };
}

// ── App 根 ─────────────────────────────────────────────
function freshState() {
  return {
    onboarded: false, interests: [],
    words: [],
    trash: [],
    pet: { mood: 75, lastSeenAt: now() },
    streak: { totalDays: 0, monthDays: 0, lastStudyDay: null, calendar: {} },
    settings: { sound: true, aiReal: false, energyMode: "normal" },
  };
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [st, setSt] = useState(freshState());
  const [view, setView] = useState("home");
  const [reviewWrongOnly, setReviewWrongOnly] = useState(false);
  const [tick, setTick] = useState(0);
  const [naughty, setNaughty] = useState(null); // 回归盲盒消息
  const [saveErr, setSaveErr] = useState(false); // 本地保存失败提示

  // 载入
  useEffect(() => { (async () => {
    const s = await loadState();
    if (s) {
      const merged = { ...freshState(), ...s, settings: { ...freshState().settings, ...(s.settings || {}) }, streak: { ...freshState().streak, ...(s.streak || {}) }, pet: { ...freshState().pet, ...(s.pet || {}) }, trash: ((s.trash) || []).filter((t) => t && t.deletedAt && (now() - t.deletedAt < 7 * DAY)) };
      // 跨天重置月历日的能量标记不需要；只重置 energyMode 回 normal（每天重新选）
      setSt(merged);
      // 计算回归盲盒
      if (merged.onboarded && merged.pet && merged.pet.lastSeenAt) {
        const away = (now() - merged.pet.lastSeenAt) / DAY;
        if (away >= 1.5) setNaughty(NAUGHTY[Math.floor(Math.random() * NAUGHTY.length)]);
      }
    }
    setLoaded(true);
  })(); }, []);
  // 保存
  useEffect(() => { if (loaded) saveState(st).then((ok) => setSaveErr(!ok)); }, [st, loaded]);
  // 计时器（刷新心情等）
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  // 进入即更新 lastSeenAt（轻量，标记"今天来过"，但延迟以便先算盲盒）
  useEffect(() => { if (loaded && st.onboarded) { const t = setTimeout(() => setSt((s) => ({ ...s, pet: { ...s.pet, lastSeenAt: now(), mood: Math.min(100, (s.pet.mood ?? 75)) } })), 1500); return () => clearTimeout(t); } }, [loaded, st.onboarded]);

  const play = useCallback((n) => { if (st.settings.sound && Sfx[n]) Sfx[n](); }, [st.settings.sound]);
  const mastered = useMemo(() => countMastered(st.words), [st.words]);
  const seg = segOf(mastered);
  const decor = decorFor(mastered);
  const mood = useMemo(() => moodState(st.pet), [st.pet, tick]);

  // —— 操作 ——
  const patch = (fn) => setSt((s) => fn(s));
  const setSetting = (k, v) => patch((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));

  const addWords = useCallback((rows) => {
    patch((s) => ({ ...s, words: [...s.words, ...rows.filter((r) => r.term && r.term.trim()).map((r) => ({
      id: r.id || uid(), type: r.type || "word", term: r.term.trim(), reading: (r.reading || "").trim(), meaning: (r.meaning || "").trim(),
      pos: r.pos || "other", freq: !!r.freq, loan: r.loan || null, mastered: false, source: (r.source || "").trim(),
      expanded: r.expanded || null, isSeed: false, seen: 0, wrong: 0, srs: { level: 0, dueAt: now(), lastReviewedAt: 0 },
    }))] }));
  }, []);
  const updateWord = useCallback((id, fn) => patch((s) => ({ ...s, words: s.words.map((w) => w.id === id ? fn(w) : w) })), []);
  // 删除 = 移入"最近删除"回收站（保留 7 天可恢复），不直接丢弃（PRD：防误删心血）
  const delWord = useCallback((id) => patch((s) => { const w = s.words.find((x) => x.id === id); return { ...s, words: s.words.filter((x) => x.id !== id), trash: w ? [{ word: w, deletedAt: now() }, ...(s.trash || [])].slice(0, 100) : (s.trash || []) }; }), []);
  const restoreWord = useCallback((id) => patch((s) => { const e = (s.trash || []).find((t) => t.word.id === id); return e ? { ...s, words: [...s.words, e.word], trash: (s.trash || []).filter((t) => t.word.id !== id) } : s; }), []);
  // 点猫"心情+1"：必须走 patch 才能持久化+重渲染（曾经就地 mutation 导致不生效）
  const petLove = useCallback(() => patch((s) => ({ ...s, pet: { ...s.pet, mood: Math.min(100, (s.pet.mood ?? 75) + 1) } })), []);

  // 自己添加的词数（非种子），用于将来的注册触发（第0步仅展示）
  const ownWordCount = useMemo(() => st.words.filter((w) => !w.isSeed).length, [st.words]);

  // 完成一轮复习：写回 SRS、月历、连胜、心情
  const finishReview = useCallback((results, hesitantIds, energyUsed) => {
    patch((s) => {
      const map = {}; results.forEach((r) => { map[r.id] = r.correct; });
      const hes = new Set(hesitantIds || []);
      const words = s.words.map((w) => {
        if (map[w.id] === undefined) return w;
        let nw = applyAnswer(w, map[w.id]);
        if (hes.has(w.id)) nw = { ...nw, hesitant: true };           // 长按标的"犹豫词"
        else if (map[w.id] === true && w.hesitant) nw = { ...nw, hesitant: false }; // 这次确信答对 → 摘掉犹豫
        return nw;
      });
      // 月历
      const today = todayStr();
      const level = energyUsed === "low" ? "light" : energyUsed === "super" ? "super" : "full";
      const calendar = { ...s.streak.calendar, [today]: level };
      // 连胜（累计，不清零）
      let { totalDays, monthDays, lastStudyDay } = s.streak;
      if (lastStudyDay !== today) {
        totalDays += 1;
        const d = new Date(); const sameMonth = lastStudyDay && new Date(lastStudyDay).getMonth() === d.getMonth() && new Date(lastStudyDay).getFullYear() === d.getFullYear();
        monthDays = sameMonth ? monthDays + 1 : 1;
        lastStudyDay = today;
      }
      return { ...s, words, streak: { totalDays, monthDays, lastStudyDay, calendar },
        pet: { ...s.pet, lastSeenAt: now(), mood: Math.min(100, (s.pet.mood ?? 75) + 10) } };
    });
    play("win"); setView("home");
  }, [play]);

  if (!loaded) return <Splash />;
  if (!st.onboarded) return <Onboarding onDone={(interests) => { play("happy"); patch((s) => ({ ...s, onboarded: true, interests, words: buildSeedWords(interests) })); }} play={play} />;

  const nav = (v) => { play("tap"); setView(v); };
  const ctx = { st, play, mastered, seg, decor, mood, nav, addWords, updateWord, delWord, restoreWord, petLove, setSetting, finishReview, ownWordCount, reviewWrongOnly, setReviewWrongOnly, setView };

  return (
    <div style={S.shell}>
      <style>{CSS}</style>
      <Bg />
      {saveErr && <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "#c4684f", color: "#fff", textAlign: "center", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>⚠️ 本地保存异常，这台设备可能无法保留数据</div>}
      {naughty && <NaughtyModal text={naughty} emoji={seg.emoji} onClose={() => { setNaughty(null); play("happy"); }} />}
      <TopBar st={st} seg={seg} mastered={mastered} onSettings={() => nav("settings")} play={play} setSetting={setSetting} />
      <main style={S.main}>
        {view === "home" && <Home ctx={ctx} />}
        {view === "review" && <ReviewSession ctx={ctx} />}
        {view === "add" && <AddWords ctx={ctx} />}
        {view === "library" && <Library ctx={ctx} />}
        {view === "center" && <ReviewCenter ctx={ctx} />}
        {view === "settings" && <Settings ctx={ctx} />}
      </main>
    </div>
  );
}

// ── 首次进入：兴趣六选二 ───────────────────────────────
function Onboarding({ onDone, play }) {
  const [sel, setSel] = useState([]);
  const toggle = (id) => { play("tap"); setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : (s.length < 2 ? [...s, id] : s)); };
  return (<div style={S.shell}><style>{CSS}</style><Bg />
    <div style={S.onbWrap}>
      <div style={S.onbLogo}>ことも</div>
      <div style={S.onbSub}>词崽 · 你遇到的词，才是你该学的词</div>
      <div className="fade-in card" style={S.onbCard}>
        <div style={S.onbTitle}>你在日本，最常遇到哪些场景？</div>
        <div style={S.onbHint}>选 2 个，给你一份贴合生活的初始词库（之后都能自己改）。</div>
        <div style={S.intGrid}>{INTERESTS.map((it) => { const on = sel.includes(it.id); return (
          <button key={it.id} className="pressable" style={{ ...S.intBtn, ...(on ? S.intOn : {}) }} onClick={() => toggle(it.id)}>
            <span style={{ fontSize: 30 }}>{it.emoji}</span><span style={S.intLabel}>{it.label}</span>{on && <span style={S.intCheck}>✓</span>}</button>); })}</div>
        <button className="pressable" disabled={sel.length !== 2} style={{ ...S.bigBtn, opacity: sel.length === 2 ? 1 : 0.45, marginTop: 16 }} onClick={() => onDone(sel)}>
          {sel.length === 2 ? "进入 ことも 🐱" : "再选 " + (2 - sel.length) + " 个"}</button>
      </div>
    </div>
  </div>);
}

function TopBar({ st, seg, mastered, onSettings, play, setSetting }) {
  const aiReal = st.settings.aiReal;
  return (<header style={S.top}>
    <div style={S.brand}><span style={S.brandMark}>こ</span>
      <div><div style={S.brandName}>ことも</div><div style={S.brandSub}>{seg.emoji} {seg.title}</div></div></div>
    <div style={S.stats}>
      <Stat icon="🔥" val={st.streak.totalDays} label="累计天" tone={C.honeyDk} />
      <Stat icon="🌸" val={mastered} label="已掌握" tone={C.matchaDk} />
      <button style={{ ...S.aiToggle, background: aiReal ? C.matcha : "#eadcc6", color: aiReal ? "#fff" : C.inkSoft }} onClick={() => { setSetting("aiReal", !aiReal); play("pop"); }} title="AI：真Claude/模拟">{aiReal ? "AI真" : "AI拟"}</button>
      <button style={S.iconBtn} onClick={() => { setSetting("sound", !st.settings.sound); if (!st.settings.sound) Sfx.pop(); }}>{st.settings.sound ? "🔔" : "🔕"}</button>
      <button style={S.iconBtn} onClick={onSettings}>⚙️</button>
    </div>
  </header>);
}
const Stat = ({ icon, val, label, tone }) => (<div style={S.stat}><span style={{ fontSize: 15 }}>{icon}</span><div><div style={{ ...S.statVal, color: tone }}>{val}</div><div style={S.statLabel}>{label}</div></div></div>);

// ── 首页 ───────────────────────────────────────────────
function Home({ ctx }) {
  const { st, play, mastered, seg, decor, mood, nav } = ctx;
  const due = useMemo(() => dueWords(st.words, st.settings.energyMode), [st.words, st.settings.energyMode]);
  const wrongs = useMemo(() => wrongWords(st.words), [st.words]);
  const canReview = useMemo(() => st.words.some((w) => !w.mastered), [st.words]);
  const ns = nextSeg(mastered);
  const goalTotal = st.settings.energyMode === "low" ? 5 : st.settings.energyMode === "super" ? Math.max(due.length, 1) : 20;
  const todayLevel = st.streak.calendar[todayStr()];
  const dailyDone = todayLevel ? 1 : 0; // 简化：今天来过即视觉达成
  const catSize = catSizeOf(mastered);

  const nudge = (() => {
    if (mood.awayDays >= 1.5) return { bg: "#fbeae2", text: "好久不见～它刚跟你汇报完它的'丰功伟绩'😼 来记几个词吧" };
    if (due.length === 0) return { bg: "#eaf4e0", text: "今天没有到期要复习的词，遇到新词随手加进来就好 🌿" };
    if (todayLevel) return { bg: "#eaf4e0", text: "今天已经来过啦，状态在线 ✨ 想再练一点也可以" };
    return { bg: "#fff4e0", text: "今天有 " + due.length + " 个词到期，消掉它们，喂饱小猫 🍙" };
  })();

  return (<div className="fade-in">
    <div style={{ ...S.nudge, background: nudge.bg }}><span style={{ fontSize: 22 }}>{seg.emoji}</span><div style={{ flex: 1, fontWeight: 700, fontSize: 13.5, color: "#6a5640" }}>{nudge.text}</div></div>

    {/* 窝 + 猫 */}
    <div style={S.room}>
      <div style={S.window}><div style={S.sun}>☀️</div></div>
      {decor.includes("plant") && <div style={S.dPlant}>🪴</div>}
      {decor.includes("lamp") && <div style={S.dLamp}>🏮</div>}
      <div style={S.bubble} className="float-soft">{mood.word}</div>
      <div style={S.catWrap} className="pressable" onClick={() => { play("happy"); ctx.petLove(); }}>
        {decor.includes("cushion") && <div style={S.dCushion}>🛋️</div>}
        <div style={S.matCushion} />
        <div style={{ ...S.cat, transform: "scale(" + catSize + ")" }}><div style={S.catEmoji}>🐱</div><div style={S.catFace}>{mood.face}</div></div>
      </div>
      <div style={S.moodChip}>{seg.emoji} {seg.title} · 已掌握 {mastered} 词</div>
      {ns && <div style={S.segHint}>再掌握 {ns.min - mastered} 个 → {ns.emoji} {ns.title}</div>}
    </div>

    {/* 今日 */}
    <div style={S.goalRow}>
      <Ring pct={Math.min(100, Math.round((dailyDone ? 100 : (due.length ? 0 : 100))))} label={todayLevel ? "✓" : (due.length || "0")} />
      <div style={{ flex: 1 }}>
        <div style={S.goalTitle}>{due.length > 0 ? ("今天 " + due.length + " 个词待复习") : "今天暂无到期复习"}</div>
        <div style={S.goalSub}>🔥 累计 {st.streak.totalDays} 天 · 本月 {st.streak.monthDays} 天 · 只涨不减</div>
      </div>
      <EnergyPicker mode={st.settings.energyMode} onPick={(m) => { ctx.setSetting("energyMode", m); play("tap"); }} />
    </div>

    <button style={{ ...S.bigBtn, marginBottom: 11 }} className="pressable" disabled={!canReview} onClick={() => { ctx.setReviewWrongOnly(false); nav("review"); }}>
      {!canReview ? "🌸 词都掌握啦，加点新词吧" : due.length > 0 ? "📖 开始复习 · 消除 " + due.length + " 个词" : "🔄 再复习一组 · 巩固"}</button>

    <div style={S.reviewRow}>
      <button className="pressable" style={S.reviewBig} onClick={() => nav("center")}>
        <span style={{ fontSize: 20 }}>🌟</span><div style={{ textAlign: "left" }}><div style={{ fontWeight: 800 }}>复习中心</div><div style={S.reviewSub}>统计 · 排序 · 强化</div></div></button>
      <button className="pressable" style={{ ...S.reviewBig, background: "#fbeae2", borderColor: C.blush, boxShadow: "0 5px 0 #e7c0b3" }} disabled={wrongs.length === 0} onClick={() => { ctx.setReviewWrongOnly(true); nav("review"); }}>
        <span style={{ fontSize: 20 }}>❗</span><div style={{ textAlign: "left" }}><div style={{ fontWeight: 800 }}>错题强化</div><div style={S.reviewSub}>{wrongs.length} 个易错/犹豫</div></div></button>
    </div>

    <div style={S.toolRow}>
      <button className="pressable card" style={S.toolBtn} onClick={() => nav("add")}><span style={S.toolIcon}>🎙️</span><span>加词</span></button>
      <button className="pressable card" style={S.toolBtn} onClick={() => nav("library")}><span style={S.toolIcon}>📚</span><span>我的词库</span></button>
    </div>
    <div style={S.statLine}>词库共 <b style={{ color: C.honeyDk }}>{st.words.length}</b> 词 · 你自己加了 <b style={{ color: C.matchaDk }}>{ctx.ownWordCount}</b> 个</div>
  </div>);
}
// 点猫即时心情反馈在 Home 内联处理（轻量，不滥用互动）
const EnergyPicker = ({ mode, onPick }) => (
  <div style={S.energyWrap}>
    {[["low", "🌙"], ["normal", "☀️"], ["super", "🔥"]].map(([m, e]) => (
      <button key={m} style={{ ...S.energyBtn, ...(mode === m ? S.energyOn : {}) }} onClick={() => onPick(m)} title={m}>{e}</button>))}
  </div>);
const Ring = ({ pct, label }) => { const r = 24, circ = 2 * Math.PI * r, off = circ - (pct / 100) * circ;
  return (<svg width="58" height="58" style={{ flexShrink: 0 }}><circle cx="29" cy="29" r={r} fill="none" stroke="#eaddc6" strokeWidth="6" /><circle cx="29" cy="29" r={r} fill="none" stroke={C.matcha} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} transform="rotate(-90 29 29)" style={{ transition: "stroke-dashoffset .5s" }} /><text x="29" y="34" textAnchor="middle" fontSize="15" fontWeight="800" fill={C.matchaDk}>{label}</text></svg>); };

function NaughtyModal({ text, emoji, onClose }) {
  return (<div style={S.modalMask} onClick={onClose}><div className="pop-in" style={S.modalCard} onClick={(e) => e.stopPropagation()}>
    <div style={{ fontSize: 60 }} className="breathe2">😼</div>
    <div style={S.modalTitle}>你不在的时候…</div>
    <div style={S.modalText}>"{text}"</div>
    <button className="pressable" style={S.bigBtn} onClick={onClose}>这臭猫！👋 回来啦</button>
  </div></div>);
}

const Bg = () => (<div style={S.bg}><div className="cloud c1">☁️</div><div className="cloud c2">☁️</div></div>);
const Splash = () => (<div style={{ ...S.shell, display: "grid", placeItems: "center" }}><style>{CSS}</style><div style={{ fontSize: 60 }} className="breathe2">🐱</div></div>);

// ── 复习会话：按内容形态分场 ────────────────────────────
// 把到期词分成 词/句子/语法 三组，词走连连看+卡片，句子走填空，语法走情境
function ReviewSession({ ctx }) {
  const { st, play, finishReview, reviewWrongOnly } = ctx;
  const pool = useMemo(() => reviewPool(st.words, st.settings.energyMode, reviewWrongOnly), [st.words, st.settings.energyMode, reviewWrongOnly]);

  // 构建题目队列：词优先用连连看分批(5个一组)，剩余零头用卡片；句子填空；语法情境
  const queue = useMemo(() => buildQueue(pool), [pool]);
  const [qi, setQi] = useState(0);
  const [hearts, setHearts] = useState(5);
  const resultsRef = useRef({}); // id -> correct(bool)，一个词若任一次错则记错
  const hesitantRef = useRef({}); // id -> true：长按标"犹豫"，按错处理且记进犹豫词
  const recordResult = (id, correct) => { if (resultsRef.current[id] === undefined) resultsRef.current[id] = correct; else if (!correct) resultsRef.current[id] = false; };
  const markHesitate = (id) => { hesitantRef.current[id] = true; recordResult(id, false); play("wrong"); vibrate(30); };

  if (pool.length === 0) return <EmptyReview ctx={ctx} />;
  const done = qi >= queue.length || hearts <= 0;
  if (done) {
    const results = Object.entries(resultsRef.current).map(([id, correct]) => ({ id, correct }));
    return <ReviewResult ctx={ctx} results={results} hearts={hearts} onDone={() => finishReview(results, Object.keys(hesitantRef.current), st.settings.energyMode)} />;
  }
  const q = queue[qi];
  const advance = () => { play("pop"); setQi((x) => x + 1); };
  const loseHeart = () => setHearts((h) => h - 1);

  return (<div className="fade-in" style={S.quizWrap}>
    <div style={S.quizHead}>
      <button style={S.quitX} onClick={() => { play("tap"); ctx.setView("home"); }}>✕</button>
      <div style={S.progOuter}><div style={{ ...S.progInner, width: ((qi / queue.length) * 100) + "%" }} /></div>
      <div style={S.hearts}>{"❤️".repeat(Math.max(0, hearts))}<span style={{ opacity: .25 }}>{"🤍".repeat(Math.max(0, 5 - hearts))}</span></div>
    </div>
    {reviewWrongOnly && <div style={S.wrongBanner}>❗ 错题强化中 · 答对才算消灭</div>}
    <div style={{ fontSize: 11.5, color: C.inkSoft, textAlign: "center", margin: "2px 0 8px" }}>不确定的词，长按它 →「犹豫词」，会更高频回来考你（防排除法蒙混）</div>
    {q.kind === "match" && <MatchRound key={qi} items={q.items} all={st.words} play={play} onResult={recordResult} onDone={advance} onWrong={loseHeart} onHesitate={markHesitate} />}
    {q.kind === "card" && <CardRound key={qi} item={q.item} all={st.words} play={play} onResult={recordResult} onNext={advance} onWrong={loseHeart} onHesitate={markHesitate} />}
    {q.kind === "fill" && <FillRound key={qi} item={q.item} all={st.words} play={play} onResult={recordResult} onNext={advance} onWrong={loseHeart} onHesitate={markHesitate} />}
    {q.kind === "grammar" && <GrammarRound key={qi} item={q.item} all={st.words} play={play} onResult={recordResult} onNext={advance} onWrong={loseHeart} onHesitate={markHesitate} />}
  </div>);
}
function buildQueue(pool) {
  const words = pool.filter((w) => (w.type || "word") === "word");
  const sentences = pool.filter((w) => w.type === "sentence");
  const grammars = pool.filter((w) => w.type === "grammar");
  const q = [];
  // 词：每5个一组连连看；不足2个的零头用卡片
  const groups = []; for (let i = 0; i < words.length; i += 5) groups.push(words.slice(i, i + 5));
  groups.forEach((g) => { if (g.length >= 2) q.push({ kind: "match", items: g }); else g.forEach((w) => q.push({ kind: "card", item: w })); });
  // 句子：填空
  sentences.forEach((w) => q.push({ kind: "fill", item: w }));
  // 语法：情境选择
  grammars.forEach((w) => q.push({ kind: "grammar", item: w }));
  // 词太少时也保证至少有卡片
  if (q.length === 0 && words.length) words.forEach((w) => q.push({ kind: "card", item: w }));
  return q;
}

// 连连看：左日(含外来词括号) 右中，配对消除
function MatchRound({ items, all, play, onResult, onDone, onWrong, onHesitate }) {
  const [left] = useState(() => shuffle(items));
  const [right] = useState(() => shuffle(items));
  const [selL, setSelL] = useState(null), [selR, setSelR] = useState(null);
  const [matched, setMatched] = useState([]); const [wrongPair, setWrongPair] = useState(null);
  const [hes, setHes] = useState({});
  const lpTimer = useRef(null), lpFired = useRef(false);
  const markHes = (id) => { if (onHesitate) onHesitate(id); setHes((h) => ({ ...h, [id]: true })); };
  const lpStart = (id) => { lpFired.current = false; lpTimer.current = setTimeout(() => { lpFired.current = true; markHes(id); }, 450); };
  const lpCancel = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };
  useEffect(() => { if (selL && selR) {
    if (selL === selR) { play("match"); vibrate(15); onResult(selL, true); setMatched((m) => [...m, selL]); setSelL(null); setSelR(null); }
    else { play("wrong"); vibrate([20, 40, 20]); onResult(selL, false); onResult(selR, false); onWrong(); setWrongPair({ l: selL, r: selR }); setTimeout(() => { setWrongPair(null); setSelL(null); setSelR(null); }, 550); }
  } }, [selL, selR]);
  useEffect(() => { if (matched.length === items.length) { const t = setTimeout(onDone, 350); return () => clearTimeout(t); } }, [matched]);
  const tile = (w, side) => {
    const isM = matched.includes(w.id); const sel = side === "L" ? selL : selR; const isSel = sel === w.id;
    const isWrong = wrongPair && ((side === "L" && wrongPair.l === w.id) || (side === "R" && wrongPair.r === w.id));
    const label = side === "L" ? termWithLoan(w) : w.meaning; const sub = side === "L" ? w.reading : "";
    return (<button key={w.id + side} disabled={isM} className={"pressable " + (isWrong ? "shake" : "")} style={{ ...S.tile, ...(isM ? S.tileDone : {}), ...(isSel ? S.tileSel : {}), ...(hes[w.id] ? { borderColor: C.grape, borderWidth: 2 } : {}) }}
      onTouchStart={() => lpStart(w.id)} onTouchEnd={lpCancel} onTouchMove={lpCancel}
      onContextMenu={(e) => { e.preventDefault(); markHes(w.id); }}
      onClick={() => { if (lpFired.current) { lpFired.current = false; return; } if (isM) return; play("tap"); if (side === "L") { setSelL(w.id); speakJa(w.term); } else setSelR(w.id); }}>
      {isM ? <div style={{ fontWeight: 800, fontSize: 20 }}>✓</div> : <>
        <div style={{ fontWeight: 800, fontSize: label.length > 6 ? 14 : label.length > 4 ? 16 : 18, lineHeight: 1.15, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hes[w.id] ? "🤔 " : ""}{label}</div>
        <div style={{ fontSize: 10.5, color: C.inkSoft, height: 13, lineHeight: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{sub || ""}</div>
      </>}</button>);
  };
  return (<div className="fade-in">
    <div style={S.roundTag}>🔗 连连看 · 日语 ↔ 中文，配对消除</div>
    <div className="card" style={S.matchCard}><div style={S.matchCols}>
      <div style={S.matchCol}><div style={S.colHead}>日本語</div>{left.map((w) => tile(w, "L"))}</div>
      <div style={S.matchCol}><div style={S.colHead}>中文</div>{right.map((w) => tile(w, "R"))}</div>
    </div><div style={S.matchHint}>{matched.length}/{items.length} · 点日语再点中文</div></div>
  </div>);
}

// 卡片四选一：双向(中日/日中)+读音穿插，防蒙(形近义近干扰+反应时间)
function CardRound({ item, all, play, onResult, onNext, onWrong, onHesitate }) {
  const askForeign = useMemo(() => Math.random() < 0.5, [item]);
  const opts = useMemo(() => {
    const others = shuffle((all || []).filter((x) => x.id !== item.id))
      .sort((a, b) => sim(b, item) - sim(a, item)).slice(0, 3); // 干扰项从整个词库取（形近/义近优先）
    return shuffle([item, ...others]);
  }, [item, all]);
  const [picked, setPicked] = useState(null), [checked, setChecked] = useState(false), [shk, setShk] = useState(0), [hesMarked, setHesMarked] = useState(false);
  const lpTimer = useRef(null), lpFired = useRef(false);
  const markHes = () => { if (onHesitate) onHesitate(item.id); setHesMarked(true); };
  const lpStart = () => { lpFired.current = false; lpTimer.current = setTimeout(() => { lpFired.current = true; markHes(); }, 450); };
  const lpCancel = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };
  const prompt = askForeign ? termWithLoan(item) : item.meaning;
  const sub = askForeign ? item.reading : "";
  const check = () => { if (!picked) return; const correct = picked.id === item.id; setChecked(true);
    onResult(item.id, correct);
    if (correct) { play("correct"); } else { play("wrong"); vibrate([20, 40, 20]); onWrong(); setShk((s) => s + 1); } };
  const proceed = () => { setChecked(false); setPicked(null); onNext(); };
  return (<div className="fade-in">
    <div style={S.roundTag}>🃏 {askForeign ? "这个日语词是什么意思？" : "用日语怎么说？"}{hesMarked ? " · 🤔已标犹豫" : ""}</div>
    <div key={shk} className={checked && picked && picked.id !== item.id ? "shake" : ""}>
      <div className="card pop-in" style={S.bigCard}>
        <div style={S.cardWord} onClick={() => askForeign && speakJa(item.term)}>{prompt}{askForeign && <span style={{ fontSize: 20 }}> 🔊</span>}</div>
        {sub && <div style={S.cardSub}>{sub}</div>}
      </div></div>
    <div style={S.optGrid}>{opts.map((o) => {
      const label = askForeign ? o.meaning : termWithLoan(o); const osub = askForeign ? "" : o.reading;
      let stt = "idle"; if (checked) { if (o.id === item.id) stt = "right"; else if (picked && picked.id === o.id) stt = "wrong"; }
      const mp = { idle: { borderColor: picked && picked.id === o.id ? C.honey : "#ecdfca", background: picked && picked.id === o.id ? "#fdf2e0" : "#fff" }, right: { borderColor: C.matchaDk, background: "#eaf4e0" }, wrong: { borderColor: C.blush, background: "#fbeae2" } };
      return (<button key={o.id} className="pressable" style={{ ...S.opt, ...mp[stt] }}
        onTouchStart={lpStart} onTouchEnd={lpCancel} onTouchMove={lpCancel}
        onContextMenu={(e) => { e.preventDefault(); markHes(); }}
        onClick={() => { if (lpFired.current) { lpFired.current = false; return; } if (!checked) { setPicked(o); play("tap"); } }}>
        <div style={{ fontWeight: 800, fontSize: osub ? 18 : 16 }}>{label}</div>{osub && <div style={{ fontSize: 12, color: C.inkSoft }}>{osub}</div>}</button>); })}</div>
    {checked && picked && picked.id !== item.id && <div className="slide-up" style={S.fb}>正确：{item.term}（{item.reading}）{item.loan ? "← " + item.loan.word + " " : ""}— {item.meaning}</div>}
    <button className="pressable" disabled={!picked} style={{ ...S.bigBtn, opacity: picked ? 1 : 0.45 }} onClick={checked ? proceed : check}>{checked ? "下一个 →" : "检查"}</button>
  </div>);
}
// 相似度（形近/义近）用于干扰项
function sim(a, b) { let s = 0; if (a.pos === b.pos) s += 1; const t1 = a.term || "", t2 = b.term || ""; if (t1[0] && t1[0] === t2[0]) s += 1; if (Math.abs(t1.length - t2.length) <= 1) s += 0.5; return s; }

// 句子填空：把句子里某词挖空，四选一
function FillRound({ item, all, play, onResult, onNext, onWrong, onHesitate }) {
  // 句子形态：term 是整句，meaning 是中文。简单实现：让用户"看中文选正确日语句"（句子较短时）
  const opts = useMemo(() => { const others = shuffle((all || []).filter((x) => x.id !== item.id && x.type === "sentence")).slice(0, 3); const base = others.length >= 1 ? others : shuffle((all || []).filter((x) => x.id !== item.id)).slice(0, 3); return shuffle([item, ...base]); }, [item, all]);
  const [picked, setPicked] = useState(null), [checked, setChecked] = useState(false);
  const check = () => { if (!picked) return; const correct = picked.id === item.id; setChecked(true); onResult(item.id, correct); if (correct) play("correct"); else { play("wrong"); onWrong(); } };
  return (<div className="fade-in">
    <div style={S.roundTag}>📝 这句话用日语怎么说？</div>
    <div className="card pop-in" style={S.bigCard}><div style={{ fontSize: 22, fontWeight: 800 }}>{item.meaning}</div></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{opts.map((o) => {
      let stt = "idle"; if (checked) { if (o.id === item.id) stt = "right"; else if (picked && picked.id === o.id) stt = "wrong"; }
      const mp = { idle: { borderColor: picked && picked.id === o.id ? C.honey : "#ecdfca", background: picked && picked.id === o.id ? "#fdf2e0" : "#fff" }, right: { borderColor: C.matchaDk, background: "#eaf4e0" }, wrong: { borderColor: C.blush, background: "#fbeae2" } };
      return (<button key={o.id} className="pressable" style={{ ...S.optWide, ...mp[stt] }} onClick={() => { if (!checked) { setPicked(o); play("tap"); } }} onDoubleClick={() => speakJa(o.term)}>
        <span style={{ fontWeight: 800, fontSize: 17 }}>{o.term}</span>{o.reading && <span style={{ fontSize: 12, color: C.inkSoft, marginLeft: 8 }}>{o.reading}</span>}</button>); })}</div>
    {checked && picked && picked.id !== item.id && <div className="slide-up" style={S.fb}>正确：{item.term}</div>}
    <button className="pressable" disabled={!picked} style={{ ...S.bigBtn, opacity: picked ? 1 : 0.45 }} onClick={checked ? onNext : check}>{checked ? "下一个 →" : "检查"}</button>
  </div>);
}

// 语法情境：给语法点，选正确用法（第0步与填空类似，用 meaning 作题干）
function GrammarRound({ item, all, play, onResult, onNext, onWrong, onHesitate }) {
  const opts = useMemo(() => { const others = shuffle((all || []).filter((x) => x.id !== item.id)).slice(0, 3); return shuffle([item, ...others]); }, [item, all]);
  const [picked, setPicked] = useState(null), [checked, setChecked] = useState(false);
  const check = () => { if (!picked) return; const correct = picked.id === item.id; setChecked(true); onResult(item.id, correct); if (correct) play("correct"); else { play("wrong"); onWrong(); } };
  return (<div className="fade-in">
    <div style={S.roundTag}>📐 选出正确的语法表达</div>
    <div className="card pop-in" style={S.bigCard}><div style={{ fontSize: 18, fontWeight: 800 }}>{item.meaning}</div></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{opts.map((o) => {
      let stt = "idle"; if (checked) { if (o.id === item.id) stt = "right"; else if (picked && picked.id === o.id) stt = "wrong"; }
      const mp = { idle: { borderColor: picked && picked.id === o.id ? C.honey : "#ecdfca", background: picked && picked.id === o.id ? "#fdf2e0" : "#fff" }, right: { borderColor: C.matchaDk, background: "#eaf4e0" }, wrong: { borderColor: C.blush, background: "#fbeae2" } };
      return (<button key={o.id} className="pressable" style={{ ...S.optWide, ...mp[stt] }} onClick={() => { if (!checked) { setPicked(o); play("tap"); } }}>
        <span style={{ fontWeight: 800, fontSize: 16 }}>{o.term}</span></button>); })}</div>
    {checked && picked && picked.id !== item.id && <div className="slide-up" style={S.fb}>正确：{item.term}</div>}
    <button className="pressable" disabled={!picked} style={{ ...S.bigBtn, opacity: picked ? 1 : 0.45 }} onClick={checked ? onNext : check}>{checked ? "下一个 →" : "检查"}</button>
  </div>);
}

function EmptyReview({ ctx }) {
  return (<div className="fade-in" style={{ textAlign: "center", paddingTop: 40 }}>
    <div style={{ fontSize: 60 }}>🌙</div>
    <h2 style={{ fontWeight: 800 }}>暂时没有要复习的词</h2>
    <p style={{ color: C.inkSoft, fontSize: 14 }}>遇到新词随手加进来，系统会安排它科学地回来考你。</p>
    <button className="pressable" style={{ ...S.bigBtn, maxWidth: 260, margin: "10px auto 0" }} onClick={() => { ctx.play("tap"); ctx.setView("home"); }}>回窝看看 🏡</button>
  </div>);
}
function ReviewResult({ ctx, results, hearts, onDone }) {
  // 结算页三核心（PRD：今天新掌握 / 累计第几天 / 离下个段位），不用"正确率"等审判型指标
  // 此刻 SRS 还没写回（finishReview 在 onDone 才执行），故用 results 预演算出本轮成果
  const newMastered = results.reduce((n, r) => {
    const w = ctx.st.words.find((x) => x.id === r.id);
    if (!w || w.mastered || (w.srs && w.srs.level >= MASTER_LEVEL)) return n;
    return n + (applyAnswer(w, r.correct).srs.level >= MASTER_LEVEL ? 1 : 0);
  }, 0);
  const projMastered = ctx.mastered + newMastered;
  const ns = nextSeg(projMastered);
  const newDay = ctx.st.streak.lastStudyDay !== todayStr();
  const totalDays = ctx.st.streak.totalDays + (newDay ? 1 : 0);
  const d = new Date(), ls = ctx.st.streak.lastStudyDay;
  const sameMonth = ls && new Date(ls).getMonth() === d.getMonth() && new Date(ls).getFullYear() === d.getFullYear();
  const monthDays = newDay ? (sameMonth ? ctx.st.streak.monthDays + 1 : 1) : ctx.st.streak.monthDays;
  return (<div className="pop-in" style={S.results}>
    <div style={{ fontSize: 70 }} className="breathe2">{hearts > 0 ? "🎉" : "🍵"}</div>
    <h2 style={S.resTitle}>{hearts > 0 ? "清空啦！小猫很满足" : "差一点，再来一次～"}</h2>
    <div style={S.resGrid}>
      <ResStat label="今天新掌握" val={newMastered + " 词"} tone={C.matchaDk} />
      <ResStat label="累计天数" val={"🔥 " + totalDays} tone={C.honeyDk} />
      {ns ? <ResStat label="离下个段位" val={(ns.min - projMastered) + " 词"} tone={C.blush} />
          : <ResStat label="已全部掌握" val={projMastered + " 词"} tone={C.blush} />}
    </div>
    <div style={S.streakLine}>🗓️ 本月陪小猫 {monthDays} 天 · 断了不清零，只涨不减</div>
    <button className="pressable" style={{ ...S.bigBtn, maxWidth: 300 }} onClick={onDone}>回窝看看 🏡</button>
  </div>);
}
const ResStat = ({ label, val, tone }) => (<div className="card" style={S.resStat}><div style={{ fontSize: 20, fontWeight: 800, color: tone }}>{val}</div><div style={S.statLabel}>{label}</div></div>);

// ── 加词：打字/语音 → AI补意思 → 展开收割 → 待确认入库 ──────
function AddWords({ ctx }) {
  const { st, play, addWords } = ctx;
  const aiReal = st.settings.aiReal;
  // 离线档：进加词页就后台预载 kuromoji 词典，避免转换时才现下载导致卡顿
  useEffect(() => { if (!aiReal) loadKuromoji().catch(() => {}); }, [aiReal]);
  const [tab, setTab] = useState("type");
  const [dir, setDir] = useState("ja"); // 录入方向：ja=日→中（输入日语），zh=中→日（输入中文）
  const [draft, setDraft] = useState([]);
  const [expandWord, setExpandWord] = useState(null); // 某条"待确认"点✨展开时的目标词
  const addDraft = (rows) => setDraft((d) => [...rows, ...d]);
  const editD = (i, k, v) => setDraft((d) => d.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const delD = (i) => setDraft((d) => d.filter((_, idx) => idx !== i));
  // ✨展开：先把当前这批待确认词存进库（被点的那条带固定 id，其余正常入库），再进入"展开学习"对它深挖/推荐关联词，避免丢草稿
  const expandDraft = (i) => { const r = draft[i]; if (!r || !r.term || !r.term.trim()) return; const id = uid(); addWords(draft.map((d, idx) => idx === i ? { ...d, id } : d)); setDraft([]); setExpandWord({ ...r, id }); setTab("expand"); play("tap"); };
  const commit = () => { addWords(draft); setDraft([]); play("win"); ctx.setView("library"); };
  return (<div className="fade-in"><BackRow ctx={ctx} title="🎙️ 加词" />
    {tab !== "expand" && <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>{[["ja", "日 → 中（输入日语）"], ["zh", "中 → 日（输入中文）"]].map(([k, l]) => (
      <button key={k} className="pressable" style={{ ...S.seg, flex: 1, ...(dir === k ? S.segOn : {}) }} onClick={() => { setDir(k); play("tap"); }}>{l}</button>))}</div>}
    <div style={S.segRow}>{[["type", "⌨️ 打字"], ["voice", "🎙️ 语音"], ["expand", "✨ 展开学习"]].map(([k, l]) => (
      <button key={k} style={{ ...S.seg, ...(tab === k ? S.segOn : {}) }} onClick={() => { setTab(k); setExpandWord(null); play("tap"); }}>{l}</button>))}</div>
    {tab === "type" && <TypeInput aiReal={aiReal} dir={dir} onRows={addDraft} play={play} />}
    {tab === "voice" && <VoiceInput aiReal={aiReal} dir={dir} onRows={addDraft} play={play} />}
    {tab === "expand" && <ExpandTool ctx={ctx} initialWord={expandWord} />}
    {draft.length > 0 && tab !== "expand" && (<div style={{ marginTop: 16 }}>
      <div style={S.sectTitle}>📥 待确认 ({draft.length}) · 点⭐标高频，🔤标外来词</div>
      <div style={S.list}>{draft.map((r, i) => (
        <div key={i} className="card" style={S.draftRow}>
          <div style={S.draftHead}>
            <select value={r.pos} onChange={(e) => editD(i, "pos", e.target.value)} style={S.draftPos}>{POS.map((p) => <option key={p.key} value={p.key}>{p.emoji}{p.label}</option>)}</select>
            <button style={S.draftExpand} onClick={() => expandDraft(i)}>✨ 展开</button>
            <button style={{ ...S.draftStar, ...(r.freq ? S.draftStarOn : {}) }} onClick={() => editD(i, "freq", !r.freq)}>⭐ 高频</button>
            <button style={S.draftDel} onClick={() => delD(i)}>✕ 删</button>
          </div>
          <label style={S.draftField}><span style={S.draftLabel}>单词</span><input style={S.draftIn} value={r.term} placeholder="日语" onChange={(e) => editD(i, "term", e.target.value)} /></label>
          <label style={S.draftField}><span style={S.draftLabel}>读音</span><input style={S.draftIn} value={r.reading} placeholder="假名" onChange={(e) => editD(i, "reading", e.target.value)} /></label>
          <label style={S.draftField}><span style={S.draftLabel}>意思</span><input style={S.draftIn} value={r.meaning} placeholder="中文" onChange={(e) => editD(i, "meaning", e.target.value)} /></label>
        </div>))}</div>
      <button className="pressable" style={{ ...S.bigBtn, marginTop: 12 }} onClick={commit}>✅ 全部加入（{draft.filter((r) => r.term.trim()).length} 词）</button>
    </div>)}
  </div>);
}

function TypeInput({ aiReal, dir, onRows, play }) {
  const [term, setTerm] = useState(""), [busy, setBusy] = useState(false);
  const add = async () => {
    const t = term.trim(); if (!t) return; setBusy(true); play("tap");
    let row;
    const sys = dir === "zh"
      ? "用户给一个中文词，给出日语母语者实际使用的最常用说法。要求：term 用规范的日语写法（该用汉字就用日语规范汉字，不要照搬中文字形，例如『古董』日语写『骨董品』；外来词用片假名）；reading 是准确的平假名读音，逐字核对促音っ/长音/浊音半浊音（不要罗马音）。输出 JSON：{term,reading,meaning:用户给的中文,pos:noun|verb|adj|phrase|other,freq:是否高频(bool),loan:若是片假名外来词则{from:语言码,word:原词}否则null}。只输出 JSON。"
      : "用户给一个日语词。要求：term 用日语规范写法；reading 是准确的平假名读音，逐字核对促音っ/长音/浊音半浊音（不要罗马音）；meaning 用地道中文。输出 JSON：{term,reading,meaning,pos:noun|verb|adj|phrase|other,freq:是否高频(bool),loan:若是片假名外来词则{from:语言码,word:原词}否则null}。只输出 JSON。";
    const offline = () => dir === "zh" ? { term: "", reading: "", meaning: t, pos: "other", freq: false } : localAutoFill(t);
    if (aiReal) { try { row = JSON.parse(stripFence(await callAI(sys, t))); } catch { row = await offline(); } }
    else row = await offline();
    onRows([row]); setTerm(""); setBusy(false); play("coin");
  };
  return (<div className="card" style={S.padCard}>
    <div style={S.howto}>{dir === "zh" ? (aiReal ? "打一个中文词，AI 给出对应日语 + 读音(假名)" : "中→日 需要开 AI（离线只支持日→中，会把中文记到意思栏）") : (aiReal ? "打一个日语词，AI 补读音(假名)/意思/词性" : "打一个日语词，离线补读音(假名)和词性，意思自己填")}。</div>
    <div style={{ display: "flex", gap: 8 }}>
      <input style={S.field} value={term} placeholder={dir === "zh" ? "例如 厕所、好吃" : "例如 トイレ、美味しい"} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      <button className="pressable" style={S.addBtn} onClick={add} disabled={busy}>{busy ? "…" : "＋"}</button>
    </div>
    <div style={S.tip}>加进"待确认"后可以编辑，确认无误再入库。</div>
  </div>);
}

function VoiceInput({ aiReal, dir, onRows, play }) {
  const [listening, setListening] = useState(false), [heard, setHeard] = useState(""), [supported, setSupported] = useState(true), [busy, setBusy] = useState(false);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  const recRef = useRef(null);
  useEffect(() => { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { setSupported(false); return; }
    const r = new SR(); r.lang = "ja-JP"; r.interimResults = true; r.continuous = true;
    r.onresult = (e) => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setHeard(t); };
    r.onend = () => setListening(false); recRef.current = r; return () => { try { r.stop(); } catch {} }; }, []);
  const toggle = () => { if (!recRef.current) return; if (listening) { recRef.current.stop(); setListening(false); } else { setHeard(""); try { recRef.current.lang = dir === "zh" ? "zh-CN" : "ja-JP"; recRef.current.start(); setListening(true); play("listen"); } catch {} } };
  const process = async () => { if (!heard.trim()) return; setBusy(true); play("tap"); let rows = [];
    const sys = dir === "zh"
      ? "用户说的是中文。把内容拆成词，每个给日语母语者最常用的说法：term 用规范日语写法（别照搬中文字形，如『古董』写『骨董品』），reading 准确平假名（逐字核对促音/长音/浊音，不要罗马音）。输出 JSON 数组 {term,reading,meaning:中文,pos,freq,loan}。只输出 JSON。"
      : "用户说的是日语。拆成日语词条，每项 term 用规范写法、reading 准确平假名（核对促音/长音/浊音，不要罗马音）、meaning 地道中文：{term,reading,meaning,pos,freq,loan}。只输出 JSON 数组。";
    const offline = (w) => dir === "zh" ? Promise.resolve({ term: "", reading: "", meaning: w, pos: "other", freq: false }) : localAutoFill(w);
    if (aiReal) { try { rows = JSON.parse(stripFence(await callAI(sys, heard))); } catch { rows = await Promise.all(heard.split(/[\s、。,，]+/).filter(Boolean).map(offline)); } }
    else rows = await Promise.all(heard.split(/[\s、。,，]+/).filter(Boolean).map(offline));
    onRows(rows); setHeard(""); setBusy(false); play("coin"); };
  return (<div className="card" style={S.padCard}>
    <div style={S.howto}>{dir === "zh" ? "说中文，转成对应的日语词条（中→日 需开 AI）。" : "看剧/逛街听到的日语词，直接说出来，自动转成词条。"}</div>
    {!supported && <div style={S.warnBox}>此浏览器不支持语音，请用 Chrome，或改"打字"。</div>}
    {isIOS && <div style={S.tip}>iPhone 网页版每次会问麦克风权限（苹果系统对网页的限制，非故障）。嫌烦可改用「打字」，AI/离线一样自动补全。</div>}
    <button className={"pressable " + (listening ? "pulse-rec" : "")} style={{ ...S.micBtn, background: listening ? C.blush : C.honey, boxShadow: "0 6px 0 " + (listening ? "#c97a64" : C.honeyDk) }} onClick={toggle} disabled={!supported}>
      <span style={{ fontSize: 30 }}>{listening ? "🔴" : "🎙️"}</span><span>{listening ? "聆听中…点击停止" : "点击说话"}</span></button>
    {heard && <div style={S.heardBox}>"{heard}"</div>}
    {heard && <button className="pressable" style={{ ...S.bigBtn }} onClick={process} disabled={busy}>{busy ? "转换中…" : "✨ 转成词条"}</button>}
  </div>);
}

// 展开学习：选词库里一个词 → AI铺开例句/近义/语法 → 勾选收割进该词
function ExpandTool({ ctx, initialWord }) {
  const { st, play, updateWord } = ctx;
  const aiReal = st.settings.aiReal;
  const [picked, setPicked] = useState(initialWord || null), [busy, setBusy] = useState(false), [data, setData] = useState(null), [sel, setSel] = useState({});
  const [related, setRelated] = useState(null), [relSel, setRelSel] = useState({});
  const words = st.words.filter((w) => (w.type || "word") === "word");
  const reset = () => { setPicked(null); setData(null); setRelated(null); setSel({}); setRelSel({}); };
  // 深挖：例句/近义/语法
  const run = async (w) => { setPicked(w); setBusy(true); play("tap"); setData(null); setRelated(null); setSel({}); let d;
    if (aiReal) { try { const sys = "你是日语老师。给定一个日语词，输出 JSON：{examples:[{jp,zh}](2条简单例句),synonyms:[{term,reading,meaning}](1-2个近义/相关词),grammar:[{point,note}](1个相关语法点)}。只输出 JSON。"; d = JSON.parse(stripFence(await callAI(sys, w.term + "（" + w.meaning + "）"))); } catch { d = mockExpand(w); } }
    else d = mockExpand(w);
    setData(d); setBusy(false); play("pop"); };
  // 关联词推荐（Pingo式）：一次推一批，批量勾选
  const runRelated = async (w) => { setPicked(w); setBusy(true); play("tap"); setData(null); setRelated(null); setRelSel({}); let rows;
    if (aiReal) { try { const have = st.words.map((x) => x.term).join("、"); const sys = "你是日语词库教练。给定一个日语词，推荐 15-20 个【相关/常一起出现/同场景】的实用日语词（避开用户已有的）。输出 JSON 数组 {term,reading,meaning,pos,freq}。只输出 JSON。"; rows = JSON.parse(stripFence(await callAI(sys, "词：" + w.term + "（" + w.meaning + "）。已有：" + have))); } catch { rows = mockRelated(w); } }
    else rows = mockRelated(w);
    const have = new Set(st.words.map((x) => x.term));
    setRelated(rows.filter((r) => !have.has(r.term)).slice(0, 20)); setBusy(false); play("pop"); };
  const harvest = () => {
    const newWords = [];
    (data.synonyms || []).forEach((sObj, i) => { if (sel["syn" + i] && sObj.term && sObj.term !== "（近义示例）") newWords.push({ term: sObj.term, reading: sObj.reading || "", meaning: sObj.meaning || "", pos: "other", freq: false }); });
    if (newWords.length) ctx.addWords(newWords);
    const keepEx = (data.examples || []).filter((_, i) => sel["ex" + i]);
    const keepGr = (data.grammar || []).filter((_, i) => sel["gr" + i]);
    if (keepEx.length || keepGr.length) updateWord(picked.id, (w) => ({ ...w, expanded: { examples: keepEx, synonyms: [], grammar: keepGr } }));
    play("win"); reset(); ctx.setView("library");
  };
  const harvestRelated = () => {
    const add = related.filter((_, i) => relSel[i]);
    if (add.length) ctx.addWords(add);
    play("win"); reset(); ctx.setView("library");
  };
  const toggle = (k) => { play("tap"); setSel((s) => ({ ...s, [k]: !s[k] })); };
  const toggleRel = (i) => { play("tap"); setRelSel((s) => ({ ...s, [i]: !s[i] })); };
  const selectAllRel = () => { play("pop"); const all = {}; related.forEach((_, i) => { all[i] = true; }); setRelSel(all); };
  const relCount = Object.values(relSel).filter(Boolean).length;

  return (<div className="card" style={S.padCard}>
    <div style={S.howto}>挑词库里一个词 → <b>深挖</b>它的例句/近义/语法，或让 AI 一次<b>推一批关联词</b>批量加入（省去自己查找打字）。</div>
    {!picked && <div style={S.chipWrap}>{words.slice(0, 40).map((w) => (
      <button key={w.id} className="pressable" style={S.wordChip} onClick={() => { setPicked(w); setData(null); setRelated(null); }}>{termWithLoan(w)}</button>))}
      {words.length === 0 && <div style={S.empty}>先加几个词，再来展开学习 🌱</div>}</div>}

    {picked && !data && !related && !busy && (<div>
      <div style={S.expandHead}>{termWithLoan(picked)} <span style={{ fontSize: 13, color: C.inkSoft }}>{picked.reading} · {picked.meaning}</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button className="pressable" style={S.bigBtn} onClick={() => runRelated(picked)}>🌱 推荐一批关联词（一次 15-20 个）</button>
        <button className="pressable" style={{ ...S.bigBtn, background: C.honey, boxShadow: "0 6px 0 " + C.honeyDk }} onClick={() => run(picked)}>🔍 深挖：例句 / 近义 / 语法</button>
        <button className="pressable" style={S.ghostBtn} onClick={reset}>← 换一个词</button>
      </div>
    </div>)}

    {busy && <div style={S.empty}>{aiReal ? "AI 思考中…✨" : "生成中…✨"}</div>}

    {/* 关联词推荐结果（批量勾选） */}
    {related && picked && (<div>
      <div style={S.expandHead}>🌱 和「{picked.term}」相关的词</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: C.inkSoft, fontWeight: 700 }}>勾选要加入的（已选 {relCount}）</span>
        <button style={S.selAllBtn} onClick={selectAllRel}>全选</button></div>
      <div style={S.relGrid}>{related.map((r, i) => { const on = relSel[i]; const p = posInfo(r.pos); return (
        <button key={i} className="pressable" style={{ ...S.relChip, ...(on ? S.relChipOn : {}) }} onClick={() => toggleRel(i)}>
          <span style={{ fontSize: 11 }}>{on ? "☑️" : "⬜"}</span>
          <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}><div style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{termWithLoan(r)}</div><div style={{ fontSize: 11, color: C.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.meaning}</div></div></button>); })}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="pressable" disabled={relCount === 0} style={{ ...S.bigBtn, flex: 1, opacity: relCount ? 1 : 0.5 }} onClick={harvestRelated}>✅ 加入 {relCount} 个词</button>
        <button className="pressable" style={S.ghostBtn} onClick={reset}>← 返回</button></div>
    </div>)}

    {/* 深挖结果 */}
    {data && picked && (<div>
      <div style={S.expandHead}>{termWithLoan(picked)} <span style={{ fontSize: 13, color: C.inkSoft }}>{picked.reading} · {picked.meaning}</span></div>
      <div style={S.sectTitle}>📖 例句</div>
      {(data.examples || []).map((e, i) => (<label key={i} style={{ ...S.harvestRow, ...(sel["ex" + i] ? S.harvestOn : {}) }} onClick={() => toggle("ex" + i)}>
        <span style={S.checkbox}>{sel["ex" + i] ? "☑️" : "⬜"}</span><div><div style={{ fontWeight: 700 }} onClick={(ev) => { ev.stopPropagation(); speakJa(e.jp); }}>{e.jp} 🔊</div><div style={{ fontSize: 12, color: C.inkSoft }}>{e.zh}</div></div></label>))}
      {(data.synonyms || []).length > 0 && <><div style={S.sectTitle}>🔗 近义/相关词</div>
        {(data.synonyms || []).map((s, i) => (<label key={i} style={{ ...S.harvestRow, ...(sel["syn" + i] ? S.harvestOn : {}) }} onClick={() => toggle("syn" + i)}>
          <span style={S.checkbox}>{sel["syn" + i] ? "☑️" : "⬜"}</span><div><span style={{ fontWeight: 800 }}>{s.term}</span> <span style={{ fontSize: 12, color: C.inkSoft }}>{s.reading} · {s.meaning}</span></div></label>))}</>}
      {(data.grammar || []).length > 0 && <><div style={S.sectTitle}>📐 语法点</div>
        {(data.grammar || []).map((g, i) => (<label key={i} style={{ ...S.harvestRow, ...(sel["gr" + i] ? S.harvestOn : {}) }} onClick={() => toggle("gr" + i)}>
          <span style={S.checkbox}>{sel["gr" + i] ? "☑️" : "⬜"}</span><div><span style={{ fontWeight: 800 }}>{g.point}</span><div style={{ fontSize: 12, color: C.inkSoft }}>{g.note}</div></div></label>))}</>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="pressable" style={{ ...S.bigBtn, flex: 1 }} onClick={harvest}>✅ 收割勾选项</button>
        <button className="pressable" style={S.ghostBtn} onClick={reset}>← 返回</button></div>
    </div>)}
  </div>);
}

// ── 我的词库 ───────────────────────────────────────────
const HL_COLORS = ["", "#ffe6a8", "#cdeccd", "#cfe4f0", "#f0d2e4"]; // 高亮笔：无/黄/绿/蓝/粉
function Library({ ctx }) {
  const { st, play, updateWord, delWord } = ctx;
  const [filter, setFilter] = useState("all");
  const [order, setOrder] = useState("new"); // new=从新到旧（默认，先看最近加的）, old=从旧到新
  const [editing, setEditing] = useState(null);
  const words = st.words;
  const shown = filter === "all" ? words
    : filter === "freq" ? words.filter((w) => w.freq)
    : filter === "loan" ? words.filter((w) => w.loan)
    : filter === "mastered" ? words.filter((w) => w.mastered || (w.srs && w.srs.level >= MASTER_LEVEL))
    : words.filter((w) => (w.pos || "other") === filter);
  // 词库按加入先后排（words 数组本身是从旧到新追加的）：从新到旧=倒序，从旧到新=原序
  const ordered = order === "new" ? [...shown].reverse() : shown;
  return (<div className="fade-in"><BackRow ctx={ctx} title="📚 我的词库" />
    <button className="pressable" style={{ ...S.bigBtn, marginBottom: 12, background: C.matcha, boxShadow: "0 5px 0 " + C.matchaDk }} onClick={() => { play("tap"); ctx.setView("add"); }}>🎙️ 去加词（打字/语音/展开）</button>
    <div style={{ ...S.filterRow, marginBottom: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: "#7a6244", alignSelf: "center", marginRight: 2 }}>排序</span>
      <Chip on={order === "new"} onClick={() => { setOrder("new"); play("tap"); }}>🆕 从新到旧</Chip>
      <Chip on={order === "old"} onClick={() => { setOrder("old"); play("tap"); }}>📜 从旧到新</Chip>
    </div>
    <div style={S.filterRow}>
      <Chip on={filter === "all"} onClick={() => { setFilter("all"); play("tap"); }}>全部 {words.length}</Chip>
      <Chip on={filter === "freq"} onClick={() => { setFilter("freq"); play("tap"); }}>⭐高频 {words.filter((w) => w.freq).length}</Chip>
      <Chip on={filter === "loan"} onClick={() => { setFilter("loan"); play("tap"); }}>🔤外来词 {words.filter((w) => w.loan).length}</Chip>
      <Chip on={filter === "mastered"} onClick={() => { setFilter("mastered"); play("tap"); }}>🌸已掌握 {countMastered(words)}</Chip>
      {POS.map((p) => { const n = words.filter((w) => (w.pos || "other") === p.key).length; if (!n) return null; return <Chip key={p.key} on={filter === p.key} onClick={() => { setFilter(p.key); play("tap"); }}>{p.emoji}{p.label} {n}</Chip>; })}
    </div>
    <div style={S.list}>{ordered.length === 0 && <div style={S.empty}>这里还没有词 🌱</div>}
      {ordered.map((w) => { const p = posInfo(w.pos); const done = w.mastered || (w.srs && w.srs.level >= MASTER_LEVEL); const open = editing === w.id;
        return [(<div key={w.id} className="card" style={{ ...S.wordRow, ...(w.hl ? { background: w.hl } : {}) }}>
          <span style={{ ...S.dot, background: p.color + "33" }} onClick={() => speakJa(w.term)}>{p.emoji}</span>
          <div style={{ flex: 1 }} onClick={() => { play("tap"); setEditing(open ? null : w.id); }}>
            <span style={S.wTerm}>{termWithLoan(w)}</span><span style={S.wReading}>{w.reading}</span>
            {w.freq && <Tag bg="#ffe6a8" fg="#a8761e">高频</Tag>}{done && <Tag bg="#eaf4e0" fg={C.matchaDk}>已掌握</Tag>}
            <div style={{ fontSize: 13, color: "#7a6244" }}>{w.meaning}{w.source ? " · 📍" + w.source : ""}</div>
          </div>
          <div style={S.wStat}><span style={S.statPill}>练{w.seen || 0}</span>{(w.wrong || 0) > 0 && <span style={{ ...S.statPill, background: "#fbeae2", color: "#c4684f" }}>错{w.wrong}</span>}</div>
        </div>)].concat(open ? [<div key={w.id + "edit"} className="card slide-up" style={S.editPanel}>
          <div style={S.editRow}><span style={S.editLabel}>掌握</span>
            <button className="pressable" style={{ ...S.toggle, ...(done ? S.toggleOn : {}) }} onClick={() => { updateWord(w.id, (x) => ({ ...x, mastered: !done })); play("tap"); }}>{done ? "已掌握 ✓（跳过复习）" : "标为已掌握"}</button></div>
          <div style={S.editRow}><span style={S.editLabel}>高亮</span><div style={{ display: "flex", gap: 6 }}>
            {HL_COLORS.map((c, i) => (<button key={i} className="pressable" style={{ ...S.hlDot, background: c || "#fff", border: (w.hl || "") === c ? "2px solid " + C.ink : "2px solid #ddd" }} onClick={() => { updateWord(w.id, (x) => ({ ...x, hl: c })); play("tap"); }}>{c ? "" : "∅"}</button>))}</div></div>
          <div style={S.editRow}><span style={S.editLabel}>来源</span>
            <input style={S.editInput} defaultValue={w.source} placeholder="哪部剧/哪家店/哪次办事…" onBlur={(e) => updateWord(w.id, (x) => ({ ...x, source: e.target.value }))} /></div>
          {w.expanded && (w.expanded.examples || []).length > 0 && <div style={{ marginTop: 6 }}><div style={S.editLabel}>例句</div>{w.expanded.examples.map((e, i) => <div key={i} style={S.exLine} onClick={() => speakJa(e.jp)}>· {e.jp} 🔊 <span style={{ color: C.inkSoft }}>{e.zh}</span></div>)}</div>}
          <button className="pressable" style={S.delBtn} onClick={() => { if (confirm("确定删除「" + w.term + "」？")) { delWord(w.id); play("tap"); } }}>🗑️ 删除这个词</button>
        </div>] : []); })}</div>
    <TrashBin ctx={ctx} />
  </div>);
}
// 最近删除回收站：删词移入此处，保留 7 天可一键恢复（PRD：防误删心血）
function TrashBin({ ctx }) {
  const { st, play, restoreWord } = ctx;
  const trash = st.trash || [];
  const [open, setOpen] = useState(false);
  if (trash.length === 0) return null;
  return (<div style={{ marginTop: 18 }}>
    <button className="pressable" style={{ width: "100%", border: "none", background: "#f3e8d6", color: "#7a6244", borderRadius: 12, padding: "11px 13px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }} onClick={() => { setOpen((o) => !o); play("tap"); }}>🗑️ 最近删除（{trash.length}）· 保留 7 天可恢复 {open ? "▲" : "▼"}</button>
    {open && <div style={{ ...S.list, marginTop: 8 }}>{trash.map((t) => { const left = Math.max(0, Math.ceil(7 - (now() - t.deletedAt) / DAY)); return (
      <div key={t.word.id} className="card" style={S.wordRow}>
        <div style={{ flex: 1 }}><span style={S.wTerm}>{termWithLoan(t.word)}</span><span style={S.wReading}>{t.word.reading}</span>
          <div style={{ fontSize: 12, color: C.inkSoft }}>{t.word.meaning} · 还剩 {left} 天</div></div>
        <button className="pressable" style={{ border: "none", background: C.matcha, color: "#fff", borderRadius: 10, padding: "7px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }} onClick={() => { restoreWord(t.word.id); play("pop"); }}>↩︎ 恢复</button>
      </div>); })}</div>}
  </div>);
}
const Chip = ({ on, onClick, children }) => (<button style={{ ...S.chip, ...(on ? S.chipOn : {}) }} onClick={onClick}>{children}</button>);
const Tag = ({ bg, fg, children }) => (<span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 7, background: bg, color: fg, marginLeft: 4 }}>{children}</span>);

// ── 复习中心：统计 / 排序 / 错题 ───────────────────────
function ReviewCenter({ ctx }) {
  const { st, play } = ctx;
  const all = st.words;
  const [tab, setTab] = useState("all"), [sort, setSort] = useState("wrong");
  const studied = all.filter((w) => (w.seen || 0) > 0);
  const wrongs = all.filter((w) => (w.wrong || 0) > 0);
  const freqs = all.filter((w) => w.freq);
  const base = tab === "wrong" ? wrongs : tab === "freq" ? freqs : studied;
  const sorted = [...base].sort((a, b) => sort === "wrong" ? ((b.wrong || 0) - (a.wrong || 0) || (b.seen || 0) - (a.seen || 0)) : sort === "seen" ? ((b.seen || 0) - (a.seen || 0)) : ((b.freq ? 1 : 0) - (a.freq ? 1 : 0)));
  const totalWrong = all.reduce((s, w) => s + (w.wrong || 0), 0);
  return (<div className="fade-in"><BackRow ctx={ctx} title="🌟 复习中心" />
    <div style={S.statCards}>
      <div className="card" style={S.statCard}><div style={{ ...S.statBig, color: C.honeyDk }}>{st.streak.totalDays}</div><div style={S.statSmall}>累计学习天</div></div>
      <div className="card" style={S.statCard}><div style={{ ...S.statBig, color: C.matchaDk }}>{ctx.mastered}</div><div style={S.statSmall}>已掌握词</div></div>
      <div className="card" style={S.statCard}><div style={{ ...S.statBig, color: C.blush }}>{totalWrong}</div><div style={S.statSmall}>总错误次数</div></div>
    </div>
    <MiniCalendar calendar={st.streak.calendar} />
    {wrongs.length > 0 && <button className="pressable" style={{ ...S.bigBtn, background: C.blush, boxShadow: "0 6px 0 #c97a64", marginTop: 14 }} onClick={() => { ctx.setReviewWrongOnly(true); play("tap"); ctx.setView("review"); }}>❗ 强化错题（{wrongs.length} 词）</button>}
    <div style={{ ...S.sectTitle, marginTop: 16 }}>📊 单词统计</div>
    <div style={S.filterRow}>
      <Chip on={tab === "all"} onClick={() => { setTab("all"); play("tap"); }}>学过 {studied.length}</Chip>
      <Chip on={tab === "wrong"} onClick={() => { setTab("wrong"); play("tap"); }}>❗易错 {wrongs.length}</Chip>
      <Chip on={tab === "freq"} onClick={() => { setTab("freq"); play("tap"); }}>⭐高频 {freqs.length}</Chip>
    </div>
    <div style={S.sortRow}>排序：{[["wrong", "错最多"], ["seen", "练最多"], ["freq", "高频先"]].map(([k, l]) => (<button key={k} style={{ ...S.sortChip, ...(sort === k ? S.sortOn : {}) }} onClick={() => { setSort(k); play("tap"); }}>{l}</button>))}</div>
    {sorted.length === 0 && <div style={S.empty}>还没有数据，先学几课 🐾</div>}
    <div style={S.list}>{sorted.map((w) => { const p = posInfo(w.pos); const rate = w.seen ? Math.round((w.wrong || 0) / w.seen * 100) : 0;
      return (<div key={w.id} className="card" style={S.wordRow} onClick={() => { play("tap"); speakJa(w.term); }}>
        <span style={{ ...S.dot, background: p.color + "33" }}>{p.emoji}</span>
        <div style={{ flex: 1 }}><span style={S.wTerm}>{termWithLoan(w)}</span><span style={S.wReading}>{w.reading}</span>{w.freq && <Tag bg="#ffe6a8" fg="#a8761e">高频</Tag>}<div style={{ fontSize: 12, color: C.inkSoft }}>{w.meaning}</div></div>
        <div style={S.wStat}><span style={S.statPill}>练{w.seen || 0}</span>{(w.wrong || 0) > 0 && <span style={{ ...S.statPill, background: "#fbeae2", color: "#c4684f" }}>错{w.wrong}·{rate}%</span>}</div></div>); })}</div>
  </div>);
}
function MiniCalendar({ calendar }) {
  const days = []; const d = new Date(); const y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y, m, 1).getDay(); const total = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < first; i++) days.push(null);
  for (let dd = 1; dd <= total; dd++) days.push(dd);
  const colorOf = (dd) => { if (!dd) return "transparent"; const key = new Date(y, m, dd).toDateString(); const lv = calendar[key]; return lv === "super" ? C.grape : lv === "full" ? C.matcha : lv === "light" ? "#cdeccd" : "#f0e6d4"; };
  return (<div className="card" style={S.calCard}>
    <div style={S.calTitle}>📅 {y}年{m + 1}月 · 努力浓淡图</div>
    <div style={S.calGrid}>{["日","一","二","三","四","五","六"].map((w) => <div key={w} style={S.calW}>{w}</div>)}
      {days.map((dd, i) => <div key={i} style={{ ...S.calCell, background: colorOf(dd), color: dd && calendar[new Date(y, m, dd).toDateString()] ? "#fff" : C.inkSoft }}>{dd || ""}</div>)}</div>
    <div style={S.calLegend}><span><i style={{ background: "#cdeccd" }} />低能</span><span><i style={{ background: C.matcha }} />正常</span><span><i style={{ background: C.grape }} />超人</span></div>
  </div>);
}

// ── 设置 ───────────────────────────────────────────────
function Settings({ ctx }) {
  const { st, play, setSetting } = ctx;
  const [aiKey, setAiKey] = useState(""); const [keyMsg, setKeyMsg] = useState("");
  useEffect(() => { getApiKey().then((k) => setAiKey(k || "")); }, []);
  const saveKey = async () => {
    await saveApiKey(aiKey); play("pop"); setKeyMsg("校验中…");
    const r = await validateKey(aiKey);
    if (r.ok === true) setSetting("aiReal", true);   // 密钥有效就自动开「真AI」，省掉一步
    setKeyMsg(r.msg + (r.ok === true ? "，已开启真 AI ✨" : ""));
    setTimeout(() => setKeyMsg(""), 5000);
  };
  return (<div className="fade-in"><BackRow ctx={ctx} title="⚙️ 设置" />
    <div className="card" style={S.setCard}>
      <Row label="音效" hint="清脆解压的按键音"><Switch on={st.settings.sound} onClick={() => { setSetting("sound", !st.settings.sound); if (!st.settings.sound) Sfx.pop(); }} /></Row>
      <Row label="AI 模式" hint="真AI(需密钥+联网，补意思/关联词/展开) / 离线(kuromoji 只补读音和词性)"><Switch on={st.settings.aiReal} label={st.settings.aiReal ? "真" : "拟"} onClick={() => { setSetting("aiReal", !st.settings.aiReal); play("pop"); }} /></Row>
      <Row label="AI 密钥" hint="OpenAI(sk-…) 或 Claude(sk-ant-…)，贴哪家就用哪家，只存本机不上传">
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input style={{ ...S.field, width: 138, fontSize: 12 }} type="password" value={aiKey} placeholder="sk-… 或 sk-ant-…" onChange={(e) => setAiKey(e.target.value)} />
          <button className="pressable" style={S.addBtn} onClick={saveKey}>存</button>
        </div>
      </Row>
      <Row label="低能量模式" hint="状态不好时主动开，温柔不评判"><div style={S.energyWrap}>{[["low", "🌙 低能"], ["normal", "☀️ 正常"], ["super", "🔥 超人"]].map(([m, l]) => (<button key={m} style={{ ...S.energyBtn, padding: "6px 10px", fontSize: 12, ...(st.settings.energyMode === m ? S.energyOn : {}) }} onClick={() => { setSetting("energyMode", m); play("tap"); }}>{l}</button>))}</div></Row>
    </div>
    {keyMsg && <div style={{ ...S.setNote, color: keyMsg.indexOf("✗") === 0 ? C.blush : C.matchaDk, fontWeight: 800 }}>{keyMsg}</div>}
    <div style={S.setNote}>开「真AI」需要密钥：OpenAI（platform.openai.com 生成，<b>sk-</b> 开头）或 Anthropic Claude（console.anthropic.com 生成，<b>sk-ant-</b> 开头）都行，贴哪家就自动用哪家，按用量付费、很便宜（查一个词不到一分钱）。没密钥或没网时自动降级离线 kuromoji（只补读音和词性，意思自己填）。</div>
    <div style={S.setNote}>当前版本：第 0 步验证版 · 数据存在本机 · 语言：日语<br/>云同步、拍照为后续版本。</div>
    <div style={S.setNote}>ことも（词崽）· 你遇到的词，才是你该学的词。</div>
  </div>);
}
const Row = ({ label, hint, children }) => (<div style={S.setRow}><div><div style={{ fontWeight: 800 }}>{label}</div><div style={{ fontSize: 12, color: C.inkSoft }}>{hint}</div></div>{children}</div>);
const Switch = ({ on, label, onClick }) => (<button className="pressable" style={{ ...S.switch, background: on ? C.matcha : "#d8cdbb" }} onClick={onClick}><span style={{ ...S.switchKnob, transform: on ? "translateX(20px)" : "translateX(0)" }} />{label && <span style={S.switchLabel}>{label}</span>}</button>);

const BackRow = ({ ctx, title }) => (<div style={S.backRow}><button className="pressable" style={S.backBtn} onClick={() => { ctx.play("tap"); ctx.setView("home"); }}>← 返回</button><h2 style={S.pageTitle}>{title}</h2></div>);

const S = {
  shell: { minHeight: "100vh", background: "linear-gradient(180deg,#fdf3e3 0%," + C.cream + " 45%)", color: C.ink, fontFamily: "'Zen Maru Gothic','PingFang SC','Microsoft YaHei',sans-serif", position: "relative", overflow: "hidden" },
  bg: { position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" },
  main: { position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto", padding: "8px calc(16px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))" },
  top: { position: "relative", zIndex: 2, maxWidth: 600, margin: "0 auto", padding: "calc(14px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 6px calc(16px + env(safe-area-inset-left))", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  brand: { display: "flex", alignItems: "center", gap: 9 },
  brandMark: { width: 38, height: 38, borderRadius: 12, background: C.honey, color: "#fff", display: "grid", placeItems: "center", fontSize: 19, fontWeight: 800, boxShadow: "0 4px 0 " + C.honeyDk },
  brandName: { fontWeight: 800, fontSize: 15 }, brandSub: { fontSize: 11, color: C.inkSoft },
  stats: { display: "flex", gap: 8, alignItems: "center" }, stat: { display: "flex", gap: 4, alignItems: "center" },
  statVal: { fontWeight: 800, fontSize: 15, lineHeight: 1 }, statLabel: { fontSize: 10, color: C.inkSoft },
  aiToggle: { border: "none", borderRadius: 10, padding: "6px 8px", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" },
  iconBtn: { border: "none", background: "#fff", borderRadius: 10, width: 32, height: 32, fontSize: 15, cursor: "pointer", boxShadow: "0 3px 0 #ecdcc4" },

  onbWrap: { position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "44px 22px", textAlign: "center" },
  onbLogo: { fontSize: 46, fontWeight: 800, color: C.honeyDk, letterSpacing: 2 },
  onbSub: { fontSize: 14, color: C.inkSoft, marginBottom: 24 },
  onbCard: { borderRadius: 24, padding: 22, textAlign: "left" },
  onbTitle: { fontSize: 20, fontWeight: 800, marginBottom: 6 }, onbHint: { fontSize: 13, color: C.inkSoft, marginBottom: 16, lineHeight: 1.6 },
  intGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  intBtn: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, border: "2.5px solid #ecdfca", background: "#fff", borderRadius: 16, padding: "16px 8px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 0 #efe2cd" },
  intOn: { borderColor: C.honey, background: "#fdf2e0", boxShadow: "0 4px 0 " + C.honeyDk },
  intLabel: { fontWeight: 800, fontSize: 14 }, intCheck: { position: "absolute", top: 6, right: 8, color: C.honeyDk, fontWeight: 800 },

  bigBtn: { width: "100%", background: C.matcha, color: "#fff", border: "none", borderRadius: 16, padding: "15px", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 6px 0 " + C.matchaDk, fontFamily: "inherit" },
  ghostBtn: { background: "#fff", color: C.inkSoft, border: "2.5px solid #ecdfca", borderRadius: 14, padding: "12px 16px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },

  nudge: { display: "flex", alignItems: "center", gap: 10, borderRadius: 16, padding: "11px 14px", marginBottom: 12, border: "2px solid rgba(0,0,0,.04)" },

  room: { position: "relative", background: "linear-gradient(180deg,#fbe9cf 0%,#f6dcb6 60%,#e9c79a 100%)", borderRadius: 28, padding: "18px 16px 20px", border: "4px solid #fff", boxShadow: "0 10px 0 #e3cba2, 0 14px 28px rgba(150,110,60,.16)", overflow: "hidden", minHeight: 250, marginBottom: 14 },
  window: { position: "absolute", top: 14, right: 16, width: 54, height: 54, background: "#bfe3f0", borderRadius: 14, border: "5px solid #fff" }, sun: { position: "absolute", top: 4, left: 6, fontSize: 18 },
  dPlant: { position: "absolute", bottom: 12, left: 14, fontSize: 28 }, dLamp: { position: "absolute", top: 12, left: 18, fontSize: 22 },
  bubble: { margin: "0 auto 6px", maxWidth: 260, background: "#fff", borderRadius: 16, padding: "9px 14px", fontSize: 13, fontWeight: 700, textAlign: "center", color: "#6a5640", boxShadow: "0 4px 0 #ecdcc4", position: "relative", zIndex: 2 },
  catWrap: { textAlign: "center", position: "relative", zIndex: 2, cursor: "pointer", marginTop: 4, minHeight: 110 },
  dCushion: { position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", fontSize: 38, opacity: .9 },
  matCushion: { width: 116, height: 22, background: "#d99a7c", borderRadius: "50%", margin: "0 auto", position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 12, opacity: .45, filter: "blur(1px)" },
  cat: { position: "relative", transition: "transform .5s", transformOrigin: "bottom center" }, catEmoji: { fontSize: 72, lineHeight: 1, display: "inline-block", animation: "bob 3.5s ease-in-out infinite" }, catFace: { fontSize: 13, fontWeight: 800, color: "#6a5640", marginTop: -6 },
  moodChip: { textAlign: "center", marginTop: 8, fontWeight: 800, fontSize: 13.5, color: "#7a6244", position: "relative", zIndex: 2 },
  segHint: { textAlign: "center", marginTop: 4, fontSize: 12, color: "#8a7254", position: "relative", zIndex: 2 },

  goalRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12, background: "#fff", border: "3px solid #f3e7d3", borderRadius: 18, padding: "12px 14px", boxShadow: "0 5px 0 #efe2cd" },
  goalTitle: { fontWeight: 800, fontSize: 14.5 }, goalSub: { fontSize: 11.5, color: C.inkSoft, marginTop: 3 },
  energyWrap: { display: "flex", gap: 4, flexShrink: 0 },
  energyBtn: { border: "2px solid #ecdfca", background: "#fff", borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: "pointer", fontFamily: "inherit" },
  energyOn: { background: "#fdf2e0", borderColor: C.honey },

  reviewRow: { display: "flex", gap: 9, marginBottom: 11 },
  reviewBig: { flex: 1, display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "3px solid #f3e7d3", borderRadius: 16, padding: "12px 13px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 5px 0 #efe2cd", color: C.ink },
  reviewSub: { fontSize: 11, color: C.inkSoft, marginTop: 2, fontWeight: 600 },
  toolRow: { display: "flex", gap: 9, marginBottom: 12 },
  toolBtn: { flex: 1, border: "none", borderRadius: 16, padding: "13px 4px", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, color: C.ink },
  toolIcon: { fontSize: 22 },
  statLine: { textAlign: "center", fontSize: 12.5, color: C.inkSoft, fontWeight: 600 },

  modalMask: { position: "fixed", inset: 0, background: "rgba(60,40,20,.45)", zIndex: 50, display: "grid", placeItems: "center", padding: 24 },
  modalCard: { background: C.paper, borderRadius: 24, padding: "26px 22px", textAlign: "center", maxWidth: 360, width: "100%", border: "4px solid #fff", boxShadow: "0 12px 40px rgba(0,0,0,.2)" },
  modalTitle: { fontWeight: 800, fontSize: 17, marginTop: 8 }, modalText: { fontSize: 15, color: "#6a5640", margin: "10px 0 18px", lineHeight: 1.6, fontStyle: "italic" },

  quizWrap: { display: "flex", flexDirection: "column", gap: 14, minHeight: "70vh" },
  quizHead: { display: "flex", alignItems: "center", gap: 10 }, quitX: { background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.inkSoft, fontWeight: 700 },
  progOuter: { flex: 1, height: 13, background: "#eaddc6", borderRadius: 99, overflow: "hidden" }, progInner: { height: "100%", background: "linear-gradient(90deg," + C.matcha + "," + C.matchaDk + ")", borderRadius: 99, transition: "width .4s" },
  hearts: { fontSize: 13, letterSpacing: -1, whiteSpace: "nowrap" },
  wrongBanner: { background: "#fbeae2", color: "#c4684f", borderRadius: 12, padding: "8px 14px", fontWeight: 800, fontSize: 13, textAlign: "center" },
  roundTag: { textAlign: "center", fontWeight: 800, fontSize: 14, color: "#b78a4e" },
  bigCard: { borderRadius: 24, padding: "28px 22px", textAlign: "center" },
  cardWord: { fontSize: 40, fontWeight: 800, cursor: "pointer", userSelect: "none", lineHeight: 1.25 }, cardSub: { fontSize: 16, color: C.inkSoft, marginTop: 6 },
  optGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  opt: { border: "2.5px solid #ecdfca", borderRadius: 16, padding: "16px 12px", cursor: "pointer", textAlign: "center", transition: "all .12s", boxShadow: "0 4px 0 #efe2cd", background: "#fff" },
  optWide: { border: "2.5px solid #ecdfca", borderRadius: 14, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all .12s", boxShadow: "0 4px 0 #efe2cd", background: "#fff" },
  fb: { borderRadius: 14, padding: "12px 16px", fontWeight: 700, fontSize: 14, background: "#fbeae2" },
  matchCard: { borderRadius: 22, padding: 16 }, matchCols: { display: "flex", gap: 12 }, matchCol: { flex: 1, display: "flex", flexDirection: "column", gap: 8 },
  colHead: { textAlign: "center", fontWeight: 800, fontSize: 13, color: C.inkSoft, marginBottom: 2 },
  tile: { border: "2.5px solid #ecdfca", borderRadius: 14, padding: "6px 8px", cursor: "pointer", textAlign: "center", background: "#fff", boxShadow: "0 3px 0 #efe2cd", fontFamily: "inherit", transition: "all .12s", height: 62, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tileSel: { borderColor: C.honey, background: "#fdf2e0", transform: "scale(1.03)" },
  tileDone: { borderColor: C.matcha, background: "#eaf4e0", color: C.matchaDk, cursor: "default", boxShadow: "none" },
  matchHint: { textAlign: "center", fontSize: 12, color: C.inkSoft, marginTop: 12 },

  results: { textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", paddingTop: 24 }, resTitle: { fontSize: 22, margin: 0, fontWeight: 800 },
  resGrid: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }, resStat: { borderRadius: 16, padding: "12px 16px", minWidth: 90 },
  streakLine: { fontSize: 13, color: C.inkSoft, fontWeight: 700 },

  segRow: { display: "flex", gap: 6, marginBottom: 14 },
  seg: { flex: 1, border: "2.5px solid #ecdfca", background: "#fff", borderRadius: 12, padding: "10px 4px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", color: C.inkSoft, fontSize: 13 },
  segOn: { background: C.honey, color: "#fff", borderColor: C.honey, boxShadow: "0 4px 0 " + C.honeyDk },
  padCard: { borderRadius: 18, padding: 15, display: "flex", flexDirection: "column", gap: 11 },
  howto: { fontSize: 13, color: "#7a6244", lineHeight: 1.6 }, tip: { fontSize: 12, color: C.inkSoft },
  warnBox: { background: "#fbeae2", color: "#b06a52", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700 },
  field: { flex: 1, minWidth: 80, border: "2.5px solid #ecdfca", borderRadius: 13, padding: "12px 13px", fontSize: 15, outline: "none", fontFamily: "inherit", background: "#fff", boxSizing: "border-box" },
  addBtn: { background: C.honey, color: "#fff", border: "none", borderRadius: 13, width: 50, fontSize: 22, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 0 " + C.honeyDk, fontFamily: "inherit", flexShrink: 0 },
  micBtn: { color: "#fff", border: "none", borderRadius: 18, padding: "20px", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, fontFamily: "inherit" },
  heardBox: { background: "#fdf2e0", borderRadius: 13, padding: "11px 15px", fontSize: 15, fontWeight: 700, color: C.ink },

  list: { display: "flex", flexDirection: "column", gap: 10 },
  draftRow: { display: "flex", flexDirection: "column", gap: 9, borderRadius: 14, padding: 13 },
  draftHead: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 },
  draftExpand: { background: "#f4fbee", border: "2px solid #cdeccd", borderRadius: 10, padding: "7px 11px", fontSize: 12.5, fontWeight: 800, color: C.matchaDk, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 },
  draftPos: { border: "2px solid #ecdfca", borderRadius: 10, padding: "8px 10px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, background: "#fff", color: C.ink, flexShrink: 0 },
  draftStar: { background: "#fff", border: "2px solid #ecdfca", borderRadius: 10, padding: "7px 11px", fontSize: 12.5, fontWeight: 800, color: C.inkSoft, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 },
  draftStarOn: { background: "#fff5e6", borderColor: C.honey, color: C.honeyDk },
  draftDel: { background: "#fff", border: "2px solid #f0ddd5", borderRadius: 10, padding: "7px 11px", fontSize: 12.5, fontWeight: 800, color: C.blush, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 },
  draftField: { display: "flex", alignItems: "center", gap: 9 },
  draftLabel: { width: 32, flexShrink: 0, fontSize: 12.5, fontWeight: 800, color: "#7a6244" },
  draftIn: { flex: 1, minWidth: 0, border: "2px solid #ecdfca", borderRadius: 10, padding: "10px 12px", fontSize: 15, outline: "none", fontFamily: "inherit", background: "#fff", boxSizing: "border-box" },

  chipWrap: { display: "flex", flexWrap: "wrap", gap: 8 },
  wordChip: { border: "2px solid #ecdfca", background: "#fff", borderRadius: 12, padding: "9px 13px", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 3px 0 #efe2cd" },
  expandHead: { fontWeight: 800, fontSize: 19, margin: "4px 0 8px" },
  relGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  relChip: { display: "flex", alignItems: "center", gap: 6, border: "2px solid #ecdfca", background: "#fff", borderRadius: 12, padding: "9px 10px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 3px 0 #efe2cd" },
  relChipOn: { borderColor: C.matcha, background: "#eaf4e0" },
  selAllBtn: { border: "2px solid #ecdfca", background: "#fff", borderRadius: 9, padding: "4px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.matchaDk },
  harvestRow: { display: "flex", gap: 10, alignItems: "flex-start", border: "2px solid #ecdfca", borderRadius: 12, padding: "10px 12px", cursor: "pointer", marginBottom: 8, background: "#fff" },
  harvestOn: { borderColor: C.matcha, background: "#eaf4e0" }, checkbox: { fontSize: 17, flexShrink: 0 },

  wordRow: { display: "flex", alignItems: "center", gap: 11, borderRadius: 15, padding: "11px 13px" },
  dot: { width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", fontSize: 17, flexShrink: 0, cursor: "pointer" },
  wTerm: { fontSize: 18, fontWeight: 800, marginRight: 7 }, wReading: { fontSize: 12.5, color: C.inkSoft },
  wStat: { display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0 },
  statPill: { fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 7, background: "#eef2e6", color: C.matchaDk, whiteSpace: "nowrap" },
  editPanel: { borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10, marginTop: -4 },
  editRow: { display: "flex", alignItems: "center", gap: 10 }, editLabel: { fontSize: 12.5, fontWeight: 800, color: "#7a6244", width: 38, flexShrink: 0 },
  toggle: { border: "2px solid #ecdfca", background: "#fff", borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: C.inkSoft, flex: 1, textAlign: "left" },
  toggleOn: { background: "#eaf4e0", borderColor: C.matcha, color: C.matchaDk },
  hlDot: { width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 11, color: C.inkSoft },
  editInput: { flex: 1, border: "2px solid #ecdfca", borderRadius: 10, padding: "8px 10px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  exLine: { fontSize: 13, color: C.ink, padding: "3px 0", cursor: "pointer" },
  delBtn: { background: "#fbeae2", color: "#c4684f", border: "none", borderRadius: 10, padding: "10px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginTop: 4 },

  statCards: { display: "flex", gap: 10, marginBottom: 14 }, statCard: { flex: 1, borderRadius: 16, padding: "13px 8px", textAlign: "center" },
  statBig: { fontSize: 23, fontWeight: 800 }, statSmall: { fontSize: 11, color: C.inkSoft, fontWeight: 700, marginTop: 2 },
  sortRow: { display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: C.inkSoft, fontWeight: 700, marginBottom: 12 },
  sortChip: { border: "2px solid #ecdfca", background: "#fff", borderRadius: 99, padding: "5px 11px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#7a6244" },
  sortOn: { background: C.matchaDk, color: "#fff", borderColor: C.matchaDk },
  filterRow: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 },
  chip: { border: "2px solid #ecdfca", background: "#fff", borderRadius: 99, padding: "6px 11px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#7a6244" },
  chipOn: { background: C.wood, color: "#fff", borderColor: C.wood },

  calCard: { borderRadius: 18, padding: 14, marginBottom: 4 }, calTitle: { fontWeight: 800, fontSize: 13.5, color: "#7a6244", marginBottom: 10, textAlign: "center" },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 },
  calW: { textAlign: "center", fontSize: 11, color: C.inkSoft, fontWeight: 700, padding: "2px 0" },
  calCell: { aspectRatio: "1", borderRadius: 7, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 },
  calLegend: { display: "flex", gap: 14, justifyContent: "center", marginTop: 10, fontSize: 11, color: C.inkSoft, fontWeight: 700 },

  setCard: { borderRadius: 18, padding: 6, marginBottom: 14 },
  setRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 12px", borderBottom: "1px solid #f3e7d3" },
  switch: { position: "relative", width: 46, height: 26, borderRadius: 99, border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 3 },
  switchKnob: { width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "transform .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" },
  switchLabel: { position: "absolute", left: 8, color: "#fff", fontSize: 11, fontWeight: 800 },
  setNote: { fontSize: 12, color: C.inkSoft, textAlign: "center", lineHeight: 1.7, marginTop: 10 },

  backRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: { border: "2.5px solid #ecdfca", background: "#fff", borderRadius: 13, padding: "8px 13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 3px 0 #efe2cd" },
  pageTitle: { fontSize: 17, margin: 0, fontWeight: 800 },
  sectTitle: { fontWeight: 800, fontSize: 13.5, color: "#7a6244", margin: "8px 0 8px" },
  empty: { textAlign: "center", color: C.inkSoft, padding: 22, fontWeight: 700 },
};

const CSS = "\
@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=swap');\
* { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }\
body { margin: 0; }\
.card { background:#fff; border:3px solid #f3e7d3; box-shadow:0 6px 0 #efe2cd; }\
.cloud { position:absolute; font-size:36px; opacity:.4; animation:floatX 30s linear infinite; }\
.c1 { top:5%; left:-12%; } .c2 { top:15%; left:-32%; animation-delay:-15s; font-size:26px; }\
.pressable { transition:transform .07s; } .pressable:active { transform:translateY(2px) scale(.98); } .pressable:disabled { cursor:not-allowed; opacity:.55; }\
.fade-in { animation:fade .35s ease both; }\
.slide-up { animation:slideUp .3s ease both; } .pop-in { animation:pop .4s cubic-bezier(.2,1.4,.4,1) both; }\
.shake { animation:shake .4s; } .float-soft { animation:floatSoft 3s ease-in-out infinite; }\
.breathe2 { animation:breathe2 1.5s ease-in-out infinite; }\
.pulse-rec { animation:pulseRec 1.1s ease-in-out infinite; }\
@keyframes bob { 0%,100%{transform:translateY(0) scale(1);} 50%{transform:translateY(-3px) scale(1.03);} } \
@keyframes breathe2 { 0%,100%{transform:scale(1) rotate(-2deg);} 50%{transform:scale(1.07) rotate(2deg);} }\
@keyframes fade { from{opacity:0;transform:translateY(7px);} }\
@keyframes slideUp { from{opacity:0;transform:translateY(10px);} }\
@keyframes pop { from{opacity:0;transform:scale(.85);} }\
@keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-6px);} 75%{transform:translateX(6px);} }\
@keyframes floatSoft { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-4px);} }\
@keyframes floatX { from{transform:translateX(0);} to{transform:translateX(150vw);} }\
@keyframes pulseRec { 0%,100%{box-shadow:0 0 0 0 rgba(232,155,134,.5);} 50%{box-shadow:0 0 0 10px rgba(232,155,134,0);} }\
";
