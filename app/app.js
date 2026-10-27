// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Kinar

"use strict";

(() => {
  const D = window.CHEM_DATA;
  const $ = s => document.querySelector(s);

  if (!D) {
    document.body.innerHTML =
      '<div class="nodata"><p>Нет data.js, запусти Обновить данные.bat</p></div>';
    return;
  }
  const R = D.reagents;
  const X = D.reactions;
  const RX = {};
  const producers = {};
  const usedIn = {};
  for (const r of X) {
    RX[r.id] = r;
    for (const p in r.p) (producers[p] = producers[p] || []).push(r);
    for (const k in r.r) (usedIn[k] = usedIn[k] || []).push(r);
  }
  const specials = X.filter(r => !Object.keys(r.p).length);

  const TABS = [
    { id: "drink", label: "Напитки", icon: "🍸" },
    { id: "chem", label: "Химия", icon: "⚗" },
    { id: "food", label: "Кухня", icon: "🍳" },
    { id: "fav", label: "Избранное", icon: "★" },
    { id: "hist", label: "Недавние", icon: "🕘" },
  ];

  const SUBS = {
    drink: [["alcohol", "Алкогольные"], ["soft", "Безалкогольные"]],
    chem: [
      ["medicine", "Медицина"], ["toxins", "Токсины"], ["narcotics", "Наркотики"],
      ["chemicals", "Химикаты"], ["pyro", "Пиротехника"], ["elements", "Элементы"],
      ["gases", "Газы"], ["botany", "Ботаника"], ["bio", "Биология"],
      ["cleaning", "Уборка"], ["special", "Особые"], ["fun", "Разное"],
      ["other", "Прочее"], ["reactions", "Реакции-эффекты"],
    ],
    food: [["food", "Кухня"]],
  };
  const SUB_LABEL = Object.fromEntries(Object.values(SUBS).flat());

  const MIX = {
    Stir: { text: "Помешать ложкой", hint: "ложкой или другой утварью" },
    Shake: { text: "Взболтать в шейкере", hint: "налить в шейкер и взболтать" },
    Electrolysis: { text: "Электролизёр", hint: "поставить в электролизёр" },
    Centrifuge: { text: "Центрифуга", hint: "поставить в центрифугу" },
    Holy: { text: "Освятить Библией", hint: "ударить Библией (капеллан)" },
  };

  const SRC = {
    chem: "Хим. раздатчик",
    booze: "Алко-раздатчик",
    soda: "Сода-раздатчик",
    kitchen: "Кухонный раздатчик",
  };

  const HINTS = {
    Water: "Раковина, водяной бак, кран",
    Blood: "Шприцем из живого существа",
    Plasma: "Измельчить лист или руду плазмы",
    WeldingFuel: "Бак со сварочным топливом",
    Milk: "Подоить корову, кухонный раздатчик",
    MilkGoat: "Подоить козу",
    Nutriment: "Измельчить почти любую еду",
    Silver: "Измельчить серебро (лист/руду)",
    Gold: "Измельчить золото (лист/руду)",
  };

  const FX = {
    explosion: ["Взрыв!", "danger"],
    smoke: ["Дым", "warn"],
    foam: ["Пена", "warn"],
    emp: ["ЭМИ", "danger"],
    flash: ["Вспышка", "warn"],
    thermal: ["Меняет температуру", "warn"],
    other: ["Особый эффект", "warn"],
  };

  const PRESETS = [10, 15, 30, 50, 100, 300];
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem("chemcalc." + k);
        return v == null ? d : JSON.parse(v);
      } catch { return d; }
    },
    set(k, v) {
      try { localStorage.setItem("chemcalc." + k, JSON.stringify(v)); } catch {}
    },
  };

  const S = {
    tab: store.get("tab", "chem"),
    sub: store.get("sub", "all"),
    mode: "name",
    q: "",
    sel: null,
    cursor: -1,
    items: [],
    amount: store.get("amount", 30),
    recipeFor: store.get("recipeFor", {}),
    have: new Set(store.get("have", [])),
    fav: new Set(store.get("fav", [])),
    hist: store.get("hist", []),
    showBase: store.get("showBase", false),
    whole: store.get("whole", true),
    theme: store.get("theme", "dark"),
  };

  const save = () => {
    store.set("tab", S.tab);
    store.set("sub", S.sub);
    store.set("amount", S.amount);
    store.set("recipeFor", S.recipeFor);
    store.set("have", [...S.have]);
    store.set("fav", [...S.fav]);
    store.set("hist", S.hist);
    store.set("showBase", S.showBase);
    store.set("whole", S.whole);
    store.set("theme", S.theme);
  };
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const nm = id => cap((R[id] && R[id].n) || id);
  const norm = s => String(s).toLowerCase().replace(/ё/g, "е");
  const fmt = x => String(Math.round(x * 100) / 100);
  const ceil2 = x => Math.ceil(x * 100 - 1e-6) / 100;
  const toC = k => Math.round((k - 273.15) * 10) / 10;
  const color = id => (R[id] && R[id].c) || "#888";
  const craftable = id => !!producers[id];
  const isBase = id => !!(R[id] && R[id].src && R[id].src.length);
  const listed = id => S.showBase || (craftable(id) && !isBase(id));
  const humanize = id => id.replace(/([a-zа-я])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

  const FX_WORD = { explosion: "Взрыв", smoke: "Дым", foam: "Пена", emp: "ЭМИ", flash: "Вспышка", thermal: "Нагрев" };
  function specialTitle(r) {
    if (r.spawn) return "Создание: " + r.spawn.join(", ");
    const f = (r.fx || [])[0];
    const word = !f ? null : f.startsWith("gas:") ? "Газ " + f.slice(4) : FX_WORD[f] || "Эффект";
    const what = Object.keys(r.r).filter(k => !r.r[k].k).map(nm).join(" + ");
    return word ? `${word}: ${what}` : humanize(r.id);
  }
  const titleOf = key => (key[0] === "r" ? nm(key.slice(2)) : specialTitle(RX[key.slice(2)]));
  const validKey = key => (key[0] === "r" ? !!R[key.slice(2)] : !!RX[key.slice(2)]);

  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 1600);
  }
  const costMemo = {};

  function leafCost(id) {
    if (isBase(id)) return 0;
    if (R[id] && R[id].ex) return 2;
    return 6;
  }

  function cost(id, stack) {
    if (isBase(id) || !producers[id]) return leafCost(id);
    if (stack.has(id)) return 99;
    if (id in costMemo) return costMemo[id];
    stack.add(id);
    let best = Infinity;
    for (const r of producers[id]) best = Math.min(best, recipeCost(r, id, stack));
    stack.delete(id);
    costMemo[id] = best;
    return best;
  }

  function recipeCost(r, id, stack) {
    if (id in r.r) return 200; // сам себя жрёт
    let c = 1;
    if (r.src) c += 3;
    if (r.tmin || r.tmax) c += 0.5;
    if (r.mix && r.mix.some(m => m === "Electrolysis" || m === "Centrifuge" || m === "Holy")) c += 1;
    if (r.fx && r.fx.some(f => f === "explosion" || f === "emp" || f === "smoke" || f === "foam")) c += 5;
    for (const k in r.r) c += cost(k, stack);
    return c;
  }

  const bestMemo = {};
  function bestRecipe(id) {
    if (bestMemo[id]) return bestMemo[id];
    let best = null, bc = Infinity;
    for (const r of producers[id] || []) {
      const c = recipeCost(r, id, new Set([id]));
      if (!best || c < bc || (c === bc && r.p[id] > best.p[id])) { best = r; bc = c; }
    }
    bestMemo[id] = best;
    return best;
  }

  function recipeOf(id) {
    const o = S.recipeFor[id];
    if (o && RX[o] && id in RX[o].p) return RX[o];
    return bestRecipe(id);
  }
  const ROOT = "§root";

  function makePlan(rootRec, target, amount) {
    const forced = new Set();
    for (let i = 0; i < 20; i++) {
      const res = tryPlan(rootRec, target, amount, forced);
      if (!res.cycle) return res;
      forced.add(res.cycle);
    }
    return tryPlan(rootRec, target, amount, forced);
  }

  function tryPlan(rootRec, target, amount, forced) {
    const recOf = id => (id === ROOT ? rootRec : recipeOf(id));
    const expand = id => id === ROOT || (!forced.has(id) && craftable(id) && !isBase(id) && !S.have.has(id));

    const state = {};
    const post = [];
    let cycle = null;

    (function dfs(id) {
      state[id] = 1;
      if (expand(id)) {
        for (const k in recOf(id).r) {
          if (cycle) return;
          if (state[k] === 1) { cycle = k; return; }
          if (!state[k]) dfs(k);
        }
      }
      state[id] = 2;
      post.push(id);
    })(ROOT);

    if (cycle) return { cycle };

    const whole = rec => rec.q || S.whole;
    let rootUnits = target ? amount / rootRec.p[target] : amount;
    if (whole(rootRec)) rootUnits = Math.ceil(rootUnits - 1e-9);

    const demand = {};
    const units = {};
    const catalyst = {};
    const catalystOnly = {};
    const need = id => (demand[id] || 0) + (catalyst[id] || 0);
    for (const id of post.slice().reverse()) {
      if (!expand(id)) continue;
      const rec = recOf(id);
      let u = rootUnits;
      if (id !== ROOT) {
        u = need(id) / rec.p[id];
        if (whole(rec)) u = Math.ceil(u - 1e-9);
      }
      units[id] = u;
      for (const k in rec.r) {
        if (rec.r[k].k) {
          catalyst[k] = Math.max(catalyst[k] || 0, rec.r[k].a);
          if (!(k in catalystOnly)) catalystOnly[k] = true;
        } else {
          demand[k] = (demand[k] || 0) + rec.r[k].a * u;
          catalystOnly[k] = false;
        }
      }
    }

    const steps = [];
    const stepOf = {};
    for (const id of post) {
      if (!expand(id)) continue;
      const rec = recOf(id);
      const u = units[id];
      stepOf[id] = steps.length + 1;
      steps.push({
        id: id === ROOT ? target : id,
        root: id === ROOT,
        rec,
        units: u,
        inputs: Object.entries(rec.r).map(([k, v]) => ({ id: k, q: v.k ? v.a : ceil2(v.a * u), cat: !!v.k })),
        outputs: Object.entries(rec.p).map(([k, v]) => ({ id: k, q: Math.round(v * u * 100) / 100 })),
      });
    }

    const leaves = post
      .filter(id => id !== ROOT && !expand(id))
      .map(id => ({ id, q: ceil2(need(id)), cat: !!catalystOnly[id] }))
      .sort((a, b) => b.q - a.q);

    return { steps, stepOf, leaves, rootUnits, target, rootRec };
  }
  function tabItems() {
    if (S.tab === "fav") return [...S.fav].filter(validKey);
    if (S.tab === "hist") return S.hist.filter(validKey);
    const out = [];
    for (const id in R) {
      const r = R[id];
      if (r.cat !== S.tab) continue;
      if (!listed(id)) continue;
      if (S.sub !== "all" && r.sub !== S.sub) continue;
      out.push("r:" + id);
    }
    out.sort((a, b) => titleOf(a).localeCompare(titleOf(b), "ru"));
    if (S.tab === "chem" && (S.sub === "all" || S.sub === "reactions")) {
      const sp = specials.map(r => "x:" + r.id);
      sp.sort((a, b) => titleOf(a).localeCompare(titleOf(b), "ru"));
      out.push(...sp);
    }
    return out;
  }

  function score(term, strs) {
    let best = 0;
    for (const s of strs) {
      if (!s) continue;
      const n = norm(s);
      if (n === term) best = Math.max(best, 100);
      else if (n.startsWith(term)) best = Math.max(best, 60);
      else if (n.includes(" " + term)) best = Math.max(best, 40);
      else if (n.includes(term)) best = Math.max(best, 20);
    }
    return best;
  }

  const reagentStrs = id => [R[id] ? R[id].n : id, R[id] ? R[id].en : id, id];

  function searchItems(q) {
    const found = new Map();
    const add = (key, s) => found.set(key, Math.max(found.get(key) || 0, s));

    if (S.mode === "name") {
      const t = norm(q.trim());
      for (const id in R) {
        const s = score(t, reagentStrs(id));
        if (s) add("r:" + id, s + (craftable(id) ? 5 : 0));
      }
      for (const r of specials) {
        const s = score(t, [specialTitle(r), r.id]);
        if (s) add("x:" + r.id, s);
      }
    } else {
      const terms = q.split(/[,+;]/).map(t => norm(t.trim())).filter(Boolean);
      for (const r of X) {
        let total = 0;
        let ok = true;
        for (const t of terms) {
          let best = 0;
          for (const k in r.r) best = Math.max(best, score(t, reagentStrs(k)));
          if (!best) { ok = false; break; }
          total += best;
        }
        if (!ok) continue;
        const prods = Object.keys(r.p);
        if (prods.length) prods.forEach(p => add("r:" + p, total));
        else add("x:" + r.id, total);
      }
    }

    return [...found]
      .sort((a, b) => b[1] - a[1] || titleOf(a[0]).localeCompare(titleOf(b[0]), "ru"))
      .slice(0, 400)
      .map(x => x[0]);
  }

  function rowHtml(key, i) {
    const id = key.slice(2);
    const sel = S.sel === key ? " sel" : "";
    const cur = i === S.cursor ? " cur" : "";
    const star = S.fav.has(key) ? '<span class="star">★</span> ' : "";
    if (key[0] === "x") {
      const r = RX[id];
      const parts = Object.keys(r.r).map(nm).join(" + ");
      return `<li class="row${sel}${cur}" data-go="${esc(key)}"><span class="dot" style="--c:transparent;border-style:dashed"></span>` +
        `<span class="t"><b>${esc(specialTitle(r))}</b><small>${esc(parts)}</small></span>` +
        `<span class="meta">${star}эффект</span></li>`;
    }
    const r = R[id];
    const searching = !!S.q.trim() || S.tab === "fav" || S.tab === "hist";
    let meta = "";
    if (searching) meta = SUB_LABEL[r.sub] || "";
    if (!craftable(id)) meta = (meta ? meta + " · " : "") + "база";
    return `<li class="row${sel}${cur}" data-go="${esc(key)}"><span class="dot" style="--c:${esc(r.c)}"></span>` +
      `<span class="t"><b>${esc(cap(r.n))}</b><small>${esc(r.en)}</small></span>` +
      `<span class="meta">${star}${esc(meta)}</span></li>`;
  }

  function renderTabs() {
    $("#tabs").innerHTML = TABS.map(t => {
      let n = "";
      if (t.id === "fav") n = S.fav.size;
      else if (t.id === "hist") n = S.hist.length;
      else {
        n = 0;
        for (const id in R) if (R[id].cat === t.id && listed(id)) n++;
        if (t.id === "chem") n += specials.length;
      }
      const on = !S.q.trim() && S.tab === t.id ? " on" : "";
      return `<button class="${on}" data-tab="${t.id}">${t.icon} ${t.label}<span class="n">${n}</span></button>`;
    }).join("");
  }

  function renderSubs() {
    const subs = SUBS[S.tab];
    if (!subs || S.q.trim() || subs.length < 2) { $("#subs").innerHTML = ""; return; }
    const counts = {};
    let all = 0;
    for (const id in R) {
      const r = R[id];
      if (r.cat !== S.tab || !listed(id)) continue;
      counts[r.sub] = (counts[r.sub] || 0) + 1;
      all++;
    }
    if (S.tab === "chem") { counts.reactions = specials.length; all += specials.length; }
    const chip = (id, label, n) =>
      `<button class="chip${S.sub === id ? " on" : ""}" data-sub="${id}">${label}<span class="n">${n}</span></button>`;
    $("#subs").innerHTML = chip("all", "Все", all) +
      subs.filter(([id]) => counts[id]).map(([id, label]) => chip(id, label, counts[id])).join("");
  }

  function renderList() {
    const q = S.q.trim();
    S.items = q ? searchItems(q) : tabItems();
    if (S.cursor >= S.items.length) S.cursor = S.items.length - 1;
    let head = "";
    if (q && S.mode === "ingr") head = `<li class="hint">С ингредиентом <b>${esc(q)}</b>: ${S.items.length}</li>`;
    else if (q) head = `<li class="hint">Найдено: ${S.items.length}</li>`;
    let empty = '<li class="empty">Ничего не найдено</li>';
    if (!q && S.tab === "fav") empty = '<li class="empty">Пусто. Жми ☆ у рецепта</li>';
    if (!q && S.tab === "hist") empty = '<li class="empty">Пусто</li>';
    $("#list").innerHTML = head + (S.items.map(rowHtml).join("") || empty);
    renderTabs();
    renderSubs();
    $("#showBase").checked = S.showBase;
    $("#showBase").parentElement.style.display = ["fav", "hist"].includes(S.tab) && !q ? "none" : "";
  }

  function scrollCursor() {
    const el = $("#list .row.cur");
    if (el) el.scrollIntoView({ block: "nearest" });
  }
  function ingChip(id, q, opts = {}) {
    const cls = ["ing"];
    if (opts.cat) cls.push("cat");
    if (opts.main) cls.push("main");
    const from = opts.step ? `<span class="from">шаг ${opts.step}</span>` : "";
    const catTxt = opts.cat ? ' <span class="from" title="Катализатор не расходуется">катализатор</span>' : "";
    const qty = q != null ? `<span class="q">${fmt(q)}</span>` : "";
    return `<span class="${cls.join(" ")}" data-go="r:${esc(id)}"><span class="dot" style="--c:${esc(color(id))}"></span>` +
      `${qty}${esc(nm(id))}${catTxt}${from}</span>`;
  }

  function condHtml(rec) {
    const out = [];
    for (const m of rec.mix || []) {
      const mi = MIX[m] || { text: D.mixers[m] || m, hint: "" };
      out.push(`<span title="${esc(mi.hint)}">${esc(mi.text)}</span>`);
    }
    if (rec.tmin != null) out.push(`<span class="warn">Нагреть от ${fmt(rec.tmin)} K (${toC(rec.tmin)} °C)</span>`);
    if (rec.tmax != null) out.push(`<span class="warn">Не выше ${fmt(rec.tmax)} K (${toC(rec.tmax)} °C)</span>`);
    for (const f of rec.fx || []) {
      if (f.startsWith("gas:")) out.push(`<span class="warn">Выделяет газ: ${esc(f.slice(4))}</span>`);
      else {
        const [t, c] = FX[f] || FX.other;
        out.push(`<span class="${c}">${t}</span>`);
      }
    }
    if (rec.spawn) out.push(`<span>Появится: ${esc(rec.spawn.join(", "))}</span>`);
    if (rec.q) out.push(`<span title="Реакция идёт только целыми порциями">Только целые порции</span>`);
    return out.length ? `<div class="cond">${out.join("")}</div>` : "";
  }

  function sourceText(id) {
    const r = R[id];
    if (!r) return "";
    if (S.have.has(id)) return "уже есть у тебя";
    if (r.src && r.src.length) return r.src.map(s => SRC[s] || s).join(", ");
    if (HINTS[id]) return HINTS[id];
    if (r.ex && r.ex.length) {
      const e = r.ex[0];
      return (e[0] === "juice" ? "Соковыжималка: " : "Измельчить: ") + e[1] + (r.ex.length > 1 ? " и др." : "");
    }
    if (craftable(id)) return "можно сварить (см. рецепт)";
    return "добывается иначе";
  }

  function recipeLabel(rec, target) {
    const parts = Object.keys(rec.r).map(nm).join(" + ");
    const extra = [];
    if (rec.src) extra.push("распад");
    if (rec.mix) extra.push(rec.mix.map(m => (MIX[m] ? MIX[m].text : m)).join(", "));
    if (rec.tmin != null) extra.push("от " + fmt(rec.tmin) + "K");
    const out = target ? ` → ${fmt(rec.p[target])}` : "";
    return { parts, extra: extra.join(" · "), out };
  }

  function planHtml(plan) {
    const { steps, stepOf, leaves } = plan;
    let need = leaves.map(l => {
      const haveBtn = S.have.has(l.id)
        ? `<button class="btn small" data-have="${esc(l.id)}" title="Расписать по шагам">сварить самому</button>`
        : "";
      return `<li><span class="amt">${fmt(l.q)}</span><span class="what">${ingChip(l.id, null, { cat: l.cat })}` +
        `<span class="src">${esc(sourceText(l.id))}</span></span>${haveBtn}</li>`;
    }).join("");
    const total = leaves.reduce((s, l) => s + (l.cat ? 0 : l.q), 0);
    need = `<div class="card need"><h3>Что взять</h3><ul>${need || '<li>-</li>'}</ul>` +
      `<div class="total">Всего сырья: ${fmt(total)} ед. · шагов: ${steps.length}</div></div>`;

    const stepHtml = steps.map((s, i) => {
      const last = i === steps.length - 1;
      const n = i + 1;
      const ins = s.inputs.map(x => ingChip(x.id, x.q, { cat: x.cat, step: stepOf[x.id] && stepOf[x.id] !== n ? stepOf[x.id] : 0 }))
        .join('<span class="op">+</span>');
      const outs = s.outputs.map(x => ingChip(x.id, x.q, { main: x.id === s.id })).join('<span class="op">+</span>');

      let title;
      if (s.id) {
        const main = s.outputs.find(o => o.id === s.id);
        title = `${last ? "Готовим" : "Сварить"} <span class="link" data-go="r:${esc(s.id)}">${esc(nm(s.id))}</span>` +
          (main ? `, <span class="amt">${fmt(main.q)} ед.</span>` : "");
      } else {
        title = `Реакция, <span class="amt">${fmt(s.units)} порц.</span>`;
      }

      let tools = "";
      if (!s.root) {
        const prods = producers[s.id] || [];
        if (prods.length > 1) {
          tools += `<label>Рецепт: <select data-alt="${esc(s.id)}">` + prods.map(r => {
            const l = recipeLabel(r, s.id);
            return `<option value="${esc(r.id)}"${r === s.rec ? " selected" : ""}>${esc(l.parts + l.out)}${l.extra ? " (" + esc(l.extra) + ")" : ""}</option>`;
          }).join("") + "</select></label>";
        }
        tools += `<button class="btn small" data-have="${esc(s.id)}" title="Не расписывать этот реагент">у меня уже есть</button>`;
      }

      return `<li class="step${last ? " final" : ""}"><div class="num">${n}</div><div class="body card">` +
        `<div class="st-title">${title}</div>` +
        (tools ? `<div class="st-tools">${tools}</div>` : "") +
        `<div class="formula">${ins}<span class="op">→</span>${outs}</div>` +
        condHtml(s.rec) + `</div></li>`;
    }).join("");

    const notes = [];
    if (plan.target) {
      const made = plan.steps[plan.steps.length - 1].outputs.find(o => o.id === plan.target);
      if (made && made.q > S.amount + 1e-6) {
        notes.push(`Выйдет ${fmt(made.q)} ед. (округлено до целых порций)`);
      }
    }
    if (steps.length > 1) {
      notes.push("Промежуточные шаги лучше делать в отдельных мензурках, чтобы не пошли лишние реакции.");
    }

    return `<div class="plan">${need}<div><ol class="steps">${stepHtml}</ol>` +
      notes.map(t => `<div class="note">${esc(t)}</div>`).join("") + `</div></div>`;
  }

  function amountHtml(label) {
    return `<div class="amount"><span>${label}</span>` +
      `<input type="number" id="amt" min="1" max="100000" step="1" value="${S.amount}">` +
      `<div class="presets">${PRESETS.map(p => `<button class="btn small${p === S.amount ? " on" : ""}" data-amt="${p}">${p}</button>`).join("")}</div>` +
      `<label class="opt-inline" title="Округлять порции вверх до целых"><input type="checkbox" id="whole"${S.whole ? " checked" : ""}> целые ед.</label>` +
      `<span class="spacer"></span><button class="btn small" data-copy="1" title="Скопировать текстом">Скопировать</button></div>`;
  }

  function sourcesHtml(id) {
    const r = R[id];
    const items = [];
    for (const s of r.src || []) items.push(`<div>${esc(SRC[s] || s)}</div>`);
    for (const [kind, name, q] of r.ex || []) {
      items.push(`<div>${kind === "juice" ? "Соковыжималка" : "Измельчитель"}: <b>${esc(name)}</b> <small>${q ? "≈" + fmt(q) + " ед." : ""}</small></div>`);
    }
    if (HINTS[id]) items.push(`<div>${esc(HINTS[id])}</div>`);
    if (!items.length) return "";
    return `<h2>Где взять готовым</h2><div class="sources">${items.join("")}</div>`;
  }

  function usesHtml(id) {
    const list = usedIn[id] || [];
    if (!list.length) return "";
    const keys = new Set();
    for (const r of list) {
      const prods = Object.keys(r.p);
      if (prods.length) prods.forEach(p => p !== id && keys.add("r:" + p));
      else keys.add("x:" + r.id);
    }
    const chips = [...keys].sort((a, b) => titleOf(a).localeCompare(titleOf(b), "ru")).map(k =>
      k[0] === "r" ? ingChip(k.slice(2), null) : `<span class="ing" data-go="${esc(k)}">${esc(titleOf(k))}</span>`);
    return `<h2>Используется в (${chips.length})</h2><div class="uses">${chips.join("")}</div>`;
  }

  function headHtml(key, title, subtitle, c, tags) {
    const fav = S.fav.has(key);
    return `<div class="head"><div class="swatch" style="--c:${esc(c)}"></div><div class="grow">` +
      `<h1>${esc(title)}</h1><div class="sub">${subtitle}${tags}</div></div>` +
      `<div class="head-actions"><button class="btn${fav ? " on" : ""}" data-fav="${esc(key)}">${fav ? "★ В избранном" : "☆ В избранное"}</button></div></div>`;
  }

  let current = null;

  function renderDetail() {
    const el = $("#detail");
    if (!S.sel || !validKey(S.sel)) {
      current = null;
      el.innerHTML = welcomeHtml();
      return;
    }
    const key = S.sel;
    const id = key.slice(2);
    let h = "";

    if (key[0] === "r") {
      const r = R[id];
      const tags = [];
      tags.push(`<span class="tag">${esc(SUB_LABEL[r.sub] || r.sub)}</span>`);
      if (isBase(id)) tags.push(`<span class="tag ok">есть в раздатчике</span>`);
      if (!craftable(id)) tags.push(`<span class="tag warn">не варится</span>`);
      h += headHtml(key, cap(r.n), `<span>${esc(r.en)}</span><span class="tag">${esc(id)}</span>`, r.c, tags.join(""));
      if (r.d) h += `<p class="desc">${esc(r.d)}</p>`;

      const prods = producers[id] || [];
      if (prods.length) {
        const rec = recipeOf(id);
        const best = bestRecipe(id);
        h += `<h2>Рецепт${prods.length > 1 ? "ы (" + prods.length + ")" : ""}</h2>`;
        if (prods.length > 1) {
          h += `<div class="recipes">` + prods.map(p => {
            const l = recipeLabel(p, id);
            return `<button class="${p === rec ? "on" : ""}" data-rec="${esc(p.id)}">${esc(l.parts)}${esc(l.out)}` +
              `<small>${p === best ? "★ проще всего" : ""}${p === best && l.extra ? " · " : ""}${esc(l.extra)}</small></button>`;
          }).join("") + `</div>`;
        }
        h += amountHtml("Хочу получить, ед.:");
        h += `<div id="plan"></div>`;
        current = { key, rec, target: id, title: cap(r.n) };
      } else {
        current = null;
      }
      h += sourcesHtml(id);
      h += usesHtml(id);
    } else {
      const r = RX[id];
      const parts = Object.keys(r.r).map(nm).join(" + ");
      h += headHtml(key, specialTitle(r), `<span>${esc(parts)}</span><span class="tag">${esc(id)}</span>`,
        "transparent", `<span class="tag warn">реакция-эффект</span>`);
      h += `<p class="desc">Реагента не даёт, только эффект или предмет.</p>`;
      h += condHtml(r);
      h += `<h2>Рецепт</h2>` + amountHtml("Порций реакции:");
      h += `<div id="plan"></div>`;
      current = { key, rec: r, target: null, title: specialTitle(r) };
    }

    el.innerHTML = h;
    el.scrollTop = 0;
    renderPlan();
  }

  function renderPlan() {
    const box = $("#plan");
    if (!box || !current) return;
    current.plan = makePlan(current.rec, current.target, S.amount);
    box.innerHTML = planHtml(current.plan);
    document.querySelectorAll("[data-amt]").forEach(b => b.classList.toggle("on", +b.dataset.amt === S.amount));
  }

  function welcomeHtml() {
    const nR = Object.keys(producers).length;
    return `<div class="welcome"><h1>ChemCalc</h1>
      <p>Выбери что-нибудь слева.</p>
      <p><kbd>/</kbd> поиск, <kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd> выбор, <kbd>Esc</kbd> сброс.<br>
      По ингредиенту можно искать несколько через запятую: <i>водка, лёд</i></p>
      <p>${nR} реагентов, ${X.length} реакций</p></div>`;
  }
  function planText() {
    if (!current || !current.plan) return "";
    const p = current.plan;
    const lines = [];
    lines.push(current.target ? `${current.title}, ${fmt(S.amount)} ед.` : `${current.title}, ${fmt(S.amount)} порц.`);
    lines.push("");
    lines.push("Взять:");
    for (const l of p.leaves) lines.push(`  ${fmt(l.q)} ${nm(l.id)}${l.cat ? " (катализатор)" : ""} (${sourceText(l.id)})`);
    lines.push("");
    p.steps.forEach((s, i) => {
      const ins = s.inputs.map(x => `${fmt(x.q)} ${nm(x.id)}`).join(" + ");
      const outs = s.outputs.map(x => `${fmt(x.q)} ${nm(x.id)}`).join(" + ");
      const cond = [];
      for (const m of s.rec.mix || []) cond.push(MIX[m] ? MIX[m].text.toLowerCase() : m);
      if (s.rec.tmin != null) cond.push(`нагреть от ${fmt(s.rec.tmin)} K`);
      if (s.rec.tmax != null) cond.push(`не выше ${fmt(s.rec.tmax)} K`);
      lines.push(`${i + 1}. ${ins} → ${outs}${cond.length ? " [" + cond.join(", ") + "]" : ""}`);
    });
    return lines.join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast("Рецепт скопирован");
  }
  function select(key, fromHash) {
    if (!validKey(key)) return;
    S.sel = key;
    S.hist = [key, ...S.hist.filter(k => k !== key)].slice(0, 40);
    save();
    if (!fromHash && location.hash !== "#" + key) history.pushState(null, "", "#" + key);
    renderDetail();
    renderList();
  }

  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h && validKey(h)) select(h, true);
    else { S.sel = null; renderDetail(); renderList(); }
  }

  function applyTheme() {
    document.documentElement.dataset.theme = S.theme;
  }
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-go],[data-tab],[data-sub],[data-mode],[data-fav],[data-rec],[data-have],[data-amt],[data-copy]");
    if (!t) return;
    const d = t.dataset;
    if (d.go) select(d.go);
    else if (d.tab) {
      S.tab = d.tab;
      S.sub = "all";
      S.q = "";
      $("#q").value = "";
      S.cursor = -1;
      save();
      renderList();
      $("#list").scrollTop = 0;
    } else if (d.sub) {
      S.sub = d.sub;
      S.cursor = -1;
      save();
      renderList();
      $("#list").scrollTop = 0;
    } else if (d.mode) {
      S.mode = d.mode;
      document.querySelectorAll("#mode button").forEach(b => b.classList.toggle("on", b.dataset.mode === S.mode));
      $("#q").placeholder = S.mode === "name"
        ? "Поиск ( / )"
        : "водка, лёд";
      renderList();
      $("#q").focus();
    } else if (d.fav) {
      if (S.fav.has(d.fav)) S.fav.delete(d.fav);
      else S.fav.add(d.fav);
      save();
      renderDetail();
      renderList();
    } else if (d.rec) {
      S.recipeFor[S.sel.slice(2)] = d.rec;
      save();
      renderDetail();
    } else if (d.have) {
      if (S.have.has(d.have)) S.have.delete(d.have);
      else S.have.add(d.have);
      save();
      renderPlan();
    } else if (d.amt) {
      S.amount = +d.amt;
      const a = $("#amt");
      if (a) a.value = S.amount;
      save();
      renderPlan();
    } else if (d.copy) {
      copyText(planText());
    }
  });

  document.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset && t.dataset.alt) {
      S.recipeFor[t.dataset.alt] = t.value;
      save();
      renderPlan();
    } else if (t.id === "whole") {
      S.whole = t.checked;
      save();
      renderPlan();
    } else if (t.id === "showBase") {
      S.showBase = t.checked;
      save();
      renderList();
    }
  });

  document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "q") {
      S.q = t.value;
      S.cursor = S.q.trim() ? 0 : -1;
      renderList();
      $("#list").scrollTop = 0;
    } else if (t.id === "amt") {
      const v = parseFloat(t.value);
      if (v > 0 && v <= 100000) {
        S.amount = v;
        save();
        renderPlan();
      }
    }
  });

  document.addEventListener("keydown", e => {
    const q = $("#q");
    const inField = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName);
    if ((e.key === "/" && !inField) || (e.key.toLowerCase() === "k" && e.ctrlKey)) {
      e.preventDefault();
      q.focus();
      q.select();
      return;
    }
    if (document.activeElement === q || !inField) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!S.items.length) return;
        e.preventDefault();
        S.cursor = Math.max(0, Math.min(S.items.length - 1, S.cursor + (e.key === "ArrowDown" ? 1 : -1)));
        renderList();
        scrollCursor();
      } else if (e.key === "Enter" && S.cursor >= 0 && S.items[S.cursor]) {
        e.preventDefault();
        select(S.items[S.cursor]);
      } else if (e.key === "Escape" && document.activeElement === q) {
        q.value = "";
        S.q = "";
        S.cursor = -1;
        renderList();
      }
    }
  });

  $("#theme").addEventListener("click", () => {
    S.theme = S.theme === "dark" ? "light" : "dark";
    applyTheme();
    save();
  });

  window.addEventListener("hashchange", fromHash);
  applyTheme();
  document.querySelectorAll("#mode button").forEach(b => b.classList.toggle("on", b.dataset.mode === S.mode));
  $("#foot").innerHTML = 'Made by <span class="author">«Моника Широва»</span>, R&amp;D NanoMed-NT Inc.';
  $("#foot").title = `Данные: ${D.repo}, ${D.generated}`;
  fromHash();
})();
