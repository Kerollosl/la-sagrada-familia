import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  formatYearDisplay,
  getHistoricalContext,
  PHASES,
  PhaseProgressState,
} from '../data/timeline';

interface HistoricalInfoCardProps {
  year: number;
  progress: PhaseProgressState;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onJumpToPhase: (startYear: number, endYear: number) => void;
}

export function HistoricalInfoCard({
  year,
  progress,
  collapsed,
  onToggleCollapse,
  onJumpToPhase,
}: HistoricalInfoCardProps) {
  const ctx = getHistoricalContext(year);
  const yearLabel = formatYearDisplay(year);

  return (
    <aside
      aria-label="Historical construction details"
      className="fixed top-4 left-4 z-10 w-[312px] max-w-[calc(100vw-2rem)] rounded-xl bg-[#14171c]/92 border border-[#fff5e1]/15 text-[#f7f3eb] shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#fff5e1]/10">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight leading-tight text-[#f7f3eb] truncate">
            La Sagrada Família
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] text-[#b9b1a3] mt-0.5">
            <span>Barcelona</span>
            <span aria-hidden="true">·</span>
            <span>1882–2026+</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-[#e0a458]">
              {progress.overallCompletionPct}% Built
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand historical info card' : 'Collapse historical info card'}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[#cfc7b8] hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-[#e0a458]"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="max-h-[min(45dvh,calc(100dvh-10rem))] overflow-y-auto p-4 space-y-3.5 md:max-h-[calc(100dvh-14rem)]">
          <div className="flex items-baseline justify-between gap-3">
            <div
              className="font-display text-4xl font-semibold leading-none tracking-tight text-[#e0a458] font-mono-tabular"
              data-testid="hud-year"
            >
              {yearLabel}
            </div>
            <div className="text-right min-w-0">
              <div className="text-[11px] text-[#a79f91]">Active Architect</div>
              <div
                className="text-[13px] font-medium text-[#f7f3eb] leading-snug"
                data-testid="hud-architect"
              >
                {ctx.architect}
              </div>
            </div>
          </div>

          <div>
            <h2
              className="text-sm font-semibold text-[#f7f3eb] leading-snug mb-1"
              data-testid="hud-era-title"
            >
              {ctx.title}
            </h2>
            <p
              className="text-[12.5px] leading-relaxed text-[#d4cdbf]"
              data-testid="hud-summary"
            >
              {ctx.summary}
            </p>
          </div>

          <div className="pt-2.5 border-t border-[#fff5e1]/10 space-y-1.5">
            <div className="text-[11px] text-[#a79f91]">Construction Phases</div>
            <div className="grid grid-cols-1 gap-1">
              {PHASES.map((phase) => {
                const pct = Math.round(progress[phase.id] * 100);
                const isActive = ctx.activePhase === phase.id;
                return (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => onJumpToPhase(phase.startYear, phase.endYear)}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-[#e0a458] ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-[#cfc7b8] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0 border border-white/20"
                        style={{ backgroundColor: phase.swatchHex }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-medium">{phase.label}</span>
                    </span>
                    <span className="font-mono-tabular text-[11px] text-[#b9b1a3] shrink-0">
                      {pct}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
