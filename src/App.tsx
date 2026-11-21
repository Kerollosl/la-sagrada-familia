import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BasilicaCanvas, CameraTargetHint } from './components/BasilicaCanvas';
import { CloseUpDetailCard } from './components/CloseUpDetailCard';
import { HistoricalInfoCard } from './components/HistoricalInfoCard';
import { TimelineDock } from './components/TimelineDock';
import {
  computePhaseProgress,
  KEY_MILESTONES,
  MAX_YEAR,
  MIN_YEAR,
} from './data/timeline';
import {
  ARCHITECTURAL_FEATURES,
  getFeatureById,
  getVisibleFeaturesForYear,
} from './data/architecturalFeatures';
import {
  GeminiVoiceName,
  getNarrationCue,
  NarrationSpeaker,
} from './utils/narration';
import {
  resolveTimeOfDayPreset,
  TIME_OF_DAY_PRESETS,
  TimeOfDayPreset,
} from './utils/timeOfDay';
import { WeatherMode } from './utils/atmosphereParticles';

function getInitialTimeOfDay(): number {
  const params = new URLSearchParams(window.location.search);
  const tod = params.get('tod');
  if (tod === 'day' || tod === 'dusk' || tod === 'night') {
    return TIME_OF_DAY_PRESETS[tod];
  }
  return TIME_OF_DAY_PRESETS.dusk;
}

function getInitialWeatherMode(): WeatherMode {
  const params = new URLSearchParams(window.location.search);
  const w = params.get('weather');
  if (w === 'auto' || w === 'rain' || w === 'fog' || w === 'clear') {
    return w;
  }
  return 'auto';
}

function getInitialBirdsEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('birds') !== 'false';
}

function getInitialLabelsVisible(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('labels') !== 'false';
}

function getInitialSelectedFeatureId(): string | null {
  const params = new URLSearchParams(window.location.search);
  const focus = params.get('focus');
  if (!focus || focus === 'false') return null;
  if (focus === 'true') return 'nativity-portal';
  return getFeatureById(focus)?.id ?? null;
}

export default function App() {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    getInitialSelectedFeatureId
  );
  const [focusMode, setFocusMode] = useState(() => getInitialSelectedFeatureId() !== null);
  const [labelsVisible, setLabelsVisible] = useState<boolean>(getInitialLabelsVisible);

  const [year, setYear] = useState<number>(() => {
    const params = new URLSearchParams(window.location.search);
    const paramYear = Number(params.get('year'));
    const initialFeature = getFeatureById(getInitialSelectedFeatureId());
    if (!Number.isNaN(paramYear) && paramYear >= MIN_YEAR && paramYear <= MAX_YEAR) {
      return Math.max(paramYear, initialFeature?.revealYear ?? MIN_YEAR);
    }
    return Math.max(1926, initialFeature?.revealYear ?? MIN_YEAR);
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [autoOrbit, setAutoOrbit] = useState<boolean>(false);
  const [timeOfDay, setTimeOfDay] = useState<number>(getInitialTimeOfDay);
  const [cycleTimeOfDay, setCycleTimeOfDay] = useState<boolean>(false);
  const [weatherMode, setWeatherMode] = useState<WeatherMode>(getInitialWeatherMode);
  const [birdsEnabled, setBirdsEnabled] = useState<boolean>(getInitialBirdsEnabled);

  const [narrationEnabled, setNarrationEnabled] = useState<boolean>(false);
  const [narrationLoading, setNarrationLoading] = useState<boolean>(false);
  const [narrationCaption, setNarrationCaption] = useState<string | null>(null);
  const [narrationError, setNarrationError] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState<GeminiVoiceName>('Charon');

  const [infoCollapsed, setInfoCollapsed] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [cameraHint, setCameraHint] = useState<CameraTargetHint | null>(() => {
    const initFeat = getFeatureById(getInitialSelectedFeatureId());
    if (!initFeat) return null;
    return {
      position: initFeat.cameraPosition,
      target: initFeat.cameraTarget,
      nonce: 1,
    };
  });

  const speakerRef = useRef<NarrationSpeaker | null>(null);
  if (!speakerRef.current) {
    speakerRef.current = new NarrationSpeaker((status) => {
      setNarrationLoading(status.loading);
      setNarrationError(status.error);
      if (status.caption) {
        setNarrationCaption(status.caption);
      }
    });
  }

  useEffect(() => {
    const speaker = speakerRef.current;
    return () => {
      speaker?.stop();
    };
  }, []);

  const progress = useMemo(() => computePhaseProgress(year), [year]);
  const todPreset = useMemo(() => resolveTimeOfDayPreset(timeOfDay), [timeOfDay]);
  const selectedFeature = useMemo(
    () => getFeatureById(selectedFeatureId),
    [selectedFeatureId]
  );

  // Keep caption synchronized with current historical chapter whenever narration is enabled
  useEffect(() => {
    if (!narrationEnabled) {
      setNarrationCaption(null);
      setNarrationError(null);
      setNarrationLoading(false);
      return;
    }
    const cue = getNarrationCue(year);
    setNarrationCaption(cue.spokenText);
    if (isPlaying) {
      void speakerRef.current?.speakForYear(year, false);
    }
  }, [year, narrationEnabled, isPlaying]);

  const handleYearTick = useCallback((nextYear: number, reachedEnd: boolean) => {
    setYear(nextYear);
    if (reachedEnd) {
      setIsPlaying(false);
    }
  }, []);

  const handleTimeOfDayTick = useCallback((nextTod: number) => {
    setTimeOfDay(nextTod);
  }, []);

  const handleResetView = useCallback(() => {
    setSelectedFeatureId(null);
    setFocusMode(false);
    setAutoOrbit(false);
    setCameraHint({ nonce: Date.now() });
  }, []);

  const handleSelectFeature = useCallback(
    (featureId: string) => {
      const feat = getFeatureById(featureId);
      if (!feat) return;
      setIsPlaying(false);
      setAutoOrbit(false);
      setFocusMode(true);
      setLabelsVisible(true);
      setSelectedFeatureId(feat.id);
      if (year < feat.revealYear) {
        setYear(feat.revealYear);
      }
      setCameraHint({
        position: feat.cameraPosition,
        target: feat.cameraTarget,
        nonce: Date.now(),
      });
    },
    [year]
  );

  const handleToggleFocusMode = useCallback(() => {
    if (focusMode) {
      handleResetView();
      return;
    }

    const pick = getVisibleFeaturesForYear(year)[0] ?? ARCHITECTURAL_FEATURES[0];
    handleSelectFeature(pick.id);
  }, [focusMode, handleResetView, handleSelectFeature, year]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      speakerRef.current?.stop();
      return;
    }

    const restart = year >= MAX_YEAR - 0.1;
    if (restart) {
      setYear(MIN_YEAR);
      if (selectedFeatureId) handleResetView();
    }
    setIsPlaying(true);
    void speakerRef.current?.speakForYear(restart ? MIN_YEAR : year, true);
  }, [handleResetView, isPlaying, selectedFeatureId, year]);

  const handleToggleNarration = useCallback(() => {
    setNarrationEnabled((prev) => {
      const next = !prev;
      speakerRef.current?.setEnabled(next, year);
      if (next) {
        setNarrationCaption(getNarrationCue(year).spokenText);
      } else {
        setNarrationCaption(null);
        setNarrationError(null);
        setNarrationLoading(false);
      }
      return next;
    });
  }, [year]);

  const handleVoiceChange = useCallback(
    (nextVoice: GeminiVoiceName) => {
      setVoiceName(nextVoice);
      speakerRef.current?.setVoice(nextVoice, year);
    },
    [year]
  );

  const handleSelectTimeOfDayPreset = useCallback((preset: TimeOfDayPreset) => {
    setCycleTimeOfDay(false);
    setTimeOfDay(TIME_OF_DAY_PRESETS[preset]);
  }, []);

  const handleToggleCycleTimeOfDay = useCallback(() => {
    setCycleTimeOfDay((c) => !c);
  }, []);

  const handleYearChange = useCallback(
    (nextYear: number) => {
      setIsPlaying(false);
      setYear(nextYear);
      if (selectedFeature && nextYear < selectedFeature.revealYear) handleResetView();
      if (narrationEnabled) {
        void speakerRef.current?.speakForYear(nextYear, false);
      }
    },
    [handleResetView, narrationEnabled, selectedFeature]
  );

  const handleSelectMilestone = useCallback(
    (milestoneId: string) => {
      const found = KEY_MILESTONES.find((m) => m.id === milestoneId);
      if (!found) return;
      setIsPlaying(false);
      setSelectedFeatureId(null);
      setFocusMode(false);
      setAutoOrbit(false);
      setYear(found.year);
      if (narrationEnabled) {
        void speakerRef.current?.speakForYear(found.year, true);
      }
      if (found.cameraHint) {
        setCameraHint({ ...found.cameraHint, nonce: Date.now() });
      }
    },
    [narrationEnabled]
  );

  const handleJumpToPhase = useCallback(
    (_startYear: number, endYear: number) => {
      const targetYear = Math.min(MAX_YEAR, endYear);
      setIsPlaying(false);
      setYear(targetYear);
      if (selectedFeature && targetYear < selectedFeature.revealYear) handleResetView();
      if (narrationEnabled) {
        void speakerRef.current?.speakForYear(targetYear, true);
      }
    },
    [handleResetView, narrationEnabled, selectedFeature]
  );

  const handleDownloadStandalone = useCallback(() => {
    const link = document.createElement('a');
    link.href = '/sagrada-familia.html';
    link.download = 'sagrada-familia-3d-timeline.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Keyboard shortcuts: Space (Play), H (Hide HUD), R (Reset), N (Narrate), T (Time), F (Focus), L (Labels), Esc (Close detail)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (e.key === 'Escape' && selectedFeatureId) {
        handleResetView();
        return;
      }
      if (
        target &&
        (target.isContentEditable || target.closest('input, textarea, select'))
      ) {
        return;
      }
      if (e.code === 'Space') {
        if (target?.closest('button, a[href]')) return;
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((c) => !c);
      } else if (e.key === 'r' || e.key === 'R') {
        handleResetView();
      } else if (e.key === 'n' || e.key === 'N') {
        handleToggleNarration();
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleFocusMode();
      } else if (e.key === 'l' || e.key === 'L') {
        setLabelsVisible((v) => !v);
      } else if (e.key === 't' || e.key === 'T') {
        setCycleTimeOfDay(false);
        setTimeOfDay((curr) => {
          const p = resolveTimeOfDayPreset(curr);
          const next: TimeOfDayPreset = p === 'day' ? 'dusk' : p === 'dusk' ? 'night' : 'day';
          return TIME_OF_DAY_PRESETS[next];
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleTogglePlay,
    handleResetView,
    handleToggleNarration,
    handleToggleFocusMode,
    selectedFeatureId,
  ]);

  return (
    <main
      className="relative w-full h-dvh overflow-hidden"
      data-year={Math.round(year)}
      data-playing={isPlaying ? 'true' : 'false'}
      data-autoorbit={autoOrbit ? 'true' : 'false'}
      data-narration={narrationEnabled ? 'true' : 'false'}
      data-tod-preset={todPreset}
      data-tod-cycling={cycleTimeOfDay ? 'true' : 'false'}
      data-weather={weatherMode}
      data-birds={birdsEnabled ? 'true' : 'false'}
      data-focus-mode={focusMode ? 'true' : 'false'}
      data-labels={labelsVisible ? 'true' : 'false'}
      data-selected-feature={selectedFeatureId ?? ''}
    >
      <BasilicaCanvas
        year={year}
        isPlaying={isPlaying}
        autoOrbit={autoOrbit}
        timeOfDay={timeOfDay}
        cycleTimeOfDay={cycleTimeOfDay}
        weatherMode={weatherMode}
        birdsEnabled={birdsEnabled}
        focusMode={focusMode}
        labelsVisible={labelsVisible}
        selectedFeatureId={selectedFeatureId}
        cameraHint={cameraHint}
        onYearTick={handleYearTick}
        onTimeOfDayTick={handleTimeOfDayTick}
        onSelectFeature={handleSelectFeature}
      />

      <div className={selectedFeature ? 'hidden md:block' : undefined}>
        <HistoricalInfoCard
          year={year}
          progress={progress}
          collapsed={infoCollapsed}
          onToggleCollapse={() => setInfoCollapsed((c) => !c)}
          onJumpToPhase={handleJumpToPhase}
        />
      </div>

      {selectedFeature && (
        <CloseUpDetailCard
          feature={selectedFeature}
          onSelectFeature={handleSelectFeature}
          onClose={handleResetView}
        />
      )}

      <TimelineDock
        year={year}
        isPlaying={isPlaying}
        autoOrbit={autoOrbit}
        timeOfDay={timeOfDay}
        cycleTimeOfDay={cycleTimeOfDay}
        weatherMode={weatherMode}
        birdsEnabled={birdsEnabled}
        focusMode={focusMode}
        labelsVisible={labelsVisible}
        narrationEnabled={narrationEnabled}
        narrationLoading={narrationLoading}
        narrationCaption={narrationCaption}
        narrationError={narrationError}
        voiceName={voiceName}
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        onTogglePlay={handleTogglePlay}
        onYearChange={handleYearChange}
        onSelectMilestone={handleSelectMilestone}
        onToggleAutoOrbit={() => setAutoOrbit((o) => !o)}
        onSelectTimeOfDayPreset={handleSelectTimeOfDayPreset}
        onToggleCycleTimeOfDay={handleToggleCycleTimeOfDay}
        onWeatherChange={setWeatherMode}
        onToggleBirds={() => setBirdsEnabled((b) => !b)}
        onToggleFocusMode={handleToggleFocusMode}
        onToggleLabels={() => setLabelsVisible((l) => !l)}
        onToggleNarration={handleToggleNarration}
        onVoiceChange={handleVoiceChange}
        onResetView={handleResetView}
        onDownloadStandalone={handleDownloadStandalone}
      />
    </main>
  );
}
