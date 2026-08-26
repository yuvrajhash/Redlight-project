/// <reference types="vite/client" />
/// <reference path="../../../preload/types.d.ts" />

declare module '*.mp3' {
  const src: string
  export default src
}
declare module '*.mp4' {
  const src: string
  export default src
}
declare module '*.webp' {
  const src: string
  export default src
}
