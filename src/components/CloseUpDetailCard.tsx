import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ARCHITECTURAL_FEATURES, ArchitecturalFeature } from '../data/architecturalFeatures';

interface CloseUpDetailCardProps {
  feature: ArchitecturalFeature;
  onSelectFeature: (featureId: string) => void;
  onClose: () => void;
}

export function CloseUpDetailCard({
  feature,
  onSelectFeature,
  onClose,
}: CloseUpDetailCardProps) {
  const currentIdx = ARCHITECTURAL_FEATURES.findIndex((f) => f.id === feature.id);
  const prevFeature =
    ARCHITECTURAL_FEATURES[
      (currentIdx - 1 + ARCHITECTURAL_FEATURES.length) % ARCHITECTURAL_FEATURES.length
    ];
  const nextFeature =
    ARCHITECTURAL_FEATURES[(currentIdx + 1) % ARCHITECTURAL_FEATURES.length];

  return (
    <aside
      aria-label={`Close-up detail: ${feature.label}`}
      data-testid="closeup-detail-card"
      className="fixed top-4 right-4 z-10 w-[356px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-10.5rem)] overflow-y-auto rounded-xl bg-[#14171c]/94 border border-[#e0a458]/35 text-[#f7f3eb] shadow-2xl"
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2.5 border-b border-[#fff5e1]/10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#e0a458] font-medium">
            <span>Close-up Detail</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#b9b1a3] font-normal">{feature.eraLabel}</span>
          </div>
          <h2
            className="font-display text-lg font-semibold tracking-tight text-[#f7f3eb] leading-tight mt-0.5 text-balance"
            data-testid="closeup-title"
          >
            {feature.label}
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSelectFeature(prevFeature.id)}
            aria-label={`Previous feature: ${prevFeature.label}`}
            title={`Previous: ${prevFeature.label}`}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#cfc7b8] hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-[#e0a458]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onSelectFeature(nextFeature.id)}
            aria-label={`Next feature: ${nextFeature.label}`}
            title={`Next: ${nextFeature.label}`}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#cfc7b8] hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-[#e0a458]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close close-up detail"
            title="Close detail"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#cfc7b8] hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-[#e0a458]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        <div className="space-y-0.5 text-[11px]">
          <div className="text-[#a79f91]">
            Lead Architect <span className="text-[#f7f3eb] font-medium ml-1">{feature.architect}</span>
          </div>
          <div className="text-[#cfc7b8] font-mono-tabular leading-snug">{feature.dimensions}</div>
        </div>

        <p className="text-[12px] leading-snug text-[#e6dfd2]">{feature.summary}</p>

        <div className="pt-2.5 border-t border-[#fff5e1]/10 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-[#a79f91]">
            <span>Historical Trivia</span>
            <span className="font-mono-tabular text-[#b9b1a3]">
              {currentIdx + 1} / {ARCHITECTURAL_FEATURES.length}
            </span>
          </div>

          <ol className="space-y-1.5" data-testid="closeup-trivia-list">
            {feature.trivia.map((fact, idx) => (
              <li
                key={idx}
                className="flex items-baseline gap-2 text-[11.5px] leading-snug text-[#d4cdbf]"
              >
                <span className="font-mono-tabular text-[11px] font-semibold text-[#e0a458] shrink-0">
                  0{idx + 1}.
                </span>
                <span>{fact}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="pt-2.5 border-t border-[#fff5e1]/10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/14 border border-white/12 text-xs font-medium text-[#f7f3eb] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e0a458]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Overview</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectFeature(nextFeature.id)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#e0a458]/18 hover:bg-[#e0a458]/28 border border-[#e0a458]/45 text-xs font-medium text-[#f6cf92] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e0a458]"
          >
            <span>Next Landmark</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
