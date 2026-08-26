import { useEffect, useRef } from 'react'

const CHARS = ' .:-=+*#%@'

type AsciiVideoProps = {
  src: string
  className?: string
}

export function AsciiVideo({ src, className }: AsciiVideoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    let raf = 0
    const cols = 72
    const rows = 40
    canvas.width = cols * 8
    canvas.height = rows * 12

    const draw = () => {
      if (video.readyState >= 2) {
        const off = document.createElement('canvas')
        off.width = cols
        off.height = rows
        const octx = off.getContext('2d')
        if (octx) {
          octx.drawImage(video, 0, 0, cols, rows)
          const { data } = octx.getImageData(0, 0, cols, rows)
          ctx.fillStyle = '#000'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = 'rgba(255,255,255,0.85)'
          ctx.font = '10px monospace'
          for (let y = 0; y < rows; y++) {
            let line = ''
            for (let x = 0; x < cols; x++) {
              const i = (y * cols + x) * 4
              const lum = (data[i]! + data[i + 1]! + data[i + 2]!) / 3
              line += CHARS[Math.floor((lum / 255) * (CHARS.length - 1))]
            }
            ctx.fillText(line, 0, (y + 1) * 12)
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    void video.play().catch(() => {})
    draw()
    return () => cancelAnimationFrame(raf)
  }, [src])

  return (
    <div className={className}>
      <video ref={videoRef} src={src} muted loop playsInline className="hidden" />
      <canvas ref={canvasRef} className="h-full w-full object-cover opacity-80" />
    </div>
  )
}
