function DynamicIslandApp() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DynamicIsland, {});
}
function DynamicIsland() {
  const [isExpanded, setIsExpanded] = reactExports.useState(false);
  const [isPanelOpen, setIsPanelOpen] = reactExports.useState(false);
  const [panelContent, setPanelContent] = reactExports.useState("stock");
  const [flashId, setFlashId] = reactExports.useState(0);
  const [isControlling, setIsControlling] = reactExports.useState(false);
  const [micMenuOpen, setMicMenuOpen] = reactExports.useState(false);
  const controllingRef = reactExports.useRef(false);
  const openTimerRef = reactExports.useRef(null);
  const session = useFridaySession();
  const { agentState, remoteTrack, micMode, setMicMode, micLive, pttActive } = session;
  const ActivePanel = ISLAND_PANELS[panelContent].component;
  const pttHotkey = /mac/i.test(navigator.userAgent) ? "Control + Option" : "Ctrl + Alt";
  const openPanel = reactExports.useCallback((key) => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    setPanelContent(key);
    setIsExpanded(true);
    openTimerRef.current = setTimeout(() => setIsPanelOpen(true), 50);
  }, []);
  const closePanel = reactExports.useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setIsPanelOpen(false);
    setIsExpanded(false);
  }, []);
  reactExports.useEffect(() => {
    console.log("[Friday] agentState:", agentState);
  }, [agentState]);
  reactExports.useEffect(() => {
    const handleTogglePanel = (_event, isOpen) => {
      if (isOpen) openPanel("stock");
      else closePanel();
    };
    window.electron.ipcRenderer.on("toggle-bottom-panel", handleTogglePanel);
    return () => {
      window.electron.ipcRenderer.removeAllListeners("toggle-bottom-panel");
    };
  }, [openPanel, closePanel]);
  reactExports.useEffect(() => {
    const handleFlash = () => {
      setFlashId((id2) => id2 + 1);
      const sound = new Audio(captureSfx);
      sound.volume = 0.4;
      sound.play().catch(() => {
      });
    };
    window.electron.ipcRenderer.on("screen-capture-flash", handleFlash);
    return () => {
      window.electron.ipcRenderer.removeAllListeners("screen-capture-flash");
    };
  }, []);
  reactExports.useEffect(() => {
    let idleTimer = null;
    const closeControl = () => {
      controllingRef.current = false;
      setIsControlling(false);
      closePanel();
    };
    const handleControl = (_event, payload) => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (payload.active) {
        if (!controllingRef.current) {
          controllingRef.current = true;
          setIsControlling(true);
          openPanel("control");
          const sound = new Audio(controlSfx);
          sound.volume = 0.4;
          sound.play().catch(() => {
          });
        }
        idleTimer = setTimeout(closeControl, 15e3);
      } else {
        closeControl();
      }
    };
    window.electron.ipcRenderer.on("computer-control", handleControl);
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.electron.ipcRenderer.removeAllListeners("computer-control");
    };
  }, [openPanel, closePanel]);
  reactExports.useEffect(() => {
    if (!isPanelOpen) return;
    const autoCloseMs = ISLAND_PANELS[panelContent].autoCloseMs;
    if (!autoCloseMs) return;
    const autoCloseTimeout = setTimeout(closePanel, autoCloseMs);
    return () => clearTimeout(autoCloseTimeout);
  }, [isPanelOpen, panelContent, closePanel]);
  const handleMouseEnter = () => {
    window.electron.ipcRenderer.send("set-ignore-mouse-events", false);
  };
  const handleMouseLeave = () => {
    window.electron.ipcRenderer.send("set-ignore-mouse-events", true, { forward: true });
  };
  const toggleSettings = reactExports.useCallback(() => {
    if (isPanelOpen && panelContent === "settings") closePanel();
    else openPanel("settings");
  }, [isPanelOpen, panelContent, openPanel, closePanel]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(FridaySessionContext.Provider, { value: session, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "w-screen h-screen bg-transparent flex flex-col items-center justify-start pt-7 overflow-hidden", children: [
    flashId > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "capture-flash-overlay" }, flashId),
    isControlling && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "control-glow-overlay" }),
    micMode === "ptt" && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: `mic-glow-overlay ${pttActive ? "mic-glow-active" : "mic-glow-inactive"}`
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SearchSourcesPanel, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: `group flex flex-col p-0 px-0 backdrop-blur-xl rounded-[24px] border shadow-2xl transition-all duration-400 ease-in-out cursor-pointer ${isExpanded ? "bg-black" : "bg-black/70 delay-[3000ms] hover:bg-black hover:delay-0"} ${isControlling ? "border-[#1FD5F9]/50 ring-2 ring-[#1FD5F9]/30" : "border-border"}`,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: `relative flex items-center justify-between transition-[gap] duration-400 ease-in-out ${isExpanded ? "gap-18" : "gap-0 group-hover:gap-18"}`,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-full flex items-center justify-center p-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                  AgentAudioVisualizerAura,
                  {
                    size: "md",
                    color: "#1FD5F9",
                    colorShift: 0.94,
                    state: agentState,
                    audioTrack: remoteTrack,
                    className: "p-0 m-0 max-h-15 max-w-15"
                  }
                ) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "div",
                  {
                    className: `flex flex-col overflow-hidden transition-[max-width,opacity] duration-400 ease-in-out ${isExpanded ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0 delay-[300ms] group-hover:max-w-[180px] group-hover:opacity-100 group-hover:delay-0"}`,
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pl-3 pr-4 flex flex-col justify-center min-w-[120px]", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-full bg-[linear-gradient(var(--border-angle),rgba(243,244,246,1),rgba(243,244,246,0.3),transparent,transparent,rgba(243,244,246,1))] p-[1px] animate-border-spin", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-4 rounded-full bg-black px-4 py-1.5 text-white", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: toggleSettings,
                          className: "flex items-center justify-center hover:opacity-70 transition-opacity",
                          title: "Settings",
                          children: /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: livekitVoice, alt: "Settings", className: "w-5" })
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: () => setMicMode(micMode === "always" ? "ptt" : "always"),
                          onMouseEnter: () => setMicMenuOpen(true),
                          onMouseLeave: () => setMicMenuOpen(false),
                          className: "flex items-center justify-center hover:opacity-70 transition-opacity",
                          title: micMode === "always" ? "Mic always on — click for push-to-talk" : `Push to talk — hold ${pttHotkey}; click to keep mic on`,
                          children: micLive ? /* @__PURE__ */ jsxRuntimeExports.jsx(Mic, { color: "white", className: "w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(MicOff, { color: "white", className: "w-4" })
                        }
                      )
                    ] }) }) })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: `pointer-events-none absolute right-0 top-full z-[60] mt-2.5 w-44 rounded-xl border border-white/10 bg-black/90 p-1.5 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out origin-top ${micMenuOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-1.5 scale-95"}`,
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-1 px-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-500", children: "Mic · click to switch" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "div",
                        {
                          className: `flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] ${micMode === "ptt" ? "bg-[#1FD5F9]/15 text-[#1FD5F9]" : "text-zinc-400"}`,
                          children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx(Hand, { className: "h-3.5 w-3.5 shrink-0" }),
                            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex flex-col leading-tight", children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: "Push to talk" }),
                              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-[9px] opacity-70", children: [
                                "Hold ",
                                pttHotkey
                              ] })
                            ] }),
                            micMode === "ptt" && /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "ml-auto h-3 w-3 shrink-0" })
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "div",
                        {
                          className: `mt-0.5 flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] ${micMode === "always" ? "bg-[#1FD5F9]/15 text-[#1FD5F9]" : "text-zinc-400"}`,
                          children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx(Mic, { className: "h-3.5 w-3.5 shrink-0" }),
                            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex flex-col leading-tight", children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: "Always on" }),
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[9px] opacity-70", children: "Mic stays live" })
                            ] }),
                            micMode === "always" && /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "ml-auto h-3 w-3 shrink-0" })
                          ]
                        }
                      )
                    ]
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: `grid w-0 min-w-full transition-all duration-400 ease-in-out ${isPanelOpen ? "grid-rows-[1fr] mt-2 opacity-100" : "grid-rows-[0fr] mt-0 opacity-0"}`,
              children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-hidden min-h-0 mb-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ActivePanel, {}) })
            }
          )
        ]
      }
    )
  ] }) });
}
function App() {
  const { initialOnboardingComplete } = useStore();
  const [onboarded, setOnboarded] = reactExports.useState(initialOnboardingComplete);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative h-screen w-screen overflow-hidden", children: [
    onboarded && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 z-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(DynamicIslandApp, {}) }),
    !onboarded && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 z-10", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Onboarding,
      {
        onComplete: async () => {
          await window.api.completeOnboarding();
          setOnboarded(true);
        }
      }
    ) })
  ] });
}
document.body.classList.add("overlay");
clientExports.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
);
