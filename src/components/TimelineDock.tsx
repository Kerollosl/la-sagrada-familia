import {
  Bird,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Crosshair,
  Download,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Sunrise,
  Tag,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  formatYearDisplay,
  KEY_MILESTONES,
  MAX_YEAR,
  MIN_YEAR,
} from '../data/timeline';
import { GeminiVoiceName } from '../utils/narration';
import { resolveTimeOfDayPreset, TimeOfDayPreset } from '../utils/timeOfDay';
import { WeatherMode } from '../utils/atmosphereParticles';

interface TimelineDockProps {
  year: number;
  isPlaying: boolean;
  autoOrbit: boolean;
  timeOfDay: number;
  cycleTimeOfDay: boolean;
  weatherMode: WeatherMode;
  birdsEnabled: boolean;
  focusMode: boolean;
  labelsVisible: boolean;
  narrationEnabled: boolean;
  narrationLoading: boolean;
  narrationCaption: string | null;
  narrationError: string | null;
  voiceName: GeminiVoiceName;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onTogglePlay: () => void;
  onYearChange: (year: number) => void;
  onSelectMilestone: (milestoneId: string) => void;
  onToggleAutoOrbit: () => void;
  onSelectTimeOfDayPreset: (preset: TimeOfDayPreset) => void;
  onToggleCycleTimeOfDay: () => void;
  onWeatherChange: (mode: WeatherMode) => void;
  onToggleBirds: () => void;
  onToggleFocusMode: () => void;
  onToggleLabels: () => void;
  onToggleNarration: () => void;
  onVoiceChange: (voice: GeminiVoiceName) => void;
  onResetView: () => void;
  onDownloadStandalone: () => void;
}

const VOICE_OPTIONS: { id: GeminiVoiceName; label: string }[] = [
  { id: 'Charon', label: 'Charon (Warm)' },
  { id: 'Kore', label: 'Kore (Clear)' },
  { id: 'Zephyr', label: 'Zephyr (Bright)' },
  { id: 'Puck', label: 'Puck (Lively)' },
  { id: 'Fenrir', label: 'Fenrir (Deep)' },
];

const WEATHER_OPTIONS: { id: WeatherMode; label: string }[] = [
  { id: 'auto', label: 'Auto (Dusk/Night)' },
  { id: 'rain', label: 'Light Rain' },
  { id: 'fog', label: 'Drifting Mist' },
  { id: 'clear', label: 'Clear Sky' },
];

