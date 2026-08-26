function useOnboardingAudio(musicSrc, section) {
  const level = useMotionValue(0);
  const [muted, setMuted] = reactExports.useState(false);
  const [speaking, setSpeaking] = reactExports.useState(false);
  const [outputTrack, setOutputTrack] = reactExports.useState(null);
  const musicARef = reactExports.useRef(null);
  const musicBRef = reactExports.useRef(null);
  const xfadeARef = reactExports.useRef(null);
  const xfadeBRef = reactExports.useRef(null);
  const activeRef = reactExports.useRef("a");
  const duckGainRef = reactExports.useRef(null);
  const voiceRef = reactExports.useRef(null);
  const ctxRef = reactExports.useRef(null);
  const sectionRef = reactExports.useRef(section);
  const voiceTimerRef = reactExports.useRef(null);
  const xfadeTimerRef = reactExports.useRef(null);
  const outroTimerRef = reactExports.useRef(null);
  const didInitRef = reactExports.useRef(false);
  const outroRef = reactExports.useRef(false);
  reactExports.useEffect(() => {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    const ctx = new AC();
    ctxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyser.connect(ctx.destination);
    const streamDest = ctx.createMediaStreamDestination();
    analyser.connect(streamDest);
    setOutputTrack(streamDest.stream.getAudioTracks()[0] ?? null);
    const duckGain = ctx.createGain();
    duckGain.gain.value = MUSIC_VOLUME;
    duckGainRef.current = duckGain;
    duckGain.connect(analyser);
    const makeDeck = (initialGain) => {
      const el = new Audio(musicSrc);
      el.loop = false;
      el.volume = 1;
      const g = ctx.createGain();
      g.gain.value = initialGain;
      ctx.createMediaElementSource(el).connect(g).connect(duckGain);
      return { el, g };
    };
    const a = makeDeck(1);
    const b = makeDeck(0);
    musicARef.current = a.el;
    xfadeARef.current = a.g;
    musicBRef.current = b.el;
    xfadeBRef.current = b.g;
    activeRef.current = "a";
    const voice = new Audio();
    voiceRef.current = voice;
    ctx.createMediaElementSource(voice).connect(analyser);
    const onSpeakStart = () => setSpeaking(true);
    const onSpeakEnd = () => setSpeaking(false);
    voice.addEventListener("playing", onSpeakStart);
    voice.addEventListener("ended", onSpeakEnd);
    voice.addEventListener("pause", onSpeakEnd);
    const start = () => {
      ctx.resume().catch(() => {
      });
      a.el.play().catch(() => {
      });
    };
    start();
    const onGesture = () => {
      start();
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let smooth = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const active = activeRef.current === "a" ? a.el : b.el;
      const { start: s, end: e } = sectionRef.current;
      const end = Math.min(e, active.duration || e);
      if (active.currentTime >= end || active.currentTime < s - 0.05) {
        try {
          active.currentTime = s;
        } catch {
        }
      }
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const target = Math.min(1, rms * 3.2);
      smooth += (target - smooth) * 0.25;
      level.set(smooth);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      if (xfadeTimerRef.current) clearTimeout(xfadeTimerRef.current);
      if (outroTimerRef.current) clearTimeout(outroTimerRef.current);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      voice.removeEventListener("playing", onSpeakStart);
      voice.removeEventListener("ended", onSpeakEnd);
      voice.removeEventListener("pause", onSpeakEnd);
      a.el.pause();
      b.el.pause();
      voice.pause();
      ctx.close().catch(() => {
      });
    };
  }, [musicSrc, level]);
  reactExports.useEffect(() => {
    sectionRef.current = section;
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (!didInitRef.current) {
      didInitRef.current = true;
      const active = activeRef.current === "a" ? musicARef.current : musicBRef.current;
      if (active) {
        try {
          active.currentTime = section.start;
        } catch {
        }
      }
      return;
    }
    const from = activeRef.current;
    const fromEl = from === "a" ? musicARef.current : musicBRef.current;
    const toEl = from === "a" ? musicBRef.current : musicARef.current;
    const fromGain = from === "a" ? xfadeARef.current : xfadeBRef.current;
    const toGain = from === "a" ? xfadeBRef.current : xfadeARef.current;
    if (!fromEl || !toEl || !fromGain || !toGain) return;
    const now2 = ctx.currentTime;
    try {
      toEl.currentTime = section.start;
    } catch {
    }
    toEl.play().catch(() => {
    });
    toGain.gain.cancelScheduledValues(now2);
    toGain.gain.setValueAtTime(toGain.gain.value, now2);
    toGain.gain.linearRampToValueAtTime(1, now2 + CROSSFADE);
    fromGain.gain.cancelScheduledValues(now2);
    fromGain.gain.setValueAtTime(fromGain.gain.value, now2);
    fromGain.gain.linearRampToValueAtTime(0, now2 + CROSSFADE);
    activeRef.current = from === "a" ? "b" : "a";
    if (xfadeTimerRef.current) clearTimeout(xfadeTimerRef.current);
    const parking = fromEl;
    xfadeTimerRef.current = setTimeout(() => parking.pause(), CROSSFADE * 1e3 + 60);
  }, [section.start, section.end]);
  reactExports.useEffect(() => {
    if (outroRef.current) return;
    const ctx = ctxRef.current;
    const gain = duckGainRef.current;
    if (!ctx || !gain) return;
    const target = speaking ? DUCK_VOLUME : MUSIC_VOLUME;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(target, ctx.currentTime + DUCK_RAMP);
  }, [speaking]);
  const toggleMute = reactExports.useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (musicARef.current) musicARef.current.muted = next;
      if (musicBRef.current) musicBRef.current.muted = next;
      return next;
    });
  }, []);
  const playVoice = reactExports.useCallback((src) => {
    const voice = voiceRef.current;
    if (!voice) return;
    if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
    voice.pause();
    voiceTimerRef.current = setTimeout(() => {
      voice.src = src;
      voice.currentTime = 0;
      voice.play().catch(() => {
      });
    }, VOICE_DELAY);
  }, []);
  const playOutro = reactExports.useCallback(() => {
    return new Promise((resolve) => {
      outroRef.current = true;
      const ctx = ctxRef.current;
      const gain = duckGainRef.current;
      if (!ctx || !gain) {
        resolve();
        return;
      }
      const now2 = ctx.currentTime;
      const hold = (OUTRO_TAIL - OUTRO_DIM) / 1e3;
      gain.gain.cancelScheduledValues(now2);
      gain.gain.setValueAtTime(gain.gain.value, now2);
      gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, now2 + 0.4);
      gain.gain.setValueAtTime(MUSIC_VOLUME, now2 + hold);
      gain.gain.linearRampToValueAtTime(1e-4, now2 + OUTRO_TAIL / 1e3);
      if (outroTimerRef.current) clearTimeout(outroTimerRef.current);
      outroTimerRef.current = setTimeout(resolve, OUTRO_TAIL);
    });
  }, []);
  return { level, muted, toggleMute, playVoice, speaking, outputTrack, playOutro };
}
const velvetCircuit = "" + new URL("velvet-circuit-Cr4b5yTq.mp3", import.meta.url).href;
const asciiMotionByStep = {
  welcome: { scale: 1, rotate: 0, scaleX: 1, opacity: 1 },
  permissions: { scale: 1.35, rotate: 0, scaleX: 1, opacity: 0.45 },
  // zoom in
  byok: { scale: 1.15, rotate: -3, scaleX: -1, opacity: 0.4 }
  // flip + slight tilt
};
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
    