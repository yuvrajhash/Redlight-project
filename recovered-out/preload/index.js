"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const onboardingArg = process.argv.find((arg) => arg.startsWith("--onboarding-complete="));
const initialOnboardingComplete = onboardingArg ? onboardingArg.split("=")[1] === "true" : false;
const api = {
  ping: () => electron.ipcRenderer.send("ping"),
  // Fire-and-forget logging from the renderer into the main-process logger, so
  // transcripts / tool calls land in the terminal + main.log alongside everything
  // else (renderer console.* would otherwise only show in DevTools).
  log: (scope, message) => electron.ipcRenderer.send("app:log", scope, message),
  // Finish onboarding → main swaps to the island overlay window
  completeOnboarding: () => electron.ipcRenderer.invoke("complete-onboarding"),
  // OpenAI Realtime (BYOK): main mints a short-lived ephemeral key from the
  // user's stored OpenAI key; the renderer connects the WebRTC session with it.
  realtime: {
    mintEphemeralKey: () => electron.ipcRenderer.invoke("realtime:mintEphemeralKey")
  },
  // Agent brains: system prompt + flags, screen capture ("eyes"), and the
  // sub-agents the voice agent delegates to. Each returns short text/data.
  getAgentConfig: () => electron.ipcRenderer.invoke("get-agent-config"),
  captureScreen: () => electron.ipcRenderer.invoke("capture-screen"),
  describeScreen: (question) => electron.ipcRenderer.invoke("describe-screen", question),
  webSearch: (query) => electron.ipcRenderer.invoke("web-search", query),
  // "Hands": one mouse/keyboard action (realtime brain) or a whole task handed to
  // the computer-use loop (openai-cua brain), which returns a short spoken report.
  computerAction: (action) => electron.ipcRenderer.invoke("computer-action", action),
  controlComputer: (task) => electron.ipcRenderer.invoke("control-computer", task),
  store: {
    initialOnboardingComplete,
    isOnboardingComplete: () => electron.ipcRenderer.invoke("store:isOnboardingComplete"),
    setOnboardingComplete: (value) => electron.ipcRenderer.invoke("store:setOnboardingComplete", value),
    saveApiKey: (service, key) => electron.ipcRenderer.invoke("store:saveApiKey", service, key),
    getApiKey: (service) => electron.ipcRenderer.invoke("store:getApiKey", service),
    deleteApiKey: (service) => electron.ipcRenderer.invoke("store:deleteApiKey", service),
    validateGoogleKey: (key) => electron.ipcRenderer.invoke("store:validateGoogleKey", key),
    validateOpenAiKey: (key) => electron.ipcRenderer.invoke("store:validateOpenAiKey", key),
    getProviderConfig: () => electron.ipcRenderer.invoke("store:getProviderConfig"),
    setProviderConfig: (config) => electron.ipcRenderer.invoke("store:setProviderConfig", config),
    resetStore: () => electron.ipcRenderer.invoke("store:resetStore")
  },
  // OS permissions — onboarding's permission checks. getUserMedia in the renderer
  // is the real mic grant; these read OS status, prompt where an API exists, and
  // deep-link to Settings. Screen/Accessibility are macOS-only (no-ops elsewhere).
  permissions: {
    getMicStatus: () => electron.ipcRenderer.invoke("permissions:getMicStatus"),
    requestMicAccess: () => electron.ipcRenderer.invoke("permissions:requestMicAccess"),
    openMicSettings: () => electron.ipcRenderer.invoke("permissions:openMicSettings"),
    getScreenStatus: () => electron.ipcRenderer.invoke("permissions:getScreenStatus"),
    openScreenSettings: () => electron.ipcRenderer.invoke("permissions:openScreenSettings"),
    getAccessibilityStatus: (prompt = false) => electron.ipcRenderer.invoke("permissions:getAccessibilityStatus", prompt),
    openAccessibilitySettings: () => electron.ipcRenderer.invoke("permissions:openAccessibilitySettings"),
    triggerInputMonitoringPrompt: () => electron.ipcRenderer.invoke("permissions:triggerInputMonitoringPrompt"),
    openInputMonitoringSettings: () => electron.ipcRenderer.invoke("permissions:openInputMonitoringSettings")
  },
  // Google sign-in (onboarding) — main runs the desktop OAuth flow in the system
  // browser and returns the resolved profile; the renderer only sees identity.
  auth: {
    signInWithGoogle: () => electron.ipcRenderer.invoke("auth:signInWithGoogle"),
    getUser: () => electron.ipcRenderer.invoke("auth:getUser"),
    signOut: () => electron.ipcRenderer.invoke("auth:signOut")
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