export function TimelineDock({
  year,
  isPlaying,
  autoOrbit,
  timeOfDay,
  cycleTimeOfDay,
  weatherMode,
  birdsEnabled,
  focusMode,
  labelsVisible,
  narrationEnabled,
  narrationLoading,
  narrationCaption,
  narrationError,
  voiceName,
  collapsed,
  onToggleCollapse,
  onTogglePlay,
  onYearChange,
  onSelectMilestone,
  onToggleAutoOrbit,
  onSelectTimeOfDayPreset,
  onToggleCycleTimeOfDay,
  onWeatherChange,
  onToggleBirds,
  onToggleFocusMode,
  onToggleLabels,
  onToggleNarration,
  onVoiceChange,
  onResetView,
  onDownloadStandalone,
}: TimelineDockProps) {
  const pct = ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
  const activePreset = resolveTimeOfDayPreset(timeOfDay);

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-10 w-[min(990px,95vw)] flex flex-col items-center pointer-events-none">
      {narrationEnabled && (narrationCaption || narrationError) && (
        <div
          role="status"
          aria-live="polite"
          data-testid="narration-caption"
          className={`pointer-events-auto mb-2 max-w-[min(560px,90vw)] px-4 py-2 rounded-lg bg-[#14171c]/92 border text-[12.5px] leading-snug text-center shadow-lg ${
            narrationError
              ? 'border-amber-400/50 text-amber-100'
              : 'border-[#e0a458]/35 text-[#f7f3eb]'
          }`}
        >
          {narrationError ? (
            <span>{narrationError}</span>
          ) : (
            <span>
              {narrationLoading && (
                <span className="text-[#e0a458] font-medium mr-1.5">
                  [Generating {voiceName} AI voice]
                </span>
              )}
              {narrationCaption}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show timeline controls' : 'Hide timeline controls'}
        className="pointer-events-auto mb-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg rounded-b-md bg-[#14171c]/90 border border-[#fff5e1]/15 text-[11px] font-medium text-[#d4cdbf] hover:text-white hover:bg-[#1b1f26] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e0a458]"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Show Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {!collapsed && (
        <section
          aria-label="Timeline playback and camera controls"
          className="pointer-events-auto w-full rounded-xl bg-[#14171c]/92 border border-[#fff5e1]/15 text-[#f7f3eb] shadow-2xl px-3.5 py-2.5 space-y-2"
        >
          {/* Primary Row: Play/Pause, Scrubber, Year Readout, Narration & Camera Controls */}
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause construction animation' : 'Play construction animation'}
              className="inline-flex items-center justify-center gap-2 min-h-[36px] px-4 rounded-lg bg-[#e0a458] hover:bg-[#eab46e] text-[#14171c] font-semibold text-xs transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>

            <div className="flex-1 min-w-[140px] flex items-center gap-2">
              <label htmlFor="timeline-year-slider" className="sr-only">
                Construction year from 1882 to 2026
              </label>
              <input
                id="timeline-year-slider"
                type="range"
                min={MIN_YEAR}
                max={MAX_YEAR}
                step={0.25}
                value={year}
                onChange={(e) => onYearChange(parseFloat(e.target.value))}
                className="timeline-slider w-full h-6"
                style={{
                  backgroundImage: `linear-gradient(to right, #e0a458 0%, #e0a458 ${pct}%, rgba(255,245,225,0.18) ${pct}%, rgba(255,245,225,0.18) 100%)`,
                  backgroundSize: '100% 6px',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                }}
              />
              <span className="font-mono-tabular text-sm font-medium text-[#f7f3eb] w-12 text-right shrink-0">
                {formatYearDisplay(year)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onToggleFocusMode}
                aria-pressed={focusMode}
                aria-label="Toggle facade Focus Mode"
                title="Focus Mode: click any facade or label for close-up trivia"
                className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e0a458] ${
                  focusMode
                    ? 'bg-[#e0a458]/22 border-[#e0a458]/65 text-[#f6cf92]'
                    : 'bg-white/5 border-white/10 text-[#d4cdbf] hover:text-white hover:bg-white/10'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Focus</span>
              </button>

              <button
                type="button"
                onClick={onToggleLabels}
                aria-pressed={labelsVisible}
                aria-label="Toggle annotated 3D labels"
                title="Show or hide annotated 3D architectural labels"
                className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e0a458] ${
                  labelsVisible
                    ? 'bg-[#e0a458]/20 border-[#e0a458]/55 text-[#f6cf92]'
                    : 'bg-white/5 border-white/10 text-[#d4cdbf] hover:text-white hover:bg-white/10'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Labels</span>
              </button>

              <button
                type="button"
                onClick={onToggleNarration}
                aria-pressed={narrationEnabled}
                aria-label={narrationEnabled ? 'Mute AI voice narration' : 'Enable AI voice narration'}
                className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e0a458] ${
                  narrationEnabled
                    ? 'bg-[#e0a458]/20 border-[#e0a458]/60 text-[#f6cf92]'
                    : 'bg-white/5 border-white/10 text-[#d4cdbf] hover:text-white hover:bg-white/10'
                }`}
              >
                {narrationEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span>Narrate</span>
              </button>

              <button
                type="button"
                onClick={onToggleAutoOrbit}
                aria-pressed={autoOrbit}
                className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e0a458] ${
                  autoOrbit
                    ? 'bg-[#e0a458]/20 border-[#e0a458]/60 text-[#f6cf92]'
                    : 'bg-white/5 border-white/10 text-[#d4cdbf] hover:text-white hover:bg-white/10'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Auto-Orbit</span>
              </button>

              <button
                type="button"
                onClick={onResetView}
                aria-label="Reset camera view"
                title="Reset camera view"
                className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-[#d4cdbf] hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e0a458]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Reset</span>
              </button>

              <button
                type="button"
                onClick={onDownloadStandalone}
                aria-label="Download single-file HTML version"
                title="Download single-file CDN HTML"
                className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-[#d4cdbf] hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e0a458]"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">HTML</span>
              </button>
            </div>
          </div>

          {/* Time of Day & Google AI Voice Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#fff5e1]/10">
            <div className="flex items-center gap-1.5" role="group" aria-label="Time of Day lighting">
              <span className="text-[11px] font-medium text-[#a79f91] mr-1 whitespace-nowrap">
                Time of Day
              </span>
              <button
                type="button"
                onClick={() => onSelectTimeOfDayPreset('day')}
                aria-pressed={!cycleTimeOfDay && activePreset === 'day'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  !cycleTimeOfDay && activePreset === 'day'
                    ? 'bg-[#e0a458]/20 border-[#e0a458]/55 text-[#f6cf92]'
                    : 'bg-white/5 border-transparent text-[#cfc7b8] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Daylight</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTimeOfDayPreset('dusk')}
                aria-pressed={!cycleTimeOfDay && activePreset === 'dusk'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  !cycleTimeOfDay && activePreset === 'dusk'
                    ? 'bg-[#e0a458]/20 border-[#e0a458]/55 text-[#f6cf92]'
                    : 'bg-white/5 border-transparent text-[#cfc7b8] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Sunrise className="w-3.5 h-3.5" />
                <span>Golden Hour</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTimeOfDayPreset('night')}
                aria-pressed={!cycleTimeOfDay && activePreset === 'night'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  !cycleTimeOfDay && activePreset === 'night'
                    ? 'bg-[#e0a458]/20 border-[#e0a458]/55 text-[#f6cf92]'
                    : 'bg-white/5 border-transparent text-[#cfc7b8] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Night</span>
              </button>

              <button
                type="button"
                onClick={onToggleCycleTimeOfDay}
                aria-pressed={cycleTimeOfDay}
                aria-label="Toggle continuous Time of Day cycle"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  cycleTimeOfDay
                    ? 'bg-[#e0a458]/20 border-[#e0a458]/55 text-[#f6cf92]'
                    : 'bg-white/5 border-white/10 text-[#cfc7b8] hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>Cycle</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-[#a79f91]" />
                <label htmlFor="weather-mode-select" className="sr-only">
                  Weather Particles
                </label>
                <select
                  id="weather-mode-select"
                  aria-label="Atmospheric weather effect"
                  value={weatherMode}
                  onChange={(e) => onWeatherChange(e.target.value as WeatherMode)}
                  className="px-2 py-1 rounded-md bg-[#1f242c] border border-white/12 text-xs text-[#f7f3eb] focus-visible:outline-2 focus-visible:outline-[#e0a458]"
                >
                  {WEATHER_OPTIONS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={onToggleBirds}
                aria-pressed={birdsEnabled}
                aria-label="Toggle bird flocking animation"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  birdsEnabled
                    ? 'bg-[#e0a458]/20 border-[#e0a458]/55 text-[#f6cf92]'
                    : 'bg-white/5 border-white/10 text-[#cfc7b8] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Bird className="w-3.5 h-3.5" />
                <span>Birds</span>
              </button>

              <div className="flex items-center gap-1.5">
                <label htmlFor="ai-voice-select" className="text-[11px] font-medium text-[#a79f91] whitespace-nowrap">
                  AI Voice
                </label>
                <select
                  id="ai-voice-select"
                  value={voiceName}
                  onChange={(e) => onVoiceChange(e.target.value as GeminiVoiceName)}
                  className="px-2 py-1 rounded-md bg-[#1f242c] border border-white/12 text-xs text-[#f7f3eb] focus-visible:outline-2 focus-visible:outline-[#e0a458]"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Secondary Row: 5 Key Era Quick-Jump Milestones */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1.5 border-t border-[#fff5e1]/10">
            {KEY_MILESTONES.map((milestone) => {
              const isSelected = Math.abs(year - milestone.year) < 1.5;
              return (
                <button
                  key={milestone.id}
                  type="button"
                  onClick={() => onSelectMilestone(milestone.id)}
                  className={`flex-1 min-w-fit px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e0a458] ${
                    isSelected
                      ? 'bg-[#e0a458]/20 text-[#f6cf92] border border-[#e0a458]/50'
                      : 'bg-white/5 text-[#cfc7b8] border border-transparent hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {milestone.shortLabel}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
