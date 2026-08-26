function IntroWelcome({ onStart }) {
  const [user, setUser] = reactExports.useState(null);
  const [signingIn, setSigningIn] = reactExports.useState(false);
  const [error, setError] = reactExports.useState("");
  reactExports.useEffect(() => {
    window.api.auth.getUser().then(setUser);
  }, []);
  const signIn = async () => {
    setError("");
    setSigningIn(true);
    try {
      setUser(await window.api.auth.signInWithGoogle());
    } catch (err) {
      console.error("Google sign-in failed:", err);
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };
  const firstName = user?.name?.split(" ")[0] || "continue";
  return (
    // pt leaves the ASCII strip at the top of the card visible; the message
    // and CTA sit centered below it.
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex h-full flex-col items-center justify-center gap-6 px-8 pt-10 text-center", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pointer-events-none absolute left-6 top-6 h-5 w-5 border-l-1 border-t-1 border-white" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pointer-events-none absolute right-6 top-6 h-5 w-5 border-r-1 border-t-1 border-white" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pointer-events-none absolute bottom-6 left-6 h-5 w-5 border-b-1 border-l-1 border-white" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pointer-events-none absolute bottom-6 right-6 h-5 w-5 border-b-1 border-r-1 border-white" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "text-3xl font-light tracking-tight", children: [
          "welcome to ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "italic font-playfair font-medium", children: "friday" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "max-w-sm text-sm text-muted-foreground lowercase", children: [
          "This could be the beginning of something ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "italic", children: "beautiful" }),
          "."
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-2", children: [
        user ? (
          // Signed in → this click is the one that advances onboarding.
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { onClick: onStart, className: "gap-2 px-6", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "h-4 w-4 text-emerald-400" }),
            "Continue as ",
            firstName
          ] })
        ) : /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: signIn, disabled: signingIn, className: "gap-2 px-6", children: signingIn ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
          "Waiting for Google…"
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(GoogleIcon, { className: "h-4 w-4" }),
          "Continue with Google"
        ] }) }),
        user ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-muted-foreground", children: user.email }) : error ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "max-w-xs text-[11px] font-medium text-destructive", children: error }) : signingIn ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-muted-foreground", children: "Finish in your browser, then come back here." }) : null
      ] })
    ] })
  );
}
function PermissionRow({
  icon,
  title,
  description,
  status,
  onAction,
  actionLabel = "Grant"
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2.5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/40 text-foreground/80", children: icon }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium leading-tight", children: title }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "truncate text-[11px] text-muted-foreground", children: description })
    ] }),
    status === "granted" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1 text-[11px] font-medium text-emerald-400", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "h-3.5 w-3.5" }),
      " Ready"
    ] }) : status === "pending" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1 text-[11px] font-medium text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }),
      " Waiting…"
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
      Button,
      {
        type: "button",
        size: "sm",
        variant: status === "denied" ? "destructive" : "secondary",
        onClick: onAction,
        className: "h-7 shrink-0 px-3 text-[11px]",
        children: [
          status === "denied" && /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "mr-1 h-3 w-3" }),
          actionLabel
        ]
      }
    )
  ] });
}
function PermissionShell({
  title,
  subtitle,
  children,
  footer
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full flex-col px-8 py-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-4 text-center", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-xl font-semibold tracking-tight", children: title }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: cn("mt-1 text-xs text-muted-foreground"), children: subtitle })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-0 flex-1 overflow-y-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-full flex-col justify-center gap-2", children }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-4 flex flex-col gap-2", children: footer })
  ] });
}
function mapStatus(s) {
  if (s === "granted") return "granted";
  if (s === "denied" || s === "restricted") return "denied";
  return null;
}
function PermissionsMac({
  onBack,
  onContinue,
  onAllGrantedChange
}) {
  const [mic, setMic] = reactExports.useState("unknown");
  const [screen, setScreen] = reactExports.useState("unknown");
  const [a11y, setA11y] = reactExports.useState("unknown");
  const [inputMon, setInputMon] = reactExports.useState("unknown");
  const canContinue = mic === "granted" && screen === "granted" && a11y === "granted" && inputMon === "granted";
  reactExports.useEffect(() => onAllGrantedChange?.(canContinue), [canContinue, onAllGrantedChange]);
  const refresh = reactExports.useCallback(async () => {
    const [micStatus, screenStatus, a11yTrusted] = await Promise.all([
      window.api.permissions.getMicStatus(),
      window.api.permissions.getScreenStatus(),
      window.api.permissions.getAccessibilityStatus()
    ]);
    setMic((prev) => mapStatus(micStatus) ?? prev);
    setScreen((prev) => mapStatus(screenStatus) ?? prev);
    setA11y((prev) => a11yTrusted ? "granted" : prev);
    setInputMon((prev) => prev === "pending" ? "granted" : prev);
  }, []);
  reactExports.useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  const enableMic = reactExports.useCallback(async () => {
    setMic("pending");
    const granted = await window.api.permissions.requestMicAccess();
    if (granted) {
      setMic("granted");
    } else {
      setMic("denied");
      window.api.permissions.openMicSettings();
    }
  }, []);
  const enableScreen = reactExports.useCallback(() => {
    window.api.permissions.openScreenSettings();
  }, []);
  const enableA11y = reactExports.useCallback(async () => {
    await window.api.permissions.getAccessibilityStatus(true);
    window.api.permissions.openAccessibilitySettings();
  }, []);
  const enableInputMon = reactExports.useCallback(async () => {
    setInputMon("pending");
    await window.api.permissions.triggerInputMonitoringPrompt();
    window.api.permissions.openInputMonitoringSettings();
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    PermissionShell,
    {
      title: "Let's get Friday set up",
      subtitle: "Grant these in System Settings. Each turns green once macOS confirms it.",
      footer: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: onContinue, disabled: !canContinue, className: "w-full", children: "Continue" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", onClick: onBack, className: "w-full text-muted-foreground", children: "Back" })
      ] }),
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          PermissionRow,
          {
            icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Mic, { className: "h-4 w-4" }),
            title: "Microphone",
            description: "So Friday can hear your voice.",
            status: mic,
            actionLabel: mic === "denied" ? "Open Settings" : "Enable",
            onAction: mic === "denied" ? () => window.api.permissions.openMicSettings() : enableMic
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          PermissionRow,
          {
            icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Monitor, { className: "h-4 w-4" }),
            title: "Screen Recording",
            description: "So Friday can see your screen. Friday restarts after setup to apply it.",
            status: screen,
            actionLabel: "Open Settings",
            onAction: enableScreen
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          PermissionRow,
          {
            icon: /* @__PURE__ */ jsxRuntimeExports.jsx(MousePointer2, { className: "h-4 w-4" }),
            title: "Accessibility",
            description: "So Friday can control your computer. Applied after the restart.",
            status: a11y,
            actionLabel: a11y === "denied" ? "Open Settings" : "Enable",
            onAction: enableA11y
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          PermissionRow,
          {
            icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Keyboard, { className: "h-4 w-4" }),
            title: "Input Monitoring",
            description: "So Friday hears your hold-to-talk key. Applied after the restart.",
            status: inputMon,
            actionLabel: "Enable",
            onAction: enableInputMon
          }
        )
      ]
    }
  );
}
function PermissionsWindows({
  onBack,
  onContinue,
  onAllGrantedChange
}) {
  const [mic, setMic] = reactExports.useState("unknown");
  const allGranted = mic === "granted";
  reactExports.useEffect(() => onAllGrantedChange?.(allGranted), [allGranted, onAllGrantedChange]);
  const refresh = reactExports.useCallback(async () => {
    const status = await window.api.permissions.getMicStatus();
    if (status === "granted") setMic("granted");
    else if (status === "denied" || status === "restricted") setMic("denied");
  }, []);
  reactExports.useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  const enable = reactExports.useCallback(async () => {
    setMic("pending");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMic("granted");
    } catch {
      setMic("denied");
      window.api.permissions.openMicSettings();
    }
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    PermissionShell,
    {
      title: "One quick check",
      subtitle: "Friday needs your microphone to hear you. Nothing else to set up on Windows.",
      footer: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: onContinue, disabled: mic !== "granted", className: "w-full", children: "Continue" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", onClick: onBack, className: "w-full text-muted-foreground", children: "Back" })
      ] }),
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          PermissionRow,
          {
            icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Mic, { className: "h-4 w-4" }),
            title: "Microphone",
            description: "So Friday can hear your voice.",
            status: mic,
            actionLabel: mic === "denied" ? "Open Settings" : "Enable",
            onAction: mic === "denied" ? () => window.api.permissions.openMicSettings() : enable
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "px-1 pt-1 text-center text-[11px] text-muted-foreground", children: "Screen view and computer control work out of the box on Windows — no permissions required." })
      ]
    }
  );
}
function PermissionsStep(props) {
  const isMac = window.electron?.process?.platform === "darwin";
  return isMac ? /* @__PURE__ */ jsxRuntimeExports.jsx(PermissionsMac, { ...props }) : /* @__PURE__ */ jsxRuntimeExports.jsx(PermissionsWindows, { ...props });
}
const fieldVariants = cva("group/field flex w-full gap-2 data-[invalid=true]:text-destructive", {
  variants: {
    orientation: {
      vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
      horizontal: "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      responsive: "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px"
    }
  },
  defaultVariants: {
    orientation: "vertical"
  }
});
function Field({
  className,
  orientation = "vertical",
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      role: "group",
      "data-slot": "field",
      "data-orientation": orientation,
      className: cn(fieldVariants({ orientation }), className),
      ...props
    }
  );
}
function Input({ className, type, ...props }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "input",
    {
      type,
      "data-slot": "input",
      className: cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      ),
      ...props
    }
  );
}
function useStore() {
  const store = window.api.store;
  return {
    initialOnboardingComplete: store.initialOnboardingComplete,
    isOnboardingComplete: store.isOnboardingComplete,
    setOnboardingComplete: store.setOnboardingComplete,
    saveApiKey: store.saveApiKey,
    getApiKey: store.getApiKey,
    deleteApiKey: store.deleteApiKey,
    getProviderConfig: store.getProviderConfig,
    setProviderConfig: store.setProviderConfig,
    validateGoogleKey: store.validateGoogleKey,
    validateOpenAiKey: store.validateOpenAiKey
  };
}
function BYOKSetup({ onComplete }) {
  const { saveApiKey, validateOpenAiKey } = useStore();
  const [openaiKey, setOpenaiKey] = reactExports.useState("");
  const [loading, setLoading] = reactExports.useState(false);
  const [error, setError] = reactExports.useState("");
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const key = openaiKey.trim();
      if (!key) throw new Error("An OpenAI API key is required.");
      if (!key.startsWith("sk-"))
        throw new Error(`That doesn't look like an OpenAI key (it should start with "sk-").`);
      const valid = await validateOpenAiKey(key);
      if (!valid)
        throw new Error("That key didn't work. Check it's active and has billing enabled.");
      await saveApiKey("openai", key);
      onComplete();
    } catch (err) {
      console.error("Failed to save:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex h-full w-full items-center justify-center px-10 py-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pointer-events-none absolute left-6 top-6 h-5 w-5 border-l-1 border-t-1 border-white/70" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pointer-events-none absolute right-6 top-6 h-5 w-5 border-r-1 border-t-1 border-white/70" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pointer-events-none absolute bottom-6 left-6 h-5 w-5 border-b-1 border-l-1 border-white/70" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pointer-events-none absolute bottom-6 right-6 h-5 w-5 border-b-1 border-r-1 border-white/70" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex w-full max-w-[330px] flex-col gap-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col items-center gap-3 text-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-1", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "text-2xl font-light tracking-tight", children: [
        "configure ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-playfair font-medium italic", children: "friday" })
      ] }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { className: "flex flex-col gap-3", onSubmit: handleSubmit, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Field, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(KeyRound, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Input,
              {
                id: "openai-key",
                type: "password",
                placeholder: "OPENAI_API_KEY",
                value: openaiKey,
                onChange: (e) => setOpenaiKey(e.target.value),
                className: "pl-9 text-sm tracking-wide",
                autoFocus: true
              }
            )
          ] }),
          error ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] font-medium text-destructive", children: error }) : /* @__PURE__ */