function createFridayTools({
  visionMode,
  controlBrain,
  inject
}) {
  const effectiveVisionMode = controlBrain === "realtime" ? "direct" : visionMode;
  const lookAtScreen = tool({
    name: "look_at_screen",
    description: `Sees the boss's screen to answer a question about what's on it. Call this whenever the boss refers to something on screen — "what is this", "read this", "what does this error say", "how do I fix this" — or any request using "this / that / here / it" pointing at the display. The screen changes constantly, so always call this fresh; never reuse an earlier look.`,
    parameters: objectType({
      question: stringType().describe(
        'What the boss wants to know about the screen, e.g. "what does this error mean". Phrase it as the actual question to answer from the screenshot.'
      )
    }),
    execute: async ({ question }) => {
      window.api.log("Tool", `look_at_screen (${effectiveVisionMode}): ${question}`);
      if (effectiveVisionMode === "subagent") {
        return await window.api.describeScreen(question);
      }
      const { image } = await window.api.captureScreen();
      if (!image) return "Could not capture the screen right now, boss.";
      inject({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_image", image_url: image, detail: "low" }]
        }
      });
      return "Screenshot captured and attached. Answer based only on what is actually visible in it.";
    }
  });
  const searchWeb = tool({
    name: "search_web",
    description: `Searches the live internet for current facts about ANYTHING — news, "what's happening today", a company, a person, a price, the weather, sports, an event. IMPORTANT: this runs in the BACKGROUND — it returns instantly so you can keep talking, then the answer comes back to you a few seconds later and you speak it then.`,
    parameters: objectType({
      query: stringType().describe('What to look up, in plain language, e.g. "latest on Tesla stock".')
    }),
    execute: async ({ query }) => {
      window.api.log("Tool", `search_web: ${query}`);
      const { busy } = await window.api.webSearch(query);
      if (busy) {
        return `You're already searching — do NOT call search_web again. Just say you're still looking ("Still pulling it up, boss.") and wait; the answer is on its way.`;
      }
      return `Search started in the background. Your ONLY job this turn is to say ONE short filler line that you're looking it up (e.g. "Looking into it, boss — one sec."). Do NOT answer the question, do NOT summarize, do NOT guess or use your own knowledge — it is stale. STOP after the filler line. The real answer will be delivered to you in a few seconds; speak ONLY that when it arrives.`;
    }
  });
  return [lookAtScreen, searchWeb, ...createControlTools(controlBrain)];
}
function createControlTools(controlBrain) {
  if (controlBrain === "realtime") {
    return [clickScreen, typeText, pressKey, scrollScreen];
  }
  return [controlComputer];
}
const controlComputer = tool({
  name: "control_computer",
  description: `Carries out a multi-step task directly on the boss's computer — opening apps, clicking, typing, navigating, searching, filling forms. Hand off the WHOLE task in plain language (e.g. "open Chrome and search for pizza", "play Daft Punk on Spotify", "close this window"). A specialist vision agent takes over, sees the screen, does the task step by step, and reports back what it did. Say a short filler line FIRST, then call this; it runs a few seconds.`,
  parameters: objectType({
    task: stringType().describe('The full task in plain language, e.g. "open Spotify and play Daft Punk".')
  }),
  execute: async ({ task }) => {
    window.api.log("Tool", `control_computer: ${task}`);
    return await window.api.controlComputer(task);
  }
});
const clickScreen = tool({
  name: "click_screen",
  description: "Clicks at a point on the screen. Coordinates are NORMALIZED to a 0–1000 grid where (0,0) is the top-left and (1000,1000) is the bottom-right, regardless of resolution. You MUST call look_at_screen first to see where things are, then estimate the coordinates from that fresh screenshot.",
  parameters: objectType({
    x: numberType().describe("Horizontal position, 0 (far left) to 1000 (far right)."),
    y: numberType().describe("Vertical position, 0 (top) to 1000 (bottom)."),
    target: stringType().describe('What you are clicking, e.g. "the blue Submit button".'),
    double: booleanType().describe("True for a double-click (e.g. to open a file)."),
    right: booleanType().describe("True for a right-click (context menu).")
  }),
  execute: async ({ x, y, target, double, right }) => {
    window.api.log(
      "Tool",
      `click_screen: "${target}" @ (${x},${y})${double ? " x2" : ""}${right ? " right" : ""}`
    );
    const action = double ? "double_click" : right ? "right_click" : "click";
    const { ok } = await window.api.computerAction({ action, x, y });
    return ok ? `Clicked ${target}. The screen has likely changed — call look_at_screen again before your next action.` : "The click failed. Tell the boss you could not click right now.";
  }
});
const typeText = tool({
  name: "type_text",
  description: "Types text using the keyboard into whatever field is currently focused. Click the target field first with click_screen if it is not already focused.",
  parameters: objectType({
    text: stringType().describe("The exact text to type.")
  }),
  execute: async ({ text }) => {
    const { ok } = await window.api.computerAction({ action: "type", text });
    return ok ? "Typed the text." : "Typing failed. Tell the boss you could not type right now.";
  }
});
const pressKey = tool({
  name: "press_key",
  description: 'Presses a key or keyboard shortcut. Examples: "enter", "tab", "escape", "backspace", "ctrl+a", "ctrl+c", "ctrl+v", "alt+tab", "win+d". Use for submitting, navigating, or shortcuts.',
  parameters: objectType({
    keys: stringType().describe('The key or combo, e.g. "enter" or "ctrl+s".')
  }),
  execute: async ({ keys }) => {
    const { ok } = await window.api.computerAction({ action: "key", keys });
    return ok ? `Pressed ${keys}.` : "Key press failed. Tell the boss it did not go through.";
  }
});
const scrollScreen = tool({
  name: "scroll_screen",
  description: "Scrolls the page or view up or down. Use before look_at_screen if the thing you need is off-screen.",
  parameters: objectType({
    direction: enumType(["up", "down"]).describe("Which way to scroll."),
    amount: numberType().describe("How many scroll steps (3 is a normal amount).")
  }),
  execute: async ({ direction, amount }) => {
    const { ok } = await window.api.computerAction({ action: "scroll", direction, amount });
    return ok ? `Scrolled ${direction}. Call look_at_screen to see the new view.` : "Scroll failed.";
  }
});
const FALLBACK_INSTRUCTIONS = "You are F.R.I.D.A.Y., a calm, concise voice assistant. Keep replies short and conversational — usually one sentence. Speak naturally.";
const GREETING = "Greet the user briefly with: 'Friday online, boss.'";
const MIC_DEVICE_KEY = "friday.micDeviceId";
const MIC_MODE_KEY = "friday.micMode";
function useFridaySession() {
  const initialMicMode = window.localStorage.getItem(MIC_MODE_KEY) === "always" ? "always" : "ptt";
  const [agentState, setAgentState] = reactExports.useState("connecting");
  const [remoteTrack, setRemoteTrack] = reactExports.useState(null);
  const [micMode, setMicModeState] = reactExports.useState(initialMicMode);
  const [pttActive, setPttActive] = reactExports.useState(false);
  const [connected, setConnected] = reactExports.useState(false);
  const micModeRef = reactExports.useRef(initialMicMode);
  const pttActiveRef = reactExports.useRef(false);
  const [selectedMicId, setSelectedMicId] = reactExports.useState(
    () => window.localStorage.getItem(MIC_DEVICE_KEY) ?? ""
  );
  const [generation, setGeneration] = reactExports.useState(0);
  const sessionRef = reactExports.useRef(null);
  const transportRef = reactExports.useRef(null);
  const audioElRef = reactExports.useRef(null);
  const speakingRef = reactExports.useRef(false);
  const activeResponseRef = reactExports.useRef(false);
  const pendingSpeakRef = reactExports.useRef(null);
  const handleEvent = reactExports.useCallback((event) => {
    const t = event?.type;
    if (t === "conversation.item.input_audio_transcription.completed") {
      if (event.transcript) window.api.log("Transcript", `user: ${event.transcript.trim()}`);
    } else if (t === "response.output_audio_transcript.done") {
      if (event.transcript) window.api.log("Transcript", `friday: ${event.transcript.trim()}`);
    }
    if (t === "input_audio_buffer.speech_started") {
      window.api.log("Mic", "server VAD: speech_started (audio IS reaching OpenAI)");
      speakingRef.current = false;
      setAgentState("listening");
    } else if (t === "input_audio_buffer.speech_stopped") {
      window.api.log("Mic", "server VAD: speech_stopped");
      setAgentState("thinking");
    } else if (t === "response.created") {
      activeResponseRef.current = true;
      setAgentState("thinking");
    } else if (t === "response.done") {
      activeResponseRef.current = false;
      const pending = pendingSpeakRef.current;
      if (pending) {
        pendingSpeakRef.current = null;
        sessionRef.current?.transport.sendEvent({
          type: "response.create",
          response: { instructions: pending }
        });
      }
    }
  }, []);
  reactExports.useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const [{ value: ephemeralKey, model }, cfg] = await Promise.all([
          window.api.realtime.mintEphemeralKey(),
          window.api.getAgentConfig().catch(() => null)
        ]);
        if (disposed) return;
        const audioEl = new Audio();
        audioEl.autoplay = true;
        audioElRef.current = audioEl;
        const tools = createFridayTools({
          visionMode: cfg?.visionMode ?? "subagent",
          controlBrain: cfg?.controlBrain ?? "openai-cua",
          inject: (event) => sessionRef.current?.transport.sendEvent(event)
        });
        const agent = new RealtimeAgent({
          name: "friday",
          voice: cfg?.voice ?? "marin",
          instructions: cfg?.systemPrompt ?? FALLBACK_INSTRUCTIONS,
          tools
        });
        let inputStream;
        const savedMic = window.localStorage.getItem(MIC_DEVICE_KEY);
        if (savedMic) {
          try {
            inputStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: savedMic } }
            });
          } catch {
            inputStream = void 0;
          }
        }
        if (disposed) {
          inputStream?.getTracks().forEach((t) => t.stop());
          return;
        }
        const transport = new OpenAIRealtimeWebRTC({
          audioElement: audioEl,
          mediaStream: inputStream
        });
        transportRef.current = transport;
        const session = new RealtimeSession(agent, {
          transport,
          model,
          config: {
            inputAudioTranscription: { model: "gpt-4o-mini-transcribe" }
          }
        });
        sessionRef.current = session;
        session.on("transport_event", handleEvent);
        session.on("error", (...args) => {
          console.error("[Realtime] session error:", ...args);
          window.api.log("Realtime", `session error: ${args.map((a) => String(a)).join(" ")}`);
        });
        await session.connect({ apiKey: ephemeralKey });
        if (disposed) return;
        setConnected(true);
        setAgentState("idle");
        session.mute(!(micModeRef.current === "always" || pttActiveRef.current));
        window.api.log(
          "Session",
          `connected (model ${model}, vision ${cfg?.visionMode}, control ${cfg?.controlBrain})`
        );
        {
          const pc = transport.connectionState?.peerConnection;
          const track = pc?.getSenders().find((s) => s.track?.kind === "audio")?.track;
          window.api.log(
            "Mic",
            `post-connect mode=${micModeRef.current} muted=${transport.muted} track=${track ? `${track.label || "unnamed"} ${track.readyState}/enabled=${track.enabled}` : "none"}`
          );
        }
        const grabTrack = () => {
          const stream = audioEl.captureStream?.();
          const track = stream?.getAudioTracks()[0] ?? null;
          if (track) setRemoteTrack(track);
        };
        audioEl.addEventListener("playing", grabTrack);
        grabTrack();
        session.transport.sendEvent({
          type: "response.create",
          response: { instructions: GREETING }
        });
      } catch (err) {
        console.error("[Realtime] failed to start session:", err);
        window.api.log("Realtime", `failed to start session: ${String(err)}`);
        if (!disposed) setAgentState("failed");
      }
    })();
    return () => {
      disposed = true;
      sessionRef.current?.close();
      sessionRef.current = null;
      transportRef.current = null;
      audioElRef.current = null;
    };
  }, [handleEvent, generation]);
  reactExports.useEffect(() => {
    if (!remoteTrack) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(new MediaStream([remoteTrack]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const SPEAK_THRESHOLD = 0.015;
    const SILENCE_MS = 700;
    let raf = 0;
    let silenceStart = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const now2 = performance.now();
      if (rms > SPEAK_THRESHOLD) {
        silenceStart = 0;
        if (!speakingRef.current) {
          speakingRef.current = true;
          setAgentState("speaking");
        }
      } else if (speakingRef.current) {
        if (!silenceStart) silenceStart = now2;
        else if (now2 - silenceStart > SILENCE_MS) {
          speakingRef.current = false;
          setAgentState("idle");
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      analyser.disconnect();
      void ctx.close().catch(() => {
      });
    };
  }, [remoteTrack]);
  reactExports.useEffect(() => {
    if (!connected) return;
    const pc = transportRef.current?.connectionState?.peerConnection;
    const track = pc?.getSenders().find((s) => s.track?.kind === "audio")?.track;
    if (!track) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let peak = 0;
    let lastLog = performance.now();
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      if (rms > peak) peak = rms;
      const now2 = performance.now();
      if (now2 - lastLog > 2e3) {
        window.api.log(
          "Mic",
          `input level peak=${peak.toFixed(3)} enabled=${track.enabled} muted=${track.muted}`
        );
        peak = 0;
        lastLog = now2;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      analyser.disconnect();
      void ctx.close().catch(() => {
      });
    };
  }, [connected]);
  reactExports.useEffect(() => {
    const handler = (_e, payload) => {
      const instructions = payload.answer ? `Your background internet search just came back. Tell the boss what you found in one or two short, natural spoken sentences — confident and casual, no lists or number dumps. Speak ONLY facts from the result below; if it contradicts anything you said earlier, THIS is the truth — correct yourself naturally. Do not add facts that aren't here.

Result:
${payload.answer}` : "Your background internet search failed. Tell the boss briefly you couldn't pull it up right now.";
      if (activeResponseRef.current) {
        pendingSpeakRef.current = instructions;
      } else {
        sessionRef.current?.transport.sendEvent({
          type: "response.create",
          response: { instructions }
        });
      }
    };
    window.electron.ipcRenderer.on("web-search-result", handler);
    return () => window.electron.ipcRenderer.removeAllListeners("web-search-result");
  }, []);
  const applyMute = reactExports.useCallback(() => {
    const live = micModeRef.current === "always" || pttActiveRef.current;
    sessionRef.current?.mute(!live);
    const pc = transportRef.current?.connectionState?.peerConnection;
    const track = pc?.getSenders().find((s) => s.track?.kind === "audio")?.track;
    window.api.log(
      "Mic",
      `applyMute live=${live} muted=${transportRef.current?.muted} track=${track ? `${track.readyState}/enabled=${track.enabled}/muted=${track.muted}` : "none"}`
    );
  }, []);
  const setMicMode = reactExports.useCallback(
    (mode) => {
      micModeRef.current = mode;
      setMicModeState(mode);
      window.localStorage.setItem(MIC_MODE_KEY, mode);
      applyMute();
    },
    [applyMute]
  );
  reactExports.useEffect(() => {
    const handler = (_e, payload) => {
      window.api.log("Mic", `ptt event received active=${payload.active}`);
      pttActiveRef.current = payload.active;
      setPttActive(payload.active);
      applyMute();
    };
    window.electron.ipcRenderer.on("push-to-talk", handler);
    return () => window.electron.ipcRenderer.removeAllListeners("push-to-talk");
  }, [applyMute]);
  const setMicDevice = reactExports.useCallback(async (deviceId) => {
    window.localStorage.setItem(MIC_DEVICE_KEY, deviceId);
    setSelectedMicId(deviceId);
    const transport = transportRef.current;
    const pc = transport?.connectionState.peerConnection;
    if (!transport || !pc) return;
    const stream = await navigator.mediaDevices.getUserMedia(
      deviceId ? { audio: { deviceId: { exact: deviceId } } } : { audio: true }
    );
    const newTrack = stream.getAudioTracks()[0];
    newTrack.enabled = !transport.muted;
    const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
    const oldTrack = sender?.track ?? null;
    await sender?.replaceTrack(newTrack);
    if (oldTrack && oldTrack !== newTrack) oldTrack.stop();
  }, []);
  const restart = reactExports.useCallback(() => setGeneration((g) => g + 1), []);
  const micLive = micMode === "always" || pttActive;
  return {
    agentState,
    remoteTrack,
    micMode,
    setMicMode,
    pttActive,
    micLive,
    connected,
    selectedMicId,
    setMicDevice,
    restart
  };
}
const controlSfx = captureSfx;
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
