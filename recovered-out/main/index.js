"use strict";
const dotenv = require("dotenv");
const electron = require("electron");
const Path = require("path");
const utils = require("@electron-toolkit/utils");
const electronUpdater = require("electron-updater");
const http$1 = require("http");
const require$$0$1 = require("child_process");
const log = require("electron-log/main");
const require$$0 = require("os");
const fs = require("fs");
const Store = require("electron-store");
const generativeAi = require("@google/generative-ai");
const node_crypto = require("node:crypto");
const http = require("node:http");
const node_module = require("node:module");
const path = require("node:path");
const OpenAI = require("openai");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const Path__namespace = /* @__PURE__ */ _interopNamespaceDefault(Path);
const http__namespace$1 = /* @__PURE__ */ _interopNamespaceDefault(http$1);
const require$$0__namespace = /* @__PURE__ */ _interopNamespaceDefault(require$$0);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const http__namespace = /* @__PURE__ */ _interopNamespaceDefault(http);
const LOG_DIR = Path__namespace.join(require$$0__namespace.tmpdir(), "electron-app-logs");
fs__namespace.mkdirSync(LOG_DIR, { recursive: true });
log.transports.file.resolvePathFn = () => Path__namespace.join(LOG_DIR, "main.log");
log.transports.file.level = "info";
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
log.transports.console.level = process.env.NODE_ENV === "development" ? "debug" : false;
log.initialize();
const icon = Path.join(__dirname, "../../resources/icon.png");
const StoreClass = Store.default || Store;
const store = new StoreClass({
  name: "friday-config",
  // creates friday-config.json in userData
  defaults: {
    onboardingComplete: false,
    encryptedApiKeys: {},
    providerConfig: {
      llm: "gemini",
      stt: "sarvam",
      tts: "sarvam"
    },
    user: null
  }
});
function isOnboardingComplete() {
  return store.get("onboardingComplete");
}
function setOnboardingComplete(value) {
  store.set("onboardingComplete", value);
}
function saveApiKey(service, plainTextKey) {
  const keys = store.get("encryptedApiKeys");
  if (!electron.safeStorage.isEncryptionAvailable()) {
    console.warn("safeStorage encryption not available, storing as-is");
    keys[service] = "RAW_" + plainTextKey;
    store.set("encryptedApiKeys", keys);
    return;
  }
  const encryptedBuffer = electron.safeStorage.encryptString(plainTextKey);
  keys[service] = "ENC_" + encryptedBuffer.toString("base64");
  store.set("encryptedApiKeys", keys);
}
function getApiKey(service) {
  const keys = store.get("encryptedApiKeys");
  const storedValue = keys[service];
  if (!storedValue) return null;
  if (storedValue.startsWith("RAW_")) {
    return storedValue.replace("RAW_", "");
  }
  if (storedValue.startsWith("ENC_")) {
    if (!electron.safeStorage.isEncryptionAvailable()) {
      console.error("Cannot decrypt: safeStorage is currently unavailable on this system.");
      return null;
    }
    try {
      const base64String = storedValue.replace("ENC_", "");
      const buffer = Buffer.from(base64String, "base64");
      return electron.safeStorage.decryptString(buffer);
    } catch {
      console.error(`Failed to decrypt API key for service: ${service}`);
      return null;
    }
  }
  return null;
}
function deleteApiKey(service) {
  const keys = store.get("encryptedApiKeys");
  delete keys[service];
  store.set("encryptedApiKeys", keys);
}
function getProviderConfig() {
  return store.get("providerConfig");
}
function setProviderConfig(config) {
  store.set("providerConfig", config);
}
function getUser() {
  return store.get("user") ?? null;
}
function setUser(user) {
  store.set("user", user);
}
function resetStore() {
  store.clear();
}
async function validateGoogleApiKey(apiKey) {
  try {
    const genAI = new generativeAi.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2-preview" });
    const result = await model.embedContent("hello");
    const values = result.embedding.values;
    return Array.isArray(values) && values.length > 0;
  } catch (err) {
    console.error("API key validation failed:", err);
    return false;
  }
}
async function validateOpenAiApiKey(apiKey) {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    return res.ok;
  } catch (err) {
    console.error("OpenAI API key validation failed:", err);
    return false;
  }
}
function getMicStatus() {
  const status = electron.systemPreferences.getMediaAccessStatus("microphone");
  log.info(`[PERMS] mic = ${status}`);
  return status;
}
async function requestMicAccess() {
  if (process.platform !== "darwin") return true;
  try {
    const granted = await electron.systemPreferences.askForMediaAccess("microphone");
    log.info(`[PERMS] askForMediaAccess(microphone) → ${granted}`);
    return granted;
  } catch (err) {
    log.warn(`[PERMS] askForMediaAccess(microphone) failed: ${err}`);
    return false;
  }
}
function getScreenStatus() {
  if (process.platform !== "darwin") return "granted";
  const status = electron.systemPreferences.getMediaAccessStatus("screen");
  log.info(`[PERMS] screen = ${status}`);
  return status;
}
function getAccessibilityStatus(prompt = false) {
  if (process.platform !== "darwin") return true;
  const trusted = electron.systemPreferences.isTrustedAccessibilityClient(prompt);
  log.info(`[PERMS] accessibility = ${trusted} (prompt=${prompt})`);
  return trusted;
}
function logPermissionDiagnostics() {
  log.info("[PERMS] ── startup diagnostics ──");
  log.info(`[PERMS] platform=${process.platform} packaged=${electron.app.isPackaged}`);
  log.info(`[PERMS] execPath=${process.execPath}`);
  log.info(`[PERMS] appPath=${electron.app.getAppPath()}`);
  if (process.platform === "darwin") {
    log.info(`[PERMS] bundleId=${electron.app.getName()} (id ${process.mas ? "mas" : "non-mas"})`);
    log.info(`[PERMS] mic=${electron.systemPreferences.getMediaAccessStatus("microphone")}`);
    log.info(`[PERMS] screen=${electron.systemPreferences.getMediaAccessStatus("screen")}`);
    log.info(`[PERMS] accessibility=${electron.systemPreferences.isTrustedAccessibilityClient(false)}`);
  }
}
async function openMicSettings() {
  if (process.platform === "win32") {
    await electron.shell.openExternal("ms-settings:privacy-microphone");
  } else if (process.platform === "darwin") {
    await electron.shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
    );
  }
}
async function openScreenSettings() {
  if (process.platform === "darwin") {
    await electron.shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    );
  }
}
async function openAccessibilitySettings() {
  if (process.platform === "darwin") {
    await electron.shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    );
  }
}
async function openInputMonitoringSettings() {
  if (process.platform === "darwin") {
    await electron.shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
    );
  }
}
function relaunchApp() {
  electron.app.relaunch();
  electron.app.exit(0);
}
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPES = ["openid", "email", "profile"];
const TIMEOUT_MS = 5 * 60 * 1e3;
const LOGIN_LOG_ENDPOINT = "https://friday.feynmanpi.com/api/auth/log";
const LOGIN_LOG_TIMEOUT_MS = 8 * 1e3;
function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeIdToken(idToken) {
  const payload = idToken.split(".")[1] ?? "";
  const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}
