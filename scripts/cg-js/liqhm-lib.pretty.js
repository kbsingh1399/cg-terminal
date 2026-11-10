(!(function () {
  try {
    var t =
        "u" > typeof window
          ? window
          : "u" > typeof global
            ? global
            : "u" > typeof globalThis
              ? globalThis
              : "u" > typeof self
                ? self
                : {},
      e = new t.Error().stack;
    e &&
      ((t._sentryDebugIds = t._sentryDebugIds || {}),
      (t._sentryDebugIds[e] = "57b3bb7b-536e-4072-ac5f-692b8bd5bbe1"),
      (t._sentryDebugIdIdentifier =
        "sentry-dbid-57b3bb7b-536e-4072-ac5f-692b8bd5bbe1"));
  } catch (t) {}
})(),
  (self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
    [18704, 23293, 53256],
    {
      13475: (t, e, s) => {
        "use strict";
        s.d(e, { A: () => F });
        var a = s(6029),
          i = s(55729),
          n = s(83617);
        (s(23293), s(18704));
        var o = s(63813),
          l = s(87141),
          r = s(40376),
          h = s(37799),
          d = s(82203),
          c = s.n(d),
          p = s(99826),
          m = s(62770),
          x = s(7197),
          u = s(27405),
          g = s(64123),
          b = s(9142),
          y = s(68710),
          f = s(40083),
          v = s(68635),
          _ = s(35850),
          j = s(16647);
        s(70218);
        var C = s(68667),
          S = s(26215),
          A = s(30327),
          k = s(3307),
          T = s(14852),
          N = s(3160),
          q = s(29941),
          L = s(40253),
          w = s(86703),
          B = s(14928),
          $ = s(16086),
          R = s.n($),
          I = s(73696),
          D = s(54499);
        class M extends i.Component {
          constructor(t) {
            (super(t),
              (this.delayTime = 300),
              (this.delayTime = 150),
              t.onRef && t.onRef(this),
              (this.countdown_time = null),
              (this.needLoginBoxRef = (0, i.createRef)()),
              (this.state = {
                reqLimit: !1,
                startTask: !0,
                countdown_second: 30,
                maxBase: 0.85,
                colorValue: 1,
                osymbol: "BTC",
                selectTime: "d1",
                loading_coin: !1,
                innerWidth: 1e3,
                limit: 288,
                time: 5,
                loading: !0,
                tickers: [],
                price: "",
                exName: "Binance",
                coin: "BTC/USDT",
                symbol: "BTC",
                search_str: "",
                data: {},
                option: {},
                chartStyle: "bar",
                ...t,
                ...j.A.getState(),
              }));
          }
          storeChange() {
            this.setState(
              {
                user: j.A.getState().user,
                all_symbol: j.A.getState().all_symbol,
              },
              () => {
                this.state.user?.grade == 6 && this.vip_task();
              },
            );
          }
          vip_task() {
            null == this.countdown_time &&
              (this.countdown_time = setInterval(
                function () {
                  this.vip_refresh();
                }.bind(this),
                1e3,
              ));
          }
          vip_refresh() {
            if (!this.state.loading && this.state.startTask) {
              let t = this.state.countdown_second - 1;
              this.setState({ countdown_second: t, loading: t <= 1 }, () => {
                t <= 1 && this.getData();
              });
            }
          }
          componentWillUnmount() {
            this.countdown_time && clearInterval(this.countdown_time);
          }
          changeTaskStatus() {
            let t = !this.state.startTask;
            this.setState({ startTask: t, countdown_second: 30 }, () => {
              (0, T.$6)(t);
            });
          }
          componentDidMount() {
            (j.A.subscribe(this.storeChange.bind(this)),
              this.state.user?.grade == 6 && this.vip_task(),
              this.props.liqmaptime
                ? this.onChangeTime(null, this.props.liqmaptime)
                : this.getData());
            let t = (0, T.RK)();
            this.setState({
              colorValue: t,
              innerWidth: window?.innerWidth,
              innerHeight: window?.innerHeight,
              startTask: (0, T.XY)(),
            });
          }
          onChangeState(t) {
            (t.symbol && this.onChangeSymbol(null, t.symbol),
              t.timeType && this.onChangeTime(null, t.timeType),
              t.refreshTime &&
                this.setState({ loading: !0 }, () => {
                  this.getData();
                }));
          }
          async getCoins() {
            let { data: t } = await (0, v.t2D)({
                keyword: this.state.search_str,
              }),
              e = [];
            for (let s = 0; s < t.length; s++) 1 == t[s].type && e.push(t[s]);
            this.setState({ loading_coin: !1, tickers: e });
          }
          async getData() {
            try {
              let { data: t, code: e } = await (0, v.QGl)({
                merge: !0,
                symbol: this.state.symbol,
                interval: this.state.time,
                limit: this.state.limit,
              });
              if ("40000" == e) return void this.needLoginBoxRef.onOpen();
              if ("40003" == e) return void this.needLoginBoxRef.onOpenPrime();
              if ("50001" == e)
                return void this.setState({
                  data: null,
                  loading: !1,
                  countdown_second: 30,
                  reqLimit: !0,
                });
              (t ||
                this.setState(
                  {
                    data: null,
                    loading: !1,
                    countdown_second: 30,
                    reqLimit: !1,
                  },
                  () => {
                    this.renderChart();
                  },
                ),
                this.setState(
                  { data: t, loading: !1, countdown_second: 30, reqLimit: !1 },
                  () => {
                    this.renderChart();
                  },
                ));
            } catch (t) {
              this.setState({
                loading: !1,
                countdown_second: 30,
                reqLimit: !1,
              });
            }
          }
          getTokenSearch(t) {
            this.setState({ loading_coin: !0, search_str: t }, () => {
              this.getCoins();
            });
          }
          async onInputChange(t, e) {
            t?.type &&
              "change" == t.type &&
              (this.setState({ loading_coin: !0 }),
              this.searchTimeout && clearTimeout(this.searchTimeout),
              (this.searchTimeout = setTimeout(
                this.getTokenSearch.bind(this),
                this.delayTime,
                e,
              )));
          }
          onChangeSymbol(t, e) {
            var s = this.state.selectTime,
              a = this.state.time,
              i = this.state.limit;
            (("y1" == this.state.selectTime ||
              "mo6" == this.state.selectTime) &&
              "BTC" != e &&
              "ETH" != e &&
              ((s = "d3"), (a = 15), (i = 288)),
              this.setState(
                {
                  loading: !0,
                  symbol: e,
                  selectTime: s,
                  time: a,
                  limit: i,
                  osymbol: e,
                },
                () => {
                  (this.changeUrlCoin(), this.getData());
                },
              ));
          }
          changeUrlCoin() {
            this.props.onChangeCoin &&
              this.props.onChangeCoin(this.state.symbol);
            let t = this.props.router;
            t?.replace(
              {
                pathname: t.pathname,
                query: { ...t.query, coin: this.state.symbol },
              },
              void 0,
              { shallow: !0 },
            );
          }
          updateLiqBase(t) {
            this.setState({ maxBase: t }, () => {
              this.renderChart();
            });
          }
          async onUpdateLiqBase(t, e) {
            (this.searchTimeout && clearTimeout(this.searchTimeout),
              (this.searchTimeout = setTimeout(
                this.updateLiqBase.bind(this),
                this.delayTime,
                e,
              )));
          }
          onChangeColor(t) {
            ((0, T.pS)(t),
              this.setState({ colorValue: t }, () => {
                this.renderChart();
              }));
          }
          async renderChart() {
            if (null == this.state.data)
              return void this.setState({ option: {} });
            var t = this;
            let { liq: e, prices: s, y: a } = this.state.data,
              i = [],
              o = [];
            for (let t = 0; t < s.length; t++) {
              let e = s[t][1],
                a = s[t][2],
                n = s[t][3],
                l = s[t][4];
              (i.push(s[t][0]), o.push([e, l, n, a]));
            }
            let l = {};
            for (let t in e) l[`${e[t][0]}-${e[t][1]}`] = 1;
            let r = [];
            for (let e = 0; e < s.length; e++)
              for (let s = 0; s < a.length; s++)
                l[`${e}-${s}`] ||
                  r.push({
                    value: [e, s, 0],
                    itemStyle: {
                      color:
                        1 == t.state.colorValue
                          ? "#46035c"
                          : 2 == t.state.colorValue
                            ? "rgba(25, 8, 49, 1)"
                            : 3 == t.state.colorValue
                              ? "#000031"
                              : "#0E1A2B",
                    },
                  });
            let h = (e = [...e, ...r])
                .map(function (t) {
                  return Array.isArray(t) ? t[2] : 0;
                })
                .reduce((t, e) => (t >= e ? t : e), -1 / 0),
              d = window?.innerWidth || 1e3;
            var c = {
              legend: {
                data: [
                  {
                    name: t.state.t("liqmap.liq_strength"),
                    itemStyle: { color: "#400d57" },
                  },
                  {
                    name: t.state.t("k.kline"),
                    itemStyle: { color: "#0ecb81", borderWidth: 0 },
                  },
                ],
              },
              grid: {
                bottom: "80px",
                left: d > 800 ? "70px" : "20px",
                right: d > 800 ? "20px" : "0px",
                containLabel: !0,
              },
              dataZoom: (0, _.Gz)(0, 100, j.A.getState().theme),
              tooltip: {
                trigger: "item",
                axisPointer: { type: "radius" },
                formatter: function (e) {
                  if (null == e.value) return "";
                  if ("heatmap" == e.componentSubType) {
                    let s = [];
                    return (
                      s.push({
                        marker: e.marker,
                        name: t.state.t("tb.price"),
                        value: t.state.data.y[e.value[1]],
                      }),
                      s.push({
                        marker: e.marker,
                        name: e.seriesName,
                        value: e.value[2],
                        format: 3,
                      }),
                      (0, _.Bc)(e.name, s, n.Ru.language)
                    );
                  }
                  let s = [];
                  return (
                    s.push({
                      marker: e.marker,
                      name: t.state.t("k.o"),
                      value: e.value[1],
                    }),
                    s.push({
                      marker: e.marker,
                      name: t.state.t("k.h"),
                      value: e.value[4],
                    }),
                    s.push({
                      marker: e.marker,
                      name: t.state.t("k.l"),
                      value: e.value[3],
                    }),
                    s.push({
                      marker: e.marker,
                      name: t.state.t("k.c"),
                      value: e.value[2],
                    }),
                    (0, _.Bc)(e.name, s, n.Ru.language)
                  );
                },
              },
              xAxis: [{ data: i }],
              yAxis: [
                {
                  type: "category",
                  data: a,
                  axisLabel: { show: !1, inside: !1 },
                },
                {
                  type: "value",
                  min: Math.min(...a),
                  max: Math.max(...a),
                  splitLine: { show: !0 },
                  axisLabel: {
                    formatter: function (t) {
                      return t > 100 ? t.toFixed(0) : t;
                    },
                  },
                },
              ],
              visualMap: {
                hoverLink: !1,
                seriesIndex: 0,
                min: 0,
                max: h * this.state.maxBase,
                formatter: function (t) {
                  return 0 == t ? 0 : (0, _.kn)(t, n.Ru.language, 2);
                },
                text: [(0, _.kn)(h, n.Ru.language, 2), 0],
                calculable: !1,
                handleIcon: "none",
                inRange: {
                  color:
                    1 == t.state.colorValue
                      ? ["#46035c", "#297090", "#1fa084", "#49c161", "#f2e805"]
                      : 2 == t.state.colorValue
                        ? [
                            "rgba(25, 8, 49, 1)",
                            "rgba(47, 16, 85, 1) ",
                            "rgba(76, 26, 105, 1)",
                            "rgba(119, 45, 109, 1)",
                            "rgba(159, 62, 113, 1)",
                            "rgba(189, 78, 113, 1)",
                            "rgba(206, 91, 108, 1)",
                            "rgba(225, 105, 104, 1)",
                            "rgba(234, 146, 127, 1)",
                            "rgba(241, 196, 160, 1) ",
                            "rgba(250, 241, 190, 1)",
                          ]
                        : 3 == t.state.colorValue
                          ? [
                              "#000031",
                              "#0000F4",
                              "#0066F4",
                              "#15FFEA",
                              "#FFB700",
                            ]
                          : [
                              "#0E1A2B",
                              "#1B2F4A",
                              "#2F4F73",
                              "#4A6FA5",
                              "#6F93B8",
                              "#8FB1A9",
                              "#B8C58A",
                              "#D6C67A",
                              "#E9D85C",
                              "#F0E442",
                            ],
                },
              },
              series: [
                {
                  large: !0,
                  name: t.state.t("liqmap.liq_strength"),
                  type: "heatmap",
                  smooth: !0,
                  data: e,
                  progressive: 0,
                  emphasis: {
                    itemStyle: { borderColor: "#FFF", borderWidth: 1 },
                  },
                },
                {
                  large: !0,
                  name: t.state.t("k.kline"),
                  yAxisIndex: 1,
                  label: { show: !0 },
                  type: "candlestick",
                  data: o,
                  itemStyle:
                    4 == t.state.colorValue
                      ? {
                          color: "#E6E6E6",
                          borderColor: "#E6E6E6",
                          color0: "#7A7A7A",
                          borderColor0: "#7A7A7A",
                          borderWidth: 1,
                        }
                      : {},
                },
              ],
            };
            ((0, _.IO)() || (c.tooltip.triggerOn = "click"),
              d > 800
                ? ((c.visualMap.top = "40px"),
                  (c.visualMap.itemHeight =
                    1.1 * this.state.innerHeight < 770
                      ? `${this.state.innerHeight - 150}px`
                      : "560px"))
                : ((c.visualMap.align = "top"),
                  (c.visualMap.orient = "horizontal"),
                  (c.visualMap.left = "center"),
                  (c.visualMap.bottom = "0%")),
              this.setState({ option: c }));
          }
          onChangeTime(t, e) {
            let s, a;
            ("h12" == e && ((s = 5), (a = 144)),
              "d1" == e && ((s = 5), (a = 288)),
              "h48" == e && ((s = 15), (a = 192)),
              "d3" == e && ((s = 15), (a = 288)),
              "w1" == e && ((s = 30), (a = 336)),
              "w2" == e && ((s = 30), (a = 672)),
              "mo1" == e && ((s = "h2"), (a = 372)),
              "mo3" == e && ((s = "h6"), (a = 360)),
              "mo6" == e && ((s = "h12"), (a = 360)),
              "y1" == e && ((s = "h24"), (a = 360)),
              "y2" == e && ((s = "d1"), (a = 720)),
              this.setState(
                { time: s, limit: a, loading: !0, selectTime: e },
                () => {
                  this.getData();
                },
              ));
          }
          render() {
            let t = this.props.t("title.liqheatmap", {
                ex: "",
                coin: this.state.symbol,
              }),
              e = () => {
                let e =
                  "d1" == this.state.selectTime ? "h24" : this.state.selectTime;
                S.X.onBroadcast({
                  topic: "chart_camera",
                  chartId: "liqheatmap2",
                  title: `${t}(${this.props.t(`time.${e}`)})`,
                });
              };
            return (0, a.jsxs)("div", {
              className: R().box1,
              children: [
                this.state.pure
                  ? ""
                  : (0, a.jsxs)(a.Fragment, {
                      children: [
                        (0, a.jsxs)("div", {
                          className: "dfsb",
                          children: [
                            (0, a.jsx)(x.o5, {
                              level: this.props.mini ? "h2" : "h1",
                              className: R().sxTypography11,
                              children: t,
                            }),
                            (0, a.jsx)("div", {
                              className: "ov8",
                              children: (0, a.jsxs)("div", {
                                className: `${R().stack2} cg-stack`,
                                children: [
                                  (0, a.jsx)(m.A, {
                                    sx: { width: 100, fontSize: "14px" },
                                    selectOnFocus: !0,
                                    onChange: this.onChangeSymbol.bind(this),
                                    disableClearable: !0,
                                    placeholder: "",
                                    defaultValue: this.state.symbol,
                                    getOptionLabel: (t) => t,
                                    options: this.state.all_symbol,
                                    className: "font2",
                                  }),
                                  (0, a.jsxs)(b.A, {
                                    sx: {
                                      width: (this.state.innerWidth, "100px"),
                                    },
                                    slotProps: {
                                      listbox: { sx: { maxHeight: "100vh" } },
                                    },
                                    value: this.state.selectTime,
                                    onChange: this.onChangeTime.bind(this),
                                    size: "sm",
                                    defaultValue: "d1",
                                    className: "font2",
                                    children: [
                                      (0, a.jsx)(y.A, {
                                        value: "h12",
                                        children: this.props.t("time.h12"),
                                      }),
                                      (0, a.jsx)(y.A, {
                                        value: "d1",
                                        children: this.props.t("time.h24"),
                                      }),
                                      (0, a.jsx)(y.A, {
                                        value: "h48",
                                        children: this.props.t("time.h48"),
                                      }),
                                      (0, a.jsx)(y.A, {
                                        value: "d3",
                                        children: this.props.t("time.d3"),
                                      }),
                                      (0, a.jsx)(y.A, {
                                        value: "w1",
                                        children: this.props.t("time.w1"),
                                      }),
                                      (0, a.jsx)(y.A, {
                                        value: "w2",
                                        children: this.props.t("time.w2"),
                                      }),
                                      (0, a.jsx)(y.A, {
                                        value: "mo1",
                                        children: this.props.t("time.mo1"),
                                      }),
                                      (0, a.jsx)(y.A, {
                                        value: "mo3",
                                        children: this.props.t("time.mo3"),
                                      }),
                                      (0, a.jsx)(y.A, {
                                        value: "mo6",
                                        children: this.props.t("time.mo6"),
                                      }),
                                      (0, a.jsx)(y.A, {
                                        value: "y1",
                                        children: this.props.t("time.y1"),
                                      }),
                                      (0, a.jsx)(y.A, {
                                        value: "y2",
                                        children: this.props.t("time.y2"),
                                      }),
                                    ],
                                  }),
                                  this.state.user?.grade == 6
                                    ? (0, a.jsxs)(u.A, {
                                        children: [
                                          (0, a.jsxs)(o.A, {
                                            sx: {
                                              borderRadius: "6px 0px 0px 6px",
                                            },
                                            disabled: this.state.loading,
                                            color: "neutral",
                                            onClick: () => {
                                              this.setState(
                                                { loading: !0 },
                                                () => {
                                                  this.getData();
                                                },
                                              );
                                            },
                                            variant: "soft",
                                            children: [
                                              (0, a.jsx)(L.Lnk, {
                                                fontSize: "16px",
                                              }),
                                              this.state.startTask
                                                ? (0, a.jsx)("div", {
                                                    className: R().box3,
                                                    children:
                                                      this.state
                                                        .countdown_second,
                                                  })
                                                : "",
                                            ],
                                          }),
                                          (0, a.jsx)(g.Ay, {
                                            sx: {
                                              borderRadius: "0px 6px 6px 0px",
                                            },
                                            onClick:
                                              this.changeTaskStatus.bind(this),
                                            color: "neutral",
                                            variant: "soft",
                                            children: this.state.startTask
                                              ? (0, a.jsx)(w.uhq, {
                                                  fontSize: "18px",
                                                })
                                              : (0, a.jsx)(w.SCP, {
                                                  fontSize: "18px",
                                                }),
                                          }),
                                        ],
                                      })
                                    : (0, a.jsx)(o.A, {
                                        disabled: this.state.loading,
                                        color: "neutral",
                                        onClick: () => {
                                          this.setState({ loading: !0 }, () => {
                                            this.getData();
                                          });
                                        },
                                        variant: "soft",
                                        children: (0, a.jsx)(L.Lnk, {
                                          fontSize: "16px",
                                        }),
                                      }),
                                  this.props.isPC
                                    ? (0, a.jsx)(o.A, {
                                        disabled: this.state.loading,
                                        color: "neutral",
                                        onClick: e,
                                        variant: "soft",
                                        children: (0, a.jsx)(C.p5B, {
                                          fontSize: "16px",
                                        }),
                                      })
                                    : "",
                                ],
                              }),
                            }),
                          ],
                        }),
                        "        ",
                      ],
                    }),
                (0, a.jsx)("div", {
                  className: R().box4,
                  children: (0, a.jsxs)("div", {
                    className: R().box5,
                    children: [
                      (0, a.jsxs)("div", {
                        className: `${R().box6} font2`,
                        children: [
                          this.state.loading
                            ? ""
                            : (0, a.jsxs)(a.Fragment, {
                                children: [
                                  (0, a.jsx)("div", {
                                    onClick: () => {
                                      this.onChangeColor(1);
                                    },
                                    className: `${R().box7} liq-heatmap-color shou`,
                                  }),
                                  (0, a.jsx)("div", {
                                    onClick: () => {
                                      this.onChangeColor(2);
                                    },
                                    className: `${R().box7} liq-heatmap-color2 shou`,
                                  }),
                                  (0, a.jsx)("div", {
                                    onClick: () => {
                                      this.onChangeColor(3);
                                    },
                                    className: `${R().box7} liq-heatmap-color3 shou`,
                                  }),
                                  (0, a.jsx)("div", {
                                    onClick: () => {
                                      this.onChangeColor(4);
                                    },
                                    className: `${R().box7} liq-heatmap-color4 shou`,
                                  }),
                                ],
                              }),
                          (0, a.jsxs)(k.A, {
                            mouseEnterDelay: 1,
                            title: this.state.t("liq.threshold_tip"),
                            variant: "outlined",
                            children: [
                              this.state.t("liq.threshold"),
                              " = ",
                              this.state.maxBase,
                            ],
                          }),
                        ],
                      }),
                      (0, a.jsx)(p.A, {
                        disabled: this.state.loading,
                        defaultValue: this.state.maxBase,
                        onChange: this.onUpdateLiqBase.bind(this),
                        step: 0.01,
                        min: 0.1,
                        max: 1,
                        valueLabelDisplay: "auto",
                        className: R().sxSlider13,
                      }),
                    ],
                  }),
                }),
                (0, a.jsxs)("div", {
                  className: R().box8,
                  style: {
                    ...(0, I.ds)("height", this.props.height || "750px", [
                      "height",
                    ]),
                  },
                  children: [
                    this.state.reqLimit && null == this.state.data
                      ? (0, a.jsxs)("div", {
                          className: R().box9,
                          children: [
                            (0, a.jsx)("div", {
                              children: (0, a.jsx)(B.fi3, { fontSize: "30px" }),
                            }),
                            (0, a.jsx)("div", {
                              className: R().box10,
                              children: this.props.t("lab.req_limit"),
                            }),
                            this.state.loading ? (0, a.jsx)(x.P, {}) : "",
                          ],
                        })
                      : "",
                    this.state.reqLimit || null != this.state.data
                      ? ""
                      : (0, a.jsxs)("div", {
                          className: R().box9,
                          children: [
                            (0, a.jsx)("div", {
                              children: (0, a.jsx)(A.VWY, { fontSize: "30px" }),
                            }),
                            (0, a.jsx)("div", {
                              className: R().box10,
                              children: this.props.t("nodata"),
                            }),
                          ],
                        }),
                    (0, a.jsx)(f.A, {
                      chartId: this.props.chartId || "liqheatmap2",
                      title: t,
                      load: this.state.loading,
                      mini: this.props.mini,
                      option: this.state.option,
                    }),
                  ],
                }),
                (0, a.jsx)(q.A, {
                  onRef: (t) => (this.needLoginBoxRef = t),
                  href: "/login?act=lhm1",
                }),
              ],
            });
          }
        }
        let z = (0, n.CI)()((0, D.vN)(M));
        var E = s(23199),
          H = s(50426),
          O = s.n(H);
        class V extends i.Component {
          constructor(t) {
            (super(t), (this.state = { type: 1, ...t }));
          }
          componentDidMount() {}
          changeUrlCoin() {
            let t = this.props.router,
              e = 1 == this.state.type ? "pair" : "symbol";
            t?.replace(
              {
                pathname: t.pathname,
                query: { ...t.query, coin: this.state.coin, type: e },
              },
              void 0,
              { shallow: !0 },
            );
          }
          onChangeModel(t, e) {
            let s = 1 == this.state.type ? "pair" : "symbol";
            if ("1" == e) {
              let t = `/pro/futures/LiquidationHeatMap?coin=${this.state.coin}&type=${s}`;
              this.props.router.push(t, t, { locale: n.Ru.language });
            }
            if ("2" == e) {
              let t = `/pro/futures/LiquidationHeatMapNew?coin=${this.state.coin}&type=${s}`;
              this.props.router.push(t, t, { locale: n.Ru.language });
            }
            if ("3" == e) {
              let t = `/liquidation-heatmap-model3?coin=${this.state.coin}&type=${s}`;
              this.props.router.push(t, t, { locale: n.Ru.language });
            }
          }
          onChangeCoin(t) {
            this.setState({ coin: t });
          }
          render() {
            return (0, a.jsxs)(a.Fragment, {
              children: [
                (0, a.jsx)("div", {
                  className: O().box1,
                  children: (0, a.jsx)(l.A, {
                    className: "liq-tab",
                    size: "md",
                    onChange: this.onChangeModel.bind(this),
                    defaultValue: "1",
                    children: (0, a.jsxs)(r.A, {
                      children: [
                        (0, a.jsx)(h.A, {
                          value: "1",
                          children: this.props.t("lab.model1"),
                        }),
                        (0, a.jsx)(h.A, {
                          value: "2",
                          children: this.props.t("lab.model2"),
                        }),
                        (0, a.jsx)(h.A, {
                          value: "3",
                          children: this.props.t("lab.model3"),
                        }),
                      ],
                    }),
                  }),
                }),
                (0, a.jsxs)("div", {
                  className: `${O().box2} dfsb`,
                  children: [
                    (0, a.jsx)(c(), {
                      className: "mbh",
                      href: "/pricing",
                      target: "_blank",
                      children: (0, a.jsxs)("span", {
                        className: O().box3,
                        children: [
                          "\uD83D\uDD25",
                          this.props.t("nav.liqmap"),
                          " API",
                        ],
                      }),
                    }),
                    (0, a.jsx)("div", {
                      children:
                        "zh" == n.Ru.language || this.props.inMainlandChina
                          ? ""
                          : (0, a.jsxs)("div", {
                              className: `${O().stack4} cg-stack`,
                              children: [
                                (0, a.jsx)(o.A, {
                                  onClick: () => {
                                    (0, N.Y)({
                                      id: "long",
                                      type: 4,
                                      language: n.Ru.language,
                                    });
                                  },
                                  children: this.props.t("lab.dolong"),
                                }),
                                (0, a.jsx)(o.A, {
                                  onClick: () => {
                                    (0, N.Y)({
                                      id: "short",
                                      type: 4,
                                      language: n.Ru.language,
                                    });
                                  },
                                  children: this.props.t("lab.doshort"),
                                }),
                                (0, a.jsx)(o.A, {
                                  onClick: () => {
                                    (0, N.Y)({
                                      id: "trade",
                                      type: 4,
                                      language: n.Ru.language,
                                    });
                                  },
                                  children: this.props.t("tb.trade"),
                                }),
                              ],
                            }),
                    }),
                  ],
                }),
                (0, a.jsxs)("div", {
                  className: "dfsb",
                  children: [
                    (0, a.jsx)(l.A, {
                      className: "fztab",
                      size: "sm",
                      onChange: (t, e) => {
                        this.setState({ type: e }, () => {
                          this.changeUrlCoin();
                        });
                      },
                      defaultValue: this.state.type,
                      children: (0, a.jsxs)(r.A, {
                        children: [
                          (0, a.jsx)(h.A, {
                            value: 1,
                            children: this.props.t("tb.pair"),
                          }),
                          (0, a.jsx)(h.A, {
                            value: 2,
                            children: this.props.t("tb.symbol"),
                          }),
                        ],
                      }),
                    }),
                    (0, a.jsx)("div", {
                      className: `${O().box5} btn-pro`,
                      children: (0, a.jsx)("div", {
                        className: O().box6,
                        children: (0, a.jsx)(c(), {
                          href: "/prime",
                          children: (0, a.jsx)(o.A, {
                            sx: {
                              pl: "15px",
                              pr: "15px",
                              "&:hover": {
                                backgroundColor: "var(--joy-cg-cardBg)",
                              },
                              backgroundColor: "var(--joy-cg-cardBg)",
                            },
                            size: "sm",
                            variant: "solid",
                            style: {
                              color:
                                "var(--joy-palette-neutral-outlinedColor, var(--joy-palette-neutral-800, #25252D))",
                            },
                            children: "Prime",
                          }),
                        }),
                      }),
                    }),
                  ],
                }),
                1 == this.state.type
                  ? (0, a.jsx)(E.default, {
                      onChangeCoin: this.onChangeCoin.bind(this),
                      router: this.props.router,
                      coin: `${this.state.coin || "BTC"}/USDT`,
                      search_str: this.state.coin || "BTCUSDT",
                      osymbol: this.state.coin || "BTC",
                      symbol: `${this.state.exName || "Binance"}_${this.state.coin || "BTC"}USDT`,
                    })
                  : (0, a.jsx)(z, {
                      onChangeCoin: this.onChangeCoin.bind(this),
                      router: this.props.router,
                      symbol: this.state.coin || "BTC",
                      osymbol: this.state.coin || "BTC",
                      coin: this.state.coin || "BTC",
                    }),
              ],
            });
          }
        }
        let F = (0, n.CI)()((0, D.vN)(V));
      },
      16086: (t) => {
        t.exports = {
          box1: "LiqHeatmap2_box1__hdI5U",
          stack2: "LiqHeatmap2_stack2__tlOe5",
          box3: "LiqHeatmap2_box3__m8WE3",
          box4: "LiqHeatmap2_box4__YIIeR",
          box5: "LiqHeatmap2_box5___UbAc",
          box6: "LiqHeatmap2_box6__EtYlG",
          box7: "LiqHeatmap2_box7__9RBHm",
          box8: "LiqHeatmap2_box8__qGZQU",
          box9: "LiqHeatmap2_box9__veG70",
          box10: "LiqHeatmap2_box10__vA9vW",
          sxTypography11: "LiqHeatmap2_sxTypography11__h9yNT",
          sxAutocomplete12: "LiqHeatmap2_sxAutocomplete12__woIX4",
          sxSlider13: "LiqHeatmap2_sxSlider13__0AM2h",
          sxSelect14: "LiqHeatmap2_sxSelect14__Sc7HM",
        };
      },
      18704: (t, e, s) => {
        "use strict";
        (s.r(e), s.d(e, { default: () => j }));
        var a = s(6029),
          i = s(55729),
          n = s(83617),
          o = s(62770),
          l = s(7197),
          r = s(63813),
          h = s(9142),
          d = s(68710),
          c = s(40083),
          p = s(68635),
          m = s(35850),
          x = s(16647);
        s(70218);
        var u = s(45411),
          g = s(30327),
          b = s(29941),
          y = s(66938),
          f = s.n(y),
          v = s(73696);
        class _ extends i.Component {
          constructor(t) {
            (super(t),
              (this.delayTime = 300),
              t.onRef && t.onRef(this),
              (this.needLoginBoxRef = (0, i.createRef)()),
              (this.state = {
                limit: 1500,
                time: 1,
                loading: !0,
                tickers: [],
                price: "",
                symbol: "BTC",
                search_str: "",
                data: {},
                option: {},
                chartStyle: "bar",
                ...t,
                ...x.A.getState(),
              }));
          }
          storeChange() {
            this.setState({ all_symbol: x.A.getState().all_symbol });
          }
          componentDidMount() {
            (x.A.subscribe(this.storeChange.bind(this)),
              this.getCoins(),
              this.props.liqmaptime
                ? this.onChangeTime(null, this.props.liqmaptime)
                : this.getData());
          }
          onChangeState(t) {
            (t.timeType && this.onChangeTime(null, t.timeType),
              t.symbol && this.onChangeSymbol(null, t.symbol),
              t.refreshTime &&
                this.setState({ loading: !0 }, () => {
                  this.getData();
                }));
          }
          async getCoins() {
            let { data: t } = await (0, p.t2D)({
                keyword: this.state.search_str,
              }),
              e = [];
            for (let s = 0; s < t.length; s++) 1 == t[s].type && e.push(t[s]);
            this.setState({ tickers: e });
          }
          async getData() {
            let { data: t, code: e } = await (0, p.R25)({
              merge: !0,
              symbol: this.state.symbol,
              interval: this.state.time,
              limit: this.state.limit,
            });
            "40000" == e
              ? this.needLoginBoxRef.onOpen()
              : (t ||
                  this.setState({ data: null, loading: !1 }, () => {
                    this.renderChart();
                  }),
                this.setState({ data: t, loading: !1 }, () => {
                  this.renderChart();
                }));
          }
          getTokenSearch(t) {
            this.setState({ search_str: t }, () => {
              this.getCoins();
            });
          }
          async onInputChange(t, e) {
            t?.type &&
              "change" == t.type &&
              (this.searchTimeout && clearTimeout(this.searchTimeout),
              (this.searchTimeout = setTimeout(
                this.getTokenSearch.bind(this),
                this.delayTime,
                e,
              )));
          }
          onChangeSymbol(t, e) {
            this.setState({ loading: !0, symbol: e }, () => {
              this.getData();
            });
          }
          async renderChart() {
            if (null == this.state.data)
              return void this.setState({ option: {} });
            let t = [],
              e = {},
              s = `${Number(this.state.data.lastPrice)}`,
              a = Number(this.state.data.lastPrice);
            (this.state.data.data[0].instrument.priceTick,
              this.state.data.rangeHigh,
              this.state.data.rangeLow,
              this.state.data.data.map((t) => {
                Object.keys(t.liqMapV2).map((t) => {
                  e[t] || (e[t] = t);
                });
              }),
              Object.keys(e).map((e) => {
                t.push(Number(e));
              }),
              t.push(a),
              (t = t.sort((t, e) => t - e)));
            let i = {};
            for (let t = 0; t < this.state.data.data.length; t++)
              i[this.state.data.data[t].instrument.exName] = [];
            t.forEach((t) => {
              for (let e = 0; e < this.state.data.data.length; e++) {
                let s = this.state.data.data[e].instrument.exName,
                  a = this.state.data.data[e].liqMapV2[`${t}`];
                if (a) {
                  let [t, e, n, o] = a[0];
                  i[s].push(+e);
                } else i[s].push(null);
              }
            });
            let o = [],
              l = [];
            for (let e = 0; e < t.length; e++) {
              let s = 0;
              for (let t in i) s += i[t][e];
              t[e] < a ? (o.push(s), l.push(0)) : (l.push(s), o.push(0));
            }
            for (let t = 1; t < l.length; t++) l[t] = l[t] + l[t - 1];
            for (let t = o.length - 2; t >= 0; t--) o[t] = o[t] + o[t + 1];
            for (let e = 0; e < t.length; e++)
              (t[e] > a && (o[e] = null), t[e] < a && (l[e] = null));
            var r = this,
              h = [
                {
                  uniform_style: "no",
                  name: "",
                  type: "line",
                  markLine: {
                    animation: !1,
                    symbol: ["none", "arrow"],
                    lineStyle: {
                      normal: {
                        type: "dashed",
                        width: 2,
                        color: "#f5222d",
                        cap: "butt",
                      },
                    },
                    data: [
                      {
                        show: !1,
                        name: `${this.props.t("tb.current_price")}`,
                        label: {
                          show: !0,
                          position: "end",
                          formatter: `{b}:${s}`,
                        },
                        xAxis: s,
                      },
                    ],
                  },
                },
                {
                  name: this.props.t("lab.liqmap_short_count"),
                  type: "line",
                  areaStyle: { opacity: 0.1 },
                  data: l,
                  yAxisIndex: 1,
                  itemStyle: { color: (0, m.zZ)() },
                },
                {
                  name: this.props.t("lab.liqmap_long_count"),
                  type: "line",
                  areaStyle: { opacity: 0.1 },
                  data: o,
                  yAxisIndex: 1,
                  itemStyle: { color: (0, m.jk)() },
                },
              ];
            for (let t in i)
              h.push({ name: t, stack: "liq", type: "bar", data: i[t] });
            var d = {
              color: [
                "#F08833",
                "#ff8300",
                "#ffc400",
                "#8bd6d9",
                "#81c1ec",
                "#6188ff",
              ],
              dataZoom: (0, m.Gz)(0, 100, x.A.getState().theme),
              tooltip: {
                trigger: "axis",
                formatter: function (t) {
                  var e = [];
                  return (
                    t.forEach(function (t, s) {
                      t.seriesName ==
                      `${r.props.t("tb.price_symbol", { symbol: r.state.symbol })}`
                        ? e.push({
                            marker: t.marker,
                            name: t.seriesName,
                            value: t.value,
                            prefix: "$",
                            format: 0,
                          })
                        : null != t.value &&
                          e.push({
                            marker: t.marker,
                            name: t.seriesName,
                            value: t.value,
                            format: 3,
                          });
                    }),
                    (0, m.Bc)(t[0].axisValueLabel, e, n.Ru.language)
                  );
                },
              },
              xAxis: [{ log: !0, data: t }],
              yAxis: [
                {
                  prointerval: "manual",
                  min: function (t) {
                    return 0.98 * t.min;
                  },
                  max: function (t) {
                    return 1.1 * t.max;
                  },
                  axisLabel: {
                    formatter: function (t) {
                      return `${(0, m.kn)(t, n.Ru.language, 0)}`;
                    },
                  },
                  splitLine: { show: !0 },
                },
                {
                  prointerval: "manual",
                  min: function (t) {
                    return 0.98 * t.min;
                  },
                  max: function (t) {
                    return 1.1 * t.max;
                  },
                  axisLabel: {
                    formatter: function (t) {
                      return `${(0, m.kn)(t, n.Ru.language, 0)}`;
                    },
                  },
                  splitLine: { show: !0 },
                },
              ],
              series: h,
            };
            this.setState({ option: d });
          }
          onChangeTime(t, e) {
            let s, a;
            (1 == e && ((s = 1), (a = 1500)),
              7 == e && ((s = 5), (a = 2e3)),
              30 == e && ((s = 30), (a = 1440)),
              90 == e && ((s = "90d"), (a = 1440)),
              180 == e && ((s = "180d"), (a = 1440)),
              365 == e && ((s = "365d"), (a = 1440)),
              this.setState({ time: s, limit: a, loading: !0 }, () => {
                this.getData();
              }));
          }
          render() {
            let t = this.props.t("title.liqmap_ex", {
              symbol:
                "BTC" == this.state.symbol
                  ? this.props.t("symbol.btc")
                  : this.state.symbol,
            });
            return (0, a.jsxs)("div", {
              className: f().box1,
              children: [
                this.state.pure
                  ? ""
                  : (0, a.jsxs)("div", {
                      className: "dfsb",
                      children: [
                        (0, a.jsx)(l.o5, {
                          level: this.props.mini ? "h2" : "h1",
                          className: f().sxTypography6,
                          children: t,
                        }),
                        (0, a.jsx)("div", {
                          className: "ov8",
                          children: (0, a.jsxs)("div", {
                            className: `${f().stack2} cg-stack`,
                            children: [
                              (0, a.jsx)(o.A, {
                                sx: { width: 100, fontSize: "14px" },
                                selectOnFocus: !0,
                                placeholder: this.state.t("search"),
                                blurOnSelect: !0,
                                onFocus: (t, e) => {
                                  setTimeout(() => {
                                    t.target.value = "";
                                  }, 10);
                                },
                                onChange: this.onChangeSymbol.bind(this),
                                disableClearable: !0,
                                defaultValue: this.state.symbol,
                                getOptionLabel: (t) => t,
                                options: this.state.all_symbol,
                                className: "font2",
                              }),
                              (0, a.jsxs)(h.A, {
                                sx: { width: "120px" },
                                onChange: this.onChangeTime.bind(this),
                                size: "sm",
                                defaultValue: 1,
                                className: "font2",
                                children: [
                                  (0, a.jsx)(d.A, {
                                    value: 1,
                                    children: this.props.t("time.d1"),
                                  }),
                                  (0, a.jsx)(d.A, {
                                    value: 7,
                                    children: this.props.t("time.d7"),
                                  }),
                                  (0, a.jsx)(d.A, {
                                    value: 30,
                                    children: this.props.t("time.d30"),
                                  }),
                                  (0, a.jsx)(d.A, {
                                    value: 90,
                                    children: this.props.t("time.number_day", {
                                      number: 90,
                                    }),
                                  }),
                                  (0, a.jsx)(d.A, {
                                    value: 180,
                                    children: this.props.t("time.number_day", {
                                      number: 180,
                                    }),
                                  }),
                                  (0, a.jsx)(d.A, {
                                    value: 365,
                                    children: this.props.t("time.y1"),
                                  }),
                                ],
                              }),
                              (0, a.jsx)(r.A, {
                                color: "neutral",
                                onClick: () => {
                                  this.setState({ loading: !0 }, () => {
                                    this.getData();
                                  });
                                },
                                variant: "soft",
                                children: (0, a.jsx)(u.wO2, {
                                  fontSize: "16px",
                                }),
                              }),
                            ],
                          }),
                        }),
                      ],
                    }),
                (0, a.jsxs)("div", {
                  className: f().box3,
                  style: {
                    ...(0, v.ds)("height", this.props.height || "450px", [
                      "height",
                    ]),
                  },
                  children: [
                    null == this.state.data
                      ? (0, a.jsxs)("div", {
                          className: f().box4,
                          children: [
                            (0, a.jsx)("div", {
                              children: (0, a.jsx)(g.VWY, { fontSize: "20px" }),
                            }),
                            (0, a.jsx)("div", {
                              className: f().box5,
                              children: this.props.t("nodata"),
                            }),
                          ],
                        })
                      : "",
                    (0, a.jsx)(c.A, {
                      chartId: this.props.chartId,
                      title: t,
                      load: this.state.loading,
                      mini: this.props.mini,
                      option: this.state.option,
                    }),
                  ],
                }),
                (0, a.jsx)(b.A, {
                  onRef: (t) => (this.needLoginBoxRef = t),
                  href: "/login?act=liqmap",
                }),
              ],
            });
          }
        }
        let j = (0, n.CI)()(_);
      },
      23293: (t, e, s) => {
        "use strict";
        (s.r(e), s.d(e, { default: () => S }));
        var a = s(6029),
          i = s(55729),
          n = s(83617),
          o = s(62770),
          l = s(7197),
          r = s(63813),
          h = s(9142),
          d = s(68710),
          c = s(40083),
          p = s(68635),
          m = s(35850),
          x = s(16647);
        s(70218);
        var u = s(45411),
          g = s(30327),
          b = s(29941),
          y = s(98197),
          f = s.n(y),
          v = s(73696),
          _ = s(20595);
        let j = {
          [`& .${_.A.indicator}`]: {
            transition: "0.2s",
            [`&.${_.A.expanded}`]: { transform: "rotate(-180deg)" },
          },
        };
        class C extends i.Component {
          constructor(t) {
            (super(t),
              (this.delayTime = 300),
              t.onRef && t.onRef(this),
              (this.needLoginBoxRef = (0, i.createRef)()),
              (this.state = {
                limit: 1500,
                time: 1,
                loading: !0,
                tickers: [],
                price: "",
                exName: "Binance",
                coin: "BTC/USDT",
                symbol: "Binance_BTCUSDT",
                search_str: "",
                data: {},
                option: {},
                chartStyle: "bar",
                ...t,
              }));
          }
          componentDidMount() {
            (this.getCoins(),
              this.props.liqmaptime
                ? this.onChangeTime(null, this.props.liqmaptime)
                : this.getData(),
              this.setState({ innerWidth: window?.innerWidth }));
          }
          onChangeState(t) {
            (t.symbol && this.onChangeSymbol(null, t.symbol),
              t.timeType && this.onChangeTime(null, t.timeType),
              t.refreshTime &&
                this.setState({ loading: !0 }, () => {
                  this.getData();
                }));
          }
          async getCoins() {
            let { data: t } = await (0, p.t2D)({
                keyword: this.state.search_str,
              }),
              e = [];
            for (let s = 0; s < t.length; s++) 1 == t[s].type && e.push(t[s]);
            this.setState({ tickers: e, loading_coin: !1 });
          }
          async getData() {
            let { data: t, code: e } = await (0, p.iuX)({
              merge: !0,
              symbol: this.state.symbol,
              interval: this.state.time,
              limit: this.state.limit,
            });
            "40000" == e
              ? this.needLoginBoxRef.onOpen()
              : (t ||
                  this.setState({ data: null, loading: !1 }, () => {
                    this.renderChart();
                  }),
                this.setState({ data: t, loading: !1 }, () => {
                  this.renderChart();
                }));
          }
          getTokenSearch(t) {
            this.setState({ loading_coin: !0, search_str: t }, () => {
              this.getCoins();
            });
          }
          async onInputChange(t, e) {
            t?.type &&
              "change" == t.type &&
              (this.setState({ loading_coin: !0 }),
              this.searchTimeout && clearTimeout(this.searchTimeout),
              (this.searchTimeout = setTimeout(
                this.getTokenSearch.bind(this),
                this.delayTime,
                e,
              )));
          }
          onChangeSymbol(t, e) {
            this.setState(
              {
                loading: !0,
                symbol: `${e.exchangeName}_${e.originalSymbol}`,
                exName: e.exchangeName,
                coin: `${e.symbol}/${e.quoteCurrency}`,
              },
              () => {
                this.getData();
              },
            );
          }
          async renderChart() {
            if (null == this.state.data)
              return void this.setState({ option: {} });
            let t = Object.keys(this.state.data.liqMapV2),
              e = `${Number(this.state.data.lastPrice)}`,
              s = Number(this.state.data.lastPrice);
            t.push(s);
            let a = {};
            t.map((e, s) => {
              t[s] = Number(e);
            });
            let i = [],
              o = [],
              l = 0,
              r = 0;
            (t = t.sort((t, e) => t - e)).map((t, e) => {
              this.state.data.liqMapV2[t]?.map((e) => {
                let [s, i, n, o] = e;
                (a[n] || (a[n] = {}), (a[n][t] = i));
              });
            });
            let h = {};
            (Object.keys(a).map((t) => {
              h[t] = [];
            }),
              t.map((t, e) => {
                Object.keys(a).map((s) => {
                  a[s][t] ? (h[s][e] = Number(a[s][t])) : (h[s][e] = 0);
                });
              }));
            for (let s = 0; s < t.length; s++)
              (t[s] < e
                ? (l += 0)
                : Object.keys(a).map((e) => {
                    a[e][t[s]] ? (l += Number(a[e][t[s]])) : (l += 0);
                  }),
                i.push(0 == l ? null : l));
            for (let s = t.length - 1; s >= 0; s--)
              (t[s] >= e
                ? (r += 0)
                : Object.keys(a).map((e) => {
                    a[e][t[s]] ? (r += Number(a[e][t[s]])) : (r += 0);
                  }),
                o.push(0 == r ? null : r));
            o.reverse();
            var d = this,
              c = [
                {
                  uniform_style: "no",
                  name: "",
                  type: "line",
                  markLine: {
                    animation: !1,
                    symbol: ["none", "arrow"],
                    lineStyle: {
                      normal: {
                        type: "dashed",
                        width: 2,
                        color: "#f5222d",
                        cap: "butt",
                      },
                    },
                    data: [
                      {
                        show: !1,
                        name: `${this.props.t("tb.current_price")}`,
                        label: {
                          show: !0,
                          position: "end",
                          formatter: `{b}:${e}`,
                        },
                        xAxis: e,
                      },
                    ],
                  },
                },
                {
                  name: this.props.t("lab.liqmap_short_count"),
                  type: "line",
                  areaStyle: { opacity: 0.1 },
                  data: i,
                  yAxisIndex: 1,
                  itemStyle: { color: (0, m.zZ)() },
                },
                {
                  name: this.props.t("lab.liqmap_long_count"),
                  type: "line",
                  areaStyle: { opacity: 0.1 },
                  data: o,
                  yAxisIndex: 1,
                  itemStyle: { color: (0, m.jk)() },
                },
              ];
            let p = {
              100: "#F08833",
              50: "#ffc400",
              25: "#6188ff",
              10: "#81c1ec",
              5: "#8bd6d9",
            };
            Object.keys(h).map((t, e) => {
              c.push({
                name: this.props.t("liqmap.lv", { lv: t }),
                type: "bar",
                stack: "liq",
                data: h[t],
                itemStyle: { color: p[t] },
              });
            });
            var u = {
              dataZoom: (0, m.Gz)(0, 100, x.A.getState().theme),
              tooltip: {
                trigger: "axis",
                formatter: function (t) {
                  var e = [];
                  return (
                    t.forEach(function (t, s) {
                      t.seriesName ==
                      `${d.props.t("tb.price_symbol", { symbol: d.state.symbol })}`
                        ? e.push({
                            marker: t.marker,
                            name: t.seriesName,
                            value: t.value,
                            prefix: "$",
                            format: 0,
                          })
                        : null != t.value &&
                          t.value > 0 &&
                          e.push({
                            marker: t.marker,
                            name: t.seriesName,
                            value: t.value,
                            format: 3,
                          });
                    }),
                    (0, m.Bc)(t[0].axisValueLabel, e, n.Ru.language)
                  );
                },
              },
              xAxis: [{ log: !0, data: t }],
              yAxis: [
                {
                  prointerval: "manual",
                  min: function (t) {
                    return 0.98 * t.min;
                  },
                  max: function (t) {
                    return 1.1 * t.max;
                  },
                  axisLabel: {
                    formatter: function (t) {
                      return `${(0, m.kn)(t, n.Ru.language, 0)}`;
                    },
                  },
                  splitLine: { show: !0 },
                },
                {
                  prointerval: "manual",
                  min: function (t) {
                    return 0.98 * t.min;
                  },
                  max: function (t) {
                    return 1.1 * t.max;
                  },
                  axisLabel: {
                    formatter: function (t) {
                      return `${(0, m.kn)(t, n.Ru.language, 0)}`;
                    },
                  },
                  splitLine: { show: !0 },
                },
              ],
              series: c,
            };
            this.setState({ option: u });
          }
          onChangeTime(t, e) {
            let s, a;
            (1 == e && ((s = 1), (a = 1500)),
              7 == e && ((s = 5), (a = 2e3)),
              30 == e && ((s = 30), (a = 1440)),
              90 == e && ((s = "90d"), (a = 1440)),
              180 == e && ((s = "180d"), (a = 1440)),
              365 == e && ((s = "365d"), (a = 1440)),
              this.setState({ time: s, limit: a, loading: !0 }, () => {
                this.getData();
              }));
          }
          render() {
            let t = this.props.t("title.liqmap", {
              ex: this.state.exName,
              coin: this.state.coin,
            });
            return (0, a.jsxs)("div", {
              className: f().box1,
              children: [
                this.state.pure
                  ? ""
                  : (0, a.jsxs)("div", {
                      className: "dfsb",
                      children: [
                        (0, a.jsx)(l.o5, {
                          level: this.props.mini ? "h2" : "h1",
                          className: f().sxTypography6,
                          children: t,
                        }),
                        (0, a.jsx)("div", {
                          className: "ov8",
                          children: (0, a.jsxs)("div", {
                            className: `${f().stack2} cg-stack`,
                            children: [
                              (0, a.jsx)(o.A, {
                                sx: {
                                  width:
                                    this.state.innerWidth > 600
                                      ? "100%"
                                      : "calc(100% - 150px)",
                                  ...j,
                                },
                                disableClearable: !0,
                                size: "sm",
                                filterOptions: (t) => t,
                                loading: this.state.loading_coin,
                                placeholder: this.state.t("search"),
                                onInputChange: this.onInputChange.bind(this),
                                onChange: this.onChangeSymbol.bind(this),
                                blurOnSelect: !0,
                                onFocus: (t, e) => {
                                  setTimeout(() => {
                                    t.target.value = "";
                                  }, 10);
                                },
                                defaultValue: {
                                  exchangeName: "Binance",
                                  symbol: "BTC",
                                  quoteCurrency: "USDT",
                                  type: 1,
                                },
                                getOptionLabel: (t) =>
                                  `${t.exchangeName} ${t.symbol}/${t.quoteCurrency} ${1 == t.type ? this.props.t("lab.perpetual") : t.type} ${1 != t.type ? dayjs(t.expiryDate).format("YYYY-MM-DD") : ""}`,
                                options: this.state.tickers,
                              }),
                              (0, a.jsxs)(h.A, {
                                sx: {
                                  width:
                                    this.state.innerWidth > 600
                                      ? "120px"
                                      : "80px",
                                },
                                onChange: this.onChangeTime.bind(this),
                                size: "sm",
                                defaultValue: 1,
                                className: "font2",
                                children: [
                                  (0, a.jsx)(d.A, {
                                    value: 1,
                                    children: this.props.t("time.d1"),
                                  }),
                                  (0, a.jsx)(d.A, {
                                    value: 7,
                                    children: this.props.t("time.d7"),
                                  }),
                                  (0, a.jsx)(d.A, {
                                    value: 30,
                                    children: this.props.t("time.d30"),
                                  }),
                                  (0, a.jsx)(d.A, {
                                    value: 90,
                                    children: this.props.t("time.number_day", {
                                      number: 90,
                                    }),
                                  }),
                                  (0, a.jsx)(d.A, {
                                    value: 180,
                                    children: this.props.t("time.number_day", {
                                      number: 180,
                                    }),
                                  }),
                                  (0, a.jsx)(d.A, {
                                    value: 365,
                                    children: this.props.t("time.y1"),
                                  }),
                                ],
                              }),
                              (0, a.jsx)(r.A, {
                                color: "neutral",
                                onClick: () => {
                                  this.setState({ loading: !0 }, () => {
                                    this.getData();
                                  });
                                },
                                variant: "soft",
                                children: (0, a.jsx)(u.wO2, {
                                  fontSize: "16px",
                                }),
                              }),
                            ],
                          }),
                        }),
                      ],
                    }),
                (0, a.jsxs)("div", {
                  className: f().box3,
                  style: {
                    ...(0, v.ds)("height", this.props.height || "450px", [
                      "height",
                    ]),
                  },
                  children: [
                    null == this.state.data
                      ? (0, a.jsxs)("div", {
                          className: f().box4,
                          children: [
                            (0, a.jsx)("div", {
                              children: (0, a.jsx)(g.VWY, { fontSize: "20px" }),
                            }),
                            (0, a.jsx)("div", {
                              className: f().box5,
                              children: this.props.t("nodata"),
                            }),
                          ],
                        })
                      : "",
                    (0, a.jsx)(c.A, {
                      chartId: this.props.chartId,
                      title: t,
                      load: this.state.loading,
                      mini: this.props.mini,
                      option: this.state.option,
                    }),
                  ],
                }),
                (0, a.jsx)(b.A, {
                  onRef: (t) => (this.needLoginBoxRef = t),
                  href: "/login?act=liqmap",
                }),
              ],
            });
          }
        }
        let S = (0, n.CI)()(C);
      },
      38762: (t, e, s) => {
        "use strict";
        s.d(e, { A: () => I });
        var a = s(6029),
          i = s(55729),
          n = s(83617),
          o = s(19750),
          l = s(64123),
          r = s(29685),
          h = s(7276),
          d = s(81278),
          c = s(29154),
          p = s(15188),
          m = s(18499),
          x = s(49493),
          u = s(82203),
          g = s.n(u),
          b = s(43635),
          y = s(93229),
          f = s(28747),
          v = s(65807),
          _ = s(4025),
          j = s(97117),
          C = s(86703),
          S = s(61061);
        function A(t, e, s) {
          let a = e.split(/[?#]/)[0].replace(/\/$/, "") || "/";
          return (
            s && a.startsWith(`/${s}/`) && (a = a.slice(s.length + 1)),
            t.find((t) => t.child.some((t) => t.child.some((t) => t.url === a)))
              ?.id ?? null
          );
        }
        class k extends i.Component {
          constructor(t) {
            super(t);
            let e = (0, S.R)(t.t);
            this.state = {
              mnav: !1,
              openCategoryId:
                A(e, t.router.asPath, t.router.locale) ??
                A(e, t.router.pathname),
              closedSectionIds: [],
              searchStr: "",
            };
          }
          componentDidMount() {
            this.props.onRef?.(this);
          }
          onOpenChild(t) {
            this.setState({ openCategoryId: t });
          }
          onOpenChildArr(t) {
            this.setState((e) => ({
              closedSectionIds: e.closedSectionIds.includes(t)
                ? e.closedSectionIds.filter((e) => e !== t)
                : [...e.closedSectionIds, t],
            }));
          }
          openNav() {
            this.setState({ mnav: !0 });
          }
          onClickLink() {
            this.state.mnav && this.setState({ mnav: !1 });
          }
          render() {
            var t, e;
            let s,
              {
                categories: i,
                searchResults: n,
                showSearch: l,
              } = ((t = (0, S.R)(this.props.t)),
              (s = (e = this.state.searchStr).trim().toLocaleLowerCase()),
              {
                categories: t.map((t) => ({
                  ...t,
                  size: t.child.reduce((t, e) => t + e.child.length, 0),
                })),
                searchResults:
                  "" === e
                    ? []
                    : t.flatMap((t) =>
                        t.child.flatMap((t) =>
                          t.child
                            .filter((t) =>
                              t.key.toLocaleLowerCase().includes(s),
                            )
                            .map((t) => ({ name: t.key, url: t.url })),
                        ),
                      ),
                showSearch: "" !== e,
              }),
              r = i.find((t) => t.id === this.state.openCategoryId),
              h = (0, a.jsxs)(o.A, {
                sx: { width: { xs: "100%", md: "255px" }, maxHeight: "100%" },
                children: [
                  (0, a.jsx)(o.A, {
                    sx: { padding: "10px" },
                    children: (0, a.jsx)(b.Ay, {
                      value: this.state.searchStr,
                      endDecorator:
                        "" == this.state.searchStr
                          ? ""
                          : (0, a.jsx)(o.A, {
                              onClick: () => {
                                this.setState({ searchStr: "" });
                              },
                              sx: {
                                backgroundColor:
                                  "var(--joy-palette-neutral-softHoverBg)",
                                width: "20px",
                                borderRadius: "2px",
                                height: "20px",
                                lineHeight: "20px",
                                textAlign: "center",
                                fontSize: "10px",
                              },
                              className: "shou",
                              children: "X",
                            }),
                      onChange: (t) => {
                        this.setState({ searchStr: t.target.value });
                      },
                      size: "sm",
                      placeholder: this.props.t("pronav.search_indicators"),
                    }),
                  }),
                  l
                    ? (0, a.jsx)(o.A, {
                        className: "pro-nav-box ovh",
                        children: n.map((t, e) =>
                          (0, a.jsx)(
                            g(),
                            {
                              prefetch: !1,
                              onClick: this.onClickLink.bind(this),
                              className:
                                this.props.router.pathname == t.url
                                  ? "isActive"
                                  : "",
                              href: `${t.url}`,
                              children: (0, a.jsx)(o.A, {
                                className: "pro-nav-box-item-child",
                                children: (0, a.jsx)(o.A, {
                                  className: "child-name",
                                  children: t.name,
                                }),
                              }),
                            },
                            `${t.url}-${e}`,
                          ),
                        ),
                      })
                    : (0, a.jsx)(o.A, {
                        className: "pro-nav-box ovh",
                        children: r
                          ? (0, a.jsxs)(a.Fragment, {
                              children: [
                                (0, a.jsx)(o.A, {
                                  className: "pro-nav-box-item-child",
                                  style: { justifyContent: "center" },
                                  onClick: () => {
                                    this.setState({
                                      openCategoryId: null,
                                      closedSectionIds: [],
                                    });
                                  },
                                  children: (0, a.jsxs)(o.A, {
                                    sx: {
                                      display: "flex",
                                      alignItems: "center",
                                    },
                                    children: [
                                      (0, a.jsx)(o.A, {
                                        sx: { display: "flex" },
                                        children: (0, a.jsx)(j.NEn, {}),
                                      }),
                                      (0, a.jsx)(o.A, {
                                        sx: { paddingLeft: "8px" },
                                        children: this.props.t(
                                          "pronav.return_all_types",
                                        ),
                                      }),
                                    ],
                                  }),
                                }),
                                r.child.map((t) =>
                                  (0, a.jsxs)(
                                    o.A,
                                    {
                                      children: [
                                        (0, a.jsxs)(o.A, {
                                          className: "pro-nav-box-item-child",
                                          onClick: this.onOpenChildArr.bind(
                                            this,
                                            t.id,
                                          ),
                                          children: [
                                            (0, a.jsxs)(o.A, {
                                              sx: {
                                                display: "flex",
                                                alignItems: "center",
                                              },
                                              children: [
                                                (0, a.jsx)(o.A, {
                                                  sx: { display: "flex" },
                                                  children:
                                                    -1 !=
                                                    this.state.closedSectionIds.indexOf(
                                                      t.id,
                                                    )
                                                      ? (0, a.jsx)(_._PQ, {})
                                                      : (0, a.jsx)(_.caT, {}),
                                                }),
                                                (0, a.jsx)(o.A, {
                                                  sx: {
                                                    paddingLeft: "8px",
                                                    fontSize: "12px",
                                                  },
                                                  children: t.category,
                                                }),
                                              ],
                                            }),
                                            (0, a.jsx)(o.A, {
                                              sx: { display: "flex" },
                                              children: (0, a.jsx)(o.A, {
                                                sx: { paddingRight: "8px" },
                                                children:
                                                  -1 !=
                                                  this.state.closedSectionIds.indexOf(
                                                    t.id,
                                                  )
                                                    ? (0, a.jsx)(C.G7L, {})
                                                    : (0, a.jsx)(C.t09, {}),
                                              }),
                                            }),
                                          ],
                                        }),
                                        -1 ==
                                        this.state.closedSectionIds.indexOf(
                                          t.id,
                                        )
                                          ? t.child.map((e) =>
                                              (0, a.jsx)(
                                                g(),
                                                {
                                                  prefetch: !1,
                                                  onClick:
                                                    this.onClickLink.bind(this),
                                                  className:
                                                    this.props.router
                                                      .pathname == e.url
                                                      ? "isActive"
                                                      : "",
                                                  href: `${e.url}`,
                                                  children: (0, a.jsx)(o.A, {
                                                    className:
                                                      "pro-nav-box-item-child",
                                                    children: (0, a.jsx)(o.A, {
                                                      className: "child-name",
                                                      children: e.key,
                                                    }),
                                                  }),
                                                },
                                                `${t.id}-${e.url}`,
                                              ),
                                            )
                                          : "",
                                      ],
                                    },
                                    t.id,
                                  ),
                                ),
                              ],
                            })
                          : i.map((t) =>
                              (0, a.jsxs)(
                                o.A,
                                {
                                  className: "pro-nav-box-item",
                                  onClick: this.onOpenChild.bind(this, t.id),
                                  children: [
                                    (0, a.jsxs)(o.A, {
                                      sx: {
                                        display: "flex",
                                        alignItems: "center",
                                      },
                                      children: [
                                        (0, a.jsx)(o.A, {
                                          sx: { display: "flex" },
                                          children: (0, a.jsx)(_.S6d, {}),
                                        }),
                                        (0, a.jsx)(o.A, {
                                          sx: { paddingLeft: "8px" },
                                          children: t.category,
                                        }),
                                      ],
                                    }),
                                    (0, a.jsxs)(o.A, {
                                      sx: { display: "flex" },
                                      children: [
                                        (0, a.jsx)(o.A, {
                                          sx: { paddingRight: "8px" },
                                          children: t.size,
                                        }),
                                        (0, a.jsx)(o.A, {
                                          className: "pro-nav-box-arrow",
                                          children: (0, a.jsx)(v.XFq, {}),
                                        }),
                                      ],
                                    }),
                                  ],
                                },
                                t.id,
                              ),
                            ),
                      }),
                ],
              });
            return (0, a.jsxs)(a.Fragment, {
              children: [
                (0, a.jsx)(o.A, {
                  sx: {
                    position: "sticky",
                    top: "0",
                    display: { xs: "none", md: "block" },
                  },
                  children: h,
                }),
                (0, a.jsx)(y.Ay, {
                  open: this.state.mnav,
                  onClose: () => {
                    this.setState({ mnav: !1 });
                  },
                  children: (0, a.jsx)(f.A, {
                    sx: {
                      width: "90vw",
                      height: "80vh",
                      maxHeight: "100%",
                      overflow: "hidden",
                      paddingBottom: "50px",
                    },
                    children: h,
                  }),
                }),
              ],
            });
          }
        }
        let T = (0, n.CI)()(k);
        var N = s(22797),
          q = s(68549),
          L = s(16647),
          w = s(14852),
          B = s(26215),
          $ = s(42493),
          R = s(31057);
        function I(t) {
          let e = (0, d.useRouter)(),
            [s, u] = (0, i.useState)(L.A.getState().pronav),
            [g, b] = (0, i.useState)(!0),
            [y, f] = (0, i.useState)(!1),
            [v, _] = (0, i.useState)(null),
            j = () => {
              null != L.A && null != L.A.getState() && u(L.A.getState().pronav);
            },
            C = () => {
              f(!0);
            };
          ((0, i.useEffect)(() => {
            L.A.subscribe(j);
          }, []),
            (0, i.useEffect)(() => {
              B.X.subscribe("open_pro_edit_show", C);
            }, []),
            (0, i.useEffect)(() => {
              window.dispatchEvent(new Event("resize"));
            }, [s]));
          let { t: S } = (0, n.Bd)("common");
          return (0, a.jsx)("div", {
            children: (0, a.jsxs)(p.Ay, {
              direction: (0, m.eX)(e.locale).dir,
              locale: {
                locale: "en",
                Table: {
                  emptyText: S("nodata"),
                  triggerDesc: S("sort.desc"),
                  triggerAsc: S("sort.asc"),
                  cancelSort: S("sort.cancel"),
                },
              },
              children: [
                (0, a.jsx)(h.A, {
                  cmmad: new Date().getTime() < x.p0,
                  pro: !0,
                  router: e,
                }),
                (0, a.jsxs)(o.A, {
                  sx: { display: "flex" },
                  children: [
                    s
                      ? (0, a.jsx)(o.A, {
                          sx: {
                            borderRight: "1px solid var(--joy-palette-divider)",
                          },
                          children: (0, a.jsx)(T, {
                            router: e,
                            onRef: (t) => _(t),
                          }),
                        })
                      : "",
                    (0, a.jsxs)(o.A, {
                      sx: { flex: 1 },
                      className: "prolayoutBox",
                      children: [
                        (0, a.jsx)(o.A, {
                          onClick: () => {
                            v?.openNav();
                          },
                          className: "pronavs shou",
                          sx: { paddingLeft: "20px", paddingTop: "20px" },
                          children: (0, a.jsx)(N.gDr, { fontSize: "24px" }),
                        }),
                        (0, a.jsxs)(o.A, {
                          className: `prolayout ${-1 == e.asPath.indexOf("/pro/dashboard") ? "" : "prolayoutmax"}`,
                          children: [
                            (0, a.jsxs)(o.A, {
                              className: "pronavh",
                              sx: { padding: "10px" },
                              children: [
                                (0, a.jsx)(l.Ay, {
                                  size: "sm",
                                  variant: "plain",
                                  color: "neutral",
                                  onClick: () => {
                                    ((0, w.qD)(!s), (0, r.eI)(!s));
                                  },
                                  children: s
                                    ? (0, a.jsx)(N.xpg, { fontSize: "18px" })
                                    : (0, a.jsx)(N.gDr, { fontSize: "18px" }),
                                }),
                                "",
                              ],
                            }),
                            n.Ru?.language == "zh"
                              ? (0, a.jsx)(o.A, {
                                  sx: {
                                    paddingLeft: "20px",
                                    paddingRight: "20px",
                                    paddingBottom: "20px",
                                  },
                                  children: (0, a.jsx)($.A, { router: e }),
                                })
                              : (0, a.jsx)(o.A, {
                                  sx: {
                                    paddingLeft: "20px",
                                    paddingRight: "20px",
                                    paddingBottom: "20px",
                                  },
                                  children: (0, a.jsx)(R.A, { router: e }),
                                }),
                            t.children,
                            (0, a.jsx)(q.A, { router: e }, e.asPath),
                          ],
                        }),
                        (0, a.jsx)(c.A, { pro: !0 }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          });
        }
      },
      50426: (t) => {
        t.exports = {
          box1: "LiqHeatmapPage_box1__LprMO",
          box2: "LiqHeatmapPage_box2__MONC5",
          box3: "LiqHeatmapPage_box3__4V_B_",
          stack4: "LiqHeatmapPage_stack4__Fazpe",
          box5: "LiqHeatmapPage_box5___X0aX",
          box6: "LiqHeatmapPage_box6__XSQg_",
        };
      },
      66938: (t) => {
        t.exports = {
          box1: "LiqMapEx_box1__V_qYQ",
          stack2: "LiqMapEx_stack2__bhNNl",
          box3: "LiqMapEx_box3__V6BVW",
          box4: "LiqMapEx_box4__dKtVX",
          box5: "LiqMapEx_box5__j28PK",
          sxTypography6: "LiqMapEx_sxTypography6__OUnyu",
          sxAutocomplete7: "LiqMapEx_sxAutocomplete7__EN1Xw",
          sxSelect8: "LiqMapEx_sxSelect8__rXB_4",
        };
      },
      98197: (t) => {
        t.exports = {
          box1: "LiqMap_box1__pQECW",
          stack2: "LiqMap_stack2__zGiY5",
          box3: "LiqMap_box3__1WP2w",
          box4: "LiqMap_box4__FY326",
          box5: "LiqMap_box5__3jyIu",
          sxTypography6: "LiqMap_sxTypography6__iZgyh",
          sxAutocomplete7: "LiqMap_sxAutocomplete7__avQzt",
          "MuiSelect-indicator": "LiqMap_MuiSelect-indicator__9INfW",
          "Mui-expanded": "LiqMap_Mui-expanded__gB5pN",
          sxSelect8: "LiqMap_sxSelect8__oad1s",
        };
      },
    },
  ]));
