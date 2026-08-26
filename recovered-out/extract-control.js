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
  } catch