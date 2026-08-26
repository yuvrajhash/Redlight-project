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
