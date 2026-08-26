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
          className: "mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400