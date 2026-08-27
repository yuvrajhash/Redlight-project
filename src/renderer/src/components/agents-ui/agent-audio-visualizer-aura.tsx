import { useEffect, useRef } from 'react'
import type { AgentState } from '@/realtime/useYUVSession'

const STATE_COLORS: Record<AgentState, [number, number, number]> = {
  connecting: [0.3, 0.35, 0.4],
  idle: [0.12, 0.84, 0.98],
  listening: [0.2, 0.95, 0.6],
  thinking: [0.85, 0.55, 0.2],
  speaking: [0.45, 0.55, 1.0],
  failed: [0.95, 0.2, 0.25]
}

export function AgentAudioVisualizerAura({
  agentState,
  audioTrack,
  className
}: {
  agentState: AgentState
  audioTrack?: MediaStreamTrack | null
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const levelRef = useRef(0.15)

  useEffect(() => {
    if (!audioTrack) return
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    let raf = 0
    const tick = () => {
      analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]!
      levelRef.current = Math.min(1, 0.12 + sum / data.length / 90)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      source.disconnect()
      void ctx.close().catch(() => {})
    }
  }, [audioTrack])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl')
    if (!gl) return

    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, `attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }`)
    gl.compileShader(vs)
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(
      fs,
      `precision mediump float;
uniform float uTime; uniform float uLevel; uniform vec3 uColor;
void main(){
  vec2 uv = gl_FragCoord.xy / vec2(400.0) - 0.5;
  float d = length(uv);
  float pulse = 0.28 + uLevel * 0.35 + 0.04*sin(uTime*2.5);
  float a = smoothstep(pulse, pulse-0.18, d) * (0.55 + uLevel*0.45);
  float ring = smoothstep(0.02, 0.0, abs(d - pulse*0.72)) * 0.35;
  gl_FragColor = vec4(uColor, a + ring);
}`
    )
    gl.compileShader(fs)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uLevel = gl.getUniformLocation(prog, 'uLevel')
    const uColor = gl.getUniformLocation(prog, 'uColor')
    let raf = 0
    const start = performance.now()
    const draw = () => {
      const color = STATE_COLORS[agentState] ?? STATE_COLORS.idle
      canvas.width = 400
      canvas.height = 400
      gl.viewport(0, 0, 400, 400)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.uniform1f(uTime, (performance.now() - start) / 1000)
      gl.uniform1f(uLevel, levelRef.current)
      gl.uniform3f(uColor, color[0], color[1], color[2])
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [agentState])

  return <canvas ref={canvasRef} className={className ?? 'h-full w-full'} />
}
