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
          error ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] font-medium text-destructive", children: error }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-muted-foreground", children: "Create an OpenAI API Key at platform.openai.com/api-keys." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-2 pt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "submit", disabled: loading, className: "w-full gap-1.5 text-sm", children: loading ? "Booting sequence..." : /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: "Encrypt & Begin" }) }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "h-3 w-3" }),
        "Encrypted on this device — it never leaves your machine."
      ] })
    ] })
  ] });
}
const PRECISIONS = ["lowp", "mediump", "highp"];
const FS_MAIN_SHADER = `
void main(void){
    vec4 color = vec4(0.0,0.0,0.0,1.0);
    mainImage( color, gl_FragCoord.xy );
    gl_FragColor = color;
}`;
const BASIC_FS = `void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = fragCoord/iResolution.xy;
    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
    fragColor = vec4(col,1.0);
}`;
const BASIC_VS = `attribute vec3 aVertexPosition;
void main(void) {
    gl_Position = vec4(aVertexPosition, 1.0);
}`;
const UNIFORM_TIME = "iTime";
const UNIFORM_TIMEDELTA = "iTimeDelta";
const UNIFORM_DATE = "iDate";
const UNIFORM_FRAME = "iFrame";
const UNIFORM_MOUSE = "iMouse";
const UNIFORM_RESOLUTION = "iResolution";
const UNIFORM_CHANNEL = "iChannel";
const UNIFORM_CHANNELRESOLUTION = "iChannelResolution";
const UNIFORM_DEVICEORIENTATION = "iDeviceOrientation";
function isMatrixType(t, v) {
  return t.includes("Matrix") && Array.isArray(v);
}
function isVectorListType(t, v) {
  return t.includes("v") && Array.isArray(v) && v.length > Number.parseInt(t.charAt(0));
}
function isVectorType(t, v) {
  return !t.includes("v") && Array.isArray(v) && v.length > Number.parseInt(t.charAt(0));
}
const processUniform = (gl, location, t, value) => {
  if (isVectorType(t, value)) {
    switch (t) {
      case "2f":
        return gl.uniform2f(location, value[0], value[1]);
      case "3f":
        return gl.uniform3f(location, value[0], value[1], value[2]);
      case "4f":
        return gl.uniform4f(location, value[0], value[1], value[2], value[3]);
      case "2i":
        return gl.uniform2i(location, value[0], value[1]);
      case "3i":
        return gl.uniform3i(location, value[0], value[1], value[2]);
      case "4i":
        return gl.uniform4i(location, value[0], value[1], value[2], value[3]);
    }
  }
  if (typeof value === "number") {
    switch (t) {
      case "1i":
        return gl.uniform1i(location, value);
      default:
        return gl.uniform1f(location, value);
    }
  }
  switch (t) {
    case "1iv":
      return gl.uniform1iv(location, value);
    case "2iv":
      return gl.uniform2iv(location, value);
    case "3iv":
      return gl.uniform3iv(location, value);
    case "4iv":
      return gl.uniform4iv(location, value);
    case "1fv":
      return gl.uniform1fv(location, value);
    case "2fv":
      return gl.uniform2fv(location, value);
    case "3fv":
      return gl.uniform3fv(location, value);
    case "4fv":
      return gl.uniform4fv(location, value);
    case "Matrix2fv":
      return gl.uniformMatrix2fv(location, false, value);
    case "Matrix3fv":
      return gl.uniformMatrix3fv(location, false, value);
    case "Matrix4fv":
      return gl.uniformMatrix4fv(location, false, value);
  }
};
const uniformTypeToGLSLType = (t) => {
  switch (t) {
    case "1f":
      return "float";
    case "2f":
      return "vec2";
    case "3f":
      return "vec3";
    case "4f":
      return "vec4";
    case "1i":
      return "int";
    case "2i":
      return "ivec2";
    case "3i":
      return "ivec3";
    case "4i":
      return "ivec4";
    case "1iv":
      return "int";
    case "2iv":
      return "ivec2";
    case "3iv":
      return "ivec3";
    case "4iv":
      return "ivec4";
    case "1fv":
      return "float";
    case "2fv":
      return "vec2";
    case "3fv":
      return "vec3";
    case "4fv":
      return "vec4";
    case "Matrix2fv":
      return "mat2";
    case "Matrix3fv":
      return "mat3";
    case "Matrix4fv":
      return "mat4";
    default:
      console.error(
        log(`The uniform type "${t}" is not valid, please make sure your uniform type is valid`)
      );
      return void 0;
  }
};
const LinearFilter = 9729;
const NearestFilter = 9728;
const LinearMipMapLinearFilter = 9987;
const ClampToEdgeWrapping = 33071;
const RepeatWrapping = 10497;
class Texture {
  gl;
  url;
  wrapS;
  wrapT;
  minFilter;
  magFilter;
  source;
  pow2canvas;
  isLoaded = false;
  isVideo = false;
  flipY = -1;
  width = 0;
  height = 0;
  _webglTexture = null;
  constructor(gl) {
    this.gl = gl;
  }
  updateTexture = (texture, video, flipY) => {
    const { gl } = this;
    const level = 0;
    const internalFormat = gl.RGBA;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, video);
  };
  setupVideo = (url) => {
    const video = document.createElement("video");
    let playing = false;
    let timeupdate = false;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.crossOrigin = "anonymous";
    const checkReady = () => {
      if (playing && timeupdate) {
        this.isLoaded = true;
      }
    };
    video.addEventListener(
      "playing",
      () => {
        playing = true;
        this.width = video.videoWidth || 0;
        this.height = video.videoHeight || 0;
        checkReady();
      },
      true
    );
    video.addEventListener(
      "timeupdate",
      () => {
        timeupdate = true;
        checkReady();
      },
      true
    );
    video.src = url;
    return video;
  };
  makePowerOf2 = (image) => {
    if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof ImageBitmap) {
      if (this.pow2canvas === void 0) this.pow2canvas = document.createElement("canvas");
      this.pow2canvas.width = 2 ** Math.floor(Math.log(image.width) / Math.LN2);
      this.pow2canvas.height = 2 ** Math.floor(Math.log(image.height) / Math.LN2);
      const context = this.pow2canvas.getContext("2d");
      context?.drawImage(image, 0, 0, this.pow2canvas.width, this.pow2canvas.height);
      console.warn(
        log(
          `Image is not power of two ${image.width} x ${image.height}. Resized to ${this.pow2canvas.width} x ${this.pow2canvas.height};`
        )
      );
      return this.pow2canvas;
    }
    return image;
  };
  load = async (textureArgs) => {
    const { gl } = this;
    const { url, wrapS, wrapT, minFilter, magFilter, flipY = -1 } = textureArgs;
    if (!url) {
      return Promise.reject(
        new Error(log("Missing url, please make sure to pass the url of your texture { url: ... }"))
      );
    }
    const isImage2 = /(\.jpg|\.jpeg|\.png|\.gif|\.bmp)$/i.exec(url);
    const isVideo = /(\.mp4|\.3gp|\.webm|\.ogv)$/i.exec(url);
    if (isImage2 === null && isVideo === null) {
      return Promise.reject(
        new Error(log(`Please upload a video or an image with a valid format (url: ${url})`))
      );
    }
    Object.assign(this, { url, wrapS, wrapT, minFilter, magFilter, flipY });
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([255, 255, 255, 0]);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      srcFormat,
      srcType,
      pixel
    );
    if (isVideo) {
      const video = this.setupVideo(url);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      this._webglTexture = texture;
      this.source = video;
      this.isVideo = true;
      return video.play().then(() => this);
    }
  