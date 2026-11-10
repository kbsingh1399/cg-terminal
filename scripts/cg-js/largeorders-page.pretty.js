! function() {
  try {
    var e = "u" > typeof window ? window : "u" > typeof global ? global : "u" > typeof globalThis ? globalThis : "u" > typeof self ? self : {},
      t = (new e.Error).stack;
    t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "60118317-5e04-4442-8642-57637bd20bc1", e._sentryDebugIdIdentifier = "sentry-dbid-60118317-5e04-4442-8642-57637bd20bc1")
  } catch (e) {}
}(), (self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [2210], {
    10720: e => {
      e.exports = {
        button: "ui_button__YsSVH",
        compact: "ui_compact__F0G97",
        icon: "ui_icon__BEeGo",
        primary: "ui_primary__gDI_2",
        selected: "ui_selected__rjXEk",
        tabs: "ui_tabs__sbBWn",
        chip: "ui_chip__0K0mL",
        chipOff: "ui_chipOff__tDxYD",
        checkbox: "ui_checkbox__MQh_2",
        marker: "ui_marker__CeUtL",
        markerTri: "ui_markerTri__HqacO",
        markerDiamond: "ui_markerDiamond__Stbsq",
        select: "ui_select__YKSW6",
        caption: "ui_caption__JUsSu",
        menu: "ui_menu__OSzC6",
        content: "ui_content__KxzcH",
        menuSearch: "ui_menuSearch__uLGly",
        popBody: "ui_popBody__8Q_BP"
      }
    },
    16066: e => {
      e.exports = {
        root: "Faq_root__KvDV1",
        gl: "Faq_gl__1Qfgq",
        wa: "Faq_wa__qmq2x",
        wb: "Faq_wb__I4PrP",
        px: "Faq_px__nEIhm",
        ax: "Faq_ax__gpJIB",
        nt: "Faq_nt__TqsFV",
        ld: "Faq_ld__wLx6s",
        foot: "Faq_foot__rjnRJ"
      }
    },
    42920: e => {
      e.exports = {
        root: "faq_root__G_7G1",
        head: "faq_head__UJSJQ",
        h2: "faq_h2__ejc9Q",
        sub: "faq_sub__6pA28",
        card: "faq_card__nBKoF",
        hero: "faq_hero__G1N2E",
        heroOnly: "faq_heroOnly__d88ds",
        text: "faq_text__M6xGY",
        h3: "faq_h3__fZd5L",
        p: "faq_p__jFPiz",
        figure: "faq_figure__jVNWy",
        cap: "faq_cap__GcXhC",
        grid: "faq_grid__9kdYn",
        single: "faq_single__COHuT",
        col: "faq_col__6eWGV",
        gh: "faq_gh__iH5_s",
        item: "faq_item__asZuc",
        q: "faq_q__OivXU",
        qText: "faq_qText__y_qkJ",
        a: "faq_a__BAmGr"
      }
    },
    58001: (e, t, s) => {
      "use strict";
      s.d(t, {
        Rk: () => l,
        fG: () => r,
        jP: () => o,
        me: () => v,
        qv: () => n,
        zY: () => i
      });
      let a = {
          dark: {
            bg: "#0b0d11",
            surface: "#12151b",
            surface2: "#181c24",
            surface3: "#21262f",
            line: "#222833",
            lineStrong: "#313947",
            ink: "#f4f6f9",
            ink2: "#b7bfcc",
            ink3: "#8b94a3",
            segOn: "#ffffff",
            segOnInk: "#0f1522",
            segRing: "#ffffff",
            selMark: "#f4f6f9",
            accentInk: "#17120a",
            grid: "rgba(160,172,195,.075)",
            cross: "rgba(230,234,242,.35)"
          },
          light: {
            bg: "#fafbfc",
            surface: "#ffffff",
            surface2: "#f4f5f7",
            surface3: "#eceef2",
            line: "#e6e8ec",
            lineStrong: "#d2d6dd",
            ink: "#0f1522",
            ink2: "#4a5568",
            ink3: "#687386",
            segOn: "#111318",
            segOnInk: "#ffffff",
            segRing: "#111318",
            selMark: "#0f1522",
            accentInk: "#fff8e8",
            grid: "rgba(15,23,42,.055)",
            cross: "rgba(15,23,42,.45)"
          }
        },
        l = [
          ["bid", "colors.bid"],
          ["ask", "colors.ask"],
          ["up", "colors.up"],
          ["down", "colors.down"],
          ["accent", "colors.accent"]
        ],
        i = {
          dark: {
            bid: "#3ddc97",
            ask: "#ff5f7e",
            up: "#2ec27e",
            down: "#e9445f",
            accent: "#f0b90b"
          },
          light: {
            bid: "#0f9d63",
            ask: "#d7304f",
            up: "#0a8a52",
            down: "#c42a46",
            accent: "#c99400"
          }
        },
        r = [{
          id: "default",
          dark: i.dark,
          light: i.light
        }, {
          id: "exchange",
          dark: {
            bid: "#0ecb81",
            ask: "#f6465d",
            up: "#089981",
            down: "#f23645",
            accent: "#f0b90b"
          },
          light: {
            bid: "#03a66d",
            ask: "#dc3b4e",
            up: "#089981",
            down: "#f23645",
            accent: "#b8860b"
          }
        }, {
          id: "classic",
          dark: {
            bid: "#34d399",
            ask: "#f87171",
            up: "#d7dde8",
            down: "#6f7a90",
            accent: "#e4c17a"
          },
          light: {
            bid: "#1f8a5b",
            ask: "#c43d4f",
            up: "#334155",
            down: "#94a3b8",
            accent: "#8c6718"
          }
        }, {
          id: "amber",
          dark: {
            bid: "#f5d27a",
            ask: "#e06a2c",
            up: "#f5d27a",
            down: "#e06a2c",
            accent: "#e4c17a"
          },
          light: {
            bid: "#a9780f",
            ask: "#b8431a",
            up: "#a9780f",
            down: "#b8431a",
            accent: "#8c6718"
          }
        }, {
          id: "contrast",
          dark: {
            bid: "#00e676",
            ask: "#ff2d55",
            up: "#19f08a",
            down: "#ff3b5c",
            accent: "#ffd400"
          },
          light: {
            bid: "#0b7a3b",
            ask: "#be123c",
            up: "#047857",
            down: "#b91c1c",
            accent: "#b45309"
          }
        }],
        o = () => ({
          dark: {
            ...i.dark
          },
          light: {
            ...i.light
          },
          preset: {
            dark: "default",
            light: "default"
          }
        }),
        n = e => "string" == typeof e && /^#[0-9a-f]{6}$/i.test(e),
        d = e => [parseInt(e.slice(1, 3), 16), parseInt(e.slice(3, 5), 16), parseInt(e.slice(5, 7), 16)],
        c = e => "#" + e.map(e => Math.round(Math.max(0, Math.min(255, e))).toString(16).padStart(2, "0")).join(""),
        h = (e, t, s) => {
          let a = d(e),
            l = d(t);
          return c(a.map((e, t) => e + (l[t] - e) * s))
        },
        p = ([e, t, s]) => {
          let a = e => (e /= 255) <= .03928 ? e / 12.92 : Math.pow((e + .055) / 1.055, 2.4);
          return .2126 * a(e) + .7152 * a(t) + .0722 * a(s)
        },
        u = (e, t) => {
          let s = p(e),
            a = p(t);
          return (Math.max(s, a) + .05) / (Math.min(s, a) + .05)
        },
        f = (e, t) => {
          let [s, a, l] = d(e);
          return `rgba(${s},${a},${l},${t})`
        };

      function g(e, t, s) {
        let a = [.5, .62, .74, .87, 1].map(s => h(t, e, s));
        return a[4] = "dark" === s ? h(e, "#ffffff", .28) : h(e, "#000000", .22), a
      }
      let x = e => (e /= 255) <= .04045 ? e / 12.92 : Math.pow((e + .055) / 1.055, 2.4);

      function m(e) {
        let [t, s, a] = d(e).map(x), l = Math.cbrt(.4122214708 * t + .5363325363 * s + .0514459929 * a), i = Math.cbrt(.2119034982 * t + .6806995451 * s + .1073969566 * a), r = Math.cbrt(.0883024619 * t + .2817188376 * s + .6299787005 * a), o = 1.9779984951 * l - 2.428592205 * i + .4505937099 * r, n = .0259040371 * l + .7827717662 * i - .808675766 * r;
        return [.2104542553 * l + .793617785 * i - .0040720468 * r, Math.hypot(o, n), Math.atan2(n, o)]
      }

      function b(e, t, s) {
        let a = t * Math.cos(s),
          l = t * Math.sin(s),
          i = (e + .3963377774 * a + .2158037573 * l) ** 3,
          r = (e - .1055613458 * a - .0638541728 * l) ** 3,
          o = (e - .0894841775 * a - 1.291485548 * l) ** 3;
        return [4.0767416621 * i - 3.3077115913 * r + .2309699292 * o, -1.2684380046 * i + 2.6097574011 * r - .3413193965 * o, -.0041960863 * i - .7034186147 * r + 1.707614701 * o]
      }

      function w(e, t, s) {
        let [, a, l] = m(e), i = d(t), r = m(t)[0], o = e => (function(e, t, s) {
          let a = b(e, t, s);
          for (let l = 0; l < 24 && a.some(e => e < -1e-4 || e > 1.0001); l++) t *= .9, a = b(e, t, s);
          return "#" + a.map(e => {
            let t;
            return Math.round(255 * Math.min(1, Math.max(0, (t = Math.min(1, Math.max(0, e))) <= .0031308 ? 12.92 * t : 1.055 * Math.pow(t, 1 / 2.4) - .055))).toString(16).padStart(2, "0")
          }).join("")
        })(e, "dark" === s ? .92 * a : Math.min(a, .05 + (1 - e) * .42), l), n = e => u(d(o(e)), i);
        return ("dark" === s ? [2.9, 3.4, 4, 4.8, 5.8] : [1.75, 2, 2.3, 2.65, 3.1]).map(e => {
          let t = "dark" === s ? r : .25,
            a = "dark" === s ? .97 : r;
          for (let l = 0; l < 22; l++) {
            let l = (t + a) / 2;
            ("dark" === s ? n(l) >= e : n(l) < e) ? a = l: t = l
          }
          return o("dark" === s ? a : t)
        })
      }

      function v(e, t) {
        let s = "light" === e ? "light" : "dark",
          r = a[s],
          o = t && t[s] || i[s],
          h = {};
        for (let [e] of l) h[e] = function(e, t, s) {
          if (!n(e) || !n(t)) return e;
          let a = d(e),
            l = d(t),
            i = .3 > p(l);
          for (let e = 0; e < 30 && u(a, l) < s; e++) a = a.map(e => i ? e + (255 - e) * .1 : .9 * e);
          return c(a)
        }(n(o[e]) ? o[e] : i[s][e], r.surface, "accent" === e ? 2.2 : 3);
        let x = g(h.bid, r.bg, s),
          m = g(h.ask, r.bg, s),
          b = w(h.bid, r.surface, s),
          v = w(h.ask, r.surface, s),
          y = {
            mode: s,
            dark: "dark" === s,
            bg: r.bg,
            surface: r.surface,
            surface2: r.surface2,
            line: r.line,
            lineStrong: r.lineStrong,
            ink: r.ink,
            ink2: r.ink2,
            ink3: r.ink3,
            grid: r.grid,
            cross: r.cross,
            segOn: r.segOn,
            segOnInk: r.segOnInk,
            segRing: r.segRing,
            selMark: r.selMark,
            bid: h.bid,
            ask: h.ask,
            up: h.up,
            dn: h.down,
            accent: h.accent,
            accentInk: r.accentInk,
            bidT: x,
            askT: m
          },
          k = {
            "--lo-bid": h.bid,
            "--lo-ask": h.ask,
            "--lo-up": h.up,
            "--lo-down": h.down,
            "--lo-accent": h.accent,
            "--lo-accent-ink": r.accentInk,
            "--lo-accent-soft": f(h.accent, .14),
            "--lo-bid-soft": f(h.bid, .16),
            "--lo-ask-soft": f(h.ask, .16)
          };
        return b.forEach((e, t) => {
          k["--lo-bk-bid-" + (t + 1)] = e
        }), v.forEach((e, t) => {
          k["--lo-bk-ask-" + (t + 1)] = e
        }), x.forEach((e, t) => {
          k["--lo-bid-" + (t + 1)] = e
        }), m.forEach((e, t) => {
          k["--lo-ask-" + (t + 1)] = e
        }), {
          T: y,
          vars: k,
          effective: h
        }
      }
    },
    71014: (e, t, s) => {
      "use strict";
      s.r(t), s.d(t, {
        __N_SSP: () => tG,
        default: () => tX
      });
      var a = s(6029),
        l = s(63046),
        i = s(55729),
        r = s(81278),
        o = s(83617),
        n = s(79690),
        d = s(75227),
        c = s(60880),
        h = s(52416),
        p = s(58001);
      let u = e => Object.entries((0, p.me)(e, (0, p.jP)()).vars).map(([e, t]) => `${e}:${t};`).join(""),
        f = (0, h.A)("div")`
${u("dark")}
[data-joy-color-scheme="light"] & { ${u("light")} }
color: var(--glass-fg);
font-size: 14px;
line-height: 1.45;
padding: 0 16px 32px;
display: grid;
grid-template-columns: minmax(0, 1fr); /* no section (a long nowrap translation) can make the page wider than the window */
gap: 12px;
-webkit-font-smoothing: antialiased;
& *, & *::before, & *::after { box-sizing: border-box; }
& [hidden] { display: none !important; }
& button, & input { font-family: inherit; }
& b, & strong, & th { font-weight: 600; }
& .bid { color: var(--lo-bid); }
& .ask { color: var(--lo-ask); }
& .muted { color: var(--glass-fg-3); }
& .lo-spacer { flex: 1; }
& .lo-cap { font-size: 13px; font-weight: 500; color: var(--glass-fg-3); white-space: nowrap; }
& .lo-num { font-variant-numeric: tabular-nums; color: var(--glass-fg-2); font-weight: 500; }
& .lo-logo { width: 18px; height: 18px; border-radius: 50%; flex: none; display: inline-block; vertical-align: middle; object-fit: cover; }
/* light theme: a white disc and a hairline under the logo, so a yellow mark (Binance) still reads on the pink / green
   depth bars */
[data-joy-color-scheme="light"] & .lo-logo { background: var(--glass-surface); box-shadow: 0 0 0 1px var(--glass-line-2); }
& .lo-logo.sm { width: 16px; height: 16px; }
& .lo-logo.md { width: 22px; height: 22px; }
& .lo-logo.lg { width: 22px; height: 22px; }
& .lo-coin-ph { display: inline-grid; place-items: center; background: var(--glass-surface-3); color: var(--glass-fg-2); font-size: 10px; font-weight: 700; line-height: 1; }
& .lo-card { background: var(--glass-surface); border: 1px solid var(--glass-line); border-radius: 8px; min-width: 0; }
& .lo-empty { padding: 24px 14px; text-align: center; color: var(--glass-fg-3); font-size: 13.5px; }
& .lo-cnt { font-variant-numeric: tabular-nums; font-size: 11.5px; margin-left: 4px; opacity: .65; font-weight: 500; }
& .lo-tablab { display: inline-flex; align-items: center; } /* the count badge centred on the tab text */
& .lo-cnt.hot { opacity: 1; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; box-sizing: border-box; min-width: 18px; height: 16px; line-height: 1; padding: 0 5px 1px; border-radius: 8px; background: var(--lo-ask); color: #fff; font-weight: 600; } /* 1px at the bottom: the page font's tall ascent sits the digits half a pixel low */
@keyframes lo-flash { 0% { background: var(--lo-accent-soft); } 100% { background: transparent; } }

/* ===== top rail ===== */
& .lo-rail { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 52px; padding: 11px 0; border-bottom: 1px solid var(--glass-line); }
/* the filter rail stays at the top of the window while the page scrolls (not on phones, where it wraps to several rows) */
@media (min-width: 641px) { & .lo-rail { position: sticky; top: 0; z-index: 20; margin: 0 -16px; padding: 11px 16px; background: var(--cg-bg, var(--glass-bg)); /* the site page colour, so the stuck rail blends in */ } }
& .lo-rail h1 { margin: 0 6px 0 0; font-size: 17px; font-weight: 600; line-height: 1.4; white-space: nowrap; }
& .lo-exbtn { position: relative; gap: 8px; padding-right: 30px; }
& .lo-exbtn .lo-cap { color: var(--glass-fg-3); }
/* ui-kit's button wraps its children in [data-scope=btn-content]: the spacing goes on that row */
& .lo-exbtn [data-scope='btn-content'] { display: inline-flex; align-items: center; gap: 8px; }
& .lo-logos { display: inline-flex; align-items: center; }
& .lo-logos .lo-logo + .lo-logo { margin-left: -5px; box-shadow: 0 0 0 1.5px var(--glass-surface); }
& .lo-caret { position: absolute; right: 12px; top: 50%; width: 7px; height: 7px; margin-top: -5px; border-right: 1.5px solid var(--glass-fg-2); border-bottom: 1.5px solid var(--glass-fg-2); transform: rotate(45deg); }

/* ===== status band ===== */
& .lo-kpis { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 12px; }
& .lo-kpi { background: var(--glass-surface); border: 1px solid var(--glass-line); border-radius: 8px; padding: 14px 16px; min-width: 0; }
& .lo-kpi .lbl { display: block; font-size: 13px; line-height: 18px; color: var(--glass-fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
& .lo-kpi .venue { float: right; display: inline-flex; align-items: center; gap: 5px; margin-left: 8px; font-size: 12.5px; line-height: 18px; color: var(--glass-fg-3); white-space: nowrap; max-width: 62%; overflow: hidden; }
& .lo-kpi .venue span { overflow: hidden; text-overflow: ellipsis; }
& .lo-kpi .v { font-variant-numeric: tabular-nums; font-size: 32px; font-weight: 600; line-height: 38px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
& .lo-kpi .v.sm { font-size: 15px; line-height: 16px; min-height: 38px; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; align-content: center; } /* the four-quadrant read may take two lines in a narrow card */
& .lo-kpi .v small { font-size: 13px; font-weight: 500; }
& .lo-kpi .s { font-size: 13px; line-height: 18px; color: var(--glass-fg-2); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
& .lo-kpi .bar { height: 6px; border-radius: 3px; background: var(--lo-ask); overflow: hidden; margin-top: 8px; position: relative; }
& .lo-kpi .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--lo-bid); }

/* ===== chart row: chart card | side panel (as tall as the chart card, scrolls its own list) ===== */
& .lo-chart-row { display: grid; grid-template-columns: minmax(0, 1fr) 440px; gap: 12px; align-items: stretch; }
& .lo-chart-card { display: grid; gap: 6px; padding: 8px 10px 10px; }
& .lo-tbar, & .lo-panebar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
& .lo-tbar { gap: 4px; }
/* chip rows that fold into one button + menu on a phone: .lo-desk holds the row, .lo-phone the button */
& .lo-desk { display: contents; }
& .lo-phone { display: none; }
& .lo-foldbtn.lo-foldbtn { position: relative; padding-right: 26px; }
& .lo-foldbtn [data-scope='btn-content'] { display: inline-flex; align-items: center; gap: 6px; }
& .lo-foldbtn .lo-caret { right: 10px; }
& .lo-fold { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
& .lo-fold label { justify-content: flex-start; }
& .lo-phone-txt { display: none; }
& .lo-panebar { padding-top: 2px; }
& .lo-stage { /* @noflip */ direction: ltr; scroll-margin-top: 80px; position: relative; height: 720px; user-select: none; touch-action: none; cursor: crosshair; border-radius: 6px; overflow: hidden; outline: none; overscroll-behavior: contain; }
& .lo-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; transition: opacity .2s ease; }
& .lo-stage.loading canvas { opacity: .35; }
& .lo-watermark { position: absolute; /* @noflip */ right: 104px; bottom: 40px; width: 100px; color: var(--joy-cg-chartlogo); pointer-events: none; user-select: none; z-index: 1; }
& .lo-watermark svg { display: block; width: 100%; height: auto; }
& .lo-tip { position: absolute; pointer-events: none; background: color-mix(in srgb, var(--glass-menu) 96%, transparent); border: 1px solid var(--glass-menu-line); border-radius: 10px; padding: 12px 14px; font-size: 13px; min-width: 236px; box-shadow: var(--glass-menu-shadow); display: none; z-index: 4; }
& .lo-tip:has(.tw) { min-width: 316px; max-width: 360px; padding: 14px 16px; }
& .lo-tip .t { font-weight: 700; font-size: 14.5px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; justify-content: space-between; }
& .lo-tip .t .muted { font-weight: 500; font-size: 12.5px; }
& .lo-tip .g { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; color: var(--glass-fg-2); }
& .lo-tip .g span:nth-child(even) { font-variant-numeric: tabular-nums; color: var(--glass-fg); /* @noflip */ text-align: right; }
& .tw { display: flex; flex-direction: column; gap: 10px; font-size: 13.5px; }
& .tw-h { display: flex; align-items: center; gap: 10px; }
& .tw-h .lo-logo { width: 26px; height: 26px; }
& .tw-v { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
& .tw-v b { font-size: 15px; }
& .tw-v small { font-size: 12.5px; color: var(--glass-fg-3); }
& .tw-side { /* @noflip */ margin-left: auto; font-size: 12.5px; font-weight: 700; padding: 3px 9px; border-radius: 6px; white-space: nowrap; }
& .tw-side.bid { color: var(--lo-bid); background: var(--lo-bid-soft); }
& .tw-side.ask { color: var(--lo-ask); background: var(--lo-ask-soft); }
& .tw-price { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
& .tw-price > b { font-size: 24px; line-height: 1.1; font-variant-numeric: tabular-nums; }
& .tw-price > span { font-size: 13.5px; font-weight: 600; }
& .tw-price .lo-st { align-self: center; /* @noflip */ margin-left: auto; }
& .tw-bar { height: 6px; border-radius: 3px; background: var(--glass-surface-3); display: flex; overflow: hidden; }
& .tw-bar i { display: block; height: 100%; }
& .tw-bar .f { background: var(--glass-fg); }
& .tw-bar .c { background: var(--glass-fg-3); opacity: .6; }
& .tw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
& .tw-grid > div { background: var(--glass-surface-2); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
& .tw-grid span { font-size: 12px; color: var(--glass-fg-3); }
& .tw-grid b { font-size: 15px; font-variant-numeric: tabular-nums; white-space: nowrap; }
& .tw-grid small { font-size: 12px; color: var(--glass-fg-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
& .tw-foot { display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; color: var(--glass-fg-3); padding-top: 8px; border-top: 1px solid var(--glass-line); }
& .tw-foot b { color: var(--glass-fg-2); font-weight: 500; }
& .lo-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 5; }
& .lo-overlay .box { display: flex; align-items: center; gap: 10px; background: var(--glass-menu); border: 1px solid var(--glass-menu-line); border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 500; color: var(--glass-fg-2); box-shadow: var(--glass-menu-shadow); pointer-events: auto; }
& .lo-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--glass-line-2); border-top-color: var(--glass-fg); animation: lo-spin .8s linear infinite; }
@keyframes lo-spin { to { transform: rotate(360deg); } }
/* loading chip, top-right of the plot: a round spinner (+ progress ring) that slides its text out to the left on hover /
   focus / tap */
& .lo-notice { position: absolute; /* @noflip */ right: 8px; top: 8px; z-index: 4; display: flex; flex-direction: row-reverse; align-items: center; max-width: calc(100% - 16px); padding: 3px; border: 1px solid var(--glass-menu-line); border-radius: 999px; background: var(--glass-menu); box-shadow: var(--glass-menu-shadow); font-size: 12px; font-weight: 500; color: var(--glass-fg-2); white-space: nowrap; cursor: default; animation: lo-notice-in .18s ease-out; }
& .lo-notice:focus-visible { outline: 2px solid var(--glass-focus); outline-offset: 1px; }
& .lo-notice .ico { position: relative; flex: none; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; }
& .lo-notice .ico[style] { background: conic-gradient(var(--glass-fg-2) var(--p), var(--glass-surface-3) 0); }
& .lo-notice .ico[style]::before { content: ""; position: absolute; inset: 2px; border-radius: 50%; background: var(--glass-menu); }
& .lo-notice .ico .lo-spin { position: relative; width: 12px; height: 12px; border-width: 1.5px; }
& .lo-notice.err .ico { background: var(--lo-ask); color: #fff; font-weight: 700; font-size: 12px; }
& .lo-notice .txt { display: flex; align-items: center; gap: 8px; max-width: 0; opacity: 0; overflow: hidden; transition: max-width .25s ease, opacity .2s ease, padding .25s ease; }
& .lo-notice:hover .txt, & .lo-notice:focus-visible .txt, & .lo-notice.open .txt { max-width: 360px; opacity: 1; /* @noflip */ padding: 0 6px 0 8px; }
& .lo-notice .txt > span { overflow: hidden; text-overflow: ellipsis; }
& .lo-notice.err { color: var(--lo-ask); }
@keyframes lo-notice-in { from { opacity: 0; transform: scale(.8); } to { opacity: 1; transform: none; } }
& .lo-spin.sm { display: inline-block; width: 12px; height: 12px; vertical-align: -2px; }
& .lo-notice .prog { flex: none; width: 56px; height: 4px; border-radius: 2px; background: var(--glass-surface-3); overflow: hidden; }
& .lo-notice .prog b { display: block; height: 100%; background: var(--glass-fg-2); transition: width .2s; }

/* analysis box figures, top-left of the stage */
& .lo-apanel { position: absolute; z-index: 1000; background: var(--glass-menu); border: 1px solid var(--glass-menu-line); border-radius: 12px; box-shadow: var(--glass-menu-shadow); min-width: 460px; max-width: calc(100vw - 16px); font-size: 15px; color: var(--glass-fg); line-height: 1.45; } /* on the page (end of <body>): parts/ChartCard AnalysisPanel */
& .lo-apanel .ah { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px; border-bottom: 1px solid var(--glass-line); }
& .lo-apanel .grip { flex: 1; align-self: stretch; min-width: 24px; cursor: grab; touch-action: none; }
& .lo-apanel .grip:active { cursor: grabbing; }
& .lo-apanel .rng { color: var(--glass-fg-3); font-size: 13.5px; padding: 9px 14px; border-bottom: 1px solid var(--glass-line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
& .lo-apanel .tw { display: block; overflow: auto; max-height: min(460px, 70vh); }
& .lo-apanel table { border-collapse: collapse; width: 100%; }
& .lo-apanel th, & .lo-apanel td { padding: 10px 14px; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; border-bottom: 1px solid var(--glass-line); }
& .lo-apanel th { color: var(--glass-fg); line-height: 1.2; }
& .lo-apanel th .k { display: block; font-size: 12.5px; color: var(--glass-fg-3); font-weight: 400; }
& .lo-apanel th .ex { display: flex; justify-content: flex-end; height: 22px; margin-bottom: 4px; } /* venue logo over its 永续 / 现货 line */
& .lo-apanel th:first-child, & .lo-apanel td:first-child { text-align: left; color: var(--glass-fg-2); font-weight: 400; }
& .lo-apanel tr:last-child td { border-bottom: 0; }

/* indicator panes */
& .lo-panes { display: grid; gap: 4px; }
& .lo-strip { position: relative; min-width: 0; height: 140px; border-top: 1px solid var(--glass-line); overflow: hidden; transition: height .25s ease, opacity .25s ease; }
& .lo-strip.off { height: 0; opacity: 0; border-top-color: transparent; pointer-events: none; }
& .lo-strip canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
& .lo-sigpop h4 { margin: 0 0 6px; font-size: 14px; }
& .lo-sigpop p { margin: 6px 0; font-size: 13.5px; line-height: 1.55; color: var(--glass-fg-2); }
& .lo-sigpop p.muted { color: var(--glass-fg-3); }
& .lo-sigtab { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12.5px; font-variant-numeric: tabular-nums; }
& .lo-sigtab th, & .lo-sigtab td { padding: 4px 6px; text-align: right; border-bottom: 1px solid var(--glass-line); white-space: nowrap; }
& .lo-sigtab th:first-child, & .lo-sigtab td:first-child { text-align: left; }
& .lo-sigtab th { color: var(--glass-fg-3); font-size: 11.5px; }

/* ===== side panel ===== */
& .lo-side { position: relative; overflow: hidden; display: flex; flex-direction: column; }
& .lo-side-tabs > :first-child { flex: 0 1 auto; min-width: 0; overflow-x: auto; scrollbar-width: none; } /* a long translation scrolls inside the tray instead of pushing the scale select onto a second line */
& .lo-side-ctl { display: flex; align-items: center; gap: 6px; flex: none; }
& .lo-side-tabs { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: nowrap; padding: 8px 10px; border-bottom: 1px solid var(--glass-line); flex: none; }
& .lo-pane { flex: 1 1 0; min-height: 0; overflow: auto; overflow-anchor: none; overscroll-behavior: contain; scrollbar-gutter: stable; }
& .lo-thead { position: sticky; top: 0; z-index: 2; display: grid; grid-template-columns: minmax(104px, 1fr) minmax(70px, 84px) minmax(50px, 58px) minmax(68px, 80px); gap: 5px; padding: 7px 10px; background: var(--glass-surface); border-bottom: 1px solid var(--glass-line); font-size: 13px; line-height: 18px; color: var(--glass-fg-3); }
& .lo-thead span:nth-child(n+2), & .lo-row span:nth-child(n+2) { text-align: right; }
& .lo-row { position: relative; display: grid; grid-template-columns: minmax(104px, 1fr) minmax(70px, 84px) minmax(50px, 58px) minmax(68px, 80px); gap: 5px; align-items: center; height: 32px; padding: 0 10px; width: 100%; border: 0; background: none; text-align: left; font: inherit; font-variant-numeric: tabular-nums; font-size: 13.5px; color: var(--glass-fg); cursor: pointer; }
& button.lo-row:focus-visible { outline: 2px solid var(--glass-focus); outline-offset: -2px; }
& .lo-row > span { position: relative; z-index: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
& .lo-row + .lo-row { box-shadow: inset 0 1px 0 color-mix(in srgb, var(--glass-bg) 60%, transparent); }
& .lo-row .depth { position: absolute; /* @noflip */ left: 0; top: 1px; bottom: 1px; z-index: 0; /* @noflip */ border-radius: 0 3px 3px 0; background: linear-gradient(90deg, var(--edge) 0 3px, var(--tier) 3px); }
& .lo-row.bid .depth { --edge: var(--lo-bid); }
& .lo-row.ask .depth { --edge: var(--lo-ask); }
& .lo-row .p { display: flex; align-items: center; gap: 5px; font-weight: 600; padding-left: 4px; min-width: 0; }
& .lo-row .a { color: var(--glass-fg-2); }
& .lo-row:hover, & .lo-row.is-hot { background: var(--glass-surface-2); }
& .lo-row.is-hot { /* @noflip */ box-shadow: inset 3px 0 0 var(--lo-accent); } /* on the depth bar's edge, which stays left */
& .lo-exb { display: inline-flex; align-items: center; gap: 4px; min-width: 0; vertical-align: middle; }
& .lo-exb i { font-style: normal; font-size: 11.5px; font-weight: 700; line-height: 18px; color: var(--glass-fg); white-space: nowrap; }
& .lo-exb .nm { font-weight: 500; margin: 0 2px; }
& .lo-divider { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 32px; padding: 0 10px; background: var(--glass-surface-2); border-top: 1px solid var(--glass-line-2); border-bottom: 1px solid var(--glass-line-2); font-size: 12px; font-variant-numeric: tabular-nums; }
& .lo-divider b { display: inline-flex; align-items: center; gap: 5px; font-size: 15px; font-weight: 700; }
& .lo-sidebadge { font-style: normal; display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 11.5px; font-weight: 600; }
& .lo-sidebadge.buy { background: var(--lo-bid-soft); color: var(--lo-bid); }
& .lo-sidebadge.sell { background: var(--lo-ask-soft); color: var(--lo-ask); }
& .lo-newfeed .lo-thead { grid-template-columns: 84px 1fr; }
& .lo-newfeed .lo-thead span:nth-child(2) { text-align: left; }
& .lo-note { display: flex; gap: 6px; align-items: flex-start; padding: 9px 12px; font-size: 13px; line-height: 1.45; color: var(--glass-fg-2); background: var(--glass-surface-2); border-bottom: 1px solid var(--glass-line); }
& .lo-note > i { font-style: normal; flex: none; width: 14px; height: 14px; border-radius: 50%; border: 1px solid var(--glass-fg-3); color: var(--glass-fg-3); font-size: 10px; display: grid; place-items: center; margin-top: 2px; }
& .lo-note .tg { margin-left: auto; flex: none; align-self: center; height: 26px; padding: 0 9px; border: 0; border-radius: 8px; background: var(--glass-ctl); color: var(--glass-fg-2); font-size: 12.5px; font-weight: 500; white-space: nowrap; cursor: pointer; }
& .lo-note .tg[aria-pressed="true"] { background: var(--glass-toggle-on); color: var(--glass-toggle-on-ink); }
& .lo-note .tg:focus-visible { outline: 2px solid var(--glass-focus); outline-offset: 1px; }
& .lo-nrow { display: grid; grid-template-columns: 84px 1fr; gap: 6px; padding: 9px 12px; width: 100%; border: 0; border-bottom: 1px solid var(--glass-line); background: none; font: inherit; font-size: 14px; line-height: 1.45; text-align: left; color: var(--glass-fg); cursor: pointer; }
& .lo-nrow:hover { background: var(--glass-surface-2); }
& .lo-nrow:focus-visible { outline: 2px solid var(--glass-focus); outline-offset: -2px; }
& .lo-nrow time { font-variant-numeric: tabular-nums; color: var(--glass-fg-3); font-size: 12.5px; padding-top: 2px; }
& .lo-nrow.is-new { animation: lo-flash 1.2s ease-out; }

/* ===== exchange picker / colours ===== */
& .lo-exq { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
& .lo-exsearch { width: 100%; height: 34px; border: 0; border-radius: 6px; background: var(--glass-ctl); color: var(--glass-fg); font-size: 13.5px; padding: 0 10px; margin-bottom: 6px; outline: none; }
& .lo-exsearch:focus-visible { box-shadow: 0 0 0 2px var(--glass-focus); }
& .lo-exrow { display: grid; grid-template-columns: minmax(0, 1fr) 64px auto auto auto; gap: 8px; align-items: center; padding: 6px 2px; border-top: 1px solid var(--glass-line); }
& .lo-exq + .lo-exrow, & .lo-exsearch + .lo-exrow { border-top: 0; }
& .lo-exrow .nm { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13.5px; min-width: 0; white-space: nowrap; }
& .lo-exrow .nm small { font-size: 11.5px; color: var(--glass-fg-3); font-weight: 400; }
& .lo-exrow.off .nm { color: var(--glass-fg-3); }
& .lo-exrow .bar { height: 4px; background: var(--glass-surface-3); border-radius: 2px; overflow: hidden; }
& .lo-exrow .bar i { display: block; height: 100%; background: var(--glass-fg-3); border-radius: 2px; }
& .lo-exk { height: 26px; padding: 0 9px; border: 0; border-radius: 6px; background: var(--glass-ctl); color: var(--glass-fg); font-size: 12.5px; font-weight: 500; cursor: pointer; }
& .lo-exk:hover { background: var(--glass-ctl-hi); }
& .lo-exk[aria-pressed="true"] { background: var(--glass-toggle-on); color: var(--glass-toggle-on-ink); font-weight: 600; }
& .lo-exk:disabled { opacity: .3; cursor: default; }
& .lo-exk:focus-visible, & .lo-exrow .only:focus-visible { outline: 2px solid var(--glass-focus); outline-offset: 1px; }
& .lo-exrow .only { border: 0; background: none; font-size: 12px; color: var(--glass-fg-3); padding: 0 4px; opacity: 0; white-space: nowrap; cursor: pointer; }
& .lo-exrow:hover .only, & .lo-exrow .only:focus-visible { opacity: 1; }
& .lo-exrow .only:hover { color: var(--glass-fg); }
@media (hover: none) { & .lo-exrow .only { opacity: 1; } }
& .lo-colors h4 { margin: 0 0 8px; font-size: 13px; color: var(--glass-fg-3); font-weight: 500; }
& .lo-colors .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 14px 0 6px; }
& .lo-colors .row h4 { margin: 0; }
& .lo-colors .note { font-size: 12px; color: var(--glass-fg-3); margin: 8px 0 0; line-height: 1.5; }
& .lo-presets { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
& .lo-preset { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px; border: 0; border-radius: 8px; background: var(--glass-ctl); cursor: pointer; font-size: 13px; font-weight: 500; color: var(--glass-fg); text-align: left; white-space: nowrap; overflow: hidden; }
& .lo-preset:hover { background: var(--glass-ctl-hi); }
& .lo-preset[aria-pressed="true"] { background: var(--glass-toggle-on); color: var(--glass-toggle-on-ink); font-weight: 600; }
& .lo-preset:focus-visible { outline: 2px solid var(--glass-focus); outline-offset: 1px; }
& .lo-preset .sw { display: inline-flex; gap: 2px; flex: none; }
& .lo-preset .sw i { width: 8px; height: 14px; border-radius: 2px; display: block; }
& .lo-cp { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; font-size: 13px; color: var(--glass-fg-2); padding: 4px 0; }
& .lo-cp small { color: var(--glass-fg-3); margin-left: 6px; font-variant-numeric: tabular-nums; }
& .lo-cp input[type="color"] { width: 34px; height: 22px; border: 1px solid var(--glass-line-2); border-radius: 4px; background: transparent; padding: 0; cursor: pointer; }

/* ===== exchange stats ===== */
& .lo-ph { display: flex; align-items: baseline; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--glass-line); flex-wrap: wrap; }
& .lo-ph h3 { margin: 0; font-size: 15px; font-weight: 600; }
& .lo-ph small { color: var(--glass-fg-2); font-size: 13px; }
& .lo-stats { padding: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 8px; }
& .lo-scard { border: 1px solid var(--glass-line); border-radius: 8px; padding: 10px 12px; background: var(--glass-surface-2); }
& .lo-scard .h { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
& .lo-scard .h .kd { font-size: 12px; color: var(--glass-fg-3); }
& .lo-scard .h .net { margin-left: auto; font-variant-numeric: tabular-nums; font-size: 12.5px; }
& .lo-scard .split { display: flex; height: 6px; border-radius: 3px; overflow: hidden; gap: 2px; margin: 4px 0 6px; }
& .lo-scard .split i { display: block; height: 100%; }
& .lo-scard .split .b { background: var(--lo-bid); }
& .lo-scard .split .a { background: var(--lo-ask); }
& .lo-scard .sgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; font-size: 13px; }
& .lo-scard .sgrid div { display: flex; justify-content: space-between; gap: 8px; color: var(--glass-fg-2); }
& .lo-scard .sgrid div span:last-child { font-variant-numeric: tabular-nums; }

/* ===== order table + detail ===== */
& .lo-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 12px; align-items: start; }
& .lo-bt-head { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-bottom: 1px solid var(--glass-line); flex-wrap: wrap; }
& .lo-bt-head [data-scope='base-item-wrapper'], & .lo-side-tabs [data-scope='base-item-wrapper'] { height: 30px; --biw-px: 11px; --biw-font-size-base: 13px; } /* the demo's 30px selects next to the 40px tab tray */
& .lo-bt-sum { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--glass-fg-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
& .lo-bt-body { overflow: auto; overflow-anchor: none; max-height: calc(100vh - 150px); min-height: 240px; overscroll-behavior: contain; }
& table.lo-bt { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; font-size: 14px; }
& .lo-bt th { position: sticky; top: 0; z-index: 2; background: var(--glass-surface); color: var(--glass-fg-3); font-weight: 400; font-size: 13px; text-align: right; padding: 12px 14px; box-shadow: 0 1px 0 var(--glass-line); white-space: nowrap; cursor: pointer; user-select: none; }
& .lo-bt th:hover, & .lo-bt th.sorted { color: var(--glass-fg); }
& .lo-bt tr.lo-pad td { padding: 0; border: 0; height: auto; }
& .lo-bt tr.lo-pad:hover { background: none; }
& .lo-bt th::after { content: ""; display: inline-block; margin-left: 5px; border-left: 3.5px solid transparent; border-right: 3.5px solid transparent; border-top: 5px solid var(--glass-line-2); vertical-align: middle; }
& .lo-bt th.sorted::after { border-top-color: var(--glass-fg); }
& .lo-bt th.sorted.asc::after { transform: rotate(180deg); }
& .lo-bt td { height: 46px; padding: 0 14px; text-align: right; border-bottom: 1px solid var(--glass-line); white-space: nowrap; }
& .lo-bt th:first-child, & .lo-bt td:first-child { text-align: left; }
& .lo-bt tbody tr { cursor: pointer; }
& .lo-bt tbody tr:hover { background: var(--glass-surface-2); }
& .lo-bt tbody tr.is-sel { background: var(--lo-accent-soft); box-shadow: inset 3px 0 0 var(--lo-accent); }
& .lo-bt tbody tr.bdiv { cursor: default; }
& .lo-bt tbody tr.bdiv td { text-align: center; height: 46px; background: var(--glass-surface-2); box-shadow: inset 0 1px 0 var(--glass-line-2); border-bottom: 1px solid var(--glass-line-2); }
& .lo-bt tbody tr.bdiv td b { font-size: 15px; }
& .lo-bt td.barcell { background-image: var(--bar); background-repeat: no-repeat; background-size: 100% calc(100% - 8px); background-position: 0 4px; }
& .lo-bt td.lo-empty { text-align: center; cursor: default; }
& .lo-star { border: 0; background: none; padding: 0 6px 0 0; font-size: 13px; line-height: 1; color: var(--glass-fg-3); cursor: pointer; }
& .lo-star.on { color: var(--lo-accent); }
& .lo-star:focus-visible { outline: 2px solid var(--glass-focus); border-radius: 3px; }
& .lo-prog { display: inline-block; vertical-align: middle; width: 44px; height: 4px; background: var(--glass-surface-3); margin-left: 6px; position: relative; overflow: hidden; } /* filled can exceed the initial size (the order grew): the bar stops at 100% */
& .lo-prog i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--glass-fg-2); }
& .lo-st { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 11.5px; line-height: 1.5; border: 1px solid; font-weight: 500; }
& .lo-st.live { color: var(--lo-bid); border-color: color-mix(in srgb, var(--lo-bid) 50%, transparent); }
& .lo-st.part { color: var(--lo-accent); border-color: color-mix(in srgb, var(--lo-accent) 50%, transparent); }
& .lo-st.filled { color: var(--glass-fg); border-color: var(--glass-line-2); }
& .lo-st.cancelled { color: var(--glass-fg-3); border-color: var(--glass-line-2); }
& .lo-bt-foot { display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 12.5px; color: var(--glass-fg-3); border-top: 1px solid var(--glass-line); flex-wrap: wrap; }
& .lo-bt-foot .hint { margin-left: auto; }
& .lo-detail { padding: 12px 16px 16px; }
& .lo-detail .dh { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--glass-fg-2); }
& .lo-detail .dh .sd { margin-left: auto; font-weight: 700; }
& .lo-detail .stale { margin: 0 0 10px; padding: 6px 10px; border-radius: 6px; background: var(--glass-surface-2); font-size: 12.5px; color: var(--glass-fg-2); }
& .lo-bt tbody tr.stale td { color: var(--glass-fg-3); }
& .lo-detail .dp { font-variant-numeric: tabular-nums; font-size: 30px; font-weight: 700; margin: 6px 0 2px; line-height: 1.1; }
& .lo-detail .dsub { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--glass-fg-3); margin-bottom: 10px; flex-wrap: wrap; }
& .lo-detail .kv { display: grid; grid-template-columns: 1fr auto; border-top: 1px solid var(--glass-line); }
& .lo-detail .kv span { padding: 8px 0; border-bottom: 1px solid var(--glass-line); font-size: 13.5px; }
& .lo-detail .kv span:nth-child(odd) { color: var(--glass-fg-2); }
& .lo-detail .kv span:nth-child(even) { font-variant-numeric: tabular-nums; text-align: right; }
& .lo-detail .mt { display: block; margin-top: 12px; }
& .lo-detail .stack { display: flex; height: 6px; gap: 1px; margin: 8px 0 4px; background: var(--glass-surface-3); }
& .lo-detail .stack i { display: block; height: 100%; }
& .lo-detail .stack .f { background: var(--glass-fg); }
& .lo-detail .stack .r { background: var(--lo-bid); }
& .lo-detail .stack .c { background: var(--glass-fg-3); }
& .lo-detail .legend { display: flex; justify-content: space-between; font-size: 12px; color: var(--glass-fg-3); font-variant-numeric: tabular-nums; }
& .lo-detail .acts { display: flex; gap: 8px; margin-top: 14px; }
& .lo-detail .acts > * { flex: 1; }

/* ===== 相关工具 ===== */
& .lo-rel { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; scroll-margin-top: 72px; }
& .fh h2 { margin: 0; font-size: 22px; font-weight: 600; }
& .fh p { margin: 6px 0 0; font-size: 14px; color: var(--glass-fg-3); }
& .lo-relgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
& .lo-relcard { display: flex; flex-direction: column; gap: 8px; min-height: 136px; padding: 16px 18px; color: var(--glass-fg); text-decoration: none; transition: background .15s, border-color .15s; }
& .lo-relcard:hover { background: var(--glass-surface-2); border-color: var(--glass-line-2); }
& .lo-relcard:focus-visible { outline: 2px solid var(--glass-focus); outline-offset: 1px; }
& .lo-relcard .rtop { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
& .lo-relcard .rico { width: 32px; height: 32px; border-radius: 8px; background: var(--glass-ctl); color: var(--glass-fg-2); display: inline-flex; align-items: center; justify-content: center; flex: none; }
& .lo-relcard .rico svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
& .lo-relcard .tg { font-size: 11.5px; line-height: 18px; padding: 0 5px; border-radius: 4px; font-weight: 600; background: var(--glass-surface-3); color: var(--glass-fg-2); white-space: nowrap; }
& .lo-relcard b { font-size: 15.5px; }
& .lo-relcard p { margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--glass-fg-2); }
& .lo-relcoins h3 { margin: 6px 0 10px; font-size: 15.5px; font-weight: 600; }
& .lo-cchips { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; } /* 20 links: 5 × 4, every column the same width */
& .lo-cchip { height: 34px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px 0 6px; border-radius: 8px; background: var(--glass-ctl); color: var(--glass-fg); font-size: 13.5px; font-weight: 500; text-decoration: none; white-space: nowrap; min-width: 0; transition: background .15s; }
& .lo-cchip .full { flex: 1; min-width: 0; display: flex; justify-content: space-between; gap: 8px; }
& .lo-cchip .full > span { overflow: hidden; text-overflow: ellipsis; }
& .lo-cchip .sfx { flex: none; white-space: pre; }
& .lo-cchip:hover { background: var(--glass-ctl-hi); }
& .lo-cchip:focus-visible { outline: 2px solid var(--glass-focus); outline-offset: 1px; }
& .lo-cchip .short { display: none; }


/* ===== toasts ===== */
& .lo-toasts { position: fixed; right: 16px; bottom: 16px; z-index: 1200; display: flex; flex-direction: column; gap: 8px; max-width: min(420px, calc(100vw - 32px)); }
& .lo-toast { position: relative; background: var(--glass-menu); border: 1px solid var(--glass-menu-line); border-radius: 10px; padding: 12px 34px 12px 14px; box-shadow: inset 3px 0 0 var(--lo-bid), var(--glass-menu-shadow); font-size: 14px; line-height: 1.45; cursor: pointer; animation: lo-toast .25s ease-out; }
& .lo-toast.ask { box-shadow: inset 3px 0 0 var(--lo-ask), var(--glass-menu-shadow); }
& .lo-toast .tt { font-size: 12.5px; color: var(--glass-fg-3); margin-bottom: 2px; }
& .lo-toast .x { position: absolute; right: 6px; top: 6px; width: 24px; height: 24px; border: 0; border-radius: 6px; background: none; color: var(--glass-fg-3); font-size: 13px; cursor: pointer; }
& .lo-toast .x:hover { background: var(--glass-ctl); color: var(--glass-fg); }
@keyframes lo-toast { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* ===== responsive: laptop → tablet → phone; same components, fewer columns ===== */
/* KPI cards: always one row of seven on desktop; below 1680px the numbers scale with the window and the venue keeps only its logo */
@media (max-width: 1679px) {
    & .lo-kpis { gap: 10px; }
    & .lo-kpi { padding: 12px; }
    & .lo-kpi .v { font-size: clamp(22px, 2.1vw, 32px); }
    & .lo-kpi .lbl, & .lo-kpi .s { font-size: 12.5px; }
    & .lo-kpi .venue > span { display: none; }
}
@media (max-width: 1400px) { & .lo-chart-row { grid-template-columns: minmax(0, 1fr) 400px; } }
@media (max-width: 1023px) {
    & .lo-kpis { display: flex; flex-wrap: wrap; }
    & .lo-kpis > .lo-kpi { flex: 1 1 calc(25% - 10px); }
    & .lo-kpi .venue > span { display: inline; }
}
@media (max-width: 1100px) { & .lo-relgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } & .lo-cchips { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 980px) {
    & .lo-chart-row, & .lo-detail-grid { grid-template-columns: minmax(0, 1fr); }
    & .lo-side { height: 520px; }
    & .lo-stage { height: 520px; }
}
@media (max-width: 640px) {
    padding: 0 10px 24px; gap: 8px;
    & .lo-rail { gap: 4px; }
    & .lo-rail h1 { width: 100%; font-size: 15px; }
    & .lo-kpis > .lo-kpi { flex-basis: calc(50% - 8px); }
    & .lo-kpi { padding: 10px 12px; }
    & .lo-kpi .v { font-size: 20px; line-height: 26px; }
    & .lo-kpi .lbl, & .lo-kpi .s { font-size: 12px; }
    & .lo-kpi .venue { font-size: 11.5px; max-width: 55%; }
    & .lo-chart-card { padding: 6px 6px 8px; }
    & .lo-stage { height: 540px; }
    & .lo-strip { height: 110px; }
    /* the order book gets most of the screen, leaving 100px to scroll the page past it */
    /* side tabs: the scale select keeps its size, the tabs drop their counts (the new-walls badge stays) */
    & .lo-side-tabs > :last-child { flex: none; } & .lo-side-tabs .lo-cnt:not(.hot) { display: none; } & .lo-side-tabs [role='tab'] { padding-inline: 8px; }
    & .lo-side { height: calc(100vh - 100px); height: calc(100svh - 100px); min-height: 360px; }
    /* folded controls: chip rows behind a button, captions dropped from the filter rail, FAQ (at the page end) hidden */
    & .lo-desk, & .lo-desk-only.lo-desk-only { display: none; }
    & .lo-phone { display: contents; }
    & .lo-rail .lo-selcap, & .lo-exbtn .lo-cap, & .lo-exbtn .lo-num { display: none; } /* the exchange button: logos only */
    /* the rail's controls take the compact size on a phone (the demo's 38px ones would wrap the filters to a third row) */
    & .lo-rail [data-scope='base-item-wrapper'] { height: 30px; --biw-px: 11px; --biw-font-size-base: 13px; }
    & .lo-desk-txt { display: none; } & .lo-phone-txt { display: inline; }
    /* the title shares its row with the colour button; the filters fill the row below */
    & .lo-rail h1 { width: auto; flex: 1 1 calc(100% - 90px); min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    & .lo-rail > * { order: 2; } & .lo-rail > h1 { order: 0; } & .lo-rail > :has(.lo-colorbtn) { order: 1; } /* ui-kit wraps the Popover trigger */
    & .lo-rail > .lo-spacer { display: none; }
    & .lo-row, & .lo-thead { grid-template-columns: minmax(96px, 1fr) minmax(64px, 78px) minmax(48px, 56px) minmax(62px, 74px); gap: 4px; padding: 0 8px; font-size: 12.5px; }
    & #lo-pane-book .lo-row, & #lo-pane-book .lo-divider { content-visibility: auto; contain-intrinsic-size: auto 32px; } /* every row is in the DOM on a phone: off-screen ones skip layout and paint */
    & .lo-thead { padding: 6px 8px; }
    & .lo-apanel { min-width: 0; max-width: calc(100% - 16px); }
    & .lo-bt-sum { flex-basis: 100%; white-space: normal; font-size: 11px; line-height: 15px; }
    & .lo-bt-body { max-height: 70vh; }
    /* the order table as simple cards (no sideways scrolling): venue and the price (coloured by side) on top;
       remaining size and the status (only when it is not "open") below, distance and age flush right. Initial / filled size, fill count and end
       time stay in the detail panel. Every card and the 现价 row are 56px tall (the list is windowed on a fixed row
       height) */
    & .lo-bt, & .lo-bt tbody { display: block; }
    & .lo-bt thead { display: none; }
    & .lo-bt tbody tr { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; grid-template-areas: "vn vn vn px" "rm st ds ag"; align-items: center; column-gap: 12px; height: 56px; padding: 0 10px; border-bottom: 1px solid var(--glass-line); }
    /* the size bar of the desktop's initial-size cell, laid from the card's left edge: side stripe + tier fill */
    & .lo-bt tbody tr:not(.bdiv):not(.lo-pad) { background-image: var(--bar-l); background-repeat: no-repeat; /* @noflip */ padding-left: 13px; }
    & .lo-bt tbody tr.lo-pad { display: block; padding: 0; border: 0; }
    & .lo-bt tbody tr.lo-pad td { display: none; }
    & .lo-bt td, & .lo-bt tbody tr.bdiv td { height: auto; padding: 0; border: 0; font-size: 12.5px; text-align: left; overflow: hidden; text-overflow: ellipsis; }
    & .lo-bt td.vn { grid-area: vn; } & .lo-bt td.px { grid-area: px; text-align: right; font-size: 13.5px; font-weight: 600; }
    & .lo-bt td.rm { grid-area: rm; font-size: 13.5px; font-weight: 600; }
    & .lo-bt td.ds { grid-area: ds; text-align: right; } & .lo-bt td.ag { grid-area: ag; text-align: right; color: var(--glass-fg-2); }
    & .lo-bt td.st { grid-area: st; } & .lo-bt td.st .lo-st.live { display: none; }
    & .lo-bt td.vn > b { display: none; } /* bid / ask: the price colour says it */
    & .lo-bt td.in, & .lo-bt td.fl, & .lo-bt td.nf, & .lo-bt td.en { display: none; }
    & .lo-bt .lo-star { font-size: 13px; }
    & .lo-bt tbody tr.bdiv { grid-template-columns: minmax(0, 1fr); grid-template-areas: none; border-top: 0; }
    & .lo-bt tbody tr.bdiv td { grid-column: 1 / -1; text-align: center; background: none; box-shadow: none; }
    & .lo-bt tbody tr.bdiv { background: var(--glass-surface-2); box-shadow: inset 0 1px 0 var(--glass-line-2); }
    & .lo-bt td.lo-empty { grid-column: 1 / -1; text-align: center; }
    & .lo-tip { min-width: 180px; padding: 8px 10px; font-size: 12px; }
    /* the hover card trimmed for a small screen: no subtitle under the venue, no coin amounts under the figures */
    & .lo-tip:has(.tw) { min-width: 0; width: min(280px, calc(100% - 16px)); padding: 10px 12px; }
    & .tw { gap: 6px; font-size: 12.5px; }
    & .tw-h { gap: 8px; }
    & .tw-h .lo-logo { width: 20px; height: 20px; }
    & .tw-v b { font-size: 13.5px; }
    & .tw-v small, & .tw-grid small { display: none; }
    & .tw-side { font-size: 11.5px; padding: 2px 7px; }
    & .tw-price { gap: 8px; }
    & .tw-price > b { font-size: 18px; }
    & .tw-price > span { font-size: 12.5px; }
    & .tw-bar { height: 4px; }
    & .tw-grid { gap: 4px; }
    & .tw-grid > div { padding: 5px 8px; }
    & .tw-grid span { font-size: 11.5px; }
    & .tw-grid b { font-size: 13.5px; }
    & .tw-foot { font-size: 11.5px; padding-top: 6px; }
    & .lo-tip .t { font-size: 13px; margin-bottom: 4px; }
    /* related tools, pared down: two columns of icon + name (group tag and description dropped), smaller coin chips */
    & .fh h2 { font-size: 18px; } & .lo-rel .fh p { display: none; }
    & .lo-relgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    & .lo-relcard { min-height: 0; flex-direction: row; align-items: center; gap: 10px; padding: 10px 12px; }
    & .lo-relcard .rico { width: 28px; height: 28px; border-radius: 7px; }
    & .lo-relcard .tg, & .lo-relcard p { display: none; }
    & .lo-relcard b { font-size: 13.5px; font-weight: 500; line-height: 1.3; min-width: 0; }
    & .lo-relcoins h3 { margin: 2px 0 8px; font-size: 14px; }
    & .lo-cchips { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    & .lo-cchip { position: relative; height: 32px; gap: 6px; padding: 0 6px; font-size: 12.5px; min-width: 0; }
    & .lo-cchip .full { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; } /* read out, not shown */
    & .lo-cchip .short { display: inline; overflow: hidden; text-overflow: ellipsis; }
    & .lo-toasts { right: 10px; bottom: 10px; max-width: calc(100vw - 20px); }
}
@media (prefers-reduced-motion: reduce) { & .lo-stage canvas, & .lo-strip { transition: none; } & .lo-nrow.is-new, & .lo-toast, & .lo-notice { animation: none; } & .lo-notice .txt { transition: none; } & .lo-spin { animation-duration: 1.6s; } }
`,
        g = (0, h.A)(f)`
&& { display: contents; }
`;
      var x = s(57326);
      let m = (0, i.createContext)(null),
        b = () => (0, i.useContext)(m);

      function w(e) {
        let [t, s] = (0, i.useState)(() => Date.now());
        return (0, i.useEffect)(() => {
          let t = setInterval(() => {
            document.hidden || s(Date.now())
          }, e);
          return () => clearInterval(t)
        }, [e]), t
      }
      let v = new Set,
        y = 0,
        k = 0,
        j = () => {
          k = performance.now()
        };

      function N() {
        if (document.hidden || performance.now() - k < 250) return;
        let e = Date.now();
        for (let t of v) {
          let s = t.fmt.age((t.to || e) - t.from),
            a = t.el.firstChild;
          s !== t.text && a && 3 === a.nodeType && (t.text = s, a.nodeValue = s)
        }
      }

      function M({
        from: e,
        to: t,
        fmt: s
      }) {
        let l = (0, i.useRef)(null),
          r = s.age((t || Date.now()) - e);
        return (0, i.useEffect)(() => {
          var a;
          let i = l.current;
          return i ? (a = {
            el: i,
            from: e,
            to: t,
            fmt: s,
            text: i.textContent
          }, v.add(a), y || (y = setInterval(N, 1e3), document.addEventListener("scroll", j, {
            capture: !0,
            passive: !0
          })), () => {
            v.delete(a), v.size || (clearInterval(y), y = 0, document.removeEventListener("scroll", j, {
              capture: !0
            }))
          }) : void 0
        }, [e, t, s]), (0, a.jsx)("span", {
          ref: l,
          suppressHydrationWarning: !0,
          children: r
        })
      }
      let S = null,
        T = () => S || (S = window.matchMedia("(max-width: 640px)")),
        V = e => {
          let t = T();
          return t.addEventListener("change", e), () => t.removeEventListener("change", e)
        };

      function z(e, t, s, l) {
        let i = {};
        for (let e of Object.keys(s)) i[e] = "\x01" + e + "\x01";
        return String(e(t, {
          ...i,
          defaultValue: l,
          interpolation: {
            escapeValue: !1
          }
        })).split("\x01").map((e, t) => t % 2 ? (0, a.jsx)("span", {
          children: s[e]
        }, t) : e)
      }
      let _ = (e, t) => "perp" === t ? e("large-orderbook-statistics.ex.kindPerp", {
        defaultValue: "Perp"
      }) : e("large-orderbook-statistics.ex.kindSpot", {
        defaultValue: "Spot"
      });
      var A = s(98532),
        O = s(86996);
      class P {
        constructor(e, t, s) {
          let a = e.length;
          this.sym = t, this.ivMin = s, this.step = a > 1 && (e[1][0] - e[0][0]) * 1e3 || 6e4 * s, this.t0 = 1e3 * e[0][0], this.N = a, this.open = new Float64Array(a), this.high = new Float64Array(a), this.low = new Float64Array(a), this.close = new Float64Array(a), this.vol = new Float64Array(a);
          for (let t = 0; t < a; t++) this._set(t, e[t]);
          this.walls = [], this.trades = [], this.wallById = new Map, this.orders = null, this.version = 0
        }
        _set(e, t) {
          this.open[e] = +t[1], this.high[e] = +t[2], this.low[e] = +t[3], this.close[e] = +t[4], this.vol[e] = +t[5] || 0
        }
        get curPrice() {
          return this.N ? this.close[this.N - 1] : 0
        }
        pushCandle(e) {
          let t = Math.round((1e3 * e[0] - this.t0) / this.step);
          return t === this.N - 1 ? (this._set(t, e), "last") : !!(t === this.N && this.merge([e])) && "new"
        }
        tsAt(e) {
          return this.t0 + e * this.step
        }
        idxOf(e) {
          return Math.max(0, Math.min(this.N - 1, Math.floor((e - this.t0) / this.step)))
        }
        prepend(e) {
          let t = (e = e.filter(e => 1e3 * e[0] < this.t0)).length;
          if (!t) return 0;
          let s = this.N + t,
            a = e => {
              let a = new Float64Array(s);
              return a.set(e, t), a
            };
          this.open = a(this.open), this.high = a(this.high), this.low = a(this.low), this.close = a(this.close), this.vol = a(this.vol);
          for (let s = 0; s < t; s++) this._set(s, e[s]);
          return this.N = s, this.t0 = 1e3 * e[0][0], this.orders && this.applyOrders(this.orders), this.version++, t
        }
        merge(e) {
          let t = [];
          for (let s of e) {
            let e = Math.round((1e3 * s[0] - this.t0) / this.step);
            e < 0 || (e < this.N ? this._set(e, s) : t.push([e, s]))
          }
          if (t.length) {
            if (t.sort((e, t) => e[0] - t[0]), t[0][0] !== this.N) return !1;
            for (let e = 1; e < t.length; e++)
              if (t[e][0] !== t[e - 1][0] + 1) return !1;
            let e = t.length,
              s = this.N + e,
              a = e => {
                let t = new Float64Array(s);
                return t.set(e), t
              };
            this.open = a(this.open), this.high = a(this.high), this.low = a(this.low), this.close = a(this.close), this.vol = a(this.vol);
            for (let s = 0; s < e; s++) this._set(this.N + s, t[s][1]);
            this.N = s, this.orders && this.applyOrders(this.orders)
          }
          return this.version++, !0
        }
        applyOrders(e) {
          this.orders = e;
          let t = this.t0,
            s = e => this.idxOf(e),
            a = [];
          for (let l of e.walls) {
            let [e, i, r, o, n, d, c, h, p, u, f] = l;
            if (!O.aV[i]) continue;
            let g = null == c;
            (g || !(c < t)) && a.push({
              id: i + "/" + e,
              ex: i,
              side: 2 === o ? "bid" : "ask",
              price: r,
              initUsd: h,
              usd: g ? p : 0,
              filledUsd: u || 0,
              fills: f || 0,
              cancelledUsd: g ? 0 : Math.max(0, h - (u || 0)),
              startT: n,
              snapT: d || n,
              endT: g ? null : c,
              s: s(n),
              end: g ? null : s(c),
              status: g ? "alive" : u >= .9 * h ? "filled" : "cancelled"
            })
          }
          let l = [];
          for (let a of e.trades) {
            let [e, i, r, o, n, d] = a;
            O.aV[i] && !(r < t) && l.push({
              id: i + "/" + e,
              ex: i,
              t: r,
              price: o,
              usd: n,
              side: 2 === d ? "buy" : "sell",
              i: s(r)
            })
          }
          l.sort((e, t) => e.t - t.t), this.walls = a, this.trades = l, this.wallById = new Map(a.map(e => [e.id, e])), this.version++
        }
      }
      let C = e => "alive" === e.status ? e.usd : e.initUsd,
        I = (e, t) => C(e) >= t.cancelMin,
        B = (e, t) => t.exSel.has(e.ex) && C(e) >= t.threshold && ("bid" === e.side ? t.bid : t.ask) && ("cancelled" !== e.status || t.cancelled && I(e, t)),
        F = (e, t) => t.exSel.has(e.ex) && e.usd >= t.threshold,
        $ = (e, t) => {
          let s = 0;
          for (let a = 1; a < 5; a++) e >= t[a] && (s = a);
          return s
        },
        W = e => "alive" === e.status ? e.filledUsd > 0 ? "part" : "live" : "filled" === e.status ? "filled" : "cancelled";

      function L(e, t, s, a) {
        let l = e.N,
          i = new Float64Array(l),
          r = new Float64Array(l),
          o = new Float64Array(l),
          n = new Float64Array(l),
          d = new Float64Array(l),
          c = new Float64Array(l),
          h = new Float64Array(l),
          p = new Float64Array(l),
          u = new Float64Array(l),
          f = new Float64Array(l),
          g = e.t0 + l * e.step,
          x = new Int32Array(l),
          m = new Int32Array(l),
          b = new Float64Array(l),
          w = new Float64Array(l),
          v = new Int32Array(l),
          y = new Int32Array(l),
          k = e.close;
        for (let a of e.walls) {
          if (!t.exSel.has(a.ex)) continue;
          let e = C(a);
          a.startT < g && (("bid" === a.side ? i : r)[a.s] += a.initUsd), "cancelled" === a.status && null != a.end && a.endT < g && (("bid" === a.side ? o : n)[a.end] += a.initUsd);
          let h = null == a.end ? l - 1 : Math.min(l - 1, a.end),
            p = "bid" === a.side,
            u = p ? d : c,
            f = p ? x : m,
            j = p ? b : w,
            N = p ? v : y;
          for (let t = a.s; t <= h; t++) {
            let l = k[t],
              i = Math.abs(a.price - l);
            i <= l * s && (u[t] += e, f[t]++), i <= .03 * l && (j[t] += e, N[t]++)
          }
        }
        for (let s of e.trades) !F(s, t) || s.i < 0 || s.i >= l || s.t >= g || (f[s.i] += "buy" === s.side ? s.usd : -s.usd);
        let j = 0,
          N = 0,
          M = 0;
        for (let e = 0; e < l; e++) {
          let t = d[e] + c[e];
          h[e] = t ? (d[e] - c[e]) / t : 0, j += i[e] - r[e], p[e] = j, N += f[e], u[e] = N, M = Math.max(M, i[e], r[e], o[e], n[e])
        }
        let S = {
            nb: i,
            na: r,
            cb: o,
            ca: n,
            bidA: d,
            askA: c,
            imb: h,
            cwd: p,
            tnf: u,
            flowMax: M || 1
          },
          T = e.step / 36e5,
          V = Math.max(1, Math.round(24 / T)),
          z = (e, t) => e + V < l ? +((k[e + V] - k[e]) * t > 0) : -1,
          _ = (e, t) => +(e >= O.WG.side && t >= O.WG.side && e + t >= O.WG.total),
          A = new Uint8Array(l),
          P = new Float64Array(l),
          I = new Uint8Array(l);
        for (let e = 0; e < l; e++) {
          A[e] = _(x[e], m[e]), I[e] = _(v[e], y[e]);
          let t = b[e] + w[e];
          P[e] = t ? (b[e] - w[e]) / t : 0
        }
        let B = h,
          $ = A,
          W = P,
          L = I,
          q = l,
          E = e => e,
          U = T;
        if (T < 1) {
          let t = Math.floor(e.t0 / 36e5);
          B = new Float64Array(q = Math.floor((e.t0 + (l - 1) * e.step) / 36e5) - t + 1), $ = new Uint8Array(q), W = new Float64Array(q), L = new Uint8Array(q);
          let s = new Int32Array(q).fill(-1);
          for (let a = 0; a < l; a++) s[Math.floor((e.t0 + a * e.step) / 36e5) - t] = a;
          for (let e = 0; e < q; e++) {
            s[e] < 0 && (s[e] = e ? s[e - 1] : 0);
            let t = s[e];
            B[e] = h[t], $[e] = A[t], W[e] = P[t], L[e] = I[t]
          }
          E = e => s[e], U = 1
        }
        let D = Math.max(1, Math.round(6 / U)),
          H = Math.max(1, Math.round(24 / U)),
          R = Math.max(1, Math.round(3 / U)) - 1,
          Q = Math.max(6, Math.round(72 / U)),
          K = Math.max(1, Math.round(12 / U)),
          G = new Float64Array(q),
          X = new Uint8Array(q);
        for (let e = 0; e < q; e++) {
          if (!L[e]) continue;
          let t = 0,
            s = 0,
            a = 0;
          for (let l = Math.max(0, e - Q); l < e; l++) L[l] && (t += W[l], s += W[l] * W[l], a++);
          if (a < .6 * Q) continue;
          let l = t / a,
            i = s / a - l * l;
          i <= 1e-9 || (G[e] = (W[e] - l) / Math.sqrt(i), X[e] = 1)
        }
        let J = 0;
        for (; J < q && e.t0 + E(J) * e.step < a;) J++;
        J += D;
        let Y = (e, t, a, l, i) => {
            let r = [];
            if (s > .03) return r;
            let o = 0 / 0,
              n = -1e9,
              d = 0;
            for (let s = J; s < q; s++) {
              if (!t[s]) {
                o = 0 / 0;
                continue
              }
              let c = e[s],
                h = o != o ? 0 : c > a && o <= a ? 1 : c < -a && o >= -a ? -1 : 0;
              if (o = c, !h || h === d && s - n < H) continue;
              let p = !0;
              for (let i = 1; i <= l; i++)(s + i >= q || !t[s + i] || e[s + i] * h < a) && (p = !1);
              if (!p) continue;
              n = s, d = h;
              let u = E(s + l);
              r.push({
                i: u,
                h: s + l,
                dir: h,
                hi: i,
                hit: z(u, h)
              })
            }
            return r
          },
          Z = Y(B, $, .5, R, !1),
          ee = Y(G, X, 1.5, R, !0),
          et = [];
        for (let e of Z) {
          let t = ee.find(t => t.dir === e.dir && Math.abs(t.h - e.h) <= K);
          if (!t) continue;
          let s = Math.max(e.h, t.h),
            a = E(s);
          et.push({
            i: a,
            dir: e.dir,
            hi: !0,
            hit: z(a, e.dir)
          })
        }
        let es = Math.max(1, Math.round(6 / U)),
          ea = Math.max(4, Math.round(48 / U)),
          el = [];
        if (s <= .03) {
          let e = {
            1: -1e9,
            "-1": -1e9
          };
          for (let t = Math.max(J, es); t < q - 1; t++) {
            if (!$[t]) continue;
            let s = B[t];
            if (.7 > Math.abs(s)) continue;
            let a = s > 0 ? 1 : -1,
              l = !0,
              i = 1 / 0;
            for (let e = t - es; e < t; e++) {
              if (!$[e]) continue;
              let t = B[e] * a;
              if (t >= s * a) {
                l = !1;
                break
              }
              t < i && (i = t)
            }
            if (!l || s * a - i < .4) continue;
            let r = -1;
            for (let e = t + 1; e <= Math.min(q - 1, t + es); e++) {
              if (!$[e]) continue;
              let t = B[e] * a;
              if (t > s * a) break;
              if (s * a - t >= .2) {
                r = e;
                break
              }
            }
            if (r < 0) continue;
            let o = E(r),
              n = 1 / 0,
              d = -1 / 0;
            for (let e = Math.max(0, r - ea); e <= r; e++) {
              let t = k[E(e)];
              t < n && (n = t), t > d && (d = t)
            }
            let c = (k[o] - n) / (d - n || 1);
            a > 0 && c > .3 || a < 0 && c < .7 || r - e[a] < H || (e[a] = r, el.push({
              i: o,
              dir: a,
              rev: !0,
              hit: z(o, a)
            }))
          }
        }
        return S.marks = Z.concat(et, el).sort((e, t) => e.i - t.i || (e.hi ? 1 : -1)), S.sigDays = Math.max(1, Math.round((l - Math.min(l, E(Math.min(q - 1, J)))) * T / 24)), S.noSig = s > .03, S
      }
      var q = s(30274),
        E = s(26152);
      let U = (e, t) => [e.id, t, +e.price, e.side, e.startTime, e.currentTime, null == e.endTime ? null : e.endTime, +e.startUsd, +e.currentUsd, +e.volUsd, e.count],
        D = (e, t) => [e.id, t, e.turnoverTime, +e.price, +e.volUsd, e.side],
        H = (e, t, s) => {
          for (let a of e || []) {
            let e = (0, O.A9)(a.instrument.name, a.instrument.exName);
            for (let l of a.list || []) s.push(t(l, e))
          }
          return s
        },
        R = e => e[1] + "/" + e[0],
        Q = (e, t) => {
          let s = R(t),
            a = e.get(s);
          a && null != a[6] && null == t[6] || e.set(s, t)
        },
        K = e => new Promise(t => setTimeout(t, e)),
        G = () => Math.floor(Date.now() / 1e3) - 5;
      async function X(e, t, s) {
        let a = await (0, q.Iq)({
          symbol: (0, O.BI)(e).api,
          interval: O.PU[t],
          endTime: s
        });
        return Array.isArray(a.data) ? a.data : []
      }
      async function J(e, t) {
        let s = await (0, q.Iq)({
          symbol: (0, O.BI)(e).api,
          interval: O.PU[t],
          limit: 3
        });
        return Array.isArray(s.data) ? s.data : []
      }
      let Y = e => {
        let t = e && e.response,
          s = t && t.status;
        return (0, E.Tr)(e) ? "40003" === e.code : !t || 429 === s || s >= 500
      };
      async function Z(e, t, s = 4) {
        for (let a = 0;; a++) try {
          return await e(t)
        } catch (l) {
          if (!Y(l) || a >= s) throw l;
          let e = l && l.response,
            t = Number(e && e.headers && e.headers["retry-after"]) || 1;
          await K(1e3 * Math.max(1, t) * (a + 1))
        }
      }
      async function ee(e, t) {
        let s = 0,
          a = async () => {
            for (; s < e.length;) await e[s++]()
          };
        await Promise.all(Array.from({
          length: Math.min(t, e.length)
        }, a))
      }
      let et = {},
        es = {},
        ea = e => es[e] || null;

      function el(e, t, s, a, l, i, r, o) {
        let n = [];
        for (let d = i; d > l;) {
          let i = Math.max(l, d - 604800),
            c = d;
          n.push(() => er(e, t, s, a, i, c, r, o)), d = i
        }
        return n
      }
      let ei = (e, t) => Math.max(e[7] || 0, e[8] || 0) >= t;
      async function er(e, t, s, a, l, i, r, o) {
        for (let n = i; n > l;) {
          let i;
          try {
            i = await Z(e, {
              exchange: s,
              symbol: a,
              startTime: l,
              endTime: n,
              minUsd: r
            }, n - l > 86400 ? 1 : 4)
          } catch (d) {
            if (!Y(d) || n - l <= 86400) throw d;
            let i = Math.floor((l + n) / 2);
            await er(e, t, s, a, i, n, r, o), await er(e, t, s, a, l, i, r, o);
            return
          }
          let d = H(i.data, U, []);
          for (let t of d)(e !== q.VF || ei(t, (0, O.Db)(a))) && o.push(t);
          if (o.page && o.page(), d.length < q.AI) break;
          let c = 1 / 0;
          for (let e of d) null != e[t] && e[t] < c && (c = e[t]);
          let h = Math.floor(c / 1e3) + 1;
          if (!(h < n)) break;
          n = h
        }
      }
      let eo = (e, t, s, a, l, i, r, o) => ee(el(e, t, s, a, l, i, r, o), 1),
        en = (e, t, s, a, l, i, r) => el(q.CD, 6, e.brand, t, s, a, l, r).concat(i ? el(q.VF, 4, e.brand, t, s, a, (0, O.Lr)(t), r) : []);

      function ed(e, t, s) {
        if (s.length < q.AI) {
          let a = new Set(s.map(R));
          for (let [s, l] of e.walls) {
            if (null != l[6] || a.has(s)) continue;
            let i = O.aV[l[1]];
            i && i.key === t.key && e.walls.delete(s)
          }
        }
        for (let t of s) Q(e.walls, t)
      }
      async function ec(e, t, s, a) {
        let l = Date.now(),
          i = H((await Z(q.e2, {
            exchange: t.brand,
            symbol: s,
            minUsd: a
          })).data, U, []);
        e.live[t.key] > l || ed(e, t, i)
      }
      async function eh(e, t, s, a, l, i, r, o) {
        await ee([async () => {
          await ec(e, t, s, i), o.page && o.page()
        }].concat(en(t, s, a, l, i, r, o)), 2)
      }
      async function ep(e, t, s, a, l) {
        let i = [];
        for (let r of (Date.now() - (e.live[t.key] || 0) < 2e4 || (await ec(e, t, s, l), await eo(q.CD, 6, t.brand, s, a - 7200, a, l, i)), e.cancelled.has(t.key) && await eo(q.VF, 4, t.brand, s, a - 172800, a, (0, O.Lr)(s), i), i)) Q(e.walls, r)
      }
      let eu = "largeTakerOrderCurrent",
        ef = "largeTakerOrderFinish",
        eg = (e, t) => {
          let s = {
            exchange: t.brand,
            symbol: e,
            market: "all",
            limit: q.AI,
            minVolUsd: String(O.tK[(0, O.BI)(e).cls][1])
          };
          return [{
            channel: eu,
            ...s
          }, {
            channel: ef,
            ...s,
            lookbackSeconds: 86400
          }]
        },
        ex = e => e && e.channel ? [e.channel, String(e.exchange || "").toLowerCase(), String(e.symbol || "").toUpperCase(), String(e.market || "all").toLowerCase(), Number(null == e.limit ? 200 : e.limit), Number(null == e.minVolUsd ? 0 : e.minVolUsd), e.channel === ef ? Number(null == e.lookbackSeconds ? 86400 : e.lookbackSeconds) : ""].join("|") : null;
      async function em(e, t, s) {
        try {
          let a = await (0, q.q9)({
            symbol: (0, O.BI)(e).api,
            startTime: t,
            endTime: s
          });
          return H(a.data, D, [])
        } catch (e) {
          return []
        }
      }
      let eb = {},
        ew = e => eb[e] || null,
        ev = e => ({
          walls: [...e.walls.values()],
          trades: e.histTrades.length ? e.trades.concat(e.histTrades) : e.trades
        });
      async function ey(e, t, s, a, l, i, r = 1209600) {
        let o = G(),
          n = eb[e];
        if (!n) {
          let t = (o - r) * 1e3;
          n = eb[e] = {
            walls: new Map,
            keys: new Set,
            cancelled: new Set,
            live: {},
            trades: [],
            histTrades: [],
            at: 0,
            from: t,
            hist: {
              busy: !1,
              done: !1,
              from: t,
              retryAt: 0,
              fails: 0
            }
          }
        }
        let d = t.filter(e => !n.keys.has(e) && (0, O._H)(e)),
          c = i ? t.filter(e => n.keys.has(e) && !n.cancelled.has(e)) : [],
          h = s || Date.now() - n.at >= 6e4;
        if (!d.length && !c.length && !h) return n;
        let p = O.tK[(0, O.BI)(e).cls][1],
          u = Math.floor(n.hist.from / 1e3),
          f = 0,
          g = [],
          x = d.map(e => (0, O._H)(e)),
          m = h ? t.filter(e => n.keys.has(e)).map(e => (0, O._H)(e)) : [],
          b = c.map(e => (0, O._H)(e)).filter(Boolean),
          w = x.length + m.length + b.length,
          v = 0,
          y = {
            push: e => Q(n.walls, e),
            page: () => {
              l && !v && (v = setTimeout(() => {
                v = 0, l(ev(n))
              }, 150))
            }
          },
          k = () => {
            f++, a && a(f, w)
          };
        for (let t of x) g.push(async () => {
          await eh(n, t, e, u, o, p, i, y), n.keys.add(t.key), i && n.cancelled.add(t.key), k()
        });
        for (let t of b) g.push(async () => {
          await ee(el(q.VF, 4, t.brand, e, u, o, (0, O.Lr)(e), y), 3), n.cancelled.add(t.key), k()
        });
        for (let t of m) g.push(async () => {
          try {
            await ep(n, t, e, o, p)
          } catch (e) {}
          k()
        });
        a && a(0, w);
        let j = h || !n.at ? em(e, Math.floor(n.from / 1e3), o).then(e => {
          n.trades = e
        }) : null;
        try {
          await ee(g, 3)
        } finally {
          clearTimeout(v)
        }
        return j && await j, n.at = Date.now(), n
      }
      async function ek(e, t, s, a = 604800) {
        let l = eb[e];
        if (!l || !l.keys.size) return !1;
        let i = l.hist;
        if (i.busy || i.done || performance.now() < i.retryAt || t >= i.from) return !1;
        i.busy = !0;
        try {
          let r = Math.floor(i.from / 1e3),
            o = G() - 7603200,
            n = Math.max(o, Math.min(r - a, Math.floor(t / 1e3)));
          if (n >= r) return i.done = !0, !1;
          s && s();
          let d = O.tK[(0, O.BI)(e).cls][1],
            c = [],
            h = [...l.keys].flatMap(e => (0, O._H)(e) || []).flatMap(t => en(t, e, n, r, d, l.cancelled.has(t.key), c)),
            [p] = await Promise.all([em(e, n, r), ee(h, 3)]);
          for (let e of c) Q(l.walls, e);
          let u = new Set(l.trades.concat(l.histTrades).map(R));
          for (let e of p) {
            let t = R(e);
            u.has(t) || (u.add(t), l.histTrades.push(e))
          }
          return i.from = 1e3 * n, n <= o && (i.done = !0), i.fails = 0, !0
        } catch (e) {
          return i.fails++, i.retryAt = performance.now() + Math.min(3e4, 2e3 * Math.pow(2, i.fails - 1)), !1
        } finally {
          i.busy = !1
        }
      }
      async function ej(e, t, s, a, l) {
        let i = O.tK[(0, O.BI)(e).cls][1],
          r = [],
          o = t.map(e => (0, O._H)(e)).filter(Boolean).flatMap(t => en(t, e, s, a, i, !0, r)),
          n = 0;
        return l && l(0, o.length), await ee(o.map(e => async () => {
          await e(), n++, l && l(n, o.length)
        }), 3), r
      }
      let eN = {};
      async function eM(e, t, s) {
        let a = e + "|" + t.slice().sort().join(",");
        if (eN[a]) return eN[a];
        let l = await X(e, "1h");
        if (l.length < 48) throw Error("backtest: no candles");
        let i = l[0][0],
          r = await ey(e, t, !1, null, null, !0),
          o = ev(r).walls,
          n = r.hist.from;
        if (n / 1e3 > i + 3600) {
          let a = await ej(e, t, i, Math.floor(n / 1e3), s),
            l = new Set(o.map(e => e[1] + "/" + e[0]));
          o = o.concat(a.filter(e => !l.has(e[1] + "/" + e[0]))), n = 1e3 * i
        }
        return eN[a] = {
          rows: l,
          walls: o,
          covFrom: n
        }
      }
      let eS = e => {
        if (!e.length) return null;
        let t = e.slice().sort((e, t) => e - t),
          s = t.length >> 1;
        return t.length % 2 ? t[s] : (t[s - 1] + t[s]) / 2
      };
      async function eT(e, t, s, a, l) {
        let {
          rows: i,
          walls: r,
          covFrom: o
        } = await eM(e, t, l), n = new P(i, e, 60);
        n.applyOrders({
          walls: r,
          trades: []
        });
        let d = L(n, s, a, o),
          c = n.close,
          h = n.N,
          p = 0;
        for (; p < h && n.tsAt(p) < o;) p++;
        let u = Math.max(1, (h - p) / 24),
          f = 0,
          g = 0;
        for (let e = p; e + 24 < h; e++) f++, c[e + 24] > c[e] && g++;
        let x = () => ({
            n: 0,
            d8: 0,
            h8: 0,
            d24: 0,
            h24: 0,
            moves: []
          }),
          m = {
            reg: x(),
            hi: x(),
            rev: x()
          };
        for (let e of d.marks) {
          if (e.i < p) continue;
          let t = m[e.rev ? "rev" : e.hi ? "hi" : "reg"];
          t.n++, e.i + 8 < h && (t.d8++, (c[e.i + 8] - c[e.i]) * e.dir > 0 && t.h8++), e.i + 24 < h && (t.d24++, (c[e.i + 24] - c[e.i]) * e.dir > 0 && t.h24++, t.moves.push((c[e.i + 24] - c[e.i]) / c[e.i] * 100 * e.dir))
        }
        let b = {};
        for (let e in m) {
          let t = m[e];
          b[e] = {
            n: t.n,
            perMonth: 30 * t.n / u,
            hit8: t.d8 ? t.h8 / t.d8 : null,
            hit24: t.d24 ? t.h24 / t.d24 : null,
            med: eS(t.moves),
            d24: t.d24
          }
        }
        return {
          sym: e,
          from: n.tsAt(p),
          to: n.tsAt(h - 1),
          days: Math.round(u),
          grades: b,
          base: f >= 48 ? g / f : null,
          noSig: d.noSig,
          validated: !d.noSig && b.reg.d24 >= 5 && b.reg.hit24 >= .6
        }
      }
      let eV = "largeOrdersPrefs",
        ez = "largeOrdersColors",
        e_ = "largeOrdersWatch2",
        eA = {
          symbol: "BTC",
          interval: "15m",
          exSel: O.EX.filter(e => O.TU.includes(e.key)).map(e => e.id),
          thrBy: {},
          candles: !0,
          bid: !0,
          ask: !0,
          trades: !0,
          cancelled: !1,
          signals: !0,
          revSig: !0,
          panes: {
            imb: !0,
            cwd: !1,
            tnf: !0
          },
          imbWin: .02,
          tab: "book",
          bookPct: 1,
          tapeLimit: 60,
          bt: "live",
          btLimit: 50,
          apTab: "walls",
          newAlert: !1,
          apPos: null
        },
        eO = ["candles", "bid", "ask", "trades", "signals", "revSig", "newAlert"],
        eP = e => {
          try {
            return JSON.parse(window.localStorage.getItem(e) || "null")
          } catch (e) {
            return null
          }
        },
        eC = (e, t) => {
          try {
            window.localStorage.setItem(e, JSON.stringify(t))
          } catch (e) {}
        },
        eI = (e, t) => e.length === t.length && t.every(t => e.includes(t)),
        eB = 0;

      function eF(e) {
        clearTimeout(eB), eB = setTimeout(() => eC(eV, {
          v: 1,
          ...e
        }), 300)
      }
      let e$ = ["id", "ex", "side", "price", "initUsd", "usd", "filledUsd", "fills", "cancelledUsd", "startT", "snapT", "endT", "status"],
        eW = e => Object.fromEntries(e$.map(t => [t, e[t]])),
        eL = e => e && "string" == typeof e.id && e.id.length < 64 && ("bid" === e.side || "ask" === e.side) && ["alive", "filled", "cancelled"].includes(e.status) && ["price", "initUsd", "usd", "filledUsd", "startT"].every(t => Number.isFinite(e[t]));

      function eq(e) {
        eC(e_, [...e.values()])
      }
      class eE {
        constructor(e) {
          this.liveAt = 0, this.onHover = null, this.subscribe = e => (this.listeners.add(e), () => this.listeners.delete(e)), this.getVersion = () => this.version, this.subscribeOrders = e => (this.ordersSubs.add(e), () => this.ordersSubs.delete(e)), this.getOrders = () => this.orders, this.prefs = {
            ...eA,
            exSel: eA.exSel.slice(),
            thrBy: {},
            panes: {
              ...eA.panes
            }
          }, (0, O.Bm)(e) && (this.prefs.symbol = e), this.watch = new Map, this.ds = null, this.series = null, this.status = "loading", this.orders = {
            state: "idle",
            done: 0,
            total: 0
          }, this.ordersSubs = new Set, this.bt = {
            key: "",
            state: "idle",
            done: 0,
            total: 0,
            res: null
          }, this.loading = !1, this.selectedId = null, this.newFeed = {
            sym: null,
            seen: new Set,
            list: [],
            unread: 0,
            fresh: new Set
          }, this.toasts = [], this.chart = null, this.panes = new Map, this.hist = {
            busy: !1,
            done: !1,
            retryAt: 0,
            fails: 0
          }, this.version = 0, this.listeners = new Set, this.seq = 0, this.timers = [], this.deferred = new Map, this.idleTimer = 0, this.movedAt = 0, this._vl = 0 / 0, this._vb = 0 / 0, this.started = !1, this.sock = null, this.liveSubs = new Set, this.liveT = 0, this.liveOpened = !1, this.klSock = null, this.klGuid = null, this.klDs = null, this.priceT = 0, this.notify = this.notify.bind(this)
        }
        setOrders(e, t) {
          for (let t of (this.orders = e, this.ordersSubs)) t();
          t && this.notify()
        }
        notify() {
          for (let e of (this.version++, this.listeners)) e()
        }
        get threshold() {
          var e, t;
          let s, a, l;
          return e = this.prefs.symbol, t = this.prefs.thrBy, s = (0, O.BI)(e), a = O.tK[s.cls], l = null != t[e] ? t[e] : s.thr, a.includes(l) ? l : a.reduce((e, t) => Math.abs(t - l) < Math.abs(e - l) ? t : e, a[0])
        }
        get exEff() {
          let e = ea(this.prefs.symbol),
            t = this.prefs.exSel;
          if (!e) return t;
          let s = t.filter(t => e.has(t));
          return s.length ? s : O.EX.filter(t => e.has(t.id)).map(e => e.id)
        }
        get exKeys() {
          return [...new Set(this.exEff.flatMap(e => {
            let t = O.aV[String(e)];
            return t ? [t.key] : []
          }))]
        }
        get filters() {
          let e = this.prefs,
            t = ea(e.symbol);
          return this._F && this._Fp === e && this._Fs === t || (this._F = {
            exSel: new Set(this.exEff),
            threshold: this.threshold,
            bid: e.bid,
            ask: e.ask,
            cancelled: e.cancelled,
            bookPct: e.bookPct,
            cancelMin: (0, O.Db)(e.symbol)
          }, this._Fp = e, this._Fs = t), this._F
        }
        get tiers() {
          let e;
          return e = (0, O.BI)(this.prefs.symbol).size, O.HA.map(t => t * e)
        }
        get coin() {
          let e = (0, O.BI)(this.prefs.symbol);
          return null != e.dec ? e : {
            ...e,
            dec: this.ds && this.ds.sym === this.prefs.symbol ? (0, O.q3)(this.ds.curPrice) : 2
          }
        }
        firstWindowSec() {
          return Math.max(86400, Math.ceil(240 * O.B0[this.prefs.interval] * 72))
        }
        covFrom() {
          let e = ew(this.prefs.symbol);
          return e && (e.hist && e.hist.from || e.from) || 0
        }
        start(e) {
          if (this.started) return;
          this.started = !0, this.prefs = function() {
            let e, t = window.matchMedia && window.matchMedia("(max-width: 640px)").matches,
              s = t ? (e = O.Qj, O.EX.filter(t => e.includes(t.key)).map(e => e.id)) : eA.exSel.slice(),
              a = {
                ...eA,
                exSel: s,
                thrBy: {},
                panes: {
                  ...eA.panes
                }
              },
              l = eP(eV);
            if (!l || 1 !== l.v) return a;
            if ((0, O.Bm)(l.symbol) && (a.symbol = l.symbol), l.interval in O.B0 && (a.interval = l.interval), Array.isArray(l.exSel) && !eI(l.exSel, O.qc) && !(t && eI(l.exSel, eA.exSel))) {
              let e = l.exSel.filter(e => O.EX.some(t => t.id === e));
              e.length && (a.exSel = e)
            }
            if (l.thrBy && "object" == typeof l.thrBy)
              for (let e in l.thrBy)(0, O.Bm)(e) && Number.isFinite(l.thrBy[e]) && l.thrBy[e] >= 0 && (a.thrBy[e] = l.thrBy[e]);
            for (let e of eO) "boolean" == typeof l[e] && (a[e] = l[e]);
            if (l.panes && "object" == typeof l.panes)
              for (let e in a.panes) "boolean" == typeof l.panes[e] && (a.panes[e] = l.panes[e]);
            return O.JK.includes(l.imbWin) && (a.imbWin = l.imbWin), ["book", "new"].includes(l.tab) && (a.tab = l.tab), [.1, .2, .3, .5, 1].includes(l.bookPct) && (a.bookPct = l.bookPct), ["live", "hist", "watch"].includes(l.bt) && (a.bt = l.bt), Number.isInteger(l.btLimit) && l.btLimit >= 50 && l.btLimit <= 2e3 && (a.btLimit = l.btLimit), Number.isInteger(l.tapeLimit) && l.tapeLimit >= 60 && l.tapeLimit <= 2e3 && (a.tapeLimit = l.tapeLimit), ("walls" === l.apTab || "trades" === l.apTab) && (a.apTab = l.apTab), l.apPos && Number.isFinite(l.apPos.x) && Number.isFinite(l.apPos.y) && 5e3 > Math.abs(l.apPos.x) && 5e3 > Math.abs(l.apPos.y) && (a.apPos = {
              x: l.apPos.x,
              y: l.apPos.y
            }), a
          }(), this.watch = function() {
            let e = new Map,
              t = eP(e_);
            if (Array.isArray(t))
              for (let s of t) s && (0, O.Bm)(s.sym) && eL(s.w) && e.set(s.w.id, {
                sym: s.sym,
                w: s.w
              });
            return e
          }();
          let t = String(e && e.symbol || "").toUpperCase();
          (0, O.Bm)(t) && (this.prefs.symbol = t), this.load(!1);
          let s = e => () => {
            ("u" < typeof document || !document.hidden) && e()
          };
          this.timers.push(setInterval(s(() => this.pollCandles()), 15e3)), this.timers.push(setInterval(s(() => this.pollOrders()), 6e4)), this.notify()
        }
        dispose() {
          for (let e of this.timers) clearInterval(e);
          this.timers = [], this.seq++, this.started = !1, clearTimeout(this.idleTimer), this.deferred.clear(), clearTimeout(this.liveT), this.liveT = 0, this.sock && (this.sock.clear(), this.sock.close(), this.sock = null), this.liveSubs.clear(), this.liveOpened = !1, clearTimeout(this.priceT), this.priceT = 0, this.klSock && (this.klSock.clear(), this.klSock.close(), this.klSock = null), this.klGuid = null, this.klDs = null
        }
        syncPrice() {
          let e = this.ds,
            t = this.prefs.interval,
            s = this.started && e && "ready" === this.status && e.sym === this.prefs.symbol && e.ivMin === O.B0[t],
            a = s ? (0, O.BI)(e.sym).api + "#kline" : null,
            l = s ? a + "#" + O.PU[t] : null;
          l === this.klGuid && e === this.klDs || (this.klGuid && this.klSock && this.klSock.unsubscribe(this.klGuid), this.klGuid = l, this.klDs = l ? e : null, l && (this.klSock || (this.klSock = new A.Ay(A.bm, e => e && e.params && e.params.listenerGuid)), this.klSock.subscribe(l, {
            channel: "kline",
            interval: O.PU[t],
            symbol: a,
            listenerGuid: l
          }, t => this.onPrice(e, t.data))))
        }
        onPrice(e, t) {
          if (e !== this.ds || !Array.isArray(t) || t.length < 5) return;
          let s = e.pushCandle(t);
          !s || ("new" === s ? (this.recompute(), this.pushChart(!0)) : this.chart && this.chart.invalidate(), this.priceT || (this.priceT = setTimeout(() => {
            this.priceT = 0, this.notifySoon()
          }, 1e3)))
        }
        syncLive() {
          if (!this.started) return;
          let e = this.prefs.symbol,
            t = ew(e),
            s = new Map;
          if (t)
            for (let a of this.exKeys) {
              let l = (0, O._H)(a);
              if (l && t.keys.has(a))
                for (let t of eg(e, l)) s.set(ex(t), {
                  p: t,
                  g: l
                })
            }
          if (s.size || this.liveSubs.size) {
            for (let e of (this.sock || (this.sock = new A.Ay(A.io, e => ex(e && e.params), e => this.onLiveOpen(e))), [...this.liveSubs])) s.has(e) || (this.sock.unsubscribe(e), this.liveSubs.delete(e));
            for (let [t, {
                p: a,
                g: l
              }] of s) this.liveSubs.has(t) || (this.liveSubs.add(t), this.sock.subscribe(t, a, t => this.onLive(e, l, t)))
          }
        }
        onLive(e, t, s) {
          e !== this.prefs.symbol || ! function(e, t, s, a) {
            let l = eb[e];
            if (!l || !l.keys.has(t.key) || !Array.isArray(a)) return !1;
            let i = H(a, U, []);
            if (s === eu) l.live[t.key] = Date.now(), ed(l, t, i);
            else if (s !== ef) return !1;
            else
              for (let e of i) Q(l.walls, e);
            return !0
          }(e, t, s.channel, s.data) || (this.liveAt = Date.now(), this.liveT || (this.liveT = setTimeout(() => {
            this.liveT = 0;
            let e = this.ds,
              t = ew(this.prefs.symbol);
            e && t && e.sym === this.prefs.symbol && this.applyOrders(t)
          }, 300)))
        }
        onLiveOpen(e) {
          e && (this.liveOpened && this.pollOrders(), this.liveOpened = !0)
        }
        chartBusy() {
          let e = this.chart;
          return !!e && !!(e.drag || e.pinch || e.inertia || e.anim || performance.now() - this.movedAt < 250)
        }
        whenIdle(e, t) {
          if (!this.chartBusy()) {
            this.deferred.delete(e), t();
            return
          }
          if (this.deferred.set(e, t), this.idleTimer) return;
          let s = () => {
            if (this.chartBusy()) {
              this.idleTimer = setTimeout(s, 120);
              return
            }
            this.idleTimer = 0;
            let e = [...this.deferred.values()];
            for (let t of (this.deferred.clear(), e)) t()
          };
          this.idleTimer = setTimeout(s, 120)
        }
        notifySoon() {
          this.whenIdle("notify", () => this.notify())
        }
        attachChart(e) {
          this.chart = e, e && (e.onFrame = t => {
            if (!t) return;
            let s = e.view;
            (s.left !== this._vl || s.barW !== this._vb) && (this._vl = s.left, this._vb = s.barW, this.movedAt = performance.now()), this.drawPanes(), this.maybeLoadHistory()
          }, e.onHover = e => {
            let t = !1;
            for (let s of this.panes.values()) s.hoverI !== e && (s.hoverI = e, t = !0);
            t && this.drawPanes(), this.onHover && this.onHover(e)
          }, e.edgeNote = () => this.edgeNote(), this.pushChart(!1))
        }
        attachPane(e, t) {
          t ? this.panes.set(e, t) : this.panes.delete(e)
        }
        drawPanes() {
          for (let e of this.panes.values()) e.draw()
        }
        pushChart(e, t) {
          let s = this.chart;
          if (!s) return;
          let a = this.prefs;
          s.setDec(this.coin.dec), s.setFilters(this.filters, this.tiers, {
            candles: a.candles,
            trades: a.trades,
            signals: a.signals,
            revSig: a.revSig
          }), s.series = this.series, s.model !== this.ds || e ? s.setModel(this.ds, {
            keepView: e,
            shift: t
          }) : s.invalidate(), this.drawPanes()
        }
        set(e, t) {
          (eF(this.prefs = {
            ...this.prefs,
            ...e
          }), "reload" === t) ? this.load(!1): ("filters" === t ? (this.recompute(), this.scanNewWalls(), this.pushChart(!1), this.maybeBacktest(), ("exSel" in e || "cancelled" in e) && this.ensureOrders(), "exSel" in e && this.syncLive()) : "chart" === t && this.pushChart(!1), this.notify())
        }
        setSymbol(e) {
          (0, O.Bm)(e) && e !== this.prefs.symbol && (this.selectedId = null, this.set({
            symbol: e
          }, "reload"))
        }
        setInterval(e) {
          e in O.B0 && e !== this.prefs.interval && this.set({
            interval: e
          }, "reload")
        }
        setThreshold(e) {
          this.set({
            thrBy: {
              ...this.prefs.thrBy,
              [this.prefs.symbol]: e
            }
          }, "filters")
        }
        setExSel(e) {
          e.length && this.set({
            exSel: O.EX.filter(t => e.includes(t.id)).map(e => e.id)
          }, "filters")
        }
        toggleLayer(e) {
          this.set({
            [e]: !this.prefs[e]
          }, "bid" === e || "ask" === e || "cancelled" === e ? "filters" : "chart")
        }
        togglePane(e) {
          this.set({
            panes: {
              ...this.prefs.panes,
              [e]: !this.prefs.panes[e]
            }
          })
        }
        setImbWin(e) {
          this.prefs = {
            ...this.prefs,
            imbWin: e
          }, eF(this.prefs), this.recompute(), this.pushChart(!1), this.notify(), this.maybeBacktest()
        }
        toggleWatch(e) {
          if (this.watch.has(e)) this.watch.delete(e);
          else {
            let t = this.wallOf(e);
            if (!t) return;
            this.watch.set(e, {
              sym: this.prefs.symbol,
              w: eW(t)
            })
          }
          eq(this.watch), this.notify()
        }
        wallOf(e) {
          let t = this.ds;
          if (!t) return null;
          let s = t.wallById.get(e);
          if (s) return s;
          let a = this.watch.get(e);
          return a && a.sym === t.sym ? {
            ...a.w,
            stale: !0,
            s: t.idxOf(a.w.startT),
            end: null == a.w.endT ? null : t.idxOf(a.w.endT)
          } : null
        }
        watched() {
          let e = this.prefs.symbol,
            t = [];
          for (let s of this.watch.values())
            if (s.sym === e) {
              let e = this.wallOf(s.w.id);
              e && t.push(e)
            } return t
        }
        watchCount() {
          let e = 0;
          for (let t of this.watch.values()) t.sym === this.prefs.symbol && e++;
          return e
        }
        refreshWatch() {
          let e = this.ds;
          if (!e || !this.watch.size) return;
          let t = !1;
          for (let [s, a] of this.watch) {
            if (a.sym !== e.sym) continue;
            let l = e.wallById.get(s);
            l && (this.watch.set(s, {
              sym: a.sym,
              w: eW(l)
            }), t = !0)
          }
          t && eq(this.watch)
        }
        select(e) {
          this.selectedId = e;
          let t = this.wallOf(e);
          t && this.chart && (this.chart.highlightId = e, this.chart.focusPrice(t.price), this.chart.invalidate(!0)), this.notify()
        }
        locate(e) {
          let t = this.chart;
          if (!t) return;
          t.locateWall(e);
          let s = t.stage.getBoundingClientRect();
          if (s.top >= 72 && s.bottom <= window.innerHeight) return;
          let a = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          t.stage.scrollIntoView({
            block: "start",
            behavior: a ? "auto" : "smooth"
          })
        }
        highlight(e) {
          this.chart && this.chart.highlightId !== e && (this.chart.highlightId = e, this.chart.invalidate(!0))
        }
        openNewTab() {
          this.newFeed.unread = 0, this.newFeed.fresh = new Set, this.notify()
        }
        dismissToast(e) {
          this.toasts = this.toasts.filter(t => t.key !== e), this.notify()
        }
        recompute() {
          this.ds && (this.series = L(this.ds, this.filters, this.prefs.imbWin, this.covFrom()))
        }
        async load(e) {
          let t, s = ++this.seq,
            {
              symbol: a,
              interval: l
            } = this.prefs;
          this.syncLive(), this.syncPrice(), e || (this.loading = !0, this.ds || (this.status = "loading"), this.notify());
          let i = this.fetchOrders(a, s, e),
            r = e ? Promise.resolve(null) : Promise.race([i, new Promise(e => setTimeout(() => e(null), 1500))]);
          try {
            [t] = await Promise.all([X(a, l), r])
          } catch (t) {
            if (s !== this.seq) return;
            this.loading = !1, e && this.ds || (this.status = "error", this.ds = null, this.series = null, this.pushChart(!1)), this.notify();
            return
          }
          if (s !== this.seq) return;
          let o = O.B0[l],
            n = this.ds;
          if (t.length < 30) {
            this.loading = !1, this.status = "empty", this.ds = null, this.series = null, this.pushChart(!1), this.notify();
            return
          }
          if (e && n && n.sym === a && n.ivMin === o && n.merge(t)) this.recompute(), this.pushChart(!0);
          else {
            let s = new P(t, a, o),
              l = ew(a);
            l && s.applyOrders(ev(l)), this.ds = s, this.hist = {
              busy: !1,
              done: !1,
              retryAt: 0,
              fails: 0
            }, this.recompute(), this.pushChart(!!e && !!n && n.sym === a && n.ivMin === o)
          }
          this.status = "ready", this.loading = !1, this.scanNewWalls(), this.notify(), this.syncPrice();
          let d = await i;
          s === this.seq && d && this.ds && this.applyOrders(d)
        }
        fetchOrders(e, t, s) {
          let a = e => {
            t === this.seq && this.setOrders(e, !0)
          };
          s || ew(e) || a({
            state: "loading",
            done: 0,
            total: 0
          });
          let l = s => this.whenIdle("orders", () => {
            let a = this.ds;
            t === this.seq && a && a.sym === e && (a.applyOrders(s), this.recompute(), this.pushChart(!0), this.notify())
          });
          return (!et[e] && (et[e] = (0, q.De)({
            symbol: e
          }).then(t => {
            let s = t.data || {},
              a = new Set;
            for (let [e, t] of [
                ["spot", s.spot],
                ["perp", s.futures]
              ])
              for (let s of t || []) {
                let t = s.instruments && s.instruments[0] && s.instruments[0].name;
                t && a.add((0, O.PP)(String(t).split(":")[0], s.exchange).key + "-" + e)
              }
            return es[e] = a
          }).catch(t => {
            throw delete et[e], t
          })), et[e]).then(() => ey(e, this.exKeys, !1, s ? null : (e, t) => a({
            state: "loading",
            done: e,
            total: t
          }), s ? null : l, this.prefs.cancelled, this.firstWindowSec())).then(e => (s || a({
            state: "idle",
            done: 0,
            total: 0
          }), t === this.seq && this.syncLive(), e), () => (s || (a({
            state: "error",
            done: 0,
            total: 0
          }), setTimeout(() => {
            t === this.seq && this.fetchOrders(e, t, !1).then(e => {
              e && t === this.seq && this.applyOrders(e)
            })
          }, 1e4)), null))
        }
        applyOrders(e) {
          this.whenIdle("orders", () => this.applyOrdersNow(e))
        }
        applyOrdersNow(e) {
          let t = this.ds;
          t && t.sym === this.prefs.symbol && (t.applyOrders(ev(e)), this.refreshWatch(), this.recompute(), this.pushChart(!0), this.scanNewWalls(), this.notify(), "idle" === this.orders.state && this.maybeBacktest())
        }
        get btExchange() {
          let e = ea(this.prefs.symbol),
            t = t => !e || e.has(t);
          return O.O.find(e => "bn" === e.key && (t(e.perp.id) || t(e.spot.id))) || O.O.find(e => t(e.perp.id) || t(e.spot.id)) || null
        }
        maybeBacktest(e) {
          let t = this.prefs.symbol,
            s = this.prefs,
            a = this.btExchange;
          if (!a) return;
          let l = ea(t),
            i = [a.perp, a.spot].filter(e => !l || l.has(e.id)).map(e => e.id),
            r = t + "|" + s.imbWin + "|" + a.key,
            o = this.bt;
          if (!e && !o.key.startsWith(t + "|") || o.key === r && ("loading" === o.state || "ready" === o.state || "error" === o.state && !e) || !this.ds || this.ds.sym !== t || "ready" !== this.status) return;
          this.bt = {
            key: r,
            state: "loading",
            done: 0,
            total: 0,
            res: null
          }, this.notify();
          let n = () => this.bt.key === r && this.prefs.symbol === t;
          eT(t, [a.key], {
            exSel: new Set(i),
            threshold: 0
          }, s.imbWin, (e, t) => {
            n() && (this.bt = {
              ...this.bt,
              done: e,
              total: t
            }, this.notify())
          }).then(e => {
            n() && (this.bt = {
              key: r,
              state: "ready",
              done: 0,
              total: 0,
              res: {
                ...e,
                exchange: a.brand
              }
            }, this.notify())
          }, e => {
            n() && (this.bt = {
              key: r,
              state: "error",
              done: 0,
              total: 0,
              res: null
            }, this.notify())
          })
        }
        async pollCandles() {
          let e = this.ds;
          if (!e || "ready" !== this.status || this.chart && (this.chart.drag || this.chart.pinch)) return;
          let t = e.sym,
            s = this.prefs.interval;
          try {
            let a = await J(t, s);
            if (this.ds !== e || this.prefs.interval !== s) return;
            if (!e.merge(a)) return void this.load(!0);
            this.recompute(), this.pushChart(!0), this.notifySoon()
          } catch (e) {}
        }
        async pollOrders() {
          let e = this.ds;
          if (e && "ready" === this.status && "loading" !== this.orders.state) try {
            let t = await ey(e.sym, this.exKeys, !0, null, null, this.prefs.cancelled);
            this.ds === e && (this.applyOrders(t), this.syncLive())
          } catch (e) {}
        }
        ensureOrders() {
          let e = this.ds,
            t = e && ew(e.sym);
          if (!e || !t || "loading" === this.orders.state) return;
          let s = this.prefs.cancelled;
          if (this.exKeys.every(e => t.keys.has(e) && (!s || t.cancelled.has(e)))) return;
          let a = this.seq;
          this.fetchOrders(e.sym, a, !1).then(t => {
            t && a === this.seq && this.ds === e && this.applyOrders(t)
          })
        }
        maybeLoadHistory() {
          let e = this.chart,
            t = this.ds;
          if (!e || !t || e.model !== t) return;
          let s = e.view,
            a = e.geo.plotW / s.barW;
          s.left < Math.max(80, .6 * a) && this.loadHistory();
          let l = t.t0 + Math.max(0, s.left) * t.step,
            i = t.sym,
            r = this.seq;
          ek(i, l, () => {
            r === this.seq && "idle" === this.orders.state && this.setOrders({
              state: "hist",
              done: 0,
              total: 0
            })
          }, Math.max(86400, Math.ceil(a * t.step / 1e3))).then(e => {
            r === this.seq && "hist" === this.orders.state && this.setOrders({
              state: "idle",
              done: 0,
              total: 0
            });
            let s = ew(i);
            e && s && this.ds === t && this.applyOrders(s)
          })
        }
        async loadHistory() {
          let e = this.hist,
            t = this.ds;
          if (!(e.busy || e.done || performance.now() < e.retryAt)) {
            e.busy = !0, this.chart && this.chart.invalidate(!0);
            try {
              let s = Math.round(t.t0 / 1e3),
                a = (await X(t.sym, this.prefs.interval, s)).filter(e => e[0] < s);
              if (this.ds !== t) return;
              if (e.fails = 0, e.retryAt = 0, a.length < 30) {
                e.done = !0;
                return
              }
              t.prepend(a) && (this.recompute(), this.pushChart(!0, !0), this.notifySoon())
            } catch (s) {
              this.ds === t && (e.fails++, e.retryAt = performance.now() + Math.min(3e4, 2e3 * Math.pow(2, e.fails - 1)))
            } finally {
              this.ds === t && (e.busy = !1, this.chart && this.chart.invalidate(!0))
            }
          }
        }
        edgeNote() {
          let e = this.chart,
            t = this.hist,
            s = this.t;
          return s && e ? t.busy ? s("large-orderbook-statistics.hist.loading", {
            defaultValue: "Loading earlier history…"
          }) : e.view.left > 0 ? null : t.retryAt > performance.now() ? s("large-orderbook-statistics.hist.failed", {
            defaultValue: "Earlier history failed to load, retrying shortly"
          }) : t.done ? s("large-orderbook-statistics.hist.done", {
            defaultValue: "Start of available data"
          }) : null : null
        }
        scanNewWalls() {
          let e = this.ds;
          if (!e || !e.orders || "loading" === this.orders.state) return;
          let t = this.newFeed,
            s = Date.now(),
            a = this.filters.exSel;
          if (t.sym !== e.sym) {
            t.sym = e.sym, t.seen = new Set(e.walls.map(e => e.id)), t.unread = 0, t.fresh = new Set, t.list = e.walls.filter(e => a.has(e.ex) && s - e.startT < 864e5).sort((e, t) => t.startT - e.startT).slice(0, 200);
            return
          }
          let l = [];
          for (let i of e.walls) t.seen.has(i.id) || (t.seen.add(i.id), a.has(i.ex) && !(s - i.startT > 864e5) && l.push(i));
          if (t.list = t.list.map(t => e.wallById.get(t.id) || t), l.length && (l.sort((e, t) => t.startT - e.startT), t.list = l.concat(t.list).slice(0, 200), t.fresh = new Set(l.map(e => e.id)), "new" !== this.prefs.tab && (t.unread += l.length), this.prefs.newAlert)) {
            for (let e of l) e.initUsd >= O.iJ && this.toasts.push({
              key: e.id + ":" + s,
              wall: e,
              at: s
            });
            this.toasts = this.toasts.slice(-4)
          }
        }
      }
      let eU = e => String(e).padStart(2, "0"),
        eD = {
          zh: ["万", "亿"],
          "zh-TW": ["萬", "億"],
          ja: ["万", "億"],
          ko: ["만", "억"]
        };
      var eH = s(35850),
        eR = s(25636),
        eQ = s(10720),
        eK = s.n(eQ);
      let eG = (...e) => e.filter(Boolean).join(" "),
        eX = (e, ...t) => eG(...t, "compact" === e && eK().compact),
        eJ = (e, t) => e.find(e => String(e.value) === String(t));

      function eY({
        as: e,
        children: t
      }) {
        let {
          theme: s
        } = b();
        return (0, a.jsx)(g, {
          as: e,
          style: s && s.vars,
          children: t
        })
      }

      function eZ({
        size: e = "standard",
        variant: t,
        selected: s,
        icon: l,
        className: i,
        children: r,
        ...o
      }) {
        return (0, a.jsx)(eR.$n, {
          className: eX(e, eK().button, l && eK().icon, "primary" === t && eK().primary, "toggle" === t && s && eK().selected, i),
          "aria-pressed": "toggle" === t ? !!s : void 0,
          onlyIcon: l,
          iconComp: l ? r : void 0,
          ...o,
          children: l ? null : r
        })
      }

      function e0({
        options: e,
        value: t,
        onChange: s,
        size: l = "standard",
        className: i
      }) {
        return (0, a.jsx)(eR.tU, {
          variant: "segmented",
          className: eX(l, eK().tabs, i),
          selectedIndex: String(t),
          onChange: a => {
            let l = eJ(e, a);
            l && l.value !== t && s(l.value)
          },
          children: e.map(e => (0, a.jsx)(eR.oz, {
            value: String(e.value),
            label: e.label,
            title: e.title,
            "data-on": String(e.value) === String(t) || void 0
          }, String(e.value)))
        })
      }
      let e1 = {
        dot: "marker",
        tri: "markerTri",
        diamond: "markerDiamond",
        candle: "markerCandle"
      };

      function e2({
        checked: e,
        onChange: t,
        color: s,
        color2: l,
        marker: r = "dot",
        title: o,
        children: n
      }) {
        let d = (0, i.useId)(),
          c = s ? (0, a.jsx)("span", {
            className: eK()[e1[r]],
            style: {
              "--c": s,
              "--c2": l
            },
            "aria-hidden": "true"
          }) : null;
        return (0, a.jsxs)("label", {
          className: eG(eK().chip, !e && eK().chipOff),
          title: o,
          children: [(0, a.jsx)(eR.Sc, {
            id: d,
            checked: e,
            onChange: e => t(e.target.checked),
            rootProps: {
              className: eK().checkbox
            }
          }), n, c]
        })
      }

      function e3({
        options: e,
        value: t,
        onChange: s,
        size: l = "standard",
        label: r,
        search: o,
        searchPlaceholder: n,
        title: d,
        align: c = "start",
        className: h
      }) {
        let p = eJ(e, t),
          u = (0, i.useRef)(null),
          f = "lo-sel-" + (0, i.useId)().replace(/[^a-zA-Z0-9_-]/g, "");
        return (0, a.jsx)("span", {
          ref: u,
          className: h,
          title: d,
          style: {
            display: "inline-flex",
            minWidth: 0
          },
          children: (0, a.jsx)(eR.l6, {
            size: "sm",
            options: e.filter(e => !e.hidden).map(e => ({
              value: String(e.value),
              label: e.label,
              iconComp: e.icon ? (0, a.jsx)(eY, {
                as: "span",
                children: e.icon
              }) : void 0
            })),
            value: [String(t)],
            onChange: a => {
              let l = eJ(e, a[0]);
              l && l.value !== t && s(l.value)
            },
            searchable: !!o,
            allowClear: !1,
            allowedPlacements: [`bottom-${c}`, `top-${c}`, `bottom-${"start"===c?"end":"start"}`, `top-${"start"===c?"end":"start"}`],
            triggerClassName: eX(l, eK().select),
            contentClassName: eG(eK().menu, o && eK().menuSearch, f),
            onOpenChange: e => {
              e && requestAnimationFrame(() => document.querySelectorAll("." + f).forEach(e => {
                u.current && e.style.setProperty("--glass-menu-min", u.current.getBoundingClientRect().width + "px"), n && e.querySelectorAll(".mm-select-search-input input").forEach(e => {
                  e.placeholder = n
                })
              }))
            },
            dropdownProps: {
              keepMounted: !1,
              mobileResponsive: !1,
              ...o && {
                initialFocus: 0
              }
            },
            enableVirtualList: e.length > 60,
            virtualItemHeight: 36,
            selectedDisplayRenderFn: () => (0, a.jsxs)("span", {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0
              },
              children: [r ? (0, a.jsx)("span", {
                className: eG(eK().caption, "lo-selcap"),
                children: r
              }) : null, p && p.icon, p ? p.label : ""]
            })
          })
        })
      }

      function e5({
        trigger: e,
        size: t = "standard",
        align: s = "end",
        width: l = 360,
        label: r,
        title: o,
        triggerClassName: n,
        onOpenChange: d,
        children: c
      }) {
        let [h, p] = (0, i.useState)(!1), u = e => {
          p(e), d && d(e)
        };
        return (0, a.jsx)(eR.AM, {
          arrow: !1,
          triggerType: "click",
          open: h,
          onChange: u,
          allowedPlacements: [`bottom-${s}`, `top-${s}`],
          shift: !0,
          contentClassName: eK().menu,
          mobileResponsive: !1,
          content: (0, a.jsx)(eY, {
            children: (0, a.jsx)("div", {
              className: eK().popBody,
              role: "dialog",
              "aria-label": r,
              style: {
                width: `min(${l}px, calc(100vw - 60px))`,
                maxHeight: "min(70vh, 640px)"
              },
              children: "function" == typeof c ? c({
                close: () => u(!1)
              }) : c
            })
          }),
          children: (0, a.jsx)(eR.$n, {
            className: eX(t, eK().button, n),
            "aria-expanded": h,
            "aria-label": "string" == typeof e ? void 0 : r,
            title: o,
            children: e
          })
        })
      }
      var e4 = s(52509);
      let e6 = (e, t) => e.walls.filter(e => "alive" === e.status && B(e, t));

      function e8(e, t, s = 1) {
        let a = e6(e, t).sort((e, t) => t.price - e.price),
          l = a.filter(e => "ask" === e.side),
          i = a.filter(e => "bid" === e.side),
          r = e => s >= 1 ? e.length : Math.ceil(e.length * s),
          o = l.slice(l.length - r(l)),
          n = i.slice(0, r(i));
        return {
          total: a.length,
          asks: o,
          bids: n,
          nearestAsk: o[o.length - 1] || null,
          nearestBid: n[0] || null
        }
      }
      let e7 = (e, t) => "alive" !== e.status && t.exSel.has(e.ex) && e.initUsd >= Math.max(t.threshold, t.cancelMin),
        e9 = {
          alive: 0,
          filled: 1,
          cancelled: 2
        },
        te = ({
          sym: e,
          size: t
        }) => {
          let [s, l] = (0, i.useState)(!1), r = (e => {
            let t = (0, e4.ev)(e);
            if (t) return t;
            let s = {
              BTC: "bitcoin",
              ETH: "ethereum",
              SOL: "solana",
              XRP: "xrp",
              BNB: "bnb",
              DOGE: "dogecoin",
              ADA: "cardano",
              SUI: "sui",
              LINK: "chainlink",
              AVAX: "avalanche",
              PEPE: "pepe"
            } [e];
            return s ? `https://cdn.coinglasscdn.com/static/img/coins/${s}-${e}.png` : ""
          })(e);
          return !r || s ? (0, a.jsx)("span", {
            className: "lo-logo lo-coin-ph" + (t ? " " + t : ""),
            "aria-hidden": "true",
            children: e.replace(/^1000/, "").slice(0, 1)
          }) : (0, a.jsx)("img", {
            className: "lo-logo" + (t ? " " + t : ""),
            src: r,
            alt: "",
            loading: "lazy",
            onError: () => l(!0)
          })
        },
        tt = ({
          e,
          size: t
        }) => {
          let s = (0, eH.EO)(e.logo);
          return s ? (0, a.jsx)("img", {
            className: "lo-logo" + (t ? " " + t : ""),
            src: s,
            alt: "",
            loading: "lazy"
          }) : (0, a.jsx)("span", {
            className: "lo-logo lo-coin-ph" + (t ? " " + t : ""),
            "aria-hidden": "true",
            children: e.brand.slice(0, 1)
          })
        };

      function ts() {
        let {
          term: e,
          t,
          fmt: s
        } = b(), l = e.prefs, r = e.coin, [o, n] = (0, i.useState)(() => (0, e4._0)() || O.Su);
        (0, i.useEffect)(() => {
          let e = !0;
          return (0, e4.k1)().then(t => e && n(t)).catch(() => {}), () => {
            e = !1
          }
        }, []);
        let d = (0, i.useMemo)(() => (o.includes(l.symbol) ? o : [l.symbol, ...o]).map(e => ({
            value: e,
            label: (0, O.BI)(e).label,
            icon: (0, a.jsx)(te, {
              sym: e,
              size: "sm"
            })
          })), [o, l.symbol]),
          c = (0, i.useMemo)(() => O.Dn.map(e => ({
            value: e,
            label: e.replace("h", "H")
          })), []),
          h = O.tK[r.cls].map(e => ({
            value: e,
            label: e ? "≥" + s.usd(e) : "$0"
          }));
        return (0, a.jsxs)("header", {
          className: "lo-rail",
          children: [(0, a.jsx)("h1", {
            children: t("large-orderbook-statistics.rel.coinLink", {
              coin: l.symbol,
              defaultValue: "{{coin}} large orders"
            })
          }), (0, a.jsx)(e3, {
            label: t("large-orderbook-statistics.hdr.symbol", {
              defaultValue: "Symbol"
            }),
            options: d,
            value: l.symbol,
            onChange: t => e.setSymbol(t),
            search: !0,
            searchPlaceholder: t("large-orderbook-statistics.hdr.searchSymbol", {
              defaultValue: "Search symbols"
            })
          }), (0, a.jsx)(e3, {
            label: t("large-orderbook-statistics.hdr.interval", {
              defaultValue: "Timeframe"
            }),
            options: c,
            value: l.interval,
            onChange: t => e.setInterval(t)
          }), (0, a.jsx)(ta, {}), (0, a.jsx)(e3, {
            label: t("large-orderbook-statistics.side.thr", {
              defaultValue: "Size threshold"
            }),
            title: t("large-orderbook-statistics.side.thrTitle", {
              defaultValue: "Show only walls and trades at or above this size; majors start at $100K, altcoins at $10K"
            }),
            options: h,
            value: e.threshold,
            onChange: t => e.setThreshold(t)
          }), (0, a.jsx)("span", {
            className: "lo-spacer"
          }), (0, a.jsx)(eZ, {
            className: "lo-desk-only",
            onClick: () => {
              let e = document.getElementById("lo-faq");
              if (!e) return;
              let t = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({
                top: e.getBoundingClientRect().top + window.scrollY - 72,
                behavior: t ? "auto" : "smooth"
              })
            },
            children: t("large-orderbook-statistics.faq.title", {
              defaultValue: "FAQ"
            })
          }), (0, a.jsx)(ti, {})]
        })
      }

      function ta() {
        let {
          term: e,
          t,
          fmt: s
        } = b(), l = ea(e.prefs.symbol), i = e => !!e && (!l || l.has(e.id)), r = O.EX.filter(i), o = O.O.filter(e => i(e.perp) || i(e.spot)), n = new Set(e.exEff), d = e => i(e.perp) && n.has(e.perp.id) || i(e.spot) && n.has(e.spot.id), c = o.filter(d), h = r.every(e => n.has(e.id)), p = (0, a.jsxs)(a.Fragment, {
          children: [(0, a.jsx)("span", {
            className: "lo-cap",
            children: t("large-orderbook-statistics.hdr.exchange", {
              defaultValue: "Exchanges"
            })
          }), (0, a.jsx)("span", {
            className: "lo-logos",
            children: c.slice(0, 3).map(e => (0, a.jsx)(tt, {
              e: e,
              size: "sm"
            }, e.brand))
          }), c.length > 3 ? (0, a.jsxs)("span", {
            className: "lo-num",
            children: ["+", c.length - 3]
          }) : null, (0, a.jsx)("span", {
            className: "lo-num lo-exsum",
            children: h ? t("large-orderbook-statistics.exPicker.allEx", {
              defaultValue: "All exchanges"
            }) : `${c.length}/${o.length}`
          }), (0, a.jsx)("i", {
            className: "lo-caret",
            "aria-hidden": "true"
          })]
        });
        return (0, a.jsx)(e5, {
          align: "start",
          width: 440,
          trigger: p,
          label: t("large-orderbook-statistics.hdr.exchange", {
            defaultValue: "Exchanges"
          }),
          triggerClassName: "lo-exbtn",
          title: O.EX.filter(e => n.has(e.id)).map(e => e.brand + " " + _(t, e.kind)).join(" \xb7 "),
          children: () => (0, a.jsx)(tl, {
            sel: n,
            on: d,
            has: i,
            markets: r,
            groups: o,
            t: t,
            fmt: s,
            term: e
          })
        })
      }

      function tl({
        sel: e,
        on: t,
        has: s,
        markets: l,
        groups: r,
        t: o,
        fmt: n,
        term: d
      }) {
        let [c, h] = (0, i.useState)(""), p = function(e, t) {
          let s = t - 864e5,
            a = {};
          if (!e) return a;
          for (let t of e.trades) {
            if (t.t < s) continue;
            let e = O.aV[t.ex];
            e && (a[e.brand] = (a[e.brand] || 0) + t.usd)
          }
          for (let t of e.walls) {
            if ("alive" !== t.status) continue;
            let e = O.aV[t.ex];
            e && (a[e.brand] = (a[e.brand] || 0) + t.usd)
          }
          return a
        }(d.ds, Date.now()), u = Math.max(1, ...Object.values(p)), f = ew(d.prefs.symbol), g = f ? f.keys : new Set, x = (t, l) => s(t) ? (0, a.jsx)("button", {
          type: "button",
          className: "lo-exk",
          "aria-pressed": e.has(t.id),
          onClick: () => (t => {
            if (e.has(t)) {
              let s;
              e.size > 1 && (s = [...e].filter(e => e !== t), d.setExSel(s))
            } else {
              let s;
              s = [...e, t], d.setExSel(s)
            }
          })(t.id),
          children: l
        }) : (0, a.jsx)("button", {
          type: "button",
          className: "lo-exk",
          disabled: !0,
          children: l
        }), m = r.filter(e => !c.trim() || e.brand.toLowerCase().includes(c.trim().toLowerCase()));
        return (0, a.jsxs)("div", {
          className: "lo-expop",
          children: [(0, a.jsx)("div", {
            className: "lo-exq",
            children: [
              ["all", o("large-orderbook-statistics.exPicker.all", {
                defaultValue: "All"
              })],
              ["perp", o("large-orderbook-statistics.exPicker.perpOnly", {
                defaultValue: "Perp only"
              })],
              ["spot", o("large-orderbook-statistics.exPicker.spotOnly", {
                defaultValue: "Spot only"
              })],
              ["invert", o("large-orderbook-statistics.exPicker.invert", {
                defaultValue: "Invert"
              })]
            ].map(([t, s]) => (0, a.jsx)(eZ, {
              size: "compact",
              onClick: () => (t => {
                if ("all" === t) {
                  let e;
                  e = l.map(e => e.id), d.setExSel(e)
                } else if ("perp" === t || "spot" === t) {
                  let e = l.filter(e => e.kind === t).map(e => e.id);
                  e.length && d.setExSel(e)
                } else {
                  let t, s = l.filter(t => !e.has(t.id)).map(e => e.id);
                  t = s.length ? s : l.map(e => e.id), d.setExSel(t)
                }
              })(t),
              children: s
            }, t))
          }), r.length > 8 ? (0, a.jsx)("input", {
            className: "lo-exsearch",
            type: "search",
            placeholder: o("large-orderbook-statistics.exPicker.search", {
              defaultValue: "Search exchanges"
            }),
            "aria-label": o("large-orderbook-statistics.exPicker.search", {
              defaultValue: "Search exchanges"
            }),
            value: c,
            onChange: e => h(e.target.value)
          }) : null, m.map(e => {
            let s = p[e.brand] || 0;
            return (0, a.jsxs)("div", {
              className: "lo-exrow" + (t(e) ? "" : " off"),
              children: [(0, a.jsxs)("span", {
                className: "nm",
                children: [(0, a.jsx)(tt, {
                  e: e
                }), e.brand, s || !g.has(e.key) ? null : (0, a.jsx)("small", {
                  children: o("large-orderbook-statistics.exPicker.noData", {
                    defaultValue: "no data"
                  })
                })]
              }), (0, a.jsx)("span", {
                className: "bar",
                title: o("large-orderbook-statistics.exPicker.activity", {
                  defaultValue: "24h large trades"
                }) + " " + n.usd(s),
                children: (0, a.jsx)("i", {
                  style: {
                    width: (s / u * 100).toFixed(0) + "%"
                  }
                })
              }), x(e.perp, o("large-orderbook-statistics.ex.kindPerp", {
                defaultValue: "Perp"
              })), x(e.spot, o("large-orderbook-statistics.ex.kindSpot", {
                defaultValue: "Spot"
              })), (0, a.jsx)("button", {
                type: "button",
                className: "only",
                onClick: () => {
                  let t;
                  return t = l.filter(t => t.brand === e.brand).map(e => e.id), d.setExSel(t)
                },
                children: o("large-orderbook-statistics.exPicker.only", {
                  defaultValue: "Only this"
                })
              })]
            }, e.brand)
          })]
        })
      }

      function ti() {
        let {
          t: e,
          colorCfg: t,
          setColorCfg: s,
          colorMode: l,
          theme: i
        } = b();
        return (0, a.jsx)(e5, {
          align: "end",
          width: 360,
          triggerClassName: "lo-colorbtn",
          trigger: e("large-orderbook-statistics.hdr.colors", {
            defaultValue: "Colors"
          }),
          label: e("large-orderbook-statistics.hdr.colors", {
            defaultValue: "Colors"
          }),
          children: (0, a.jsxs)("div", {
            className: "lo-colors",
            children: [(0, a.jsx)("h4", {
              children: e("large-orderbook-statistics.colors.presets", {
                defaultValue: "Palette"
              })
            }), (0, a.jsx)("div", {
              className: "lo-presets",
              children: p.fG.map(i => (0, a.jsxs)("button", {
                type: "button",
                className: "lo-preset",
                "aria-pressed": t.preset[l] === i.id,
                onClick: () => s(e => ({
                  ...e,
                  [l]: {
                    ...i[l]
                  },
                  preset: {
                    ...e.preset,
                    [l]: i.id
                  }
                })),
                children: [(0, a.jsx)("span", {
                  className: "sw",
                  children: ["bid", "ask", "up", "down"].map(e => (0, a.jsx)("i", {
                    style: {
                      background: i[l][e]
                    }
                  }, e))
                }), e("large-orderbook-statistics.colors.preset." + i.id)]
              }, i.id))
            }), (0, a.jsxs)("div", {
              className: "row",
              children: [(0, a.jsx)("h4", {
                children: e("large-orderbook-statistics.colors.custom", {
                  defaultValue: "Custom (current theme)"
                })
              }), (0, a.jsx)(eZ, {
                size: "compact",
                onClick: () => s(e => ({
                  ...e,
                  [l]: {
                    ...p.zY[l]
                  },
                  preset: {
                    ...e.preset,
                    [l]: "default"
                  }
                })),
                children: e("large-orderbook-statistics.colors.reset", {
                  defaultValue: "Reset"
                })
              })]
            }), p.Rk.map(([r, o]) => {
              o = "large-orderbook-statistics." + o;
              let n = i.effective[r],
                d = t[l][r];
              return (0, a.jsxs)("label", {
                className: "lo-cp",
                children: [(0, a.jsxs)("span", {
                  children: [e(o), n && d && n.toLowerCase() !== d.toLowerCase() ? (0, a.jsxs)("small", {
                    children: ["→ ", n]
                  }) : null]
                }), (0, a.jsx)("input", {
                  type: "color",
                  value: d,
                  "aria-label": e(o),
                  onChange: e => {
                    let t;
                    return t = e.target.value, s(e => ({
                      ...e,
                      [l]: {
                        ...e[l],
                        [r]: t
                      },
                      preset: {
                        ...e.preset,
                        [l]: "custom"
                      }
                    }))
                  }
                })]
              }, r)
            }), (0, a.jsx)("p", {
              className: "note",
              children: e("large-orderbook-statistics.colors.note", {
                defaultValue: "Colors are nudged to a readable contrast on the current background; light and dark are stored separately. The five wall tiers are derived from the chosen base colors."
              })
            })]
          })
        })
      }
      let tr = ({
        w: e,
        t
      }) => {
        let s = O.aV[e.ex];
        return s ? (0, a.jsxs)("span", {
          className: "venue",
          title: s.brand + " " + _(t, s.kind),
          children: [(0, a.jsx)(tt, {
            e: s,
            size: "sm"
          }), (0, a.jsxs)("span", {
            children: [s.brand, " ", _(t, s.kind)]
          })]
        }) : null
      };

      function to() {
        let {
          term: e,
          version: t,
          t: s,
          fmt: l
        } = b(), r = w(5e3), o = e.ds, n = (0, i.useMemo)(() => o ? function(e, t, s, a, l) {
          let i = e.N,
            r = e.close[i - 1],
            o = e.open[Math.max(0, i - Math.round(1440 / e.ivMin))],
            n = e6(e, t),
            d = 0,
            c = 0,
            h = null,
            p = null,
            u = null;
          for (let e of n) "bid" === e.side ? (d += e.usd, e.price <= r && (!u || e.price > u.price) && (u = e)) : (c += e.usd, e.price > r && (!p || e.price < p.price) && (p = e)), (!h || e.usd > h.usd) && (h = e);
          let f = a - 36e5,
            g = 0,
            x = 0;
          for (let s of e.walls) !(!t.exSel.has(s.ex) || C(s) < t.threshold) && (s.startT >= f && g++, "cancelled" === s.status && s.endT >= f && I(s, t) && x++);
          let m = null;
          if (s) {
            let t = e => {
                let t = Math.max(0, e - 12),
                  a = s.imb[e],
                  l = s.tnf[e] - s.tnf[t] > 0;
                return [a > .1 ? l ? "bidBuy" : "bidSell" : a < -.1 ? l ? "askBuy" : "askSell" : "even", l]
              },
              [a, r] = t(i - 1),
              o = Math.max(1, Math.round(960 / e.ivMin)),
              n = 12;
            for (; n < i && e.tsAt(n) < l;) n++;
            let d = 0,
              c = 0;
            if ("even" !== a)
              for (let s = n; s + o < i; s++) t(s)[0] === a && (d++, e.close[s + o] > e.close[s] && c++);
            m = {
              buy: r,
              kind: a,
              n: d,
              pct: d ? c / d : null,
              days: Math.max(1, Math.round((i - n) * e.ivMin / 1440)),
              enough: d >= 20
            }
          }
          return {
            last: r,
            chg: (r - o) / o * 100,
            bid: d,
            ask: c,
            pct: d + c ? d / (d + c) * 100 : 50,
            nAsk: p,
            nBid: u,
            big: h,
            count: n.length,
            newW: g,
            canW: x,
            quad: m
          }
        }(o, e.filters, e.series, r, e.covFrom()) : null, [o, t, r]);
        if (!n) return (0, a.jsx)("section", {
          className: "lo-kpis lo-kpis-empty",
          "aria-label": s("large-orderbook-statistics.kpi.aria", {
            defaultValue: "Key metrics"
          }),
          children: [0, 1, 2, 3, 4, 5, 6].map(e => (0, a.jsxs)("div", {
            className: "lo-kpi",
            children: [(0, a.jsx)("span", {
              className: "lbl",
              children: "\xa0"
            }), (0, a.jsx)("div", {
              className: "v",
              children: "—"
            }), (0, a.jsx)("div", {
              className: "s",
              children: "\xa0"
            })]
          }, e))
        });
        let d = e => l.pct((e - n.last) / n.last * 100),
          c = null;
        if (n.quad) {
          let e = n.quad,
            t = s("large-orderbook-statistics.kpi.qd." + e.kind);
          c = ["even" === e.kind ? s("large-orderbook-statistics.kpi.q.even", {
            defaultValue: "Balanced"
          }) + " \xb7 " + s(e.buy ? "large-orderbook-statistics.kpi.netBuy" : "large-orderbook-statistics.kpi.netSell") : s("large-orderbook-statistics.kpi.q." + e.kind), "even" === e.kind ? s("large-orderbook-statistics.kpi.qWait", {
            desc: t,
            defaultValue: "{{desc}}"
          }) : e.enough ? s("large-orderbook-statistics.kpi.qStat", {
            desc: t,
            pct: Math.round(100 * e.pct) + "%",
            days: e.days,
            n: e.n,
            defaultValue: "{{desc}}: {{pct}} up after 16h for the same setup over the last {{days}} days (sample {{n}})"
          }) : s("large-orderbook-statistics.kpi.qInsuf", {
            desc: t,
            n: e.n,
            days: e.days,
            defaultValue: "{{desc}}: not enough samples ({{n}} in the last {{days}} days)"
          })]
        }
        return (0, a.jsxs)("section", {
          className: "lo-kpis",
          "aria-label": s("large-orderbook-statistics.kpi.aria", {
            defaultValue: "Key metrics"
          }),
          children: [(0, a.jsxs)("div", {
            className: "lo-kpi",
            children: [(0, a.jsx)("span", {
              className: "lbl",
              children: s("large-orderbook-statistics.kpi.price", {
                defaultValue: "Last price"
              })
            }), (0, a.jsx)("div", {
              className: "v " + (n.chg >= 0 ? "bid" : "ask"),
              children: l.px(n.last)
            }), (0, a.jsxs)("div", {
              className: "s",
              children: ["24h ", l.pct(n.chg)]
            })]
          }), (0, a.jsxs)("div", {
            className: "lo-kpi",
            children: [(0, a.jsx)("span", {
              className: "lbl",
              children: s("large-orderbook-statistics.kpi.imb", {
                defaultValue: "Wall imbalance bid : ask"
              })
            }), (0, a.jsxs)("div", {
              className: "v",
              children: [(0, a.jsx)("span", {
                className: "bid",
                children: n.pct.toFixed(0)
              }), (0, a.jsx)("span", {
                className: "muted",
                children: " : "
              }), (0, a.jsx)("span", {
                className: "ask",
                children: (100 - n.pct).toFixed(0)
              })]
            }), (0, a.jsxs)("div", {
              className: "s",
              children: [(0, a.jsx)("span", {
                className: "bid",
                children: l.usd(n.bid)
              }), " \xb7 ", (0, a.jsx)("span", {
                className: "ask",
                children: l.usd(n.ask)
              })]
            }), (0, a.jsx)("div", {
              className: "bar",
              children: (0, a.jsx)("i", {
                style: {
                  width: n.pct.toFixed(1) + "%"
                }
              })
            })]
          }), (0, a.jsxs)("div", {
            className: "lo-kpi",
            children: [n.nAsk ? (0, a.jsx)(tr, {
              w: n.nAsk,
              t: s
            }) : null, (0, a.jsx)("span", {
              className: "lbl",
              children: s("large-orderbook-statistics.kpi.nearAsk", {
                defaultValue: "Nearest ask wall"
              })
            }), (0, a.jsx)("div", {
              className: "v ask",
              children: n.nAsk ? l.px(n.nAsk.price) : "—"
            }), (0, a.jsx)("div", {
              className: "s",
              children: n.nAsk ? `${d(n.nAsk.price)} \xb7 ${l.usd(n.nAsk.usd)}` : s("large-orderbook-statistics.w.none", {
                defaultValue: "none"
              })
            })]
          }), (0, a.jsxs)("div", {
            className: "lo-kpi",
            children: [n.nBid ? (0, a.jsx)(tr, {
              w: n.nBid,
              t: s
            }) : null, (0, a.jsx)("span", {
              className: "lbl",
              children: s("large-orderbook-statistics.kpi.nearBid", {
                defaultValue: "Nearest bid wall"
              })
            }), (0, a.jsx)("div", {
              className: "v bid",
              children: n.nBid ? l.px(n.nBid.price) : "—"
            }), (0, a.jsx)("div", {
              className: "s",
              children: n.nBid ? `${d(n.nBid.price)} \xb7 ${l.usd(n.nBid.usd)}` : s("large-orderbook-statistics.w.none", {
                defaultValue: "none"
              })
            })]
          }), (0, a.jsxs)("div", {
            className: "lo-kpi",
            children: [n.big ? (0, a.jsx)(tr, {
              w: n.big,
              t: s
            }) : null, (0, a.jsx)("span", {
              className: "lbl",
              children: s("large-orderbook-statistics.kpi.big", {
                defaultValue: "Largest wall"
              })
            }), (0, a.jsx)("div", {
              className: "v " + (n.big ? n.big.side : ""),
              children: n.big ? l.usd(n.big.usd) : "—"
            }), (0, a.jsx)("div", {
              className: "s",
              children: n.big ? (0, a.jsxs)(a.Fragment, {
                children: [(0, a.jsxs)("span", {
                  className: n.big.side,
                  children: [s("bid" === n.big.side ? "large-orderbook-statistics.w.bidWall" : "large-orderbook-statistics.w.askWall"), " ", l.px(n.big.price)]
                }), " \xb7 ", l.age(r - n.big.startT)]
              }) : s("large-orderbook-statistics.w.none", {
                defaultValue: "none"
              })
            })]
          }), (0, a.jsxs)("div", {
            className: "lo-kpi",
            children: [(0, a.jsx)("span", {
              className: "lbl",
              children: s("large-orderbook-statistics.kpi.active", {
                defaultValue: "Open walls"
              })
            }), (0, a.jsxs)("div", {
              className: "v",
              children: [n.count, " ", (0, a.jsx)("small", {
                className: "muted",
                children: s("large-orderbook-statistics.unit.fills", {
                  defaultValue: "orders"
                })
              })]
            }), (0, a.jsxs)("div", {
              className: "s",
              children: [s("large-orderbook-statistics.kpi.new1h", {
                defaultValue: "1h placed"
              }), " ", n.newW, " \xb7 ", s("large-orderbook-statistics.kpi.cancel", {
                defaultValue: "Cancelled"
              }), " ", n.canW]
            })]
          }), c ? (0, a.jsxs)("div", {
            className: "lo-kpi",
            children: [(0, a.jsx)("span", {
              className: "lbl",
              children: s("large-orderbook-statistics.kpi.struct", {
                defaultValue: "Wall structure \xb7 last 12"
              })
            }), (0, a.jsx)("div", {
              className: "v sm " + (n.quad.buy ? "bid" : "ask"),
              children: c[0]
            }), (0, a.jsx)("div", {
              className: "s",
              title: c[1],
              children: c[1]
            })]
          }) : null]
        })
      }
      var tn = s(56760),
        td = s(69892),
        tc = s(19308),
        th = s(371);
      let tp = (e, t, s) => {
        for (let a of (e.cap = s, t)) {
          let t = e[a];
          e[a] = "i" === a || "k" === a ? new Int32Array(s) : new Float32Array(s), t && e[a].set(t.subarray(0, Math.min(t.length, s)))
        }
      };
      class tu extends tc.Ay {
        constructor(e) {
          super(e), this.extWithCandles = !0, this.limits = {
            right: .9,
            left: .9
          }, this.barWRange = [.2, 120], this.yLimits = {
            min: 1e-4,
            max: 20,
            pad: 20
          }, this.dec = 1, this.F = null, this.tiers = [0, 0, 0, 0, 0], this.layers = {
            trades: !0,
            signals: !0,
            revSig: !0
          }, this.series = null, this.idx = null, this.rev = 0, this.hitWalls = {
            n: 0,
            cap: 0
          }, this.hitTrades = {
            n: 0,
            cap: 0
          }, this.hitSig = {
            n: 0,
            cap: 0
          }, this.highlightId = null, this.hotId = null, this.flash = null, this.sel = null, this.analyzing = !1, this.pick = null, this.tips = null, this.edgeNote = null, this.onHot = null, this.onSelChange = null
        }
        setFilters(e, t, s) {
          this.F = e, this.tiers = t, s && (this.layers = s, this.showCandles = !1 !== s.candles), this.markData()
        }
        setSeries(e) {
          this.series = e, this.invalidate()
        }
        markData() {
          this.rev++, this.invalidate()
        }
        setDec(e) {
          this.dec = e, this.layout()
        }
        geometry(e) {
          return {
            rightW: 0,
            axisW: e < 640 ? 72 : this.dec >= 6 ? 104 : 86,
            bottomH: 0,
            taxH: 24
          }
        }
        resetBars(e) {
          return Math.max(30, Math.min(e, 240))
        }
        autoTarget(e, t) {
          let s = this.model.curPrice;
          this.ensureIndex();
          let a = this.idx;
          for (let l = 0; l < a.m; l++) {
            if (0 !== a.K[l]) continue;
            let i = a.P[l];
            Math.abs(i - s) / s <= .04 && (i < e && (e = i), i > t && (t = i))
          }
          let l = (t - e) * .07 || .01 * s;
          return [t + l, e - l]
        }
        onDataShift(e) {
          this.sel && (this.sel.i0 += e, this.sel.i1 += e)
        }
        focusPrice(e) {
          let t = this.view,
            s = t.pTop - t.pBot;
          if (e > t.pBot + .08 * s && e < t.pTop - .08 * s) return;
          let a = e - (t.pTop + t.pBot) / 2;
          this.animateTo({
            pTop: t.pTop + a,
            pBot: t.pBot + a
          }, 300)
        }
        locateWall(e) {
          let t = this.model;
          if (!t) return;
          let s = t.N,
            a = e.s,
            l = null == e.end ? s - 1 : Math.min(s - 1, e.end),
            i = this.geo.plotW,
            r = i / (this.anim && this.anim.to.barW ? this.anim.to.barW : this.view.barW),
            o = (l - a + 1) / .7;
          o > r && (r = Math.min(o, 1.2 * s));
          let n = Math.max(.35, Math.min(48, i / r)),
            d = i / n,
            c = (a + l + 1) / 2 - d / 2,
            h = Math.max(0, Math.floor(c)),
            p = Math.min(s - 1, Math.ceil(c + d)),
            u = 1 / 0,
            f = -1 / 0;
          for (let e = h; e <= p; e++) t.low[e] < u && (u = t.low[e]), t.high[e] > f && (f = t.high[e]);
          isFinite(u) || (u = .97 * t.curPrice, f = 1.03 * t.curPrice);
          let [g, x] = this.autoTarget(u, f), m = g - x;
          e.price < x + .08 * m && (x = e.price - .12 * m), e.price > g - .08 * m && (g = e.price + .12 * m), this.animateTo({
            left: c,
            barW: n,
            pTop: g,
            pBot: x
          }, 480), this.highlightId = e.id, this.flash = {
            id: e.id,
            price: e.price,
            t0: performance.now()
          }, this.invalidate()
        }
        clearSelection() {
          this.sel = null, this.pick = null, this.analyzing = !1, this.invalidate(!0), this.onSelChange && this.onSelChange()
        }
        setAnalyzing(e) {
          this.analyzing = e, this.pick = null, e && (this.sel = null), this.invalidate(!0), this.onSelChange && this.onSelChange()
        }
        ensureIndex() {
          let e = this.model,
            t = this.idx;
          t && t.d === e && t.ver === e.version && t.rev === this.rev || this.buildIndex()
        }
        buildIndex() {
          let e = this.model,
            t = this.F,
            s = e.walls,
            a = e.trades,
            l = s.length,
            i = this.tiers,
            r = new Int32Array(l),
            o = new Int32Array(l),
            n = new Float64Array(l),
            d = new Uint8Array(l),
            c = new Uint8Array(l),
            h = new Int32Array(l),
            p = null;
          if (t && t.bookPct < 1) {
            let e = [],
              a = [];
            for (let l of s) "alive" === l.status && B(l, t) && ("ask" === l.side ? e : a).push(l);
            for (let s of (e.sort((e, t) => e.price - t.price), a.sort((e, t) => t.price - e.price), p = new Set, [e, a]))
              for (let e = 0, a = Math.ceil(s.length * t.bookPct); e < a; e++) p.add(s[e])
          }
          let u = 0;
          if (t)
            for (let e = 0; e < l; e++) {
              let a = s[e];
              if (!B(a, t) || p && "alive" === a.status && !p.has(a)) continue;
              let l = "alive" === a.status ? 0 : "cancelled" === a.status ? 1 : 2;
              r[u] = a.s, o[u] = l ? a.end : -1, n[u] = a.price, d[u] = 5 * ("bid" !== a.side) + $(C(a), i), c[u] = l, h[u] = e, u++
            }
          let f = [];
          if (t)
            for (let e = 0; e < a.length; e++) F(a[e], t) && f.push(e);
          f.sort((e, t) => a[t].usd - a[e].usd);
          let g = f.length,
            x = new Float64Array(g),
            m = new Float64Array(g),
            b = new Float64Array(g),
            w = new Uint8Array(g),
            v = new Int32Array(g);
          for (let t = 0; t < g; t++) {
            let s = a[f[t]];
            x[t] = s.i + (s.t - e.tsAt(s.i)) / e.step, m[t] = s.price, b[t] = Math.sqrt(s.usd), w[t] = +("buy" !== s.side), v[t] = f[t]
          }
          this.idx = {
            d: e,
            ver: e.version,
            rev: this.rev,
            m: u,
            S: r,
            E: o,
            P: n,
            B: d,
            K: c,
            ID: h,
            tn: g,
            TI: x,
            TP: m,
            TU: b,
            TS: w,
            TID: v
          }
        }
        drawUnder(e, t) {
          let s = this.T,
            a = this.model,
            l = this.view,
            i = this.DPR,
            {
              plotW: r,
              plotH: o,
              c0: n,
              c1: d
            } = t;
          this.ensureIndex();
          let c = this.idx,
            h = this.hitWalls;
          h.n = 0;
          let p = [],
            u = [],
            f = [],
            g = [],
            x = (e, t) => e[t] || (e[t] = new Path2D),
            m = this.tickOcc || (this.tickOcc = new Set),
            b = this.lineOcc || (this.lineOcc = new Set);
          m.clear(), b.clear();
          let w = this.ticks || (this.ticks = Array.from({
            length: 10
          }, () => []));
          for (let e of w) e.length = 0;
          this.tierD !== i && (this.tierD = i, this.tierHD = O.se.map(e => Math.max(1, Math.round(e * i))));
          let v = this.tierHD,
            y = Math.max(1, Math.round(i)),
            {
              S: k,
              E: j,
              P: N,
              B: M,
              K: S,
              ID: T,
              m: V
            } = c,
            z = o / (l.pTop - l.pBot),
            _ = l.pBot - 6 / z,
            A = l.pTop + 6 / z,
            P = a.N - 1,
            C = n - 1 - 6 / l.barW,
            I = d + 1,
            B = this.gridStep("dtStep", 5 / l.barW),
            F = this.gridStep("dpStep", 5 / z),
            $ = l.pTop;
          for (let e = 0; e < V; e++) {
            let t = N[e];
            if (t < _ || t > A) continue;
            let s = k[e],
              a = S[e],
              l = a ? j[e] : P;
            if (s > I || l < C) continue;
            let o = this.xOf(l + 1),
              n = this.xOf(s),
              d = o,
              c = Math.round((n = n < -2 ? -2 : n) * i),
              V = Math.round((d = d > r + 2 ? r + 2 : d) * i);
            if (V <= c) continue;
            let W = M[e],
              L = W % 5,
              q = ($ - t) * z;
            if (0 === a) {
              let e = v[L],
                t = Math.round(q * i - e / 2);
              x(p, W).rect(c, t, V - c, e), L >= 3 && x(u, W).rect(c, t + (e - y >> 1), V - c, y)
            } else if (1 === a) {
              let e = Math.round(q * i - y / 2),
                s = 4194304 * e + 2048 * c + Math.min(2047, V - c) + 1e12 * W;
              if (b.has(s) || (b.add(s), x(f, W).rect(c, e, V - c, y)), o <= r + 6) {
                let s = (1048576 * Math.floor(t / F) + Math.floor((l + 1) / B)) * 16 + W;
                m.has(s) || (m.add(s), w[W].push(Math.round(o * i), e + (y >> 1)))
              }
            } else {
              let e = v[L];
              x(g, W).rect(c, Math.round(q * i - e / 2), V - c, e)
            }
            h.n === h.cap && tp(h, ["x", "y", "w", "h", "i", "k"], h.cap ? 2 * h.cap : 4096);
            let E = O.se[L],
              U = h.n,
              D = n < 0 ? 0 : Math.round(n);
            h.x[U] = D, h.y[U] = Math.round(q - E / 2), h.w[U] = Math.round(d > r ? r : d) - D, h.h[U] = E, h.i[U] = T[e], h.k[U] = a, h.n = U + 1
          }
          let W = e => (e < 5 ? s.bidT : s.askT)[e % 5];
          e.save(), e.setTransform(1, 0, 0, 1, 0, 0);
          for (let t = 0; t < 10; t++) g[t] && (e.fillStyle = (0, th.B3)(W(t), .95), e.fill(g[t]));
          for (let t = 0; t < 10; t++) {
            f[t] && (e.fillStyle = (0, th.B3)(W(t), .75), e.fill(f[t]));
            let s = w[t];
            if (s.length) {
              e.fillStyle = W(t);
              let a = 4.5 * i,
                l = new Path2D;
              for (let t = 0; t < s.length; t += 2) {
                let i = s[t],
                  r = s[t + 1] + .5;
                l.moveTo(i, r - a), l.lineTo(i + a, r), l.lineTo(i, r + a), l.lineTo(i - a, r), l.closePath(), (511 & t) == 510 && (e.fill(l), l = new Path2D)
              }
              e.fill(l)
            }
          }
          for (let t = 0; t < 10; t++) p[t] && (e.fillStyle = W(t), e.fill(p[t]));
          e.globalAlpha = .55, e.fillStyle = s.ink;
          for (let t = 0; t < 10; t++) u[t] && e.fill(u[t]);
          e.restore()
        }
        gridStep(e, t) {
          let s = this[e];
          return s && t > 0 && s / t < 1.6 && t / s < 1.6 ? s : this[e] = Math.pow(2, Math.round(Math.log2(t)))
        }
        drawAbove(e, t) {
          let s = this.T,
            a = this.model,
            l = this.view,
            {
              plotW: i,
              plotH: r,
              c0: o,
              c1: n
            } = t,
            d = this.idx,
            c = this.hitTrades;
          if (c.n = 0, this.layers.trades) {
            let t = this.occ || (this.occ = new Set);
            t.clear();
            let {
              TI: a,
              TP: h,
              TU: p,
              TS: u,
              TID: f,
              tn: g
            } = d;
            c.cap < g && tp(c, ["x", "y", "r", "i"], g + 64);
            let x = l.pBot,
              m = l.pTop,
              b = r / (m - x),
              w = o - 2 - 24 / l.barW,
              v = n + 2 + 24 / l.barW,
              y = 24 / b,
              k = this.gridStep("tStep", 20 / l.barW),
              j = this.gridStep("pStep", 20 / b),
              N = 0;
            for (let e = 0; e < g; e++) {
              let s = a[e];
              if (s < w || s > v) continue;
              let l = h[e];
              if (l < x - y || l > m + y) continue;
              let o = this.xOf(s),
                n = (m - l) * b;
              if (o < -24 || o > i + 24 || n < -24 || n > r + 24) continue;
              let d = 1048576 * Math.floor(l / j) + Math.floor(s / k);
              !t.has(d) && (t.add(d), c.x[N] = o, c.y[N] = n, c.i[N] = e, N++)
            }
            let M = g ? p[0] : 1,
              S = g ? p[g - 1] : 0,
              T = Math.max(1e-9, M - S),
              V = [new Path2D, new Path2D],
              z = [new Path2D, new Path2D];
            for (let e = 0; e < N; e++) {
              let t = c.i[e],
                s = Math.round(5 + 19 * Math.pow((p[t] - S) / T, 1.3)),
                a = u[t],
                l = Math.round(c.x[e]) + .5,
                i = Math.round(c.y[e]) + .5;
              V[a].moveTo(l + s, i), V[a].arc(l, i, s, 0, 6.2832), z[a].moveTo(l + 1.5, i), z[a].arc(l, i, 1.5, 0, 6.2832), c.x[e] = l, c.y[e] = i, c.r[e] = s, c.i[e] = f[t]
            }
            c.n = N;
            for (let t = 0; t < 2; t++) {
              let a = 0 === t ? s.bid : s.ask;
              e.fillStyle = a, e.globalAlpha = .14, e.fill(V[t]), e.strokeStyle = a, e.lineWidth = 1.5, e.globalAlpha = 1, e.stroke(V[t]), e.fillStyle = s.ink, e.fill(z[t])
            }
            e.lineWidth = 1
          }
          let h = this.hitSig;
          h.n = 0;
          let p = this.layers,
            u = this.series && this.series.marks;
          if ((p.signals || p.revSig) && u && u.length) {
            h.cap < u.length && tp(h, ["x", "y", "i"], u.length + 32);
            for (let t = 0; t < u.length; t++) {
              let l = u[t];
              if (l.i < o || l.i > n || (l.rev ? !p.revSig : !p.signals)) continue;
              let i = l.dir > 0,
                d = l.hi ? 12 : 9,
                c = l.rev ? 32 : l.hi ? 16 : 13,
                f = Math.round(this.xOf(l.i + .5)) + .5,
                g = Math.round(i ? this.yOf(a.low[l.i]) + c : this.yOf(a.high[l.i]) - c) + .5;
              if (g < -14 || g > r + 14) continue;
              let x = i ? s.bid : s.ask;
              e.beginPath(), l.rev ? (e.moveTo(f, g - d), e.lineTo(f + .8 * d, g), e.lineTo(f, g + d), e.lineTo(f - .8 * d, g)) : i ? (e.moveTo(f, g - d), e.lineTo(f + d, g + .8 * d), e.lineTo(f - d, g + .8 * d)) : (e.moveTo(f, g + d), e.lineTo(f + d, g - .8 * d), e.lineTo(f - d, g - .8 * d)), e.closePath(), e.lineJoin = "round", e.strokeStyle = s.bg, e.lineWidth = 4, e.stroke(), e.lineWidth = 2, 1 === l.hit ? (e.fillStyle = x, e.fill()) : (e.fillStyle = s.bg, e.fill(), 0 !== l.hit && e.setLineDash([3, 2]), e.strokeStyle = x, e.stroke(), e.setLineDash([])), l.hi && (e.strokeStyle = s.accent, e.lineWidth = 2, e.stroke()), e.lineWidth = 1, e.lineJoin = "miter", h.x[h.n] = f, h.y[h.n] = g, h.i[h.n] = t, h.n++
            }
          }
        }
        drawOverlay(e, t) {
          let s = this.T,
            a = this.model,
            l = this.fmt,
            i = this.mouse,
            {
              plotW: r,
              plotH: o,
              axisX: n,
              taxY: d,
              taxH: c,
              W: h
            } = t,
            p = null,
            u = null,
            f = null,
            g = (!this.drag || "new" === this.drag.custom || this.drag.inspect) && !this.sel && !this.analyzing;
          if (i.inside && g && i.x < r && i.y < o) {
            let {
              x: e,
              y: t
            } = i, s = i.touch, l = this.hitSig;
            for (let a = l.n - 1; a >= 0; a--)
              if (Math.abs(l.x[a] - e) <= (s ? 18 : 12) && Math.abs(l.y[a] - t) <= (s ? 18 : 13)) {
                f = {
                  x: l.x[a],
                  y: l.y[a],
                  mark: this.series.marks[l.i[a]]
                };
                break
              } if (!f) {
              let l = this.hitTrades;
              for (let i = l.n - 1; i >= 0; i--)
                if (Math.hypot(l.x[i] - e, l.y[i] - t) <= l.r[i] + (s ? 8 : 2)) {
                  u = {
                    x: l.x[i],
                    y: l.y[i],
                    r: l.r[i],
                    trade: a.trades[l.i[i]]
                  };
                  break
                }
            }
            if (!u && !f) {
              let l = this.hitWalls,
                i = s ? 10 : 3,
                r = -1,
                o = 1 / 0;
              for (let s = l.n - 1; s >= 0; s--) {
                if (e < l.x[s] || e > l.x[s] + l.w[s] || t < l.y[s] - i || t > l.y[s] + l.h[s] + i) continue;
                let a = Math.abs(t - (l.y[s] + l.h[s] / 2)) + .5 * (0 !== l.k[s]);
                a < o && (o = a, r = s)
              }
              if (r >= 0) {
                let e = this.hitWalls;
                p = {
                  x: e.x[r],
                  y: e.y[r],
                  w: e.w[r],
                  h: e.h[r],
                  wall: a.walls[e.i[r]]
                }
              }
            }
          }
          let x = this.sel || this.pickBox();
          if (x) {
            let t = this.xOf(x.i0),
              i = this.xOf(x.i1),
              n = this.yOf(x.p1),
              h = this.yOf(x.p0),
              p = Math.max(0, t),
              u = Math.max(0, n),
              f = Math.min(r, i) - p,
              g = Math.min(o, h) - u;
            for (let [a, l] of(f > 0 && g > 0 && (e.fillStyle = (0, th.B3)(s.accent, .08), e.fillRect(p, u, f, g), e.strokeStyle = (0, th.B3)(s.accent, .9), e.lineWidth = 1, e.strokeRect(Math.round(t) + .5, Math.round(n) + .5, Math.round(i - t), Math.round(h - n))), x.flip ? [
                [i, n],
                [t, h]
              ] : [
                [t, n],
                [i, h]
              ])) a >= 0 && a <= r && l >= 0 && l <= o && (e.beginPath(), e.arc(a, l, 4.5, 0, 6.2832), e.fillStyle = s.accent, e.fill(), e.strokeStyle = s.bg, e.lineWidth = 1.5, e.stroke());
            for (let [p, u] of(n > 0 && n < o && this.tag(e, n, l.px(x.p1), s.accent, s.accentInk), h > 0 && h < o && this.tag(e, h, l.px(x.p0), s.accent, s.accentInk), e.font = this._font(600, 11), [
                [t, x.i0],
                [i, x.i1]
              ])) {
              if (!(p > 0 && p < r)) continue;
              let t = l.date(a.tsAt(u)),
                i = e.measureText(t).width + 12,
                o = Math.min(r - i, Math.max(0, p - i / 2));
              e.fillStyle = s.accent, e.fillRect(o, d + 2, i, c - 4), e.fillStyle = s.accentInk, e.textAlign = "center", e.textBaseline = "middle", e.fillText(t, o + i / 2, d + c / 2 + 1), e.textBaseline = "alphabetic"
            }
          }
          let m = !!p,
            b = this.highlightId;
          if (null != b && !p) {
            let e = this.hitWalls;
            for (let t = 0; t < e.n; t++) {
              let s = a.walls[e.i[t]];
              if (s.id === b) {
                p = {
                  x: e.x[t],
                  y: e.y[t],
                  w: e.w[t],
                  h: e.h[t],
                  wall: s
                };
                break
              }
            }
          }
          if (p && (e.strokeStyle = s.accent, e.lineWidth = 1.5, e.strokeRect(p.x + .75, p.y - 1.25, Math.max(2, p.w - 1.5), p.h + 2.5), e.fillStyle = (0, th.B3)(s.accent, .12), e.fillRect(p.x, p.y - 1, p.w, p.h + 2), m || this.tag(e, this.yOf(p.wall.price), l.px(p.wall.price), s.accent, s.accentInk)), this.flash) {
            let t = this.flash,
              i = performance.now() - t.t0;
            if (i > 1200) this.flash = null;
            else {
              let r = i / 1200,
                o = Math.round(this.yOf(t.price)) + .5;
              e.save(), e.globalAlpha = 1 - .7 * r, e.strokeStyle = s.accent, e.lineWidth = 1.5, e.setLineDash([6, 4]), e.beginPath(), e.moveTo(0, o), e.lineTo(n, o), e.stroke(), e.restore(), this.tag(e, o, l.px(t.price), s.accent, s.accentInk);
              let d = this.hitWalls;
              for (let l = 0; l < d.n; l++) {
                if (a.walls[d.i[l]].id !== t.id) continue;
                let i = 4 + 12 * r;
                e.save(), e.strokeStyle = s.accent, e.globalAlpha = (1 - r) * .9, e.lineWidth = 2, e.strokeRect(d.x[l] - i, d.y[l] - i, d.w[l] + 2 * i, d.h[l] + 2 * i), e.restore();
                break
              }
              this.overDirty = !0, this.schedule()
            }
          }
          u && (e.strokeStyle = s.accent, e.lineWidth = 2, e.beginPath(), e.arc(u.x, u.y, u.r + 2, 0, 6.2832), e.stroke()), f && (e.strokeStyle = s.accent, e.lineWidth = 1.5, e.beginPath(), e.arc(f.x, f.y, 10, 0, 6.2832), e.stroke()), e.lineWidth = 1;
          let w = m ? p.wall.id : null;
          w !== this.hotId && (this.hotId = w, this.onHot && this.onHot(w)), this.hover = m ? {
            wall: p.wall
          } : u ? {
            trade: u.trade
          } : f ? {
            mark: f.mark
          } : null;
          let v = this.edgeNote ? this.edgeNote() : null;
          v && this.caption(e, v, 4, o - 24, "left")
        }
        updateTip() {
          let e = this.hover,
            t = this.tips;
          if (!e || !t || this.drag && !this.drag.custom && !this.drag.inspect) return !1;
          let s = e.wall ? "w" + e.wall.id + ":" + e.wall.usd : e.trade ? "t" + e.trade.id : "s" + e.mark.i + ":" + e.mark.dir + (e.mark.rev ? "r" : "");
          return s !== this.tipKey && (this.tipKey = s, this.setTipHtml(e.wall ? t.wall(e.wall) : e.trade ? t.trade(e.trade) : t.signal(e.mark))), this.placeTip(), !0
        }
        selHit(e, t) {
          let s = this.sel;
          if (!s) return null;
          let a = this.xOf(s.i0),
            l = this.xOf(s.i1),
            i = this.yOf(s.p1),
            r = this.yOf(s.p0);
          if (s.flip) {
            if (9 >= Math.hypot(e - l, t - i)) return "tr";
            if (9 >= Math.hypot(e - a, t - r)) return "bl"
          } else {
            if (9 >= Math.hypot(e - a, t - i)) return "tl";
            if (9 >= Math.hypot(e - l, t - r)) return "br"
          }
          return e > a && e < l && t > i && t < r && (l - a) * (r - i) < this.geo.plotW * this.geo.plotH * .6 ? "move" : null
        }
        pickBox() {
          let e = this.pick;
          return e ? {
            i0: Math.min(e.ai, e.i),
            i1: Math.max(e.ai, e.i),
            p0: Math.min(e.ap, e.p),
            p1: Math.max(e.ap, e.p),
            flip: (e.i - e.ai) * (e.p - e.ap) > 0
          } : null
        }
        boxOk(e) {
          return e && Math.abs(this.xOf(e.i1) - this.xOf(e.i0)) >= 4 && Math.abs(this.yOf(e.p0) - this.yOf(e.p1)) >= 4
        }
        finishPick() {
          let e = this.pickBox();
          this.pick = null, this.analyzing = !1, this.sel = this.boxOk(e) ? e : null, this.overDirty = !0, this.onSelChange && this.onSelChange()
        }
        gestureStart(e, t) {
          if (this.pick) return this.pick.i = this.iOf(e), this.pick.p = this.pOf(t), this.finishPick(), "done";
          let s = this.selHit(e, t);
          if (s) return s;
          if (!this.analyzing) return null;
          let a = this.iOf(e),
            l = this.pOf(t);
          return this.pick = {
            ai: a,
            ap: l,
            i: a,
            p: l
          }, "new"
        }
        gestureMove(e, t, s) {
          if ("done" === e.custom) return;
          if ("new" === e.custom) {
            let e = this.pick;
            e && (e.i = this.iOf(t), e.p = this.pOf(s), this.overDirty = !0);
            return
          }
          let a = this.sel;
          if (!a) return;
          let l = this.iOf(t),
            i = this.pOf(s);
          e.sel || (e.sel = {
            ...a
          });
          let r = e.sel;
          if ("move" === e.custom) {
            let t = l - this.iOf(e.x),
              s = i - this.pOf(e.y);
            a.i0 = r.i0 + t, a.i1 = r.i1 + t, a.p0 = r.p0 + s, a.p1 = r.p1 + s
          } else {
            let t = e.custom,
              s = "tl" === t || "bl" === t ? r.i1 : r.i0,
              o = "tl" === t || "tr" === t ? r.p0 : r.p1;
            a.i0 = Math.min(s, l), a.i1 = Math.max(s, l), a.p0 = Math.min(o, i), a.p1 = Math.max(o, i), a.flip = (l - s) * (i - o) > 0
          }
          this.overDirty = !0, this.onSelChange && this.onSelChange()
        }
        gestureEnd(e) {
          "new" === e.custom && this.pick && this.boxOk(this.pickBox()) ? this.finishPick() : "new" !== e.custom && "done" !== e.custom && this.onSelChange && this.onSelChange()
        }
        hoverCursor(e, t, s) {
          if (this.pick) return this.pick.i = this.iOf(Math.min(e, this.geo.plotW)), this.pick.p = this.pOf(Math.min(t, this.geo.plotH)), this.overDirty = !0, "crosshair";
          if ("plot" !== s) return null;
          let a = this.selHit(e, t);
          return "move" === a ? "move" : "tr" === a || "bl" === a ? "nesw-resize" : a ? "nwse-resize" : null
        }
        onKey(e) {
          return "Escape" === e.key && (!!this.sel || !!this.analyzing || !!this.pick) && (this.clearSelection(), !0)
        }
      }
      class tf {
        constructor(e, t, s, a) {
          this.root = e, this.cv = t, this.ctx = t.getContext("2d"), this.kind = s, this.chart = a, this.W = 0, this.H = 0, this.hoverI = null, this.text = null, this.off = (0, th.km)(e, (e, t) => {
            this.W = e, this.H = t, this.draw()
          })
        }
        destroy() {
          this.off()
        }
        draw() {
          let e = this.ctx,
            t = this.chart,
            s = t.T,
            a = t.model,
            l = t.series,
            i = this.text;
          if (!this.W || this.H < 24 || !s || !a || !l || !i || !t.geo.plotW) return;
          (0, th.iq)(this.cv, e, this.W, this.H);
          let {
            t: r,
            fmt: o
          } = i, n = this.W, d = this.H;
          e.clearRect(0, 0, n, d);
          let c = t.geo.plotW,
            h = t.geo.axisX,
            p = d - 6,
            u = p - 20,
            f = Math.round((20 + p) / 2) + .5,
            [g, x] = t.visRange(),
            m = null != this.hoverI && this.hoverI >= 0 && this.hoverI < a.N ? this.hoverI : a.N - 1,
            b = (e, s) => e + " " + s + "px " + t.ff;
          e.font = b(500, 12), e.textBaseline = "middle", e.strokeStyle = s.lineStrong, e.lineWidth = 1, e.beginPath(), e.moveTo(0, f), e.lineTo(c, f), e.stroke(), e.save(), e.beginPath(), e.rect(0, 0, c, d), e.clip();
          let w = l[this.kind],
            v = 1;
          if ("imb" !== this.kind) {
            v = 0;
            for (let e = g; e <= x; e++) v = Math.max(v, Math.abs(w[e]));
            v = v || 1
          }
          let y = e => f - e / v * (u / 2),
            k = Math.max(1, Math.floor(.7 / t.view.barW)),
            j = g - g % k;
          for (let a of [1, -1]) {
            e.beginPath(), e.moveTo(t.xOf(g + .5), f);
            for (let s = j; s <= x; s += k) e.lineTo(t.xOf(s + .5), y(a * Math.max(0, a * w[s])));
            e.lineTo(t.xOf(x + .5), f), e.closePath(), e.fillStyle = a > 0 ? s.bid : s.ask, e.globalAlpha = .28, e.fill()
          }
          e.globalAlpha = 1, e.beginPath();
          for (let s = j; s <= x; s += k) {
            let a = t.xOf(s + .5),
              l = y(w[s]);
            s === j ? e.moveTo(a, l) : e.lineTo(a, l)
          }
          if (e.lineWidth = 1.25, e.strokeStyle = s.ink2, e.stroke(), e.lineWidth = 1, null != this.hoverI) {
            let a = Math.round(t.xOf(this.hoverI + .5)) + .5;
            e.strokeStyle = s.cross, e.setLineDash([3, 3]), e.beginPath(), e.moveTo(a, 0), e.lineTo(a, d), e.stroke(), e.setLineDash([])
          }
          e.restore(), e.fillStyle = s.surface, e.fillRect(h, 0, n - h, d), e.strokeStyle = s.line, e.beginPath(), e.moveTo(h + .5, 0), e.lineTo(h + .5, d), e.stroke();
          let N = "imb" === this.kind ? ["+100%", "−100%"] : ["+" + o.usd(v), "−" + o.usd(v)];
          e.fillStyle = s.ink3, e.textAlign = "left", e.font = b(600, 11), e.fillText(N[0], h + 8, 24), e.fillText("0", h + 8, f), e.fillText(N[1], h + 8, p - 4);
          let M = w[m],
            S = "imb" === this.kind ? (M >= 0 ? "+" : "−") + Math.abs(100 * M).toFixed(0) + "%" : o.signed(M);
          e.font = b(500, 12.5);
          let T = r("large-orderbook-statistics.pane." + this.kind) + ("imb" === this.kind ? ` \xb1${Math.round(100*i.imbWin)}%` : "") + "  ",
            V = e.measureText(T).width,
            z = e.measureText(S).width;
          e.globalAlpha = .85, e.fillStyle = s.surface, e.fillRect(4, 3, Math.min(c - 8, V + z + 10), 19), e.globalAlpha = 1, e.save(), e.beginPath(), e.rect(4, 0, c - 8, 24), e.clip(), e.textAlign = "left", e.fillStyle = s.ink2, e.fillText(T, 9, 12.5), e.fillStyle = M >= 0 ? s.bid : s.ask, e.fillText(S, 9 + V, 12.5), e.restore()
        }
      }

      function tg() {
        let {
          term: e,
          version: t,
          t: s,
          fmt: l,
          theme: r,
          font: o
        } = b(), n = (0, i.useRef)(null), d = (0, i.useRef)(null), c = (0, i.useRef)(null), h = (0, i.useRef)(null), p = (0, i.useRef)(null), [, u] = (0, i.useReducer)(e => e + 1, 0), f = e.prefs;
        (0, i.useEffect)(() => {
          let t = p.current = new tu({
            stage: n.current,
            base: d.current,
            over: c.current,
            tip: h.current
          });
          return t.onSelChange = u, t.onHot = e => {
            for (let e of document.querySelectorAll(".lo-row.is-hot")) e.classList.remove("is-hot");
            if (null != e) {
              let t = document.querySelector(`.lo-row[data-id="${CSS.escape(e)}"]`);
              t && t.classList.add("is-hot")
            }
          }, e.attachChart(t), u(), () => {
            e.attachChart(null), t.destroy(), p.current = null
          }
        }, [e]), (0, i.useEffect)(() => {
          p.current.setTheme(r.T, o), e.drawPanes()
        }, [r, o, e]), (0, i.useEffect)(() => {
          let t = p.current;
          t.tips = function({
            t: e,
            fmt: t,
            term: s
          }) {
            let a = (t, s, a, l) => {
              let i;
              return `<div class="tw-h">${(i=(0,eH.EO)(t.logo))?`<img class="lo-logo lg" src="${(0,tc.UQ)(i)}" alt="">`:`<span class="lo-logo lg lo-coin-ph">${(0,tc.UQ)(t.brand.slice(0,1))}</span>`}<div class="tw-v"><b>${(0,tc.UQ)(t.brand+" "+_(e,t.kind))}</b><small>${(0,tc.UQ)(s)}</small></div><span class="tw-side ${a}">${(0,tc.UQ)(l)}</span></div>`
            };
            return {
              wall(l) {
                let i = O.aV[l.ex],
                  r = l.initUsd || 1,
                  o = Math.min(100, l.filledUsd / r * 100),
                  n = Math.min(100 - o, l.cancelledUsd / r * 100),
                  d = ("alive" === l.status ? Date.now() : l.endT) - l.startT,
                  c = (l.price - s.ds.curPrice) / s.ds.curPrice * 100,
                  h = e => t.qty(e / l.price) + " " + s.coin.label;
                return `<div class="tw">${a(i,s.coin.label+"/USDT \xb7 "+_(e,i.kind),l.side,e("bid"===l.side?"large-orderbook-statistics.w.bidWall":"large-orderbook-statistics.w.askWall"))}
<div class="tw-price"><b class="${l.side}">${t.px(l.price)}</b><span class="${c>=0?"bid":"ask"}">${t.pct(c)}</span><span class="lo-st ${W(l)}">${(0,tc.UQ)(e("large-orderbook-statistics.status."+W(l)))}</span></div>
<div class="tw-bar" title="${(0,tc.UQ)(e("large-orderbook-statistics.detail.lgFilled",{defaultValue:"Filled"}))} ${o.toFixed(1)}%"><i class="f" style="width:${o.toFixed(1)}%"></i><i class="c" style="width:${n.toFixed(1)}%"></i></div>
<div class="tw-grid"><div><span>${(0,tc.UQ)(e("large-orderbook-statistics.detail.init",{defaultValue:"Initial size"}))}</span><b>${t.usd(l.initUsd)}</b><small>${h(l.initUsd)}</small></div><div><span>${(0,tc.UQ)(e("large-orderbook-statistics.detail.lgRemain",{defaultValue:"Remaining"}))}</span><b>${t.usd(l.usd)}</b><small>${h(l.usd)}</small></div>
<div><span>${(0,tc.UQ)(e("large-orderbook-statistics.detail.lgFilled",{defaultValue:"Filled"}))}</span><b>${t.usd(l.filledUsd)}</b><small>${l.fills} ${(0,tc.UQ)(e("large-orderbook-statistics.unit.fills",{defaultValue:"orders"}))} \xb7 ${o.toFixed(1)}%</small></div><div><span>${(0,tc.UQ)(e("large-orderbook-statistics.detail.lgCancelled",{defaultValue:"Cancelled"}))}</span><b>${t.usd(l.cancelledUsd)}</b><small>${n.toFixed(1)}%</small></div></div>
<div class="tw-foot"><span>${(0,tc.UQ)(e("large-orderbook-statistics.w.appeared",{defaultValue:"Placed"}))} <b>${t.date(l.startT)}</b></span><span>${(0,tc.UQ)(e("alive"===l.status?"large-orderbook-statistics.w.aliveFor":"large-orderbook-statistics.w.lasted"))} <b>${t.age(d)}</b></span></div></div>`
              },
              trade(l) {
                let i = O.aV[l.ex],
                  r = "buy" === l.side ? "bid" : "ask",
                  o = s.ds.curPrice;
                return `<div class="tw">${a(i,s.coin.label+"/USDT",r,e("buy"===l.side?"large-orderbook-statistics.w.bigBuy":"large-orderbook-statistics.w.bigSell"))}
<div class="tw-price"><b class="${r}">${t.px(l.price)}</b><span class="muted">${t.date(l.t)}</span></div>
<div class="tw-grid"><div><span>${(0,tc.UQ)(e("large-orderbook-statistics.side.amount",{defaultValue:"Size"}))}</span><b>${t.usd(l.usd)}</b><small>${t.qty(l.usd/l.price)} ${s.coin.label}</small></div><div><span>${(0,tc.UQ)(e("large-orderbook-statistics.side.dist",{defaultValue:"From price"}))}</span><b class="${l.price>=o?"bid":"ask"}">${t.pct((l.price-o)/o*100)}</b></div></div></div>`
              },
              signal(a) {
                let l = s.ds,
                  i = a.dir > 0,
                  r = Math.max(1, Math.round(24 / (l.step / 36e5))),
                  o = a.i + r < l.N,
                  n = o ? (l.close[a.i + r] - l.close[a.i]) / l.close[a.i] * 100 : null,
                  d = a.rev ? "◆ " + e("large-orderbook-statistics.chart.revSig", {
                    defaultValue: "Reversal signals"
                  }) + " \xb7 " + e(i ? "large-orderbook-statistics.sig.bottom" : "large-orderbook-statistics.sig.top") : `${i?"▲":"▼"} ${a.hi?e("large-orderbook-statistics.sig.hi",{defaultValue:"high confidence"})+" \xb7 ":""}${e("large-orderbook-statistics.chart.signals",{defaultValue:"Signals"})} \xb7 ${e(i?"large-orderbook-statistics.sig.bull":"large-orderbook-statistics.sig.bear")}`,
                  c = o ? `<span class="${n>=0?"bid":"ask"}">${t.pct(n)}</span> \xb7 ${(0,tc.UQ)(e(1===a.hit?"large-orderbook-statistics.sig.hitYes":"large-orderbook-statistics.sig.hitNo"))}` : (0, tc.UQ)(e("large-orderbook-statistics.sig.pending", {
                    defaultValue: "pending"
                  }));
                return `<div class="t"><span class="${i?"bid":"ask"}">${(0,tc.UQ)(d)}</span><span class="muted">${(0,tc.UQ)(e("large-orderbook-statistics.sig.imb",{defaultValue:"Imbalance"}))} \xb1${Math.round(100*s.prefs.imbWin)}%</span></div>
<div class="g"><span>${(0,tc.UQ)(e("large-orderbook-statistics.side.time",{defaultValue:"Time"}))}</span><span>${t.date(l.tsAt(a.i))}</span><span>${(0,tc.UQ)(e("large-orderbook-statistics.side.price",{defaultValue:"Price"}))}</span><span>${t.px(l.close[a.i])}</span><span>${(0,tc.UQ)(e("large-orderbook-statistics.sig.after24",{defaultValue:"24 h later"}))}</span><span>${c}</span></div>`
              }
            }
          }({
            t: s,
            fmt: l,
            term: e
          }), t.setText(e => "tag.high" === e ? s("large-orderbook-statistics.tag.high", {
            defaultValue: "High"
          }) : "tag.low" === e ? s("large-orderbook-statistics.tag.low", {
            defaultValue: "Low"
          }) : e, l), e.drawPanes()
        }, [s, l, e]);
        let g = p.current,
          x = (t, s, l, i, r, o) => (0, a.jsx)(e2, {
            checked: f[t],
            onChange: () => e.toggleLayer(t),
            color: l,
            color2: o,
            title: i,
            marker: r,
            children: s
          }, t),
          m = ["candles", "bid", "ask", "trades", "cancelled", "signals", "revSig"],
          w = [x("candles", s("large-orderbook-statistics.chart.candles", {
            defaultValue: "Candles"
          }), "var(--lo-up)", void 0, "candle", "var(--lo-down)"), x("bid", s("large-orderbook-statistics.chart.bid", {
            defaultValue: "Bid walls"
          }), "var(--lo-bid)"), x("ask", s("large-orderbook-statistics.chart.ask", {
            defaultValue: "Ask walls"
          }), "var(--lo-ask)"), x("trades", s("large-orderbook-statistics.chart.trades", {
            defaultValue: "Large trades"
          }), "var(--glass-fg-2)"), x("cancelled", s("large-orderbook-statistics.chart.cancelled", {
            defaultValue: "Cancelled"
          })), x("signals", s("large-orderbook-statistics.chart.signals", {
            defaultValue: "Signals"
          }), "var(--lo-bid)", s("large-orderbook-statistics.chart.signalsTitle", {
            defaultValue: "Imbalance trend signals on the main chart: ▲ below the candle, ▼ above it; solid = price followed within 24 h, hollow = it did not, dotted = pending"
          }), "tri"), x("revSig", s("large-orderbook-statistics.chart.revSig", {
            defaultValue: "Reversal signals"
          }), "var(--lo-accent)", s("large-orderbook-statistics.chart.revSigTitle", {
            defaultValue: "Diamond = imbalance-spike reversal signal: a spike in the wall imbalance while price sits near its two-day high or low hints at a possible top or bottom"
          }), "diamond")],
          v = O.sH.map(t => (0, a.jsx)(e2, {
            checked: f.panes[t],
            onChange: () => e.togglePane(t),
            title: s("large-orderbook-statistics.pane.hint." + t),
            children: s("large-orderbook-statistics.pane." + t)
          }, t)),
          y = e.status,
          k = g && g.sel;
        return (0, a.jsxs)("section", {
          className: "lo-card lo-chart-card",
          "aria-label": s("large-orderbook-statistics.chart.aria", {
            defaultValue: "Price chart"
          }),
          children: [(0, a.jsxs)("div", {
            className: "lo-tbar",
            children: [(0, a.jsx)("span", {
              className: "lo-desk",
              children: w
            }), (0, a.jsx)("span", {
              className: "lo-phone",
              children: (0, a.jsx)(e5, {
                size: "compact",
                align: "start",
                width: 240,
                label: s("large-orderbook-statistics.chart.layers", {
                  defaultValue: "Layers"
                }),
                trigger: (0, a.jsxs)(a.Fragment, {
                  children: [s("large-orderbook-statistics.chart.layers", {
                    defaultValue: "Layers"
                  }), (0, a.jsxs)("span", {
                    className: "lo-num",
                    children: [m.filter(e => f[e]).length, "/", m.length]
                  }), (0, a.jsx)("i", {
                    className: "lo-caret",
                    "aria-hidden": "true"
                  })]
                }),
                triggerClassName: "lo-foldbtn",
                children: () => (0, a.jsx)("div", {
                  className: "lo-fold",
                  children: w
                })
              })
            }), (0, a.jsxs)(eZ, {
              size: "compact",
              variant: "toggle",
              selected: !!(g && g.analyzing),
              title: s("large-orderbook-statistics.chart.analyzeTitle", {
                defaultValue: "Drag a time \xd7 price box on the chart to total the walls and trades inside it"
              }),
              "aria-label": s("large-orderbook-statistics.chart.analyze", {
                defaultValue: "✎ Wall analysis"
              }),
              onClick: () => g.setAnalyzing(!g.analyzing),
              children: [(0, a.jsx)("span", {
                className: "lo-desk-txt",
                children: s("large-orderbook-statistics.chart.analyze", {
                  defaultValue: "✎ Wall analysis"
                })
              }), (0, a.jsx)("span", {
                className: "lo-phone-txt",
                "aria-hidden": "true",
                children: "✎"
              })]
            }), (0, a.jsx)("span", {
              className: "lo-spacer"
            }), (0, a.jsx)(eZ, {
              size: "compact",
              title: "End",
              onClick: () => g && g.jumpLatest(),
              children: s("large-orderbook-statistics.chart.latest", {
                defaultValue: "Latest"
              })
            }), (0, a.jsx)(eZ, {
              size: "compact",
              title: s("large-orderbook-statistics.chart.resetTitle", {
                defaultValue: "Home / double-click the chart"
              }),
              onClick: () => g && g.resetView(!0),
              children: s("large-orderbook-statistics.chart.reset", {
                defaultValue: "Reset view"
              })
            })]
          }), (0, a.jsxs)("div", {
            className: "lo-stage" + (e.loading ? " loading" : ""),
            ref: n,
            "aria-label": s("large-orderbook-statistics.chart.stageAria", {
              defaultValue: "Candles and large-order walls: drag to pan, wheel to zoom, arrow keys to move"
            }),
            children: [(0, a.jsx)("canvas", {
              ref: d
            }), (0, a.jsx)("canvas", {
              ref: c
            }), e.ds ? (0, a.jsx)("span", {
              className: "lo-watermark",
              "aria-hidden": "true",
              children: (0, a.jsx)(td.A, {})
            }) : null, (0, a.jsx)("div", {
              className: "lo-tip",
              ref: h
            }), k ? (0, a.jsx)(tb, {
              chart: g
            }) : null, "ready" === y ? (0, a.jsx)(tx, {
              term: e,
              t: s
            }) : null, "error" === y ? (0, a.jsx)("div", {
              className: "lo-overlay",
              role: "alert",
              children: (0, a.jsxs)("div", {
                className: "box",
                children: [(0, a.jsx)("span", {
                  children: s("large-orderbook-statistics.chart.errLoad", {
                    defaultValue: "Failed to load candle data"
                  })
                }), (0, a.jsx)(eZ, {
                  size: "compact",
                  onClick: () => e.load(!1),
                  children: s("large-orderbook-statistics.chart.retry", {
                    defaultValue: "Retry"
                  })
                })]
              })
            }) : "empty" === y ? (0, a.jsx)("div", {
              className: "lo-overlay",
              children: (0, a.jsx)("div", {
                className: "box",
                children: (0, a.jsx)("span", {
                  children: s("large-orderbook-statistics.chart.empty", {
                    defaultValue: "No candle data for this symbol"
                  })
                })
              })
            }) : "loading" === y ? (0, a.jsx)("div", {
              className: "lo-overlay",
              "aria-live": "polite",
              children: (0, a.jsxs)("div", {
                className: "box",
                children: [(0, a.jsx)("span", {
                  className: "lo-spin",
                  "aria-hidden": "true"
                }), (0, a.jsx)("span", {
                  children: s("large-orderbook-statistics.chart.loading", {
                    defaultValue: "Loading…"
                  })
                })]
              })
            }) : null]
          }), (0, a.jsxs)("div", {
            className: "lo-panebar",
            children: [(0, a.jsxs)("span", {
              className: "lo-desk",
              children: [(0, a.jsx)("span", {
                className: "lo-cap",
                children: s("large-orderbook-statistics.pane.label", {
                  defaultValue: "Panes"
                })
              }), v]
            }), (0, a.jsx)("span", {
              className: "lo-phone",
              children: (0, a.jsx)(e5, {
                size: "compact",
                align: "start",
                width: 240,
                label: s("large-orderbook-statistics.pane.label", {
                  defaultValue: "Panes"
                }),
                trigger: (0, a.jsxs)(a.Fragment, {
                  children: [s("large-orderbook-statistics.pane.label", {
                    defaultValue: "Panes"
                  }), (0, a.jsxs)("span", {
                    className: "lo-num",
                    children: [O.sH.filter(e => f.panes[e]).length, "/", O.sH.length]
                  }), (0, a.jsx)("i", {
                    className: "lo-caret",
                    "aria-hidden": "true"
                  })]
                }),
                triggerClassName: "lo-foldbtn",
                children: () => (0, a.jsx)("div", {
                  className: "lo-fold",
                  children: v
                })
              })
            }), (0, a.jsx)("span", {
              className: "lo-spacer"
            }), (0, a.jsx)(e3, {
              size: "compact",
              label: s("large-orderbook-statistics.pane.imbWin", {
                defaultValue: "Imbalance window"
              }),
              title: s("large-orderbook-statistics.pane.imbWinTitle", {
                defaultValue: "Price window for the imbalance: only walls within this distance from the last price count"
              }),
              value: f.imbWin,
              onChange: t => e.setImbWin(t),
              options: O.JK.map(e => ({
                value: e,
                label: "\xb1" + Math.round(100 * e) + "%"
              }))
            }), null]
          }), (0, a.jsx)("div", {
            className: "lo-panes",
            children: O.sH.map(e => (0, a.jsx)(tm, {
              kind: e,
              on: f.panes[e],
              chart: g,
              version: t
            }, e))
          })]
        })
      }

      function tx({
        term: e,
        t
      }) {
        let s = (0, i.useSyncExternalStore)(e.subscribeOrders, e.getOrders, e.getOrders),
          l = "idle" !== s.state,
          r = function(e) {
            let [t, s] = (0, i.useState)(!1), a = (0, i.useRef)(0);
            return (0, i.useEffect)(() => {
              if (e) {
                if (t) return;
                let e = setTimeout(() => {
                  a.current = Date.now(), s(!0)
                }, 400);
                return () => clearTimeout(e)
              }
              if (!t) return;
              let l = setTimeout(() => s(!1), Math.max(0, 700 - (Date.now() - a.current)));
              return () => clearTimeout(l)
            }, [e, t]), t
          }(l),
          o = (0, i.useRef)(s);
        l && (o.current = s);
        let [n, d] = (0, i.useState)(!1);
        if (!r) return null;
        let c = o.current,
          h = "error" === c.state,
          p = h ? t("large-orderbook-statistics.chart.ordersErr", {
            defaultValue: "Large-order data failed to load, retrying shortly"
          }) : "hist" === c.state ? t("large-orderbook-statistics.chart.ordersHist", {
            defaultValue: "Loading earlier orders…"
          }) : c.total ? t("large-orderbook-statistics.chart.ordersProgress", {
            done: c.done,
            total: c.total,
            defaultValue: "Loading large orders {{done}}/{{total}}"
          }) : t("large-orderbook-statistics.chart.ordersLoading", {
            defaultValue: "Loading large orders…"
          }),
          u = "loading" === c.state && c.total ? Math.min(100, c.done / c.total * 100) : null;
        return (0, a.jsxs)("div", {
          className: "lo-notice" + (h ? " err" : "") + (n ? " open" : ""),
          role: "status",
          "aria-live": "polite",
          tabIndex: 0,
          onPointerDown: e => e.stopPropagation(),
          onClick: () => d(e => !e),
          children: [(0, a.jsx)("span", {
            className: "ico",
            "aria-hidden": "true",
            style: null == u ? void 0 : {
              "--p": u.toFixed(0) + "%"
            },
            children: h ? "!" : (0, a.jsx)("span", {
              className: "lo-spin"
            })
          }), (0, a.jsxs)("span", {
            className: "txt",
            children: [(0, a.jsx)("span", {
              children: p
            }), null == u ? null : (0, a.jsx)("i", {
              className: "prog",
              children: (0, a.jsx)("b", {
                style: {
                  width: u.toFixed(0) + "%"
                }
              })
            })]
          })]
        })
      }

      function tm({
        kind: e,
        on: t,
        chart: s
      }) {
        let {
          term: l,
          t: r,
          fmt: o
        } = b(), n = (0, i.useRef)(null), d = (0, i.useRef)(null), c = (0, i.useRef)(null);
        return (0, i.useEffect)(() => {
          if (!s) return;
          let t = c.current = new tf(n.current, d.current, e, s);
          return l.attachPane(e, t), () => {
            l.attachPane(e, null), t.destroy(), c.current = null
          }
        }, [s, e, l]), (0, i.useEffect)(() => {
          let e = c.current;
          e && (e.text = {
            t: r,
            fmt: o,
            sym: l.prefs.symbol,
            imbWin: l.prefs.imbWin,
            bt: "ready" === l.bt.state ? l.bt.res : null
          }, e.draw())
        }), (0, a.jsx)("div", {
          ref: n,
          className: "lo-strip" + (t ? "" : " off"),
          title: r("large-orderbook-statistics.pane.hint." + e),
          children: (0, a.jsx)("canvas", {
            ref: d
          })
        })
      }

      function tb({
        chart: e
      }) {
        let {
          term: t,
          t: s,
          fmt: l,
          theme: r
        } = b(), [o, n] = (0, i.useState)(() => t.prefs.apPos || {
          x: 8,
          y: 8
        }), d = (0, i.useRef)(null), [, c] = (0, i.useReducer)(e => e + 1, 0);
        (0, i.useEffect)(() => (window.addEventListener("resize", c), () => window.removeEventListener("resize", c)), []), (0, i.useLayoutEffect)(() => {
          c()
        }, []);
        let h = t => {
            let s = e.stage.getBoundingClientRect(),
              a = s.left + window.scrollX,
              l = s.top + window.scrollY,
              i = d.current ? d.current.offsetWidth : 0;
            return {
              bx: a,
              by: l,
              x: Math.min(Math.max(4, document.documentElement.clientWidth - i - 4), Math.max(4, a + t.x)),
              y: Math.max(4, l + t.y)
            }
          },
          p = e.sel,
          u = t.ds;
        if (!p || !u) return null;
        let {
          cols: f,
          res: x,
          t0: m,
          t1: w
        } = function(e, t, s) {
          let a = e.tsAt(s.i0),
            l = e.tsAt(s.i1),
            i = new Set;
          for (let t of e.walls) i.add(t.ex);
          for (let t of e.trades) i.add(t.ex);
          let r = O.EX.filter(e => t.exSel.has(e.id) && i.has(e.id)),
            o = () => ({
              bid: 0,
              ask: 0,
              nNew: 0,
              nCancel: 0,
              maxBid: 0,
              maxAsk: 0,
              buy: 0,
              sell: 0,
              bp: 0,
              sp: 0,
              nb: 0,
              ns: 0
            }),
            n = {
              all: o()
            };
          for (let e of r) n[e.id] = o();
          for (let i of e.walls) {
            if (!t.exSel.has(i.ex) || C(i) < t.threshold || i.price < s.p0 || i.price > s.p1 || i.startT > l || null != i.endT && i.endT < a) continue;
            let e = C(i);
            for (let s of [n[i.ex], n.all]) s && ("bid" === i.side ? (s.bid += e, e > s.maxBid && (s.maxBid = e)) : (s.ask += e, e > s.maxAsk && (s.maxAsk = e)), i.startT >= a && s.nNew++, "cancelled" === i.status && i.endT >= a && i.endT <= l && I(i, t) && s.nCancel++)
          }
          for (let i of e.trades)
            if (t.exSel.has(i.ex) && !(i.usd < t.threshold) && !(i.t < a) && !(i.t > l) && !(i.price < s.p0) && !(i.price > s.p1))
              for (let e of [n[i.ex], n.all]) e && ("buy" === i.side ? (e.buy += i.usd, e.bp += i.price * i.usd, e.nb++) : (e.sell += i.usd, e.sp += i.price * i.usd, e.ns++));
          return {
            cols: r,
            res: n,
            t0: a,
            t1: l
          }
        }(u, t.filters, p), v = [...f.map(e => e.id), "all"], y = e => e > 0 ? "bid" : e < 0 ? "ask" : "", k = "walls" === t.prefs.apTab ? [
          ["large-orderbook-statistics.analysis.netWalls", e => [l.signed(e.bid - e.ask), y(e.bid - e.ask)]],
          ["large-orderbook-statistics.analysis.bidAmt", e => [l.usd(e.bid), "bid"]],
          ["large-orderbook-statistics.analysis.askAmt", e => [l.usd(e.ask), "ask"]],
          ["large-orderbook-statistics.analysis.maxBid", e => [e.maxBid ? l.usd(e.maxBid) : "—", ""]],
          ["large-orderbook-statistics.analysis.maxAsk", e => [e.maxAsk ? l.usd(e.maxAsk) : "—", ""]],
          ["large-orderbook-statistics.analysis.nNew", e => [e.nNew, ""]],
          ["large-orderbook-statistics.analysis.nCancel", e => [e.nCancel, ""]]
        ] : [
          ["large-orderbook-statistics.analysis.netTrades", e => [l.signed(e.buy - e.sell), y(e.buy - e.sell)]],
          ["large-orderbook-statistics.analysis.buyAmt", e => [l.usd(e.buy), "bid"]],
          ["large-orderbook-statistics.analysis.sellAmt", e => [l.usd(e.sell), "ask"]],
          ["large-orderbook-statistics.analysis.buyAvg", e => [e.nb ? l.px(e.bp / e.buy) : "—", "bid"]],
          ["large-orderbook-statistics.analysis.sellAvg", e => [e.ns ? l.px(e.sp / e.sell) : "—", "ask"]],
          ["large-orderbook-statistics.analysis.nBuy", e => [e.nb, ""]],
          ["large-orderbook-statistics.analysis.nSell", e => [e.ns, ""]]
        ], j = h(o);
        return (0, tn.createPortal)((0, a.jsx)(g, {
          style: r && r.vars,
          children: (0, a.jsxs)("div", {
            className: "lo-apanel",
            ref: d,
            style: {
              left: j.x,
              top: j.y
            },
            children: [(0, a.jsxs)("div", {
              className: "ah",
              children: [(0, a.jsx)(e0, {
                value: t.prefs.apTab,
                onChange: e => t.set({
                  apTab: e
                }),
                options: [{
                  value: "walls",
                  label: s("large-orderbook-statistics.analysis.walls", {
                    defaultValue: "Walls"
                  })
                }, {
                  value: "trades",
                  label: s("large-orderbook-statistics.analysis.trades", {
                    defaultValue: "Large trades"
                  })
                }]
              }), (0, a.jsx)("span", {
                className: "grip",
                "aria-hidden": "true",
                onPointerDown: e => {
                  if ("mouse" === e.pointerType && 0 !== e.button) return;
                  e.preventDefault(), e.stopPropagation();
                  let s = e.currentTarget,
                    a = e.clientX,
                    l = e.clientY,
                    i = o,
                    r = e => {
                      let t = h({
                        x: o.x + e.clientX - a,
                        y: o.y + e.clientY - l
                      });
                      n(i = {
                        x: t.x - t.bx,
                        y: t.y - t.by
                      })
                    },
                    d = () => {
                      s.removeEventListener("pointermove", r), s.removeEventListener("pointerup", d), s.removeEventListener("pointercancel", d), t.set({
                        apPos: i
                      })
                    };
                  try {
                    s.setPointerCapture(e.pointerId)
                  } catch {}
                  s.addEventListener("pointermove", r), s.addEventListener("pointerup", d), s.addEventListener("pointercancel", d)
                }
              }), (0, a.jsx)(eZ, {
                icon: !0,
                "aria-label": s("large-orderbook-statistics.analysis.close", {
                  defaultValue: "Remove selection"
                }),
                title: s("large-orderbook-statistics.analysis.closeTitle", {
                  defaultValue: "Remove selection (Esc)"
                }),
                onClick: () => e.clearSelection(),
                children: "✕"
              })]
            }), (0, a.jsxs)("div", {
              className: "rng",
              children: [l.date(m), " → ", l.date(w), " \xb7 ", s("large-orderbook-statistics.side.price", {
                defaultValue: "Price"
              }), " ", l.px(p.p0), " – ", l.px(p.p1), " \xb7 ", s("large-orderbook-statistics.analysis.hint", {
                defaultValue: "drag a corner to resize, drag inside to move"
              })]
            }), (0, a.jsx)("div", {
              className: "tw",
              children: (0, a.jsxs)("table", {
                children: [(0, a.jsx)("thead", {
                  children: (0, a.jsxs)("tr", {
                    children: [(0, a.jsx)("th", {}), f.map(e => (0, a.jsxs)("th", {
                      title: e.brand,
                      children: [(0, a.jsx)("span", {
                        className: "ex",
                        role: "img",
                        "aria-label": e.brand,
                        children: (0, a.jsx)(tt, {
                          e: e,
                          size: "md"
                        })
                      }), (0, a.jsx)("span", {
                        className: "k",
                        children: _(s, e.kind)
                      })]
                    }, e.id)), (0, a.jsxs)("th", {
                      children: [s("large-orderbook-statistics.analysis.total", {
                        defaultValue: "Total"
                      }), (0, a.jsx)("span", {
                        className: "k",
                        children: s("large-orderbook-statistics.analysis.totalSub", {
                          defaultValue: "selected venues"
                        })
                      })]
                    })]
                  })
                }), (0, a.jsx)("tbody", {
                  children: k.map(([e, t]) => (0, a.jsxs)("tr", {
                    children: [(0, a.jsx)("td", {
                      children: s(e)
                    }), v.map(e => {
                      let [s, l] = t(x[e]);
                      return (0, a.jsx)("td", {
                        className: l,
                        children: s
                      }, e)
                    })]
                  }, e))
                })]
              })
            })]
          })
        }), document.body)
      }
      let tw = i.useLayoutEffect,
        tv = ({
          ex: e,
          t,
          full: s
        }) => {
          let l = O.aV[e];
          return l ? (0, a.jsxs)("span", {
            className: "lo-exb",
            title: l.brand + " " + _(t, l.kind),
            children: [(0, a.jsx)(tt, {
              e: l
            }), s ? (0, a.jsxs)("span", {
              className: "nm",
              children: [l.brand, " ", _(t, l.kind)]
            }) : (0, a.jsx)("i", {
              children: _(t, l.kind)
            })]
          }) : null
        },
        ty = () => (0, a.jsxs)("svg", {
          width: "16",
          height: "16",
          viewBox: "0 0 16 16",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.5",
          strokeLinecap: "round",
          "aria-hidden": "true",
          children: [(0, a.jsx)("circle", {
            cx: "8",
            cy: "8",
            r: "4.5"
          }), (0, a.jsx)("circle", {
            cx: "8",
            cy: "8",
            r: "1",
            fill: "currentColor",
            stroke: "none"
          }), (0, a.jsx)("path", {
            d: "M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15"
          })]
        });

      function tk() {
        let {
          term: e,
          t
        } = b(), s = "new" === e.prefs.tab ? "new" : "book", l = e.ds, r = e.newFeed.unread, o = (0, i.useMemo)(() => l ? e8(l, e.filters).total : 0, [l, e.version]), [n, d] = (0, i.useState)(!1), [c, h] = (0, i.useState)(0), p = (e, t, s, l) => ({
          value: e,
          label: (0, a.jsxs)("span", {
            className: "lo-tablab",
            children: [t, s ? (0, a.jsx)("span", {
              className: "lo-cnt" + (l ? " hot" : ""),
              children: s
            }) : null]
          })
        });
        return (0, a.jsxs)("aside", {
          className: "lo-card lo-side",
          "aria-label": t("large-orderbook-statistics.side.aria", {
            defaultValue: "Order book, large trades and new walls"
          }),
          children: [(0, a.jsxs)("div", {
            className: "lo-side-tabs",
            children: [(0, a.jsx)(e0, {
              ariaLabel: t("large-orderbook-statistics.side.aria", {
                defaultValue: "Order book, large trades and new walls"
              }),
              value: s,
              onChange: t => {
                e.set({
                  tab: t
                }), "new" === t && e.openNewTab()
              },
              panelId: e => "lo-pane-" + e,
              options: [p("book", t("large-orderbook-statistics.side.book", {
                defaultValue: "Order book"
              }), o), p("new", t("large-orderbook-statistics.side.new", {
                defaultValue: "New walls"
              }), r, !0)]
            }), "book" === s ? (0, a.jsxs)("span", {
              className: "lo-side-ctl",
              children: [n ? (0, a.jsx)(eZ, {
                size: "compact",
                icon: !0,
                onClick: () => h(e => e + 1),
                children: (0, a.jsx)(ty, {})
              }) : null, (0, a.jsx)(e3, {
                value: e.prefs.bookPct,
                onChange: t => e.set({
                  bookPct: t
                }, "chart"),
                options: [.1, .2, .3, .5, 1].map(e => ({
                  value: e,
                  label: 100 * e + "%"
                }))
              })]
            }) : null]
          }), "book" === s ? (0, a.jsx)(tj, {
            onDrift: d,
            centerReq: c
          }) : (0, a.jsx)(tM, {})]
        })
      }

      function tj({
        onDrift: e,
        centerReq: t
      }) {
        let {
          term: s,
          version: l,
          t: r,
          fmt: o
        } = b(), n = s.ds, d = s.prefs, c = (0, i.useMemo)(() => n ? e8(n, s.filters, d.bookPct) : null, [n, l, d.bookPct]), h = (0, i.useRef)(!0), p = (0, i.useRef)(null), u = (0, i.useSyncExternalStore)(V, () => T().matches, () => !1), f = (0, i.useMemo)(() => c ? c.asks.concat([{
          divider: !0
        }], c.bids) : [], [c]), g = (0, x.z)(u ? 0 : f.length, 32, p), m = u ? 0 : g.start, w = u ? f.length : g.end, v = u ? 0 : g.padTop, y = u ? 0 : g.padBottom, k = n ? n.sym + n.ivMin : "", j = (0, i.useRef)(!1), N = () => {
          h.current = !1, j.current = !0
        };
        if (tw(() => {
            h.current = !0, j.current = !1, e(!1)
          }, [k, d.bookPct]), tw(() => {
            t && (h.current = !0, j.current = !1, e(!1))
          }, [t]), (0, i.useEffect)(() => {
            let t = g.box;
            if (!t) return;
            let s = () => {
              j.current && !h.current && e(!0)
            };
            return t.addEventListener("scroll", s, {
              passive: !0
            }), () => t.removeEventListener("scroll", s)
          }, [g.box, e]), tw(() => {
            h.current && g.box && !(g.box.clientHeight <= 0) && c && g.center(c.asks.length)
          }), !c) return (0, a.jsx)("div", {
          className: "lo-pane",
          id: "lo-pane-book",
          role: "tabpanel"
        });
        let M = n.curPrice,
          S = s.tiers,
          z = Math.max(c.asks.concat(c.bids).reduce((e, t) => Math.max(e, t.usd), 1), S[2]),
          _ = M >= n.open[n.N - 1],
          A = c.nearestAsk && c.nearestBid ? o.pct((c.nearestAsk.price - c.nearestBid.price) / M * 100) : "—";
        return (0, a.jsxs)("div", {
          className: "lo-pane",
          id: "lo-pane-book",
          role: "tabpanel",
          ref: g.ref,
          onWheel: N,
          onPointerDown: N,
          onKeyDown: N,
          children: [(0, a.jsxs)("div", {
            className: "lo-thead",
            ref: p,
            children: [(0, a.jsx)("span", {
              children: r("large-orderbook-statistics.side.priceEx", {
                defaultValue: "Price \xb7 venue"
              })
            }), (0, a.jsx)("span", {
              children: r("large-orderbook-statistics.side.amount", {
                defaultValue: "Size"
              })
            }), (0, a.jsx)("span", {
              children: r("large-orderbook-statistics.side.dist", {
                defaultValue: "From price"
              })
            }), (0, a.jsx)("span", {
              children: r("large-orderbook-statistics.side.age", {
                defaultValue: "Age"
              })
            })]
          }), v ? (0, a.jsx)("div", {
            "aria-hidden": "true",
            style: {
              height: v
            }
          }) : null, f.slice(m, w).map((e, t) => {
            var l;
            return l = m + t, e.divider ? (0, a.jsxs)("div", {
              className: "lo-divider",
              ref: l === m ? g.measure : void 0,
              children: [(0, a.jsx)("span", {
                className: "muted",
                children: r("large-orderbook-statistics.side.cur", {
                  defaultValue: "Last"
                })
              }), (0, a.jsxs)("b", {
                className: _ ? "bid" : "ask",
                children: [(0, a.jsx)(te, {
                  sym: n.sym,
                  size: "sm"
                }), s.coin.label, " ", _ ? "▲" : "▼", " ", (0, a.jsx)("span", {
                  className: "px",
                  children: o.px(M)
                })]
              }), (0, a.jsxs)("span", {
                className: "muted",
                children: [r("large-orderbook-statistics.side.gap", {
                  defaultValue: "Wall gap"
                }), " ", A]
              })]
            }, "div") : (0, a.jsx)(tN, {
              w: e,
              last: M,
              mx: z,
              tiersKey: S.join(),
              measure: l === m ? g.measure : void 0
            }, e.id)
          }), y ? (0, a.jsx)("div", {
            "aria-hidden": "true",
            style: {
              height: y
            }
          }) : null, c.total ? null : (0, a.jsx)("div", {
            className: "lo-empty",
            children: r("large-orderbook-statistics.side.empty", {
              defaultValue: "No open walls match the current filters"
            })
          })]
        })
      }
      let tN = i.memo(function({
        w: e,
        last: t,
        mx: s,
        measure: l
      }) {
        let {
          term: i,
          t: r,
          fmt: o
        } = b(), n = Math.min(100, 100 * Math.pow(e.usd / s, .6)).toFixed(1) + "%";
        return (0, a.jsxs)("button", {
          ref: l,
          type: "button",
          className: "lo-row " + e.side,
          "data-id": e.id,
          onMouseEnter: () => i.highlight(e.id),
          onMouseLeave: () => i.highlight(null),
          onClick: () => i.locate(e),
          children: [(0, a.jsx)("i", {
            className: "depth",
            style: {
              width: n,
              "--tier": `var(--lo-bk-${e.side}-${$(e.usd,i.tiers)+1})`
            }
          }), (0, a.jsxs)("span", {
            className: "p",
            children: [(0, a.jsx)(tv, {
              ex: e.ex,
              t: r
            }), (0, a.jsx)("b", {
              children: o.px(e.price)
            })]
          }), (0, a.jsx)("span", {
            className: "u",
            children: o.usd(e.usd)
          }), (0, a.jsx)("span", {
            className: "d",
            children: o.pct((e.price - t) / t * 100)
          }), (0, a.jsx)("span", {
            className: "a",
            children: (0, a.jsx)(M, {
              from: e.startT,
              fmt: o
            })
          })]
        })
      });

      function tM() {
        let {
          term: e,
          t,
          fmt: s
        } = b(), l = e.newFeed, r = e.ds, o = e.prefs.newAlert;
        (0, i.useEffect)(() => {
          l.unread && e.openNewTab()
        });
        let n = r ? r.curPrice : 0;
        return (0, a.jsxs)("div", {
          className: "lo-pane lo-newfeed",
          id: "lo-pane-new",
          role: "tabpanel",
          children: [(0, a.jsxs)("div", {
            className: "lo-thead",
            children: [(0, a.jsx)("span", {
              children: t("large-orderbook-statistics.side.time", {
                defaultValue: "Time"
              })
            }), (0, a.jsx)("span", {
              children: t("large-orderbook-statistics.feed.head", {
                defaultValue: "New walls (newest first)"
              })
            })]
          }), (0, a.jsxs)("div", {
            className: "lo-note",
            children: [(0, a.jsx)("i", {
              children: "i"
            }), (0, a.jsx)("span", {
              children: z(t, "large-orderbook-statistics.feed.noteLocate", {
                usd: (0, a.jsx)("b", {
                  children: s.usd(O.iJ)
                })
              }, "New walls of {{usd}} or more pop up a notice at the bottom right of the page (click to locate); smaller ones are only listed here, and nothing is drawn on the chart.")
            }), (0, a.jsxs)("button", {
              type: "button",
              className: "tg",
              "aria-pressed": o,
              onClick: () => e.set({
                newAlert: !o
              }),
              children: [t("large-orderbook-statistics.feed.alerts", {
                defaultValue: "Pop-up alerts"
              }), " ", (0, a.jsx)("b", {
                children: t(o ? "large-orderbook-statistics.feed.on" : "large-orderbook-statistics.feed.off")
              })]
            })]
          }), l.list.length ? l.list.map(i => (0, a.jsxs)("button", {
            type: "button",
            className: "lo-nrow" + (l.fresh.has(i.id) ? " is-new" : ""),
            onClick: () => {
              e.select(i.id), e.locate(i)
            },
            children: [(0, a.jsx)("time", {
              children: s.date(i.startT).slice(-11)
            }), (0, a.jsxs)("span", {
              children: [(0, a.jsx)(tS, {
                w: i,
                t: t,
                fmt: s
              }), " ", (0, a.jsxs)("span", {
                className: "muted",
                children: ["\xb7 ", t("large-orderbook-statistics.side.dist", {
                  defaultValue: "From price"
                }), " ", s.pct((i.price - n) / n * 100)]
              })]
            })]
          }, i.id)) : (0, a.jsx)("div", {
            className: "lo-empty",
            children: t("large-orderbook-statistics.feed.emptyLive", {
              defaultValue: "No new walls yet. New walls appear here as soon as they are placed"
            })
          })]
        })
      }
      let tS = ({
        w: e,
        t,
        fmt: s
      }) => {
        let l = O.aV[e.ex];
        return z(t, "large-orderbook-statistics.feed.sentence", {
          ex: l ? l.brand + " " + _(t, l.kind) : e.ex,
          usd: (0, a.jsx)("b", {
            className: "usd " + e.side,
            children: s.usd(e.initUsd)
          }),
          side: (0, a.jsx)("b", {
            className: e.side,
            children: t("bid" === e.side ? "large-orderbook-statistics.feed.bid" : "large-orderbook-statistics.feed.ask")
          }),
          price: (0, a.jsx)("b", {
            children: s.px(e.price)
          })
        }, "{{ex}} placed {{side}} of {{usd}} at {{price}}")
      };

      function tT() {
        let {
          term: e,
          version: t,
          t: s,
          fmt: l
        } = b(), r = e.ds, o = (0, i.useMemo)(() => r ? function(e, t) {
          let s = [];
          for (let a of O.EX) {
            if (!t.exSel.has(a.id)) continue;
            let l = 0,
              i = 0;
            for (let s of e.walls) s.ex !== a.id || "alive" !== s.status || C(s) < t.threshold || ("bid" === s.side ? l += s.usd : i += s.usd);
            (l || i) && s.push({
              e: a,
              bid: l,
              ask: i
            })
          }
          return s
        }(r, e.filters) : [], [r, t]), n = !r && "loading" === e.status;
        return (0, a.jsxs)("section", {
          className: "lo-card",
          "aria-labelledby": "lo-stats-h",
          children: [(0, a.jsxs)("div", {
            className: "lo-ph",
            children: [(0, a.jsx)("h3", {
              id: "lo-stats-h",
              children: s("large-orderbook-statistics.stats.title", {
                defaultValue: "By exchange"
              })
            }), (0, a.jsx)("small", {
              children: s("large-orderbook-statistics.stats.subWalls", {
                defaultValue: "Open walls, per exchange"
              })
            })]
          }), (0, a.jsx)("div", {
            className: "lo-stats",
            children: o.length ? o.map(({
              e,
              bid: t,
              ask: i
            }) => {
              let r = t + i || 1,
                o = t - i;
              return (0, a.jsxs)("div", {
                className: "lo-scard",
                children: [(0, a.jsxs)("div", {
                  className: "h",
                  children: [(0, a.jsx)(tt, {
                    e: e,
                    size: "lg"
                  }), (0, a.jsx)("span", {
                    className: "nm",
                    children: e.brand
                  }), (0, a.jsx)("span", {
                    className: "kd",
                    children: _(s, e.kind)
                  }), (0, a.jsxs)("span", {
                    className: "net " + (o >= 0 ? "bid" : "ask"),
                    children: [s("large-orderbook-statistics.stats.net", {
                      defaultValue: "Net walls"
                    }), " ", l.signed(o)]
                  })]
                }), (0, a.jsxs)("div", {
                  className: "split",
                  children: [(0, a.jsx)("i", {
                    className: "b",
                    style: {
                      width: (t / r * 100).toFixed(1) + "%"
                    }
                  }), (0, a.jsx)("i", {
                    className: "a",
                    style: {
                      width: (i / r * 100).toFixed(1) + "%"
                    }
                  })]
                }), (0, a.jsxs)("div", {
                  className: "sgrid",
                  children: [(0, a.jsxs)("div", {
                    children: [(0, a.jsx)("span", {
                      children: s("large-orderbook-statistics.stats.bid", {
                        defaultValue: "Bid walls"
                      })
                    }), (0, a.jsx)("span", {
                      className: "bid",
                      children: l.usd(t)
                    })]
                  }), (0, a.jsxs)("div", {
                    children: [(0, a.jsx)("span", {
                      children: s("large-orderbook-statistics.stats.ask", {
                        defaultValue: "Ask walls"
                      })
                    }), (0, a.jsx)("span", {
                      className: "ask",
                      children: l.usd(i)
                    })]
                  })]
                })]
              }, e.id)
            }) : (0, a.jsx)("div", {
              className: "lo-empty",
              children: n ? s("large-orderbook-statistics.chart.loading", {
                defaultValue: "Loading…"
              }) : s("large-orderbook-statistics.side.empty", {
                defaultValue: "No open walls match the current filters"
              })
            })
          })]
        })
      }
      let tV = ["side", "price", "dist", "init", "remain", "filled", "fills", "age", "end", "status"],
        tz = ["book:1", "remain:1", "init:1", "filled:1", "price:1", "price:-1", "dist:-1", "age:1", "end:1"],
        t_ = {
          "book:1": "book",
          "remain:1": "remain",
          "init:1": "init",
          "filled:1": "filled",
          "price:1": "priceDesc",
          "price:-1": "priceAsc",
          "dist:-1": "dist",
          "age:1": "age",
          "end:1": "end"
        };

      function tA() {
        let {
          term: e,
          version: t,
          t: s,
          fmt: l
        } = b(), r = e.ds, o = e.prefs, n = (0, i.useRef)({
          key: "hist" === o.bt ? "end" : "watch" === o.bt ? "remain" : "book",
          dir: 1
        }), d = "book" === n.current.key && "live" !== o.bt ? {
          key: "hist" === o.bt ? "end" : "remain",
          dir: 1
        } : n.current, [, c] = (0, i.useReducer)(e => e + 1, 0), h = (t, s) => {
          let a = "live" === e.prefs.bt;
          "book" !== t || a || (t = "hist" === e.prefs.bt ? "end" : "remain", s = 1), n.current = {
            key: t,
            dir: s
          }, c()
        }, p = (0, i.useMemo)(() => {
          var t, s, a, l, i, n;
          let c, h, p, u;
          return r ? (t = e.filters, s = o.bt, a = e.watched(), l = d.key, i = d.dir, n = Date.now(), h = r.close[r.N - 1], c = "live" === s ? e6(r, t) : "hist" === s ? r.walls.filter(e => e7(e, t)) : a.slice(), u = (p = {
            book: e => e.price,
            remain: e => e.usd,
            init: e => e.initUsd,
            filled: e => e.filledUsd,
            price: e => e.price,
            dist: e => Math.abs(e.price - h),
            fills: e => e.fills,
            age: e => (e.endT || n) - e.startT,
            end: e => e.endT || 0,
            status: e => e9[e.status] + .5 * ("alive" === e.status && e.filledUsd > 0),
            side: e => ("bid" === e.side) * 1e12 + e.initUsd
          })[l] || p.remain, c.sort((e, t) => (u(t) - u(e)) * i || t.initUsd - e.initUsd)) : []
        }, [r, t, o.bt, d.key, d.dir]), u = (0, i.useMemo)(() => r ? function(e, t) {
          let s = 0,
            a = 0,
            l = 0,
            i = 0;
          for (let r of e.walls) "alive" === r.status ? B(r, t) && (s++, "bid" === r.side ? l += r.usd : i += r.usd) : e7(r, t) && a++;
          return {
            nLive: s,
            nHist: a,
            bid: l,
            ask: i
          }
        }(r, e.filters) : null, [r, t]), f = r ? r.curPrice : 0, g = "book" === d.key && "live" === o.bt, m = "live" === o.bt ? tV.filter(e => "end" !== e) : tV, w = "live" === o.bt, v = (0, i.useMemo)(() => g && r ? [...p.filter(e => e.price > f), {
          divider: !0
        }, ...p.filter(e => e.price <= f)] : p, [p, g, f, r]), y = (0, i.useRef)(null), k = (0, x.z)(v.length, 46, y), j = (0, i.useRef)(!0), N = r ? r.sym + r.ivMin + o.bt + d.key : "", M = (0, i.useRef)(!1), [S, T] = (0, i.useState)(!1);
        (0, i.useLayoutEffect)(() => {
          j.current = !0, M.current = !1, T(!1), !g && k.box && (k.box.scrollTop = 0)
        }, [N]), (0, i.useEffect)(() => {
          let e = k.box;
          if (!e) return;
          let t = () => {
            M.current && !j.current && T(!0)
          };
          return e.addEventListener("scroll", t, {
            passive: !0
          }), () => e.removeEventListener("scroll", t)
        }, [k.box]), (0, i.useLayoutEffect)(() => {
          g && j.current && k.box && !(k.box.clientHeight <= 0) && v.length && k.center(Math.max(0, v.findIndex(e => e.divider)))
        });
        let V = () => {
            j.current = !1, M.current = !0
          },
          z = e.tiers,
          _ = (0, i.useMemo)(() => p.reduce((e, t) => Math.max(e, t.initUsd), z[2]), [p, z[2]]),
          A = e.selectedId,
          O = z.join(),
          P = r && f >= r.open[r.N - 1],
          C = !r && "loading" === e.status,
          I = tz.includes(d.key + ":" + d.dir) ? d.key + ":" + d.dir : "custom";
        return (0, a.jsxs)("div", {
          className: "lo-card lo-btable",
          "aria-label": s("large-orderbook-statistics.table.aria", {
            defaultValue: "Order list"
          }),
          children: [(0, a.jsxs)("div", {
            className: "lo-bt-head",
            children: [(0, a.jsx)(e0, {
              ariaLabel: s("large-orderbook-statistics.table.aria", {
                defaultValue: "Order list"
              }),
              value: o.bt,
              onChange: t => {
                n.current = {
                  key: "hist" === t ? "end" : "watch" === t ? "remain" : "book",
                  dir: 1
                }, e.set({
                  bt: t
                })
              },
              options: [{
                value: "live",
                label: (0, a.jsxs)("span", {
                  children: [s("large-orderbook-statistics.table.live", {
                    defaultValue: "Open"
                  }), (0, a.jsx)("span", {
                    className: "lo-cnt",
                    children: u ? u.nLive : "—"
                  })]
                })
              }, {
                value: "hist",
                label: (0, a.jsxs)("span", {
                  children: [s("large-orderbook-statistics.table.hist", {
                    defaultValue: "History"
                  }), (0, a.jsx)("span", {
                    className: "lo-cnt",
                    children: u ? u.nHist : "—"
                  })]
                })
              }, {
                value: "watch",
                label: (0, a.jsxs)("span", {
                  children: [s("large-orderbook-statistics.table.watch", {
                    defaultValue: "Watchlist"
                  }), (0, a.jsx)("span", {
                    className: "lo-cnt",
                    children: r ? e.watchCount() : "—"
                  })]
                })
              }]
            }), (0, a.jsxs)("span", {
              className: "lo-bt-sum",
              children: [(0, a.jsxs)("b", {
                children: ["≥ ", l.usd(e.threshold)]
              }), " \xb7 ", s("large-orderbook-statistics.table.exCount", {
                n: o.exSel.length,
                defaultValue: "{{n}} venues"
              }), " \xb7 ", s("large-orderbook-statistics.table.sum", {
                defaultValue: "Remaining wall size"
              }), " ", (0, a.jsxs)("span", {
                className: "bid",
                children: [s("large-orderbook-statistics.w.buy", {
                  defaultValue: "Bid"
                }), " ", u ? l.usd(u.bid) : "—"]
              }), " \xb7 ", (0, a.jsxs)("span", {
                className: "ask",
                children: [s("large-orderbook-statistics.w.sell", {
                  defaultValue: "Ask"
                }), " ", u ? l.usd(u.ask) : "—"]
              })]
            }), (0, a.jsx)("span", {
              className: "lo-spacer"
            }), g && S ? (0, a.jsx)(eZ, {
              size: "compact",
              icon: !0,
              onClick: () => {
                j.current = !0, M.current = !1, T(!1)
              },
              children: (0, a.jsx)(ty, {})
            }) : null, (0, a.jsx)(e3, {
              label: s("large-orderbook-statistics.table.sort", {
                defaultValue: "Sort"
              }),
              title: s("large-orderbook-statistics.table.sortTitle", {
                defaultValue: "You can also click a column header to sort"
              }),
              value: I,
              onChange: e => {
                let [t, s] = e.split(":");
                h(t, +s || 1)
              },
              options: [...tz.map(e => ({
                value: e,
                label: s("large-orderbook-statistics.table.opt." + t_[e]),
                hidden: "book:1" === e && "live" !== o.bt || "end:1" === e && w
              })), {
                value: "custom",
                label: s("large-orderbook-statistics.table.opt.custom", {
                  defaultValue: "By column"
                }),
                hidden: !0
              }]
            })]
          }), (0, a.jsx)("div", {
            className: "lo-bt-body",
            ref: k.ref,
            onWheel: V,
            onPointerDown: V,
            onKeyDown: V,
            onMouseLeave: () => e.highlight(null),
            children: (0, a.jsxs)("table", {
              className: "lo-bt",
              children: [(0, a.jsx)("thead", {
                ref: y,
                children: (0, a.jsx)("tr", {
                  children: m.map(e => {
                    let t = d.key === e;
                    return (0, a.jsx)("th", {
                      className: t ? "sorted" + (d.dir < 0 ? " asc" : "") : void 0,
                      "aria-sort": t ? d.dir < 0 ? "ascending" : "descending" : "none",
                      onClick: () => h(e, t ? -d.dir : "dist" === e ? -1 : 1),
                      children: s("large-orderbook-statistics.table.col." + e)
                    }, e)
                  })
                })
              }), (0, a.jsxs)("tbody", {
                children: [k.padTop ? (0, a.jsx)("tr", {
                  className: "lo-pad",
                  "aria-hidden": "true",
                  style: {
                    height: k.padTop
                  },
                  children: (0, a.jsx)("td", {
                    colSpan: m.length
                  })
                }) : null, v.slice(k.start, k.end).map((t, i) => {
                  let r;
                  return r = k.start + i === k.start ? k.measure : void 0, t.divider ? (0, a.jsx)("tr", {
                    className: "bdiv",
                    ref: r,
                    children: (0, a.jsxs)("td", {
                      colSpan: m.length,
                      children: [(0, a.jsx)("span", {
                        className: "muted",
                        children: s("large-orderbook-statistics.side.cur", {
                          defaultValue: "Last"
                        })
                      }), " ", (0, a.jsxs)("b", {
                        className: P ? "bid" : "ask",
                        children: [P ? "▲" : "▼", " ", l.px(f)]
                      })]
                    })
                  }, "div") : (0, a.jsx)(tO, {
                    w: t,
                    noEnd: w,
                    sel: t.id === A,
                    watched: e.watch.has(t.id),
                    last: f,
                    mxT: _,
                    tiersKey: O,
                    measure: r
                  }, t.id)
                }), k.padBottom ? (0, a.jsx)("tr", {
                  className: "lo-pad",
                  "aria-hidden": "true",
                  style: {
                    height: k.padBottom
                  },
                  children: (0, a.jsx)("td", {
                    colSpan: m.length
                  })
                }) : null, p.length ? null : (0, a.jsx)("tr", {
                  children: (0, a.jsx)("td", {
                    colSpan: m.length,
                    className: "lo-empty",
                    children: C ? s("large-orderbook-statistics.chart.loading", {
                      defaultValue: "Loading…"
                    }) : s("watch" === o.bt ? "large-orderbook-statistics.table.emptyWatch" : "large-orderbook-statistics.table.empty")
                  })
                })]
              })]
            })
          }), (0, a.jsxs)("div", {
            className: "lo-bt-foot",
            children: [(0, a.jsx)("span", {
              children: r ? s("large-orderbook-statistics.table.records", {
                n: p.length,
                defaultValue: "{{n}} rows"
              }) : null
            }), (0, a.jsx)("span", {
              className: "hint",
              children: s("large-orderbook-statistics.table.hint", {
                defaultValue: "Click a row for details and to locate it on the chart \xb7 ★ adds it to the watchlist"
              })
            })]
          })]
        })
      }
      let tO = i.memo(function({
        w: e,
        noEnd: t,
        sel: s,
        watched: l,
        last: i,
        mxT: r,
        measure: o
      }) {
        let {
          term: n,
          t: d,
          fmt: c
        } = b(), h = n.tiers, p = $(e.initUsd, h), u = Math.min(100, e.initUsd / r * 100).toFixed(1), f = `linear-gradient(270deg,var(--lo-${e.side}) 0 3px,var(--lo-bk-${e.side}-${p+1}) 3px ${u}%,transparent ${u}%)`, g = `linear-gradient(90deg,var(--lo-${e.side}) 0 3px,var(--lo-bk-${e.side}-${p+1}) 3px ${u}%,transparent ${u}%)`, x = W(e);
        return (0, a.jsxs)("tr", {
          ref: o,
          style: {
            "--bar-l": g
          },
          className: [s && "is-sel", e.stale && "stale"].filter(Boolean).join(" ") || void 0,
          title: e.stale ? d("large-orderbook-statistics.table.snapNote", {
            defaultValue: "This order is no longer in the loaded data; showing its last known state"
          }) : void 0,
          onClick: () => n.select(e.id),
          onMouseEnter: () => n.highlight(e.id),
          children: [(0, a.jsxs)("td", {
            className: "vn",
            children: [(0, a.jsx)("button", {
              type: "button",
              className: "lo-star" + (l ? " on" : ""),
              title: d("large-orderbook-statistics.table.watch", {
                defaultValue: "Watchlist"
              }),
              "aria-label": d("large-orderbook-statistics.table.watch", {
                defaultValue: "Watchlist"
              }),
              "aria-pressed": l,
              onClick: t => {
                t.stopPropagation(), n.toggleWatch(e.id)
              },
              children: "★"
            }), (0, a.jsx)(tv, {
              ex: e.ex,
              t: d,
              full: !0
            }), " ", (0, a.jsx)("b", {
              className: e.side,
              children: d("bid" === e.side ? "large-orderbook-statistics.w.buy" : "large-orderbook-statistics.w.sell")
            })]
          }), (0, a.jsx)("td", {
            className: "px " + e.side,
            children: c.px(e.price)
          }), (0, a.jsx)("td", {
            className: "muted ds",
            children: c.pct((e.price - i) / i * 100)
          }), (0, a.jsx)("td", {
            className: "barcell in",
            style: {
              "--bar": f
            },
            "data-l": d("large-orderbook-statistics.table.col.init"),
            children: c.usd(e.initUsd)
          }), (0, a.jsx)("td", {
            className: "rm",
            "data-l": d("large-orderbook-statistics.table.col.remain"),
            children: c.usd(e.usd)
          }), (0, a.jsxs)("td", {
            className: "fl",
            children: [c.usd(e.filledUsd), (0, a.jsx)("span", {
              className: "lo-prog",
              children: (0, a.jsx)("i", {
                style: {
                  width: Math.min(100, e.filledUsd / (e.initUsd || 1) * 100).toFixed(0) + "%"
                }
              })
            })]
          }), (0, a.jsx)("td", {
            className: "nf",
            children: e.fills
          }), (0, a.jsx)("td", {
            className: "ag",
            "data-l": d("large-orderbook-statistics.table.col.age"),
            children: (0, a.jsx)(M, {
              from: e.startT,
              to: e.endT,
              fmt: c
            })
          }), t ? null : (0, a.jsx)("td", {
            className: "muted en",
            children: e.endT ? c.date(e.endT) : "—"
          }), (0, a.jsx)("td", {
            className: "st",
            children: (0, a.jsx)("span", {
              className: "lo-st " + x,
              children: d("large-orderbook-statistics.status." + x)
            })
          })]
        })
      });

      function tP() {
        let e, {
            term: t,
            t: s,
            fmt: l
          } = b(),
          r = w(5e3),
          o = t.ds,
          n = o && null != t.selectedId ? t.wallOf(t.selectedId) : null;
        if (n) {
          let d = o.curPrice,
            c = n.initUsd || 1,
            h = t.watch.has(n.id),
            p = n.filledUsd / c * 100,
            u = n.usd / c * 100,
            f = n.cancelledUsd / c * 100,
            g = W(n),
            x = [
              ["large-orderbook-statistics.detail.init", l.usd(n.initUsd)],
              ["large-orderbook-statistics.detail.remain", l.usd(n.usd)],
              ["large-orderbook-statistics.detail.filled", l.usd(n.filledUsd)],
              ["large-orderbook-statistics.detail.cancelled", l.usd(n.cancelledUsd)],
              ["large-orderbook-statistics.detail.fills", n.fills],
              ["large-orderbook-statistics.detail.start", l.date(n.startT)],
              ["large-orderbook-statistics.detail.update", l.date(n.snapT)],
              ["large-orderbook-statistics.detail.dur", l.age((n.endT || r) - n.startT)],
              ["large-orderbook-statistics.detail.end", n.endT ? l.date(n.endT) : "—"]
            ];
          e = (0, a.jsxs)("div", {
            className: "lo-detail",
            children: [(0, a.jsxs)("div", {
              className: "dh",
              children: [(0, a.jsx)(tv, {
                ex: n.ex,
                t: s,
                full: !0
              }), (0, a.jsx)("span", {
                className: "sd " + n.side,
                children: s("bid" === n.side ? "large-orderbook-statistics.detail.bidOrder" : "large-orderbook-statistics.detail.askOrder")
              })]
            }), (0, a.jsx)("div", {
              className: "dp " + n.side,
              children: l.px(n.price)
            }), (0, a.jsxs)("div", {
              className: "dsub",
              children: [(0, a.jsxs)("span", {
                children: [t.coin.label, " / USDT"]
              }), (0, a.jsx)("span", {
                className: "lo-st " + g,
                children: s("large-orderbook-statistics.status." + g)
              }), (0, a.jsxs)("span", {
                children: [s("large-orderbook-statistics.side.dist", {
                  defaultValue: "From price"
                }), " ", l.pct((n.price - d) / d * 100)]
              })]
            }), n.stale ? (0, a.jsx)("p", {
              className: "stale",
              children: s("large-orderbook-statistics.table.snapNote", {
                defaultValue: "This order is no longer in the loaded data; showing its last known state"
              })
            }) : null, (0, a.jsx)("div", {
              className: "kv",
              children: x.map(([e, t]) => (0, a.jsxs)(i.Fragment, {
                children: [(0, a.jsx)("span", {
                  children: s(e)
                }), (0, a.jsx)("span", {
                  children: t
                })]
              }, e))
            }), (0, a.jsx)("div", {
              className: "lo-cap mt",
              children: s("large-orderbook-statistics.detail.comp", {
                defaultValue: "Breakdown of initial size"
              })
            }), (0, a.jsxs)("div", {
              className: "stack",
              children: [(0, a.jsx)("i", {
                className: "f",
                style: {
                  width: p.toFixed(1) + "%"
                }
              }), (0, a.jsx)("i", {
                className: "r",
                style: {
                  width: u.toFixed(1) + "%"
                }
              }), (0, a.jsx)("i", {
                className: "c",
                style: {
                  width: f.toFixed(1) + "%"
                }
              })]
            }), (0, a.jsxs)("div", {
              className: "legend",
              children: [(0, a.jsxs)("span", {
                children: [s("large-orderbook-statistics.detail.lgFilled", {
                  defaultValue: "Filled"
                }), " ", p.toFixed(1), "%"]
              }), (0, a.jsxs)("span", {
                children: [s("large-orderbook-statistics.detail.lgRemain", {
                  defaultValue: "Remaining"
                }), " ", u.toFixed(1), "%"]
              }), (0, a.jsxs)("span", {
                children: [s("large-orderbook-statistics.detail.lgCancelled", {
                  defaultValue: "Cancelled"
                }), " ", f.toFixed(1), "%"]
              })]
            }), (0, a.jsxs)("div", {
              className: "acts",
              children: [(0, a.jsx)(eZ, {
                size: "compact",
                variant: "toggle",
                selected: h,
                onClick: () => t.toggleWatch(n.id),
                children: s(h ? "large-orderbook-statistics.detail.watchOn" : "large-orderbook-statistics.detail.watchOff")
              }), (0, a.jsx)(eZ, {
                size: "compact",
                onClick: () => t.locate(n),
                children: s("large-orderbook-statistics.detail.locate", {
                  defaultValue: "Locate on chart"
                })
              })]
            })]
          })
        } else e = (0, a.jsx)("div", {
          className: "lo-empty",
          children: s("large-orderbook-statistics.detail.empty", {
            defaultValue: "Click any order in the list or in the order book to see its full life cycle here"
          })
        });
        return (0, a.jsxs)("aside", {
          className: "lo-card",
          "aria-labelledby": "lo-detail-h",
          children: [(0, a.jsxs)("div", {
            className: "lo-ph",
            children: [(0, a.jsx)("h3", {
              id: "lo-detail-h",
              children: s("large-orderbook-statistics.detail.title", {
                defaultValue: "Order details"
              })
            }), (0, a.jsx)("small", {
              children: s("large-orderbook-statistics.detail.sub", {
                defaultValue: "Click any order in the list or the order book"
              })
            })]
          }), e]
        })
      }
      var tC = s(82203),
        tI = s.n(tC);

      function tB() {
        let {
          term: e,
          t
        } = b(), s = e.prefs.symbol, [l, r] = (0, i.useState)(() => (0, e4.xF)() || O.Su);
        (0, i.useEffect)(() => {
          let e = !0;
          return (0, e4.ro)().then(t => e && t.length && r(t)).catch(() => {}), () => {
            e = !1
          }
        }, []);
        let o = l.filter(e => e !== s).slice(0, 20),
          [n, d = ""] = t("large-orderbook-statistics.rel.coinLink", {
            coin: "\x01",
            defaultValue: "{{coin}} large orders"
          }).split("\x01");
        return (0, a.jsxs)("section", {
          className: "lo-rel",
          "aria-labelledby": "lo-rel-h",
          children: [(0, a.jsxs)("div", {
            className: "fh",
            children: [(0, a.jsx)("h2", {
              id: "lo-rel-h",
              children: t("large-orderbook-statistics.rel.title", {
                defaultValue: "Related tools"
              })
            }), (0, a.jsx)("p", {
              children: t("large-orderbook-statistics.rel.sub", {
                defaultValue: "Large orders show the walls in the book; these pages complete the order-flow picture with resting depth, aggressive trades and liquidations."
              })
            })]
          }), (0, a.jsx)("nav", {
            className: "lo-relgrid",
            "aria-label": t("large-orderbook-statistics.rel.title", {
              defaultValue: "Related tools"
            }),
            children: O.Ir.map(e => (0, a.jsxs)(tI(), {
              href: e.path,
              className: "lo-card lo-relcard",
              children: [(0, a.jsxs)("span", {
                className: "rtop",
                children: [(0, a.jsx)("span", {
                  className: "rico",
                  children: (0, a.jsx)("svg", {
                    viewBox: "0 0 17 17",
                    "aria-hidden": "true",
                    dangerouslySetInnerHTML: {
                      __html: e.icon
                    }
                  })
                }), (0, a.jsx)("span", {
                  className: "tg",
                  children: t("large-orderbook-statistics.rel.group." + e.group)
                })]
              }), (0, a.jsx)("b", {
                children: t("large-orderbook-statistics.rel." + e.id + ".name")
              }), (0, a.jsx)("p", {
                children: t("large-orderbook-statistics.rel." + e.id + ".desc")
              })]
            }, e.id))
          }), (0, a.jsxs)("div", {
            className: "lo-relcoins",
            children: [(0, a.jsx)("h3", {
              children: t("large-orderbook-statistics.rel.coins", {
                defaultValue: "Large orders for other coins"
              })
            }), (0, a.jsx)("nav", {
              className: "lo-cchips",
              "aria-label": t("large-orderbook-statistics.rel.coins", {
                defaultValue: "Large orders for other coins"
              }),
              children: o.map(s => (0, a.jsxs)("a", {
                className: "lo-cchip",
                href: (0, c.sQ)("largeOrders", s),
                onClick: t => ((t, s) => {
                  if (t.metaKey || t.ctrlKey || t.shiftKey || t.button) return;
                  t.preventDefault(), e.setSymbol(s);
                  let a = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                  window.scrollTo({
                    top: 0,
                    behavior: a ? "auto" : "smooth"
                  })
                })(t, s),
                children: [(0, a.jsx)(te, {
                  sym: s,
                  size: "md"
                }), (0, a.jsxs)("span", {
                  className: "full",
                  children: [(0, a.jsxs)("span", {
                    children: [n, t("large-orderbook-statistics.rel.coin." + s, {
                      defaultValue: (0, O.BI)(s).label
                    })]
                  }), (0, a.jsx)("span", {
                    className: "sfx",
                    children: d
                  })]
                }), (0, a.jsx)("span", {
                  className: "short",
                  "aria-hidden": "true",
                  children: s
                })]
              }, s))
            })]
          })]
        })
      }
      var tF = s(95669),
        t$ = s.n(tF),
        tW = s(98114),
        tL = s(16066),
        tq = s.n(tL);
      let tE = [
          [6, 0],
          [6, 1],
          [4, 1],
          [3, 0]
        ],
        tU = new Set(["g2q4"]),
        tD = "large-orderbook-statistics.";

      function tH({
        t: e
      }) {
        let t = t => e(tD + "guide.hero.s" + t);
        return (0, a.jsxs)("svg", {
          viewBox: "0 0 520 262",
          direction: "ltr",
          role: "img",
          "aria-label": e(tD + "guide.hero.h", {
            defaultValue: "What are large orders (order book walls)?"
          }),
          children: [(0, a.jsx)("line", {
            className: tq().gl,
            x1: "14",
            y1: "52",
            x2: "430",
            y2: "52"
          }), (0, a.jsx)("line", {
            className: tq().gl,
            x1: "14",
            y1: "186",
            x2: "430",
            y2: "186"
          }), (0, a.jsx)("line", {
            className: tq().gl,
            x1: "300",
            y1: "208",
            x2: "430",
            y2: "208"
          }), (0, a.jsx)("rect", {
            className: tq().wa,
            x: "17",
            y: "48.5",
            width: "411",
            height: "7",
            rx: "1.5"
          }), (0, a.jsx)("rect", {
            className: tq().wb,
            x: "17",
            y: "181.5",
            width: "257",
            height: "9",
            rx: "1.5"
          }), (0, a.jsx)("path", {
            className: tq().wb,
            d: "M276 180.5 L281.5 186 L276 191.5 L270.5 186 Z"
          }), (0, a.jsx)("polyline", {
            className: tq().px,
            points: "17,119 51,102 85,141 128,180 157,130 187,63 208,108 230,180 251,147 276,179 298,192 332,208 366,213 400,197 425,202"
          }), (0, a.jsx)("text", {
            className: tq().ax,
            x: "436",
            y: "56",
            children: "65,200"
          }), (0, a.jsx)("text", {
            className: tq().ax,
            x: "436",
            y: "190",
            children: "64,000"
          }), (0, a.jsx)("text", {
            className: tq().ax,
            x: "436",
            y: "212",
            children: "63,800"
          }), (0, a.jsx)("line", {
            className: tq().ld,
            x1: "187",
            y1: "30",
            x2: "187",
            y2: "46"
          }), (0, a.jsx)("text", {
            className: tq().nt,
            x: "187",
            y: "24",
            textAnchor: "middle",
            children: t(1)
          }), (0, a.jsx)("text", {
            className: tq().nt,
            x: "20",
            y: "208",
            children: t(2)
          }), (0, a.jsx)("line", {
            className: tq().ld,
            x1: "128",
            y1: "192",
            x2: "172",
            y2: "238"
          }), (0, a.jsx)("line", {
            className: tq().ld,
            x1: "230",
            y1: "192",
            x2: "194",
            y2: "238"
          }), (0, a.jsx)("text", {
            className: tq().nt,
            x: "183",
            y: "252",
            textAnchor: "middle",
            children: t(3)
          }), (0, a.jsx)("line", {
            className: tq().ld,
            x1: "279",
            y1: "178",
            x2: "294",
            y2: "160"
          }), (0, a.jsx)("text", {
            className: tq().nt,
            x: "296",
            y: "156",
            children: t(4)
          }), (0, a.jsx)("line", {
            className: tq().ld,
            x1: "366",
            y1: "216",
            x2: "366",
            y2: "238"
          }), (0, a.jsx)("text", {
            className: tq().nt,
            x: "366",
            y: "252",
            textAnchor: "middle",
            children: t(5)
          })]
        })
      }

      function tR() {
        let {
          t: e
        } = b(), {
          props: t,
          ld: s
        } = (0, i.useMemo)(() => {
          let t = e(tD + "guide.hero.h", {
              defaultValue: "What are large orders (order book walls)?"
            }),
            s = [1, 2, 3, 4].map(t => e(tD + "guide.hero.p" + t)),
            l = tE.map(([t, s], a) => ({
              id: "g" + (a + 1),
              title: e(`${tD}guide.g${a+1}.h`),
              col: s,
              items: Array.from({
                length: t
              }, (e, t) => `g${a+1}q${t+1}`).filter(e => !tU.has(e)).map(t => {
                let [s, a] = t.slice(1).split("q"), l = e(`${tD}guide.g${s}.a${a}`);
                return {
                  id: t,
                  q: e(`${tD}guide.g${s}.q${a}`),
                  a: String(l).split("\n").filter(Boolean),
                  raw: l
                }
              })
            }));
          return {
            ld: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                [t, s.join("\n")], ...l.flatMap(e => e.items.map(e => [e.q, e.raw]))
              ].map(([e, t]) => ({
                "@type": "Question",
                name: e,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: t
                }
              }))
            }).replace(/</g, "\\u003c"),
            props: {
              title: e(tD + "faq.title", {
                defaultValue: "FAQ"
              }),
              sub: e(tD + "guide.sub", {
                defaultValue: "How to read large orders, what the walls, bubbles and signals on the chart mean, where the data comes from and how often it updates."
              }),
              hero: {
                title: t,
                paragraphs: s,
                figure: (0, a.jsx)(tH, {
                  t: e
                }),
                caption: e(tD + "guide.hero.cap", {
                  defaultValue: "Watch whether the wall is still there when price arrives: a wall that gets filled can hold price, a pulled wall often lets price break through faster."
                })
              },
              groups: l
            }
          }
        }, [e]);
        return (0, a.jsxs)(a.Fragment, {
          children: [(0, a.jsx)(t$(), {
            children: (0, a.jsx)("script", {
              type: "application/ld+json",
              dangerouslySetInnerHTML: {
                __html: s
              }
            }, "lo-faq-ld")
          }), (0, a.jsx)(tW.A, {
            id: "lo-faq",
            className: tq().root,
            ...t,
            children: (0, a.jsxs)("footer", {
              className: tq().foot,
              children: [(0, a.jsx)("span", {
                children: e(tD + "foot.gestures2", {
                  defaultValue: "Drag to pan \xb7 wheel to zoom time and price around the pointer \xb7 drag or scroll the price axis to zoom price \xb7 double-click restores the default view"
                })
              }), (0, a.jsx)("span", {
                children: e(tD + "foot.data", {
                  defaultValue: "Data from the major exchanges, updated live."
                })
              })]
            })
          })]
        })
      }

      function tQ() {
        let {
          term: e,
          t,
          fmt: s
        } = b(), l = e.toasts;
        return ((0, i.useEffect)(() => {
          if (!l.length) return;
          let t = l.map(t => setTimeout(() => e.dismissToast(t.key), Math.max(0, 8e3 - (Date.now() - t.at))));
          return () => t.forEach(clearTimeout)
        }, [l, e]), l.length) ? (0, a.jsx)("div", {
          className: "lo-toasts",
          "aria-live": "polite",
          children: l.map(({
            key: l,
            wall: i
          }) => (0, a.jsxs)("div", {
            className: "lo-toast " + i.side,
            role: "button",
            tabIndex: 0,
            onClick: () => {
              e.dismissToast(l), e.select(i.id), e.locate(i)
            },
            onKeyDown: t => {
              "Enter" === t.key && (e.dismissToast(l), e.select(i.id), e.locate(i))
            },
            children: [(0, a.jsx)("button", {
              type: "button",
              className: "x",
              "aria-label": t("large-orderbook-statistics.toast.close", {
                defaultValue: "Close"
              }),
              title: t("large-orderbook-statistics.toast.close", {
                defaultValue: "Close"
              }),
              onClick: t => {
                t.stopPropagation(), e.dismissToast(l)
              },
              children: "✕"
            }), (0, a.jsxs)("div", {
              className: "tt",
              children: [t("large-orderbook-statistics.feed.toast", {
                defaultValue: "Large new wall"
              }), " ≥ ", s.usd(O.iJ), " \xb7 ", s.date(i.startT).slice(-5)]
            }), (0, a.jsx)(tS, {
              w: i,
              t: t,
              fmt: s
            })]
          }, l))
        }) : null
      }

      function tK({
        symbol: e
      }) {
        let {
          t,
          i18n: s
        } = (0, o.Bd)(), l = (0, r.useRouter)(), h = (0, i.useMemo)(() => new eE(e), []), u = (0, i.useSyncExternalStore)(h.subscribe, h.getVersion, h.getVersion);
        h.t = t;
        let {
          mode: g,
          systemMode: x
        } = (0, n.Ut)(), b = ("system" === g ? x : g) === "light" ? "light" : "dark", [w, v] = (0, i.useState)(p.jP), [y, k] = (0, i.useState)(!1);
        (0, i.useEffect)(() => (v(function() {
          let e = (0, p.jP)(),
            t = eP(ez);
          if (!t || "object" != typeof t) return e;
          for (let s of ["dark", "light"]) {
            let a = t.preset && "string" == typeof t.preset[s] ? t.preset[s] : "default";
            if ("default" === a) continue;
            let l = p.fG.find(e => e.id === a);
            if (l) e[s] = {
              ...l[s]
            }, e.preset[s] = a;
            else if (t[s] && "object" == typeof t[s]) {
              for (let [a] of p.Rk)(0, p.qv)(t[s][a]) && (e[s][a] = t[s][a]);
              e.preset[s] = "custom"
            }
          }
          return e
        }()), k(!0), h.start({
          symbol: l.query.symbol
        }), () => h.dispose()), []), (0, i.useEffect)(() => {
          y && eC(ez, w)
        }, [w, y]);
        let j = (0, i.useMemo)(() => (0, p.me)(b, w), [b, w]),
          N = (0, i.useRef)(null),
          [M, S] = (0, i.useState)("Arial, sans-serif");
        (0, i.useEffect)(() => {
          let e = () => N.current && S(getComputedStyle(N.current).fontFamily || "Arial, sans-serif");
          e(), document.fonts && document.fonts.ready && document.fonts.ready.then(e)
        }, []);
        let T = (0, i.useMemo)(() => {
            let e = new Map;
            return (s, a) => {
              if (a && Object.keys(a).some(e => "defaultValue" !== e)) return t(s, a);
              let l = e.get(s);
              return void 0 === l && (l = t(s, a), e.set(s, l)), l
            }
          }, [t, s.language]),
          V = h.prefs.symbol,
          z = h.ds,
          _ = (0, i.useMemo)(() => {
            var e, t;
            let a, l, i, r, o, n;
            return e = s.language, t = h.coin.dec, a = eD[e], l = T || (e => e), i = e => a ? e >= 1e8 ? "$" + (e / 1e8).toFixed(2) + a[1] : e >= 1e4 ? "$" + (e / 1e4).toFixed(e >= 1e7 ? 0 : 1).replace(/\.0$/, "") + a[0] : "$" + Math.round(e).toLocaleString("en-US") : e >= 1e9 ? "$" + (e / 1e9).toFixed(2) + "B" : e >= 1e6 ? "$" + (e / 1e6).toFixed(e >= 1e8 ? 0 : e >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + "M" : e >= 1e4 ? "$" + (e / 1e3).toFixed(e >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "K" : "$" + Math.round(e).toLocaleString("en-US"), r = a ? "" : " ", o = {}, n = (e, t) => o[e] || (o[e] = l("large-orderbook-statistics.unit." + e, {
              defaultValue: t
            })), {
              lang: e,
              dec: t,
              px: e => {
                let s = e >= 1e5 ? Math.max(0, t - 1) : t;
                return e.toLocaleString("en-US", {
                  minimumFractionDigits: s,
                  maximumFractionDigits: s
                })
              },
              usd: i,
              signed: e => (e >= 0 ? "+" : "−") + i(Math.abs(e)),
              pct: e => (e >= 0 ? "+" : "−") + Math.abs(e).toFixed(2) + "%",
              qty: e => e >= 1e3 ? Math.round(e).toLocaleString("en-US") : e >= 1 ? e.toFixed(2) : e.toPrecision(3),
              date: e => {
                let t = new Date(e);
                return eU(t.getMonth() + 1) + "-" + eU(t.getDate()) + " " + eU(t.getHours()) + ":" + eU(t.getMinutes())
              },
              clock: e => {
                let t = new Date(e);
                return eU(t.getHours()) + ":" + eU(t.getMinutes()) + ":" + eU(t.getSeconds())
              },
              age: e => {
                let t = Math.max(0, e / 1e3);
                if (t < 60) return Math.floor(t) + n("s", "s");
                let s = t / 60;
                if (s < 60) return Math.floor(s) + n("m", "m") + r + eU(Math.floor(t % 60)) + n("s", "s");
                let a = s / 60;
                return a < 24 ? Math.floor(a) + n("h", "h") + r + eU(Math.floor(s % 60)) + n("m", "m") : Math.floor(a / 24) + n("d", "d") + r + Math.floor(a % 24) + n("h", "h")
              },
              time: (e, t) => {
                let s = new Date(z ? z.t0 + e * z.step : 0),
                  a = eU(s.getHours()) + ":" + eU(s.getMinutes());
                return t ? eU(s.getMonth() + 1) + "-" + eU(s.getDate()) + " " + a : a
              }
            }
          }, [s.language, V, T, z]);
        (0, i.useEffect)(() => {
          if (!h.started || l.query.symbol === V) return;
          let {
            symbol: e,
            ...t
          } = l.query;
          l.replace((0, c.sQ)("largeOrders", V, t), void 0, {
            shallow: !0,
            scroll: !1
          })
        }, [V]);
        let A = (0, i.useMemo)(() => ({
            term: h,
            version: u,
            t: T,
            fmt: _,
            theme: j,
            font: M,
            colorCfg: w,
            setColorCfg: v,
            colorMode: b
          }), [h, u, T, _, j, M, w, b]),
          O = h.coin.label;
        return (0, a.jsx)(m.Provider, {
          value: A,
          children: (0, a.jsxs)(f, {
            ref: N,
            style: y ? j.vars : void 0,
            children: [(0, a.jsx)(d.A, {
              title: "BTC" === V ? "largeTakerOrder.t" : "largeTakerOrder2.t",
              d: "BTC" === V ? "largeTakerOrder.d" : "largeTakerOrder2.d",
              tObj: {
                symbol: O
              },
              dObj: {
                symbol: O
              }
            }), (0, a.jsx)(ts, {}), (0, a.jsx)(to, {}), (0, a.jsxs)("div", {
              className: "lo-chart-row",
              children: [(0, a.jsx)(tg, {}), (0, a.jsx)(tk, {})]
            }), (0, a.jsx)(tT, {}), (0, a.jsxs)("section", {
              className: "lo-detail-grid",
              children: [(0, a.jsx)(tA, {}), (0, a.jsx)(tP, {})]
            }), (0, a.jsx)(tB, {}), (0, a.jsx)(tR, {}), (0, a.jsx)(tQ, {})]
          })
        })
      }
      var tG = !0;

      function tX({
        symbol: e
      }) {
        return (0, a.jsx)(tK, {
          symbol: e
        })
      }
      tX.getLayout = function(e) {
        return (0, a.jsx)(l.A, {
          children: e
        })
      }
    },
    88937: (e, t, s) => {
      (window.__NEXT_P = window.__NEXT_P || []).push(["/large-orderbook-statistics/[symbol]", function() {
        return s(71014)
      }])
    },
    98114: (e, t, s) => {
      "use strict";
      s.d(t, {
        A: () => c
      });
      var a = s(6029),
        l = s(55729),
        i = s(42920),
        r = s.n(i);
      let o = (...e) => e.filter(Boolean).join(" ");

      function n({
        hero: e
      }) {
        let {
          title: t,
          paragraphs: s = [],
          figure: l = null,
          caption: i = null
        } = e;
        return (0, a.jsxs)("article", {
          className: o(r().card, r().hero, !l && r().heroOnly),
          children: [(0, a.jsxs)("div", {
            className: r().text,
            children: [(0, a.jsx)("h3", {
              className: r().h3,
              children: t
            }), s.map((e, t) => (0, a.jsx)("p", {
              className: r().p,
              children: e
            }, t))]
          }), l ? (0, a.jsxs)("figure", {
            className: r().figure,
            children: [l, i ? (0, a.jsx)("figcaption", {
              className: r().cap,
              children: i
            }) : null]
          }) : null]
        })
      }

      function d({
        groups: e,
        name: t,
        domId: s,
        defaultOpen: l,
        onToggle: i
      }) {
        return (0, a.jsx)("div", {
          className: r().col,
          children: e.map(e => (0, a.jsxs)("div", {
            children: [(0, a.jsx)("h3", {
              className: r().gh,
              children: e.title
            }), e.items.map(e => (0, a.jsxs)("details", {
              id: s(e.id),
              name: t,
              className: r().item,
              "data-q": e.id,
              open: e.id === l || void 0,
              onToggle: i,
              children: [(0, a.jsx)("summary", {
                className: r().q,
                children: (0, a.jsx)("span", {
                  className: r().qText,
                  children: e.q
                })
              }), null != e.html ? (0, a.jsx)("div", {
                className: r().a,
                dangerouslySetInnerHTML: {
                  __html: e.html
                }
              }) : (0, a.jsx)("div", {
                className: r().a,
                children: e.a.map((e, t) => (0, a.jsx)("p", {
                  children: e
                }, t))
              })]
            }, e.id))]
          }, e.id ?? e.title))
        })
      }
      let c = (0, l.memo)(function({
        id: e,
        title: t,
        sub: s = null,
        hero: i = null,
        groups: c,
        notice: h = null,
        domId: p = null,
        defaultOpen: u,
        jsonLd: f = !1,
        scrollMarginTop: g = 72,
        className: x,
        children: m = null
      }) {
        let b = (0, l.useRef)(null),
          w = p ?? (t => `${e}-${t}`),
          v = void 0 === u ? c[0]?.items[0]?.id : u,
          y = [0, 1].map(e => c.filter(t => (t.col ?? 0) === e)).filter(e => e.length),
          k = (0, l.useCallback)(e => {
            let t = e.currentTarget;
            t.open && b.current?.querySelectorAll("details[open]").forEach(e => {
              e !== t && (e.open = !1)
            })
          }, []);
        return (0, a.jsxs)("section", {
          ref: b,
          id: e,
          className: o(r().root, x),
          style: {
            "--faq-scroll-margin-top": `${g}px`
          },
          "aria-labelledby": `${e}-title`,
          children: [(0, a.jsxs)("div", {
            className: r().head,
            children: [(0, a.jsx)("h2", {
              id: `${e}-title`,
              className: r().h2,
              tabIndex: -1,
              children: t
            }), s ? (0, a.jsx)("p", {
              className: r().sub,
              children: s
            }) : null]
          }), h, i ? (0, a.jsx)(n, {
            hero: i
          }) : null, (0, a.jsx)("div", {
            className: o(r().grid, y.length < 2 && r().single),
            children: y.map((t, s) => (0, a.jsx)("div", {
              className: r().card,
              children: (0, a.jsx)(d, {
                groups: t,
                name: `${e}-q`,
                domId: w,
                defaultOpen: v,
                onToggle: k
              })
            }, s))
          }), m, f ? (0, a.jsx)("script", {
            type: "application/ld+json",
            dangerouslySetInnerHTML: {
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: c.flatMap(e => e.items.map(e => ({
                  "@type": "Question",
                  name: e.q,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: e.html ?? e.a.join("\n\n")
                  }
                })))
              }).replace(/</g, "\\u003c")
            }
          }) : null]
        })
      })
    }
  },
  e => {
    e.O(0, [47532, 4958, 15789, 45474, 36501, 34790, 88185, 38370, 16301, 69897, 84023, 12985, 62256, 55394, 25727, 89831, 28906, 73305, 3986, 90507, 90636, 46593, 38792], () => e(e.s = 88937)), _N_E = e.O()
  }
]);