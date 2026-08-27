export function ComputerUseCard({ action }: { action?: string }) {
  return (
    <div className="mx-1.5 rounded-xl border border-white/10 bg-slate-600/15 px-3 py-2.5 font-sans text-white">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1FD5F9]">
        Computer control
      </p>
      <p className="mt-1 text-[12px] text-zinc-200">
        {action ? `Working: ${action}` : 'YUV is navigating your screen…'}
      </p>
    </div>
  )
}