function resultPage(ok) {
  const title = ok ? "You’re signed in" : "Sign-in failed";
  const body = ok ? "You can close this tab and return to Friday." : "Please return to Friday and try again.";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>html{color-scheme:dark}body{margin:0;height:100vh;display:flex;flex-direction:column;
align-items:center;justify-content:center;gap:.5rem;background:#0a0a0a;color:#ededed;
font:400 16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}h1{font-weight:500;font-size:1.25rem;margin:0}
p{margin:0;color:#a1a1a1;font-size:.9rem}</style></head>
<body><h1>${title}</h1><p>${body}</p></body></html>`;
}
let activeServer = null;
function listenLoopback() {
  return new Promise((resolve, reject) => {
    const server = http__namespace.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") resolve({ server, port: addr.port });
      else reject(new Error("Failed to bind the loopback sign-in server."));
    });
  });
}
function waitForCallback(server) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.removeAllListeners("request");
      reject(new Error("Timed out waiting for Google sign-in."));
    }, TIMEOUT_MS);
    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (!url.searchParams.has("code") && !url.searchParams.has("error")) {
        res.writeHead(204).end();
        return;
      }
      clearTimeout(timer);
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(resultPage(!error && !!code));
      if (error) return reject(new Error(`Google sign-in was cancelled (${error}).`));
      if (!code) return reject(new Error("No authorization code returned by Google."));
      resolve({ code, returnedState: url.searchParams.get("state") });
    });
  });
}
async function exchangeCode(code, verifier, redirectUri, clientId, clientSecret) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier
    })
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.id_token) throw new Error("Google did not return an id_token.");
  const claims = decodeIdToken(data.id_token);
  const user = {
    id: String(claims.sub ?? ""),
    email: String(claims.email ?? ""),
    name: String(claims.name ?? claims.email ?? "there"),
    picture: claims.picture ? String(claims.picture) : void 0
  };
  return { user, idToken: data.id_token };
}
async function logLoginToServer(idToken) {
  try {
    const res = await fetch(LOGIN_LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(LOGIN_LOG_TIMEOUT_MS)
    });
    if (!res.ok) {
      log.warn(`[auth] login log returned ${res.status}: ${await res.text().catch(() => "")}`);
    }
  } catch (err) {
    log.warn(`[auth] login log failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
async function signInWithGoogle() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  const verifier = base64url(node_crypto.randomBytes(32));
  const challenge = base64url(node_crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(node_crypto.randomBytes(16));
  if (activeServer) {
    try {
      activeServer.close();
    } catch {
    }
    activeServer = null;
  }
  const { server, port } = await listenLoopback();
  activeServer = server;
  const redirectUri = `http://127.0.0.1:${port}`;
  try {
    const authUrl = `${AUTH_ENDPOINT}?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      prompt: "select_account"
    })}`;
    await electron.shell.openExternal(authUrl);
    const { code, returnedState } = await waitForCallback(server);
    if (returnedState !== state) throw new Error("OAuth state mismatch — aborting sign-in.");
    const { user, idToken } = await exchangeCode(code, verifier, redirectUri, clientId, clientSecret);
    setUser(user);
    log.info(`[auth] signed in as ${user.email}`);
    void logLoginToServer(idToken);
    return user;
  } finally {
    try {
      server.close();
    } catch {
    }
    if (activeServer === server) activeServer = null;
  }
}
async function captureScreen() {
  const display = electron.screen.getPrimaryDisplay();
  const { width, height } = display.size;
  const scale = Math.min(1, 1280 / Math.max(width, height));
  const thumbnailSize = {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
  const sources = await electron.desktopCapturer.getSources({ types: ["screen"], thumbnailSize });
  if (sources.length === 0) throw new Error("No screen sources available");
  const jpeg = sources[0].thumbnail.toJPEG(70);
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
async function captureScreenForControl() {
  const display = electron.screen.getPrimaryDisplay();
  const { width, height } = display.size;
  const scale = Math.min(1, 1920 / Math.max(width, height));
  const sources = await electron.desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) }
  });
  if (sources.length === 0) throw new Error("No screen sources available");
  const size = sources[0].thumbnail.getSize();
  const jpeg = sources[0].thumbnail.toJPEG(80);
  return {
    image: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    width: size.width,
    height: size.height
  };
}
let nut = null;
let nutLoadFailed = false;
async function getNut() {
  if (nut || nutLoadFailed) return nut;
  try {
    nut = await Promise.resolve().then(() => require("./index-D1XYK4AD.js")).then((n) => n.index);
    nut.mouse.config.autoDelayMs = 2;
    nut.keyboard.config.autoDelayMs = 2;
    log.info("[Control] nut.js loaded - input injection ready");
  } catch (err) {
    nutLoadFailed = true;
    log.error(`[Control] Failed to load nut.js - input injection disabled: ${err}`);
  }
  return nut;
}
function resolveKeys(n, combo) {
  const { Key } = n;
  const map = {
    ctrl: Key.LeftControl,
    control: Key.LeftControl,
    alt: Key.LeftAlt,
    option: Key.LeftAlt,
    shift: Key.LeftShift,
    cmd: Key.LeftSuper,
    win: Key.LeftSuper,
    super: Key.LeftSuper,
    meta: Key.LeftSuper,
    enter: Key.Enter,
    return: Key.Enter,
    tab: Key.Tab,
    esc: Key.Escape,
    escape: Key.Escape,
    backspace: Key.Backspace,
    delete: Key.Delete,
    del: Key.Delete,
    space: Key.Space,
    up: Key.Up,
    down: Key.Down,
    left: Key.Left,
    right: Key.Right,
    home: Key.Home,
    end: Key.End,
    pageup: Key.PageUp,
    pagedown: Key.PageDown
  };
  return combo.split("+").map((p) => p.trim().toLowerCase()).map((p) => {
    if (p in map) return map[p];
    if (p.length === 1 && p >= "a" && p <= "z")
      return Key[p.toUpperCase()];
    if (p.length === 1 && p >= "0" && p <= "9")
      return Key[`Num${p}`];
    throw new Error(`Unknown key: ${p}`);
  });
}
async function runComputerAction(a) {
  const n = await getNut();
  if (!n) throw new Error("Input injection unavailable (nut.js failed to load)");
  const toPoint = async () => {
    const w = await n.screen.width();
    const h = await n.screen.height();
    const px = Math.round((a.x ?? 0) / 1e3 * w);
    const py = Math.round((a.y ?? 0) / 1e3 * h);
    return new n.Point(px, py);
  };
  switch (a.action) {
    case "move":
      await n.mouse.setPosition(await toPoint());
      break;
    case "click":
      await n.mouse.setPosition(await toPoint());
      await n.mouse.leftClick();
      break;
    case "double_click":
      await n.mouse.setPosition(await toPoint());
      await n.mouse.doubleClick(n.Button.LEFT);
      break;
    case "right_click":
      await n.mouse.setPosition(await toPoint());
      await n.mouse.rightClick();
      break;
    case "type":
      if (a.text) await n.keyboard.type(a.text);
      break;
    case "key": {
      if (!a.keys) break;
      const keys = resolveKeys(n, a.keys);
      const mods = keys.slice(0, -1);
      const last = keys[keys.length - 1];
      for (const m of mods) await n.keyboard.pressKey(m);
      await n.keyboard.pressKey(last);
      await n.keyboard.releaseKey(last);
      for (const m of mods.reverse()) await n.keyboard.releaseKey(m);
      break;
    }
    case "scroll": {
      if (a.x != null && a.y != null) await n.mouse.setPosition(await toPoint());
      const amount = a.amount ?? 3;
      if (a.direction === "up") await n.mouse.scrollUp(amount);
      else await n.mouse.scrollDown(amount);
      break;
    }
    case "drag": {
      if (!a.path || a.path.length < 2) break;
      const w = await n.screen.width();
      const h = await n.screen.height();
      const pts = a.path.map(
        (p) => new n.Point(Math.round(p.x / 1e3 * w), Math.round(p.y / 1e3 * h))
      );
      await n.mouse.setPosition(pts[0]);
      await n.mouse.pressButton(n.Button.LEFT);
      for (const pt of pts.slice(1)) await n.mouse.setPosition(pt);
      await n.mouse.releaseButton(n.Button.LEFT);
      break;
    }
    default:
      throw new Error(`Unknown action: ${a.action}`);
  }
}
const nativeRequire = node_module.createRequire(path.join(electron.app.getAppPath(), "package.json"));
let started = false;
let active = false;
let sawAnyEvent = false;
async function startPushToTalk(onChange) {
  if (started) return;
  let uIOhookModule;
  try {
    uIOhookModule = nativeRequire("uiohook-napi");
  } catch (err) {
    log.error(`[PTT] uiohook-napi failed to load — push-to-talk disabled: ${err}`);
    return;
  }
  const hook = uIOhookModule.uIOhook;
  const handleEvent = (e) => {
    if (!sawAnyEvent) {
      sawAnyEvent = true;
      log.info("[PTT] receiving global key events — listen hook is live (Input Monitoring OK)");
    }
    const next = e.ctrlKey && e.altKey;
    if (next !== active) {
      active = next;
      onChange(active);
    }
  };
  hook.on("keydown", handleEvent);
  hook.on("keyup", handleEvent);
  try {
    hook.start();
    started = true;
    log.info("[PTT] global hook started — hold Ctrl+Alt (Control+Option) to talk");
  } catch (err) {
    log.error(`[PTT] failed to start global hook — push-to-talk disabled: ${err}`);
    try {
      hook.stop();
    } catch {
    }
  }
}
async function triggerInputMonitoringPrompt() {
  if (process.platform !== "darwin") return;
  if (started) return;
  let uIOhookModule;
  try {
    uIOhookModule = nativeRequire("uiohook-napi");
  } catch (err) {
    log.warn(`[PTT] input-monitoring prompt: uiohook-napi failed to load: ${err}`);
    return;
  }
  const hook = uIOhookModule.uIOhook;
  try {
    hook.start();
    log.info("[PTT] input-monitoring prompt: started listen tap to register Friday in the list");
  } catch (err) {
    log.warn(`[PTT] input-monitoring prompt: failed to start listen tap: ${err}`);
    return;
  }
  setTimeout(() => {
    try {
      hook.stop();
    } catch {
    }
  }, 600);
}
function stopPushToTalk() {
  if (!started) return;
  try {
    const { uIOhook } = nativeRequire("uiohook-napi");
    uIOhook.stop();
  } catch (err) {
    log.warn(`[PTT] failed to stop global hook: ${err}`);
  }
  started = false;
  active = false;
  sawAnyEvent = false;
}
function broadcast$1(channel, payload) {
  electron.BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(channel, payload));
}
function resolveVisionMode() {
  return (process.env.VISION_MODE || "subagent").toLowerCase() === "direct" ? "direct" : "subagent";
}
function resolveControlBrain() {
  return (process.env.CONTROL_BRAIN || "openai-cua").toLowerCase() === "realtime" ? "realtime" : "openai-cua";
}
function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const parts = [];
  for (const item of data?.output ?? []) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if ((c?.type === "output_text" || c?.type === "text") && c.text) parts.push(c.text);
      }
    } else if (item?.type === "output_text" && item.text) {
      parts.push(item.text);
    }
  }
  return parts.join(" ").trim();
}
let cachedClient = null;
function getClient() {
  const apiKey = getApiKey("openai");
  if (!apiKey) throw new Error("No OpenAI API key found.");
  if (!cachedClient || cachedClient.key !== apiKey) {
    cachedClient = { key: apiKey, client: new OpenAI({ apiKey }) };
  }
  return cachedClient.client;
}
async function openaiResponses(body) {
  return getClient().responses.create(body);
}
function buildSystemPrompt(controlBrain) {
  const controlCapability = controlBrain === "realtime" ? `### click_screen / type_text / press_key / scroll_screen — Control the Computer
You can operate the boss's machine directly — mouse, keyboard, scrolling.
- Coordinates are a NORMALIZED 0–1000 grid: (0,0) top-left, (1000,1000) bottom-right, any resolution.
- THE GOLDEN LOOP: you are blind between screenshots. Before EVERY click, call look_at_screen for a
  FRESH view, estimate the target's coordinates from THAT image, then click. After acting, the screen
  has changed — look again before the next click. Never click from memory.
- Work one step at a time: look → act → look → act. Don't fire a burst of clicks blind.
- Narrate lightly as you go — "On it, boss." "Opening that now." Keep it short.` : `### control_computer — Operate the Computer
You can carry out whole tasks on the boss's machine — opening apps, clicking, typing, navigating,
searching, filling forms.
- When asked to DO something — "open X", "search for Y", "close this", "play that" — hand the WHOLE
  task to control_computer in plain language and let the specialist agent carry it out. Don't narrate
  individual clicks; hand it off and let it work.
- Say a short filler line FIRST ("On it, boss." / "Opening that now."), THEN call control_computer.
  It runs a few seconds — that's normal. Stay quiet until it returns.
- When it returns, tell the boss the result in one short line, based ONLY on what it actually reports.
  Never claim you did something it didn't confirm.`;
  return `
You are F.R.I.D.A.Y. — Fully Responsive Intelligent Digital Assistant for You — Tony Stark's AI,
now serving your user, the boss.

You are calm, composed, and always informed — a trusted aide who's been awake while the boss slept.
Precise, warm when the moment calls for it, occasionally dry. You brief, then you move on. No
rambling, ever. Think late-night briefing officer, not a chatbot.

You are a VOICE. Every spoken reply is SHORT — one or two sentences, usually one. Natural spoken
language: contractions, light pauses, no stiff phrasing. No markdown, no bullet points, no lists,
no reading out strings of numbers like a report.

## Capabilities

### look_at_screen — See the Boss's Screen
Captures a fresh view of whatever the boss is looking at.
- Use it WHENEVER a question could be answered by looking — "what is this", "read this", "what does
  this error say", "help me with this" — or any request using "this / that / here / it" pointing at
  the screen.
- PREFER LOOKING OVER ASKING. Don't ask "which one, boss?" — look first, work it out, then answer.
- The screen is always changing: a screenshot from an earlier turn is stale and worthless now. Every
  new screen question = a FRESH look_at_screen. Call it silently; don't narrate taking a shot.

### search_web — Search the Internet (runs in the BACKGROUND)
For ANYTHING that needs current or outside facts — news, "what's happening today", a company, a
person, a price, the weather, sports, an event, a definition.
- This runs in the BACKGROUND and returns instantly. The moment you call it, say ONE short filler
  line ("Looking into it, boss — one sec.") and then STOP. Do NOT answer, summarize, or guess in that
  turn. The real answer arrives on its own a few seconds later; speak it THEN, and only then.
- Your built-in knowledge of news, prices, scores, and current events is STALE — never speak it as
  fact. If a question needs live info, the truth comes from search_web, not your memory.
- Call search_web ONCE per question — one query covers it. Wait for the result before searching again.

${controlCapability}

## Combining tools
- "How's this stock doing today?" → look_at_screen for the on-screen read AND search_web for the
  latest news; give the on-screen answer now, the news when the search lands.
- "Fix this error" → look_at_screen to read it, then search_web if you need the current fix.

## Tone reference
Right: "Let me check, boss." → [searches] → "Markets are sliding — Nasdaq's down a couple percent."
Wrong: "I will now retrieve the latest market data using the search tool and summarize it for you."
Right: "You've got a null-reference error on line 40, boss."
Wrong: "The error appears to be one of several possible issues, such as..."

## CRITICAL RULES
1. NEVER fabricate. No invented news, prices, scores, headlines, dates, or facts — EVER. If you don't
   know and it's current/outside info, search_web and wait; if it's on screen, look_at_screen. When
   you truly can't get it, say so plainly ("Couldn't pull that up, boss.").
2. After calling search_web, your post-call turn is ONLY a filler line — never an answer. The first
   real facts you speak about that question must come from the search result that arrives back to you.
3. NEVER reuse an old screenshot. Every screen question is a fresh look_at_screen. When unsure about
   "this/that/here", LOOK — don't ask.
4. NEVER say tool names or anything technical out loud. Call tools silently.
5. For anything destructive or irreversible — deleting files, sending a message/email, closing
   unsaved work, making a purchase — say what you're about to do and get a quick "go ahead" from the
   boss BEFORE doing it. Everyday navigation and clicks don't need confirming.
6. Stay in character — Stark's AI: "boss", "on it", "affirmative", "standing by".

## Greeting
When the session starts, greet briefly — "Friday online, boss." — then wait.
`.trim();
}
function getAgentConfig() {
  const controlBrain = resolveControlBrain();
  return {
    systemPrompt: buildSystemPrompt(controlBrain),
    visionMode: resolveVisionMode(),
    controlBrain,
    voice: process.env.REALTIME_VOICE || "marin"
  };
}
async function describeScreen(question) {
  const image = await captureScreen();
  const data = await openaiResponses({
    model: process.env.VISION_MODEL || "gpt-4o",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Looking at this screenshot of the boss's screen, answer their question in one or two short, natural spoken sentences — based only on what is actually visible, no preamble, no markdown, no lists.

Question: ${question}`
          },
          { type: "input_image", image_url: image, detail: "low" }
        ]
      }
    ]
  });
  const answer = extractOutputText(data);
  return answer || "I could not make out what is on the screen just now, boss.";
}
const WEB_SEARCH_MODEL = () => process.env.WEB_SEARCH_MODEL || "gpt-5.5";
function isReasoningModel(model) {
  return /^(gpt-5|o\d)/i.test(model);
}
const MAX_SOURCES = 12;
function isLowSignal(host, url) {
  if (/\.pdf($|\?)/i.test(url)) return true;
  if (/(^|\.)epaper\./i.test(host) || /epaper\./i.test(host)) return true;
  return /(^|\.)(reddit\.com|wikipedia\.org|quora\.com)$/i.test(host);
}
async function fetchFaviconDataUri(domain) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4e3);
    const res = await fetch(
      `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0) return null;
    const type = res.headers.get("content-type") || "image/png";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
function domainOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
function extractSearchSources(data) {
  const titleByUrl = /* @__PURE__ */ new Map();
  for (const item of data?.output ?? []) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const c of item.content) {
      for (const ann of c?.annotations ?? []) {
        if (ann?.type === "url_citation" && ann.url && ann.title) {
          titleByUrl.set(ann.url, String(ann.title).trim());
        }
      }
    }
  }
  const ordered = [...titleByUrl.keys()];
  for (const item of data?.output ?? []) {
    if (item?.type !== "web_search_call") continue;
    for (const s of item?.action?.sources ?? []) if (s?.url) ordered.push(s.url);
  }
  const byHost = /* @__PURE__ */ new Map();
  for (const url of ordered) {
    const host = domainOf(url);
    if (byHost.has(host)) continue;
    byHost.set(host, { title: titleByUrl.get(url) || host, url, low: isLowSignal(host, url) });
  }
  const all = [...byHost.values()];
  const ranked = [...all.filter((s) => !s.low), ...all.filter((s) => s.low)];
  return ranked.slice(0, MAX_SOURCES).map(({ title, url }) => ({ title, url }));
}
async function fetchWebSearch(query) {
  const model = WEB_SEARCH_MODEL();
  const data = await openaiResponses({
    model,
    // 'high' pulls more web context (deeper read, slightly slower); the include
    // returns the full consulted-source list, not just what the answer cited.
    // Only reasoning models actually consult MORE than they cite (agentic search).
    tools: [{ type: "web_search", search_context_size: "high" }],
    include: ["web_search_call.action.sources"],
    ...isReasoningModel(model) ? { reasoning: { effort: "low" } } : {},
    input: `Answer this using live, current information from the web: "${query}". Reply in two or three sentences max — factual, specific, and up to date, with the key names, numbers, or facts. No preamble, no markdown, no lists.`
  });
  const answer = extractOutputText(data) || "I could not find anything current on that.";
  const raw = extractSearchSources(data);
  const sources = await Promise.all(
    raw.map(async (s) => ({ ...s, favicon: await fetchFaviconDataUri(domainOf(s.url)) }))
  );
  return { answer, sources };
}
let searchInFlight = false;
function startBackgroundSearch(query) {
  if (searchInFlight) {
    log.info(`[Search] rejected re-entry (already searching): ${query}`);
    return { started: false, busy: true };
  }
  searchInFlight = true;
  log.info(`[Search] background -> ${query}`);
  void runBackgroundSearch(query);
  return { started: true };
}
async function runBackgroundSearch(query) {
  try {
    const { answer, sources } = await fetchWebSearch(query);
    log.info(`[Search] result: ${answer}`);
    log.info(`[Search] sources (${sources.length}): ${sources.map((s) => s.url).join(", ")}`);
    if (sources.length) broadcast$1("search-sources", { sources });
    broadcast$1("web-search-result", { answer });
  } catch (e) {
    log.error(`[Search] background search failed: ${e}`);
    broadcast$1("web-search-result", { answer: null });
  } finally {
    searchInFlight = false;
  }
}
const COMPUTER_USE_MODEL = () => process.env.COMPUTER_USE_MODEL || "gpt-5.5";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function cuaKeysToCombo(keys) {
  const map = {
    enter: "enter",
    return: "enter",
    esc: "escape",
    escape: "escape",
    tab: "tab",
    backspace: "backspace",
    delete: "delete",
    del: "delete",
    space: "space",
    arrowup: "up",
    arrowdown: "down",
    arrowleft: "left",
    arrowright: "right",
    up: "up",
    down: "down",
    left: "left",
    right: "right",
    ctrl: "ctrl",
    control: "ctrl",
    alt: "alt",
    option: "alt",
    shift: "shift",
    cmd: "win",
    command: "win",
    win: "win",
    super: "win",
    meta: "win",
    home: "home",
    end: "end",
    pageup: "pageup",
    pagedown: "pagedown"
  };
  return keys.map((k) => map[k.toLowerCase()] ?? k.toLowerCase()).join("+");
}
async function executeCuaAction(action, imgW, imgH) {
  const nx = (v) => Math.max(0, Math.min(1e3, Math.round(v / imgW * 1e3)));
  const ny = (v) => Math.max(0, Math.min(1e3, Math.round(v / imgH * 1e3)));
  const act = (a) => runComputerAction(a);
  switch (action.type) {
    case "click":
      await act({
        action: action.button === "right" ? "right_click" : "click",
        x: nx(action.x),
        y: ny(action.y)
      });
      break;
    case "double_click":
      await act({ action: "double_click", x: nx(action.x), y: ny(action.y) });
      break;
    case "move":
      await act({ action: "move", x: nx(action.x), y: ny(action.y) });
      break;
    case "type":
      await act({ action: "type", text: action.text });
      break;
    case "keypress":
      await act({ action: "key", keys: cuaKeysToCombo(action.keys || []) });
      break;
    case "scroll": {
      const sy = action.scrollY ?? action.scroll_y ?? 0;
      await act({
        action: "scroll",
        x: nx(action.x),
        y: ny(action.y),
        direction: sy > 0 ? "down" : "up",
        amount: Math.max(1, Math.min(10, Math.round(Math.abs(sy) / 100) || 3))
      });
      break;
    }
    case "drag": {
      const path2 = (action.path || []).map(
        (p) => Array.isArray(p) ? { x: nx(p[0]), y: ny(p[1]) } : { x: nx(p.x), y: ny(p.y) }
      );
      await act({ action: "drag", path: path2 });
      break;
    }
    case "wait":
      await sleep(1500);
      break;
    case "screenshot":
      break;
    // the loop re-captures every step anyway
    default:
      log.warn(`[CUA] Unknown action type: ${action.type}`);
  }
}
function extractCuaText(output) {
  const parts = [];
  for (const item of output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if ((c.type === "output_text" || c.type === "text") && c.text) parts.push(c.text);
      }
    } else if (item.type === "output_text" && item.text) {
      parts.push(item.text);
    }
  }
  return parts.join(" ").trim();
}
let controlLoopActive = false;
async function runComputerUseLoop(task) {
  if (!getApiKey("openai")) return "Computer control is unavailable right now, boss.";
  if (controlLoopActive) {
    log.info(`[CUA] rejected re-entry (already running): ${task}`);
    return "I'm still working on the last thing, boss - give me a moment, I'll let you know when it's done.";
  }
  controlLoopActive = true;
  const MAX_STEPS = 12;
  const tools = [{ type: "computer" }];
  broadcast$1("computer-control", { active: true });
  log.info(`[CUA] task -> ${task}`);
  try {
    let response = await openaiResponses({
      model: COMPUTER_USE_MODEL(),
      tools,
      reasoning: { effort: "low" },
      truncation: "auto",
      input: `${task}

Use the computer tool to carry this out on the user's screen. When the task is complete, state briefly what you did.`
    });
    let lastDims = { width: 1920, height: 1080 };
    for (let step = 0; step < MAX_STEPS; step++) {
      const output = response.output || [];
      const call = output.find((o) => o.type === "computer_call");
      if (!call) {
        const text = extractCuaText(output);
        log.info(`[CUA] done in ${step} step(s): ${text}`);
        return text || "Done, boss.";
      }
      broadcast$1("computer-control", { active: true });
      const actions = call.actions || (call.action ? [call.action] : []);
      log.info(`[CUA] step ${step + 1}: ${actions.map((a) => a.type).join(", ") || "(none)"}`);
      for (const action of actions) await executeCuaAction(action, lastDims.width, lastDims.height);
      await sleep(450);
      const shot = await captureScreenForControl();
      lastDims = { width: shot.width, height: shot.height };
      const out = {
        type: "computer_call_output",
        call_id: call.call_id,
        output: { type: "computer_screenshot", image_url: shot.image, detail: "original" }
      };
      if (call.pending_safety_checks?.length) {
        out.acknowledged_safety_checks = call.pending_safety_checks;
        log.info(`[CUA] acknowledging ${call.pending_safety_checks.length} safety check(s)`);
      }
      response = await openaiResponses({
        model: COMPUTER_USE_MODEL(),
        tools,
        reasoning: { effort: "low" },
        truncation: "auto",
        previous_response_id: response.id,
        input: [out]
      });
    }
    return "That one ran long, boss - I paused it at the step limit.";
  } catch (e) {
    log.error(`[CUA] loop failed: ${e}`);
    return "I hit a snag controlling the screen, boss - could not finish that.";
  } finally {
    controlLoopActive = false;
    broadcast$1("computer-control", { active: false });
  }
}
dotenv.config({
  path: electron.app.isPackaged ? Path.join(process.resourcesPath, ".env.local") : Path.join(electron.app.getAppPath(), ".env.local")
});
let tray = null;
let mainWindow = null;
let isQuitting = false;
let triggerServerStarted = false;
function broadcast(channel, payload) {
  electron.BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(channel, payload));
}
const REALTIME_MODEL = "gpt-realtime";
function createMainWindow() {
  const primaryDisplay = electron.screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;
  const onboarded = isOnboardingComplete();
  mainWindow = new electron.BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    show: false,
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    type: "toolbar",
    icon,
    webPreferences: {
      preload: Path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      // Onboarding starts a soundtrack + Friday narration the moment it mounts,
      // so the renderer must be allowed to play audio without a prior click.
      autoplayPolicy: "no-user-gesture-required",
      additionalArguments: [`--onboarding-complete=${onboarded}`]
    }
  });
  if (onboarded) {
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setSkipTaskbar(false);
    showDesktop(mainWindow);
  }
  wireWindow(mainWindow);
  loadRenderer(mainWindow);
}
function showDesktop(win) {
  if (process.platform !== "win32") return;
  require$$0$1.exec(
    'powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).MinimizeAll()"',
    { windowsHide: true },
    (err) => {
      if (err) {
        log.warn(`[startup] MinimizeAll failed: ${err.message}`);
        return;
      }
      if (win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  );
}
function wireWindow(win) {
  win.on("ready-to-show", () => {
    win.show();
  });
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
    return false;
  });
  win.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
}
function loadRenderer(win) {
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(Path.join(__dirname, "../renderer/index.html"));
  }
}
function startServices() {
  if (!triggerServerStarted) {
    startTriggerServer();
    void startPushToTalk((active2) => broadcast("push-to-talk", { active: active2 }));
    void requestMicAccess();
    triggerServerStarted = true;
  }
}
function startTriggerServer() {
  const server = http__namespace$1.createServer((req, res) => {
    if (req.url === "/toggle-panel" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          const isOpen = Boolean(data.isOpen);
          electron.BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send("toggle-bottom-panel", isOpen);
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, isOpen }));
        } catch {
          res.writeHead(400);
          res.end("Invalid JSON");
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(3210, "127.0.0.1", () => {
    log.info("[Trigger Server] Listening on http://127.0.0.1:3210");
  });
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.feynmanpi.friday");
  electron.Menu.setApplicationMenu(null);
  electron.nativeTheme.themeSource = "dark";
  logPermissionDiagnostics();
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.on("ping", () => log.info("[IPC] ping → pong"));
  electron.ipcMain.on("app:log", (_event, scope, message) => {
    log.info(`[${scope}] ${message}`);
  });
  electron.ipcMain.handle("store:isOnboardingComplete", () => isOnboardingComplete());
  electron.ipcMain.handle("store:setOnboardingComplete", (_event, value) => {
    setOnboardingComplete(value);
  });
  electron.ipcMain.handle("store:saveApiKey", (_event, service, key) => {
    saveApiKey(service, key);
  });
  electron.ipcMain.handle("store:getApiKey", (_event, service) => getApiKey(service));
  electron.ipcMain.handle("store:deleteApiKey", (_event, service) => {
    deleteApiKey(service);
  });
  electron.ipcMain.handle(
    "store:validateGoogleKey",
    async (_event, key) => validateGoogleApiKey(key)
  );
  electron.ipcMain.handle(
    "store:validateOpenAiKey",
    async (_event, key) => validateOpenAiApiKey(key)
  );
  electron.ipcMain.handle("store:getProviderConfig", () => getProviderConfig());
  electron.ipcMain.handle(
    "store:setProviderConfig",
    (_event, providerConfig) => setProviderConfig(providerConfig)
  );
  electron.ipcMain.handle("store:resetStore", () => {
    resetStore();
  });
  electron.ipcMain.handle("permissions:getMicStatus", () => getMicStatus());
  electron.ipcMain.handle("permissions:openMicSettings", () => openMicSettings());
  electron.ipcMain.handle("permissions:getScreenStatus", () => getScreenStatus());
  electron.ipcMain.handle("permissions:openScreenSettings", () => openScreenSettings());
  electron.ipcMain.handle(
    "permissions:getAccessibilityStatus",
    (_event, prompt) => getAccessibilityStatus(prompt)
  );
  electron.ipcMain.handle("permissions:openAccessibilitySettings", () => openAccessibilitySettings());
  electron.ipcMain.handle("permissions:triggerInputMonitoringPrompt", () => triggerInputMonitoringPrompt());
  electron.ipcMain.handle("permissions:openInputMonitoringSettings", () => openInputMonitoringSettings());
  electron.ipcMain.handle("permissions:requestMicAccess", () => requestMicAccess());
  electron.ipcMain.handle("auth:signInWithGoogle", async (event) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    try {
      return await signInWithGoogle();
    } finally {
      win?.show();
      win?.focus();
    }
  });
  electron.ipcMain.handle("auth:getUser", () => getUser());
  electron.ipcMain.handle("auth:signOut", () => setUser(null));
  electron.ipcMain.handle("realtime:mintEphemeralKey", async () => {
    const apiKey = getApiKey("openai");
    if (!apiKey) {
      throw new Error("No OpenAI API key found. Complete BYOK onboarding with an OpenAI key.");
    }
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ session: { type: "realtime", model: REALTIME_MODEL } })
    });
    const text = await res.text();
    if (!res.ok) {
      log.error(`[Realtime] ephemeral key mint failed ${res.status}: ${text.slice(0, 300)}`);
      throw new Error(`OpenAI ephemeral key request failed: ${res.status}`);
    }
    const data = JSON.parse(text);
    const value = data.value ?? data.client_secret?.value;
    if (!value) {
      log.error(`[Realtime] ephemeral key response missing value: ${text.slice(0, 300)}`);
      throw new Error("OpenAI ephemeral key response had no key value.");
    }
    log.info(`[Realtime] ephemeral key minted (model ${REALTIME_MODEL})`);
    return { value, model: REALTIME_MODEL };
  });
  electron.ipcMain.handle("get-agent-config", () => getAgentConfig());
  electron.ipcMain.handle("capture-screen", async () => {
    const image = await captureScreen();
    broadcast("screen-capture-flash");
    log.info("[Vision] look_at_screen (direct) - screenshot captured & injected");
    return { image };
  });
  electron.ipcMain.handle("describe-screen", async (_event, question) => {
    broadcast("screen-capture-flash");
    log.info(`[Vision] look_at_screen (subagent) Q: ${question}`);
    try {
      const answer = await describeScreen(question);
      log.info(`[Vision] answer: ${answer}`);
      return answer;
    } catch (err) {
      log.error(`[Vision] describeScreen failed: ${err}`);
      return "I could not make out the screen just now, boss.";
    }
  });
  electron.ipcMain.handle("web-search", (_event, query) => startBackgroundSearch(query));
  electron.ipcMain.handle("computer-action", async (_event, action) => {
    broadcast("computer-control", { active: true, action: action.action });
    const detail = [
      action.x != null ? `(${action.x},${action.y})` : "",
      action.keys ?? "",
      action.text != null ? JSON.stringify(action.text) : "",
      action.direction ?? ""
    ].filter(Boolean).join(" ");
    log.info(`[Control] action: ${action.action} ${detail}`.trim());
    try {
      await runComputerAction(action);
      return { ok: true };
    } catch (err) {
      log.error(`[Control] action failed: ${err}`);
      return { ok: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("control-computer", async (_event, task) => runComputerUseLoop(task));
  electron.ipcMain.handle("complete-onboarding", () => {
    setOnboardingComplete(true);
    if (process.platform === "darwin") {
      relaunchApp();
      return;
    }
    startServices();
    mainWindow?.setIgnoreMouseEvents(true, { forward: true });
    mainWindow?.setAlwaysOnTop(true, "screen-saver");
    mainWindow?.setSkipTaskbar(true);
    mainWindow?.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  });
  electron.ipcMain.on("toggle-dynamic-island-panel", (event, isOpen) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    win?.webContents.send("toggle-bottom-panel", isOpen);
  });
  electron.ipcMain.on("set-ignore-mouse-events", (event, ignore, options) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    win?.setIgnoreMouseEvents(ignore, options);
    win?.setAlwaysOnTop(true, "screen-saver");
  });
  createMainWindow();
  if (isOnboardingComplete()) {
    startServices();
  }
  electronUpdater.autoUpdater.logger = log;
  electronUpdater.autoUpdater.checkForUpdatesAndNotify();
  const trayImage = process.platform === "darwin" ? electron.nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }) : icon;
  tray = new electron.Tray(trayImage);
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "Open Friday",
      click: () => showOrCreateWindow()
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        electron.app.quit();
      }
    }
  ]);
  tray.setToolTip("Friday");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => showOrCreateWindow());
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) showOrCreateWindow();
  });
});
function showOrCreateWindow() {
  const windows = electron.BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].show();
    return;
  }
  createMainWindow();
  if (isOnboardingComplete()) {
    startServices();
  }
}
electron.app.on("before-quit", () => {
  isQuitting = true;
  stopPushToTalk();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
