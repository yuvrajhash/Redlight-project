import growwLogo from '@/assets/img/groww_logo.webp'

export function StockGraphCard() {
  return (
    <div className="mx-1.5 overflow-hidden rounded-xl border border-white/10 bg-slate-600/15 px-3 py-2.5 font-sans text-white">
      <div className="mb-2 flex items-center gap-2">
        <img src={growwLogo} alt="Groww" className="h-7 w-7" />
        <div>
          <p className="text-[12px] font-semibold">NIFTY 50</p>
          <p className="text-[10px] text-zinc-400">Live demo chart</p>
        </div>
      </div>
      <svg viewBox="0 0 240 60" className="h-14 w-full text-[#1FD5F9]">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points="0,40 30,35 60,42 90,28 120,32 150,18 180,22 210,12 240,16"
        />
      </svg>
    </div>
  )
}
