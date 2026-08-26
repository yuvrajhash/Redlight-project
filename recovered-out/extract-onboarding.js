function Onboarding({ onComplete, className, ...props }) {
  const [step, setStep] = reactExports.useState("welcome");
  const [permsGranted, setPermsGranted] = reactExports.useState(false);
  const inverted = step === "permissions" && permsGranted;
  const [finishing, setFinishing] = reactExports.useState(false);
  const musicSection = {
    welcome: { start: 0, end: 27.5 },
    permissions: { start: 40, end: 142 },
    byok: { start: 144.3, end: Infinity }
  }[step];
  const { level, muted, toggleMute, playVoice, speaking, outputTrack, playOutro } = useOnboardingAudio(velvetCircuit, musicSection);
  reactExports.useEffect(() => {
    playVoice(onboardingScript[step].voice);
  }, [step, playVoice]);
  const finishOnboarding = reactExports.useCallback(async () => {
    setFinishing(true);
    await playOutro();
    onComplete();
  }, [onComplete, playOutro]);
  const pulseScale = useTransform(level, [0, 1], [1, 1.08]);
  const pulseBrightness = useTransform(level, [0, 1], [1, 1.5]);
  const pulseFilter = useMotionTemplate`brightness(${pulseBrightness})`;
  return (
    // Full-screen transparent overlay; the onboarding lives in a centered
    // floating card — same visual language as the Dynamic Island.
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("absolute inset-0", className), ...props, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      motion.div,
      {
        className: "absolute inset-0 flex items-center justify-center p-8 text-foreground",
        initial: false,
        animate: { opacity: finishing ? 0 : 1 },
        transition: { duration: finishing ? 2.6 : 0.3, ease: "easeInOut" },
        style: { pointerEvents: finishing ? "none" : void 0 },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.82)_100%)]" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(FridayOrb, { speaking, audioTrack: outputTrack }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex w-full max-w-lg flex-col items-center gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                className: cn(
                  "relative h-[350px] w-full overflow-hidden rounded-[24px] border border-border bg-black/90 shadow-2xl backdrop-blur-xl",
                  // True negative: black↔white, hues flipped. Animates the whole
                  // card (ASCII video included) when permissions are all granted.
                  "transition-[filter] duration-700 ease-in-out",
                  inverted && "[filter:invert(1)]"
                ),
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    motion.div,
                    {
                      className: "pointer-events-none absolute inset-0 z-0",
                      initial: false,
                      animate: asciiMotionByStep[step],
                      transition: { duration: 0.8, ease: "easeInOut" },
                      children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                        motion.div,
                        {
                          className: "absolute inset-0",
                          style: { scale: pulseScale, filter: pulseFilter },
                          children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute top-0 h-full w-full", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AsciiVideo, { fit: "contain", className: "pointer-events-none absolute inset-0 z-0" }) })
                        }
                      )
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-black/85 via-black/50 to-black/40" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative z-10 h-full", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { mode: "wait", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    motion.div,
                    {
                      initial: { opacity: 0, y: 8 },
                      animate: { opacity: 1, y: 0 },
                      exit: { opacity: 0, y: -8 },
                      transition: { duration: 0.4, ease: "easeInOut" },
                      className: "h-full",
                      children: [
                        step === "welcome" && /* @__PURE__ */ jsxRuntimeExports.jsx(IntroWelcome, { onStart: () => setStep("permissions") }),
                        step === "permissions" && /* @__PURE__ */ jsxRuntimeExports.jsx(
                          PermissionsStep,
                          {
                            onBack: () => setStep("welcome"),
                            onContinue: () => setStep("byok"),
                            onAllGrantedChange: setPermsGranted
                          }
                        ),
                        step === "byok" && /* @__PURE__ */ jsxRuntimeExports.jsx(BYOKSetup, { onComplete: finishOnboarding })
                      ]
                    },
                    step
                  ) }) })
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                onClick: toggleMute,
                "aria-label": muted ? "Unmute music" : "Mute music",
                title: muted ? "Unmute music" : "Mute music",
                className: "flex items-center gap-1.5 text-[11px] text-white lowercase",
                children: [
                  muted ? /* @__PURE__ */ jsxRuntimeExports.jsx(VolumeX, { className: "h-3 w-3" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Volume2, { className: "h-3 w-3" }),
                  muted ? "Music off" : "Music on"
                ]
              }
            )
          ] })
        ]
      }
    ) })
  );
}
const livekitVoice = "data:image/svg+xml,%3csvg%20version='1.2'%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20432%20270'%20width='432'%20height='270'%3e%3cstyle%3e%20.s0%20{%20fill:%20%23ffffff%20}%20%3c/style%3e%3cpath%20id='Path%200'%20class='s0'%20d='m208%2028.09c-2.47%200.53-6.7%202.19-9.38%203.69-2.68%201.49-6.11%204.3-7.61%206.22-1.51%201.92-3.59%205.08-4.62%207-1.81%203.35-1.89%207.17-1.89%2092v88.5c3.37%206.98%206.07%2010.73%208.17%2012.84%202.11%202.11%206.08%204.94%208.83%206.29%203.78%201.86%206.71%202.48%2012%202.55%205.39%200.07%208.26-0.47%2012.5-2.36%203.03-1.34%207.27-4.22%209.43-6.38%202.17-2.17%204.97-6.19%206.24-8.94l2.31-5%200.02-174.5c-5.49-10.48-8.05-13.57-11.5-16.15-2.75-2.06-6.57-4.2-8.5-4.75-1.93-0.56-5.3-1.23-7.5-1.49-2.2-0.26-6.03-0.04-8.5%200.48zm161.95%2073.17c-2.51%200.68-6.38%202.57-8.61%204.2-2.24%201.63-5.22%204.33-6.64%206-1.42%201.67-3.6%205.29-4.86%208.04-2%204.39-2.28%206.58-2.27%2018%200.01%2011.76%200.25%2013.52%202.53%2018.5%201.39%203.03%204.3%207.27%206.46%209.44%202.17%202.16%206.42%205.06%209.44%206.45%204.09%201.86%207.17%202.5%2012%202.49%204.42-0.01%207.94-0.67%2011-2.07%202.48-1.14%206.46-3.81%208.85-5.94%202.39-2.13%205.54-6.34%207-9.37%202.48-5.14%202.65-6.41%202.65-19.5%200-12.83-0.21-14.45-2.5-19.4-1.4-3.01-4.49-7.18-7-9.45-2.48-2.23-6.52-4.92-9-5.98-2.48-1.05-6.75-2.08-9.5-2.29-2.75-0.2-7.05%200.2-9.55%200.88zm-334.95%2017.59c-1.37%200.42-4.19%201.76-6.25%202.96-2.09%201.22-4.58%203.85-5.63%205.94-1.03%202.06-2.18%205.1-2.56%206.75-0.38%201.65-0.21%204.91%200.38%207.25%200.58%202.34%202.52%205.88%204.31%207.88%201.79%201.99%204.49%204.24%206%205%202%201%207.32%201.37%2019.5%201.38%2016.62%200.02%2016.78-0.01%2020.98-2.75%202.33-1.52%205.22-4.56%206.42-6.76%201.43-2.61%202.19-5.74%202.19-9%200-3.42-0.76-6.38-2.42-9.36-1.53-2.75-4.08-5.33-6.92-7-4.25-2.49-5.32-2.65-19-2.85-7.97-0.11-15.62%200.14-17%200.56zm250.5-54.62c-1.65%200.59-4.8%202.29-7%203.78-2.2%201.49-5.22%204.47-6.71%206.6-1.49%202.14-3.41%205.91-4.27%208.39-1.34%203.85-1.56%2011.75-1.54%2054.75%200.02%2047.07%200.14%2050.58%201.94%2055.5%201.22%203.33%203.69%207.01%206.75%2010.08%203.07%203.06%206.75%205.53%2010.08%206.75%203.01%201.1%207.81%201.92%2011.25%201.92%203.53%200%208.16-0.81%2011.25-1.97%203.17-1.19%206.89-3.67%209.4-6.25%202.28-2.35%205.2-6.31%206.5-8.78l2.35-4.5v-106c-4.06-7.75-7.46-12.03-10.18-14.5-2.71-2.48-6.71-5.06-8.88-5.73-2.17-0.68-7.09-1.21-10.94-1.17-3.85%200.03-8.35%200.54-10%201.13zm-166%2031.07c-2.75%201.31-6.69%204.26-8.75%206.54-2.06%202.29-4.76%206.07-6%208.41-2.14%204.05-2.25%205.32-2.25%2027.25v23c4.65%208.33%207.58%2012.19%209.5%2013.94%201.92%201.75%206.2%204.21%209.5%205.47%204.73%201.8%207.38%202.19%2012.5%201.84%203.57-0.24%208.53-1.33%2011-2.41%202.47-1.08%206.27-3.74%208.44-5.9%202.16-2.17%205.07-6.42%206.46-9.44%202.32-5.05%202.56-6.89%202.92-22.5%200.23-10.28-0.07-19.37-0.76-23-0.63-3.3-1.91-7.56-2.85-9.46-0.94-1.91-3.28-5.13-5.21-7.16-1.93-2.03-5.53-4.75-8-6.04-3.48-1.81-6.42-2.41-13-2.63-7.26-0.25-9.23%200.06-13.5%202.09z'/%3e%3c/svg%3e";
const captureSfx = "" + new URL("dynamic-island-screen-capture-sound-2-DRchIjT2.mp3", import.meta.url).href;
const AUTO_HIDE_MS = 13e3;
const PRIMARY_COUNT = 6;
function SearchSourcesPanel() {
  const [sources, setSources] = reactExports.useState([]);
  const [visible, setVisible] = reactExports.useState(false);
  const [expanded, setExpanded] = reactExports.useState(false);
  const hideTimer = reactExports.useRef(null);
  reactExports.useEffect(() => {
    const handle = (_event, payload) => {
      const next = payload?.sources ?? [];
      if (!next.length) return;
      setSources(next);
      setExpanded(false);
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    };
    window.electron.ipcRenderer.on("search-sources", handle);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      window.electron.ipcRenderer.removeAllListeners("search-sources");
    };
  }, []);
  const enableMouse = () => window.electron.ipcRenderer.send("set-ignore-mouse-events", false);
  const disableMouse = () => window.electron.ipcRenderer.send("set-ignore-mouse-events", true, { forward: true });
  const openSource = (url) => {
    window.open(url, "_blank");
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    visible && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "source-viz-glow" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "fixed right-4 top-24 z-50 flex flex-col items-end gap-5",
        onMouseEnter: enableMouse,
        onMouseLeave: disableMouse,
        style: { perspective: 1200 },
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(AnimatePresence, { children: [
          visible && (expanded ? sources : sources.slice(0, PRIMARY_COUNT)).map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            motion.button,
            {
              type: "button",
              onClick: () => openSource(s.url),
              initial: { opacity: 0, x: 40, rotateY: -24, rotateX: 6, z: -40 },
              animate: { opacity: 0.45, x: 0, rotateY: -24, rotateX: 6, z: -40 },
              exit: { opacity: 0, x: 40, rotateY: -24, rotateX: 6, z: -40 },
              transition: { duration: 0.28, delay: i * 0.045, ease: "easeInOut" },
              whileHover: {
                opacity: 1,
                scale: 1.08,
                transition: { duration: 0.14, ease: "easeInOut" }
              },
              style: { transformPerspective: 900, transformOrigin: "right center" },
              className: "group h-full w-48 cursor-pointer animate-border-spin rounded-[22px] bg-[linear-gradient(var(--border-angle),var(--color-gray-100),color-mix(in_oklab,var(--color-gray-100)_30%,transparent),transparent,transparent,var(--color-gray-100))] p-[1px] shadow-2xl [transform-style:preserve-3d]",
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full flex-col justify-between gap-3 rounded-[21px] bg-gray-950 px-3.5 py-3 text-left shadow-[0_8px_30px_color-mix(in_oklab,var(--color-gray-950)_50%,transparent)] backdrop-blur-xl", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 items-center gap-2.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-700/40", children: s.favicon ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: s.favicon, alt: "", className: "h-5 w-5 object-contain" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-gray-400", children: s.title.charAt(0).toUpperCase() }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate text-sm font-semibold text-gray-50", children: s.title })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "w-full truncate text-[10px] text-gray-500", children: s.url })
              ] })
            },
            `${s.url}-${i}`
          )),
          visible && !expanded && sources.length > PRIMARY_COUNT && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            motion.button,
            {
              type: "button",
              onClick: () => setExpanded(true),
              initial: { opacity: 0, x: 40 },
              animate: { opacity: 0.6, x: 0 },
              exit: { opacity: 0, x: 40 },
              transition: { duration: 0.24, delay: PRIMARY_COUNT * 0.045, ease: "easeInOut" },
              whileHover: { opacity: 1, scale: 1.06, transition: { duration: 0.14 } },
              className: "cursor-pointer rounded-full border border-gray-700/60 bg-gray-950/80 px-4 py-1.5 text-xs font-semibold text-gray-300 shadow-xl backdrop-blur-xl",
              children: [
                "+",
                sources.length - PRIMARY_COUNT,
                " more"
              ]
            },
            "more-pill"
          )
        ] })
      }
    )
  ] });
}
const GrowwLogo = "" + new URL("groww_logo-CoUr_zl9.webp", import.meta.url).href;
function StockGraphCard() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-full", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-1.5 px-2 py-2 bg-slate-600/15 text-white rounded-xl font-sans overflow-hidden", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between items-start mb-2 -ml-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: GrowwLogo, alt: "Groww", className: "w-9 h-9" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-start justify-center", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-zinc-400 text-[11px] font-semibold tracking-wide", children: "GROWW" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-zinc-100 text-[11px] font-medium", children: "Billionbrains Gara.." })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-end leading-tight mt-0.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-zinc-400 text-[10px] font-medium", children: "updated" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-zinc-100 text-[10px] font-semibold", children: "2m ago" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-start gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-normal tracking-tight", children: "₹ 184.89" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col justify-end text-[#ef4444]", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] font-semibold tracking-wide", children: "-₹2.46" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1 text-[10px] font-bold", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CircleArrowDown, { className: "w-3 h-3 fill-[#ef4444] text-black", strokeWidth: 1.5 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "1.31%" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative w-full h-[40px] -mx-1 -mt-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "svg",
      {
        viewBox: "0 0 100 40",
        className: "w-full h-full overflow-visible",
        preserveAspectRatio: "none",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("defs", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("linearGradient", { id: "chart-gradient", x1: "0", x2: "0", y1: "0", y2: "1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "0%", stopColor: "#ef4444", stopOpacity: "0.25" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "100%", stopColor: "#ef4444", stopOpacity: "0" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "line",
            {
              x1: "0",
              y1: "26",
              x2: "100",
              y2: "26",
              stroke: "#52525B",
              strokeWidth: "1",
              strokeDasharray: "2 2"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "path",
            {
              d: "M0 24 L5 23 L10 25 L15 19 L20 20 L25 19 L28 25 L32 37 L38 36 L43 25 L48 24 L55 24 L60 22 L65 25 L75 23 L80 20 L85 24 L90 23 L95 19 L100 21 L100 40 L0 40 Z",
              fill: "url(#chart-gradient)"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "path",
            {
              d: "M0 24 L5 23 L10 25 L15 19 L20 20 L25 19 L28 25 L32 37 L38 36 L43 25 L48 24 L55 24 L60 22 L65 25 L75 23 L80 20 L85 24 L90 23 L95 19 L100 21",
              fill: "none",
              stroke: "#ef4444",
              strokeWidth: "1.5",
              vectorEffect: "non-scaling-stroke",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          )
        ]
      }
    ) })
  ] }) });
}
function ComputerUseCard({
  title = "Computer-Use",
  status = "FRIDAY is operating your screen"
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-full", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative mx-1.5 overflow-hidden rounded-xl border border-[#4db8ffff]/20 bg-[#4db8ffff]/[0.08] px-3 py-2.5 font-sans text-white", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "island-shimmer pointer-events-none absolute inset-0" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4db8ffff]/15", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Cpu, { className: "h-4 w-4 text-[#4db8ffff]", strokeWidth: 2 }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4db8ffff] opacity-75" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-black bg-[#4db8ffff]" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-col", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[11px] font-bold tracking-wider text-[#4db8ffff]", children: "F.R.I.D.A.Y." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rounded-full bg-[#4db8ffff]/15 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-[#4db8ffff]", children: title })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex items-center text-[11px] font-medium text-zinc-200", children: status })
      ] })
    ] })
  ] }) });
}
const FridaySessionContext = reactExports.createContext(null);
function useFridaySessionContext() {
  const ctx = reactExports.useContext(FridaySessionContext);
  if (!ctx) {
    throw new Error("useFridaySessionContext must be used within <FridaySessionContext.Provider>");
  }
  return ctx;
}
function SettingsPanel() {
  const { saveApiKey, validateOpenAiKey } = useStore();
  const { selectedMicId, setMicDevice, restart } = useFridaySessionContext();
  const [mics, setMics] = reactExports.useState([]);
  const [openaiKey, setOpenaiKey] = reactExports.useState("");
  const [keyState, setKeyState] = reactExports.useState("idle");
  const [keyError, setKeyError] = reactExports.useState("");
  reactExports.useEffect(() => {
    const refresh = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMics(devices.filter((d) => d.kind === "audioinput"));
    };
    refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refresh);
  }, []);
  const handleSaveKey = async (e) => {
    e.preventDefault();
    const key = openaiKey.trim();
    setKeyError("");
    if (!key.startsWith("sk-")) {
      setKeyState("error");
      setKeyError(`That doesn't look like an OpenAI key (should start with "sk-").`);
      return;
    }
    setKeyState("saving");
    try {
      const valid = await validateOpenAiKey(key);
      if (!valid) throw new Error("That key didn't work. Check it's active with billing.");
      await saveApiKey("openai", key);
      setOpenaiKey("");
      setKeyState("saved");
      restart();
    } catch (err) {
      setKeyState("error");
      setKeyError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-full", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-1.5 rounded-xl border border-white/10 bg-slate-600/15 px-3 py-2.5 font-sans text-white", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "label",
      {
        htmlFor: "settings-mic",
        className: "mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Mic, { className: "h-3 w-3" }),
          " Microphone"
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "select",
      {
        id: "settings-mic",
        value: selectedMicId,
        onChange: (e) => void setMicDevice(e.target.value),
        className: "mb-3 w-full min-w-0 cursor-pointer truncate rounded-lg border border-input bg-black/40 px-2.5 py-1.5 text-[11px] text-zinc-100 outline-none transition-colors focus:border-[#1FD5F9]/60",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", className: "bg-zinc-900 font-medium text-zinc-400", children: "System default" }),
          mics.map((m, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: m.deviceId, className: "bg-zinc-900 text-zinc-100", children: m.label || `Microphone ${i + 1}` }, m.deviceId))
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleSaveKey, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "label",
        {
          htmlFor: "settings-openai-key",
          className: "mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(KeyRound, { className: "h-3 w-3" }),
            " OpenAI API Key"
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            id: "settings-openai-key",
            type: "password",
            placeholder: "sk-…",
            value: openaiKey,
            onChange: (e) => {
              setOpenaiKey(e.target.value);
              if (keyState !== "idle") setKeyState("idle");
            },
            className: "h-7 w-full min-w-0 rounded-lg border border-input bg-black/40 px-2.5 text-[11px] tracking-wide text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-[#1FD5F9]/60"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "submit",
            disabled: keyState === "saving" || !openaiKey.trim(),
            className: "flex h-7 shrink-0 items-center gap-1 rounded-lg bg-[#1FD5F9]/15 px-3 text-[11px] font-semibold text-[#1FD5F9] transition-colors hover:bg-[#1FD5F9]/25 disabled:cursor-not-allowed disabled:opacity-40",
            children: keyState === "saving" ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-3 w-3 animate-spin" }) : keyState === "saved" ? /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "h-3 w-3" }) : "Save"
          }
        )
      ] }),
      keyState === "error" ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-[10px] font-medium text-red-400", children: keyError }) : keyState === "saved" ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-[10px] font-medium text-[#1FD5F9]", children: "Key updated — reconnecting Friday…" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-[10px] text-zinc-500", children: "Saved encrypted locally. Replaces current key." })
    ] })
  ] }) });
}
const ISLAND_PANELS = {
  stock: { component: StockGraphCard, autoCloseMs: 1e4 },
  control: { component: ComputerUseCard },
  settings: { component: SettingsPanel }
};
const METADATA$1 = {
  "version": "0.2.1"
};
async function safeExecute(fn) {
  try {
    return [null, await fn()];
  } catch (error) {
    return [error, null];
  }
}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
class $ZodRegistry {
  constructor() {
    this._map = /* @__PURE__ */ new Map();
    this._idmap = /* @__PURE__ */ new Map();
  }
  add(schema, ..._meta) {
    const meta = _meta[0];
    this._map.set(schema, meta);
    if (meta && typeof meta === "object" && "id" in meta) {
      if (this._idmap.has(meta.id)) {
        throw new Error(`ID ${meta.id} already exists in the registry`);
      }
      this._idmap.set(meta.id, schema);
    }
    return this;
  }
  clear() {
    this._map = /* @__PURE__ */ new Map();
    this._idmap = /* @__PURE__ */ new Map();
    return this;
  }
  remove(schema) {
    const meta = this._map.get(schema);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.delete(meta.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      return { ...pm, ...this._map.get(schema) };
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
}
function registry() {
  return new $ZodRegistry();
}
const globalRegistry = /* @__PURE__ */ registry();
class JSONSchemaGenerator {
  constructor(params) {
    this.counter = 0;
    this.metadataRegistry = params?.metadata ?? globalRegistry;
    this.target = params?.target ?? "draft-2020-12";
    this.unrepresentable = params?.unrepresentable ?? "throw";
    this.override = params?.override ?? (() => {
    });
    this.io = params?.io ?? "output";
    this.seen = /* @__PURE__ */ new Map();
  }
  process(schema, _params = { path: [], schemaPath: [] }) {
    var _a2;
    const def = schema._zod.def;
    const formatMap = {
      guid: "uuid",
      url: "uri",
      datetime: "date-time",
      json_string: "json-string",
      regex: ""
      // do not set
    };
    const seen = this.seen.get(schema);
    if (seen) {
      seen.count++;
      const isCycle = _params.schemaPath.includes(schema);
      if (isCycle) {
        seen.cycle = _params.path;
      }
      return seen.schema;
    }
    const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
    this.seen.set(schema, result);
    const overrideSchema = schema._zod.toJSONSchema?.();
    if (overrideSchema) {
      result.schema = overrideSchema;
    } else {
      const params = {
        ..._params,
        schemaPath: [..._params.schemaPath, schema],
        path: _params.path
      };
      const parent = schema._zod.parent;
      if (parent) {
        result.ref = parent;
        this.process(parent, params);
        this.seen.get(parent).isParent = true;
      } else {
        const _json = result.schema;
        switch (def.type) {
          case "string": {
            const json = _json;
            json.type = "string";
            const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
            if (typeof minimum === "number")
              json.minLength = minimum;
            if (typeof maximum === "number")
              json.maxLength = maximum;
            if (format) {
              json.format = formatMap[format] ?? format;
              if (json.format === "")
                delete json.format;
            }
            if (contentEncoding)
              json.contentEncoding = contentEncoding;
            if (patterns && patterns.size > 0) {
              const regexes = [...patterns];
              if (regexes.length === 1)
                json.pattern = regexes[0].source;
              else if (regexes.length > 1) {
                result.schema.allOf = [
                  ...regexes.map((regex) => ({
                    ...this.target === "draft-7" ? { type: "string" } : {},
                    pattern: regex.source
                  }))
                ];
              }
            }
            break;
          }
          case "number": {
            const json = _json;
            const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
            if (typeof format === "string" && format.includes("int"))
              json.type = "integer";
            else
              json.type = "number";
            if (typeof exclusiveMinimum === "number")
              json.exclusiveMinimum = exclusiveMinimum;
            if (typeof minimum === "number") {
              json.minimum = minimum;
              if (typeof exclusiveMinimum === "number") {
                if (exclusiveMinimum >= minimum)
                  delete json.minimum;
                else
                  delete json.exclusiveMinimum;
              }
            }
            if (typeof exclusiveMaximum === "number")
              json.exclusiveMaximum = exclusiveMaximum;
            if (typeof maximum === "number") {
              json.maximum = maximum;
              if (typeof exclusiveMaximum === "number") {
                if (exclusiveMaximum <= maximum)
                  delete json.maximum;
                else
                  delete json.exclusiveMaximum;
              }
            }
            if (typeof multipleOf === "number")
              json.multipleOf = multipleOf;
            break;
          }
          case "boolean": {
            const json = _json;
            json.type = "boolean";
            break;
          }
          case "bigint": {
            if (this.unrepresentable === "throw") {
              throw new Error("BigInt cannot be represented in JSON Schema");
            }
            break;
          }
          case "symbol": {
            if (this.unrepresentable === "throw") {
              throw new Error("Symbols cannot be represented in JSON Schema");
            }
            break;
          }
          case "null": {
            _json.type = "null";
            break;
          }
          case "any": {
            break;
          }
          case "unknown": {
            break;
          }
          case "undefined": {
            if (this.unrepresentable === "throw") {
              throw new Error("Undefined cannot be represented in JSON Schema");
            }
            break;
          }
          case "void": {
            if (this.unrepresentable === "throw") {
              throw new Error("Void cannot be represented in JSON Schema");
            }
            break;
          }
          case "never": {
            _json.not = {};
            break;
          }
          case "date": {
            if (this.unrepresentable === "throw") {
              throw new Error("Date cannot be represented in JSON Schema");
            }
            break;
          }
          case "array": {
            const json = _json;
            const { minimum, maximum } = schema._zod.bag;
            if (typeof minimum === "number")
              json.minItems = minimum;
            if (typeof maximum === "number")
              json.maxItems = maximum;
            json.type = "array";
            json.items = this.process(def.element, { ...params, path: [...params.path, "items"] });
            break;
          }
          case "object": {
            const json = _json;
            json.type = "object";
            json.properties = {};
            const shape = def.shape;
            for (const key in shape) {
              json.properties[key] = this.process(shape[key], {
                ...params,
                path: [...params.path, "properties", key]
              });
            }
            const allKeys = new Set(Object.keys(shape));
            const requiredKeys = new Set([...allKeys].filter((key) => {
              const v = def.shape[key]._zod;
              if (this.io === "input") {
                return v.optin === void 0;
              } else {
                return v.optout === void 0;
              }
            }));
            if (requiredKeys.size > 0) {
              json.required = Array.from(requiredKeys);
            }
            if (def.catchall?._zod.def.type === "never") {
              json.additionalProperties = false;
            } else if (!def.catchall) {
              if (this.io === "output")
                json.additionalProperties = false;
            } else if (def.catchall) {
              json.additionalProperties = this.process(def.catchall, {
                ...params,
                path: [...params.path, "additionalProperties"]
              });
            }
            break;
          }
          case "union": {
            const json = _json;
            json.anyOf = def.options.map((x, i) => this.process(x, {
              ...params,
              path: [...params.path, "anyOf", i]
            }));
            break;
          }
          case "intersection": {
            const json = _json;
            const a = this.process(def.left, {
              ...params,
              path: [...params.path, "allOf", 0]
            });
            const b = this.process(def.right, {
              ...params,
              path: [...params.path, "allOf", 1]
            });
            const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
            const allOf = [
              ...isSimpleIntersection(a) ? a.allOf : [a],
              ...isSimpleIntersection(b) ? b.allOf : [b]
            ];
            json.allOf = allOf;
            break;
          }
          case "tuple": {
            const json = _json;
            json.type = "array";
            const prefixItems = def.items.map((x, i) => this.process(x, { ...params, path: [...params.path, "prefixItems", i] }));
            if (this.target === "draft-2020-12") {
              json.prefixItems = prefixItems;
            } else {
              json.items = prefixItems;
            }
            if (def.rest) {
              const rest = this.process(def.rest, {
                ...params,
                path: [...params.path, "items"]
              });
              if (this.target === "draft-2020-12") {
                json.items = rest;
              } else {
                json.additionalItems = rest;
              }
            }
            if (def.rest) {
              json.items = this.process(def.rest, {
                ...params,
                path: [...params.path, "items"]
              });
            }
            const { minimum, maximum } = schema._zod.bag;
            if (typeof minimum === "number")
              json.minItems = minimum;
            if (typeof maximum === "number")
              json.maxItems = maximum;
            break;
          }
          case "record": {
            const json = _json;
            json.type = "object";
            json.propertyNames = this.process(def.keyType, { ...params, path: [...params.path, "propertyNames"] });
            json.additionalProperties = this.process(def.valueType, {
              ...params,
              path: [...params.path, "additionalProperties"]
            });
            break;
          }
          case "map": {
            if (this.unrepresentable === "throw") {
              throw new Error("Map cannot be represented in JSON Schema");
            }
            break;
          }
          case "set": {
            if (this.unrepresentable === "throw") {
              throw new Error("Set cannot be represented in JSON Schema");
            }
            break;
          }
          case "enum": {
            const json = _json;
            const values = getEnumValues(def.entries);
            if (values.every((v) => typeof v === "number"))
              json.type = "number";
            if (values.every((v) => typeof v === "string"))
              json.type = "string";
            json.enum = values;
            break;
          }
          case "literal": {
            const json = _json;
            const vals = [];
            for (const val of def.values) {
              if (val === void 0) {
                if (this.unrepresentable === "throw") {
                  throw new Error("Literal `undefined` cannot be represented in JSON Schema");
                }
              } else if (typeof val === "bigint") {
                if (this.unrepresentable === "throw") {
                  throw new Error("BigInt literals cannot be represented in JSON Schema");
                } else {
                  vals.push(Number(val));
                }
              } else {
                vals.push(val);
              }
            }
            if (vals.length === 0) ;
            else if (vals.length === 1) {
              const val = vals[0];
              json.type = val === null ? "null" : typeof val;
              json.const = val;
            } else {
              if (vals.every((v) => typeof v === "number"))
                json.type = "number";
              if (vals.every((v) => typeof v === "string"))
                json.type = "string";
              if (vals.every((v) => typeof v === "boolean"))
                json.type = "string";
              if (vals.every((v) => v === null))
                json.type = "null";
              json.enum = vals;
            }
            break;
          }
          case "file": {
            const json = _json;
            const file = {
              type: "string",
              format: "binary",
              contentEncoding: "binary"
            };
            const { minimum, maximum, mime } = schema._zod.bag;
            if (minimum !== void 0)
              file.minLength = minimum;
            if (maximum !== void 0)
              file.maxLength = maximum;
            if (mime) {
              if (mime.length === 1) {
                file.contentMediaType = mime[0];
                Object.assign(json, file);
              } else {
                json.anyOf = mime.map((m) => {
                  const mFile = { ...file, contentMediaType: m };
                  return mFile;
                });
              }
            } else {
              Object.assign(json, file);
            }
            break;
          }
          case "transform": {
            if (this.unrepresentable === "throw") {
              throw new Error("Transforms cannot be represented in JSON Schema");
            }
            break;
          }
          case "nullable": {
            const inner = this.process(def.innerType, params);
            _json.anyOf = [inner, { type: "null" }];
            break;
          }
          case "nonoptional": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            break;
          }
          case "success": {
            const json = _json;
            json.type = "boolean";
            break;
          }
          case "default": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            _json.default = JSON.parse(JSON.stringify(def.defaultValue));
            break;
          }
          case "prefault": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            if (this.io === "input")
              _json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
            break;
          }
          case "catch": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            let catchValue;
            try {
              catchValue = def.catchValue(void 0);
            } catch {
              throw new Error("Dynamic catch values are not supported in JSON Schema");
            }
            _json.default = catchValue;
            break;
          }
          case "nan": {
            if (this.unrepresentable === "throw") {
              throw new Error("NaN cannot be represented in JSON Schema");
            }
            break;
          }
          case "template_literal": {
            const json = _json;
            const pattern = schema._zod.pattern;
            if (!pattern)
              throw new Error("Pattern not found in template literal");
            json.type = "string";
            json.pattern = pattern.source;
            break;
          }
          case "pipe": {
            const innerType = this.io === "input" ? def.in._zod.def.type === "transform" ? def.out : def.in : def.out;
            this.process(innerType, params);
            result.ref = innerType;
            break;
          }
          case "readonly": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            _json.readOnly = true;
            break;
          }
          // passthrough types
          case "promise": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            break;
          }
          case "optional": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            break;
          }
          case "lazy": {
            const innerType = schema._zod.innerType;
            this.process(innerType, params);
            result.ref = innerType;
            break;
          }
          case "custom": {
            if (this.unrepresentable === "throw") {
              throw new Error("Custom types cannot be represented in JSON Schema");
            }
            break;
          }
        }
      }
    }
    const meta = this.metadataRegistry.get(schema);
    if (meta)
      Object.assign(result.schema, meta);
    if (this.io === "input" && isTransforming(schema)) {
      delete result.schema.examples;
      delete result.schema.default;
    }
    if (this.io === "input" && result.schema._prefault)
      (_a2 = result.schema).default ?? (_a2.default = result.schema._prefault);
    delete result.schema._prefault;
    const _result = this.seen.get(schema);
    return _result.schema;
  }
  emit(schema, _params) {
    const params = {
      cycles: _params?.cycles ?? "ref",
      reused: _params?.reused ?? "inline",
      // unrepresentable: _params?.unrepresentable ?? "throw",
      // uri: _params?.uri ?? ((id) => `${id}`),
      external: _params?.external ?? void 0
    };
    const root = this.seen.get(schema);
    if (!root)
      throw new Error("Unprocessed schema. This is a bug