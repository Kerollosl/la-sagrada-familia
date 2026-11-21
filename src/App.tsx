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
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    const focus = params.get('focus');
    return Boolean(focus && focus !== 'false');
  });
  const [labelsVisible, setLabelsVisible] = useState<boolean>(getInitialLabelsVisible);

  const [year, setYear] = useState<number>(() => {
    const params = new URLSearchParams(window.location.search);
    const paramYear = Number(params.get('year'));
    if (!Number.isNaN(paramYear) && paramYear >= MIN_YEAR && paramYear <= MAX_YEAR) {
      return paramYear;
    }
    const initFeat = getFeatureById(getInitialSelectedFeatureId());
    if (initFeat) {
      return Math.max(1926, initFeat.revealYear);
    }
    return 1926;
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

  const [infoCollapsed, setInfoCollapsed] = useState<boolean>(false);
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
    setCameraHint({
      azimuthDeg: 42,
      elevationDeg: 16,
      distance: 106,
      nonce: Date.now(),
    });
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
    setFocusMode((prev) => {
      const next = !prev;
      if (next) {
        setLabelsVisible(true);
        if (!selectedFeatureId) {
          const visible = getVisibleFeaturesForYear(year);
          const pick = visible[0] ?? ARCHITECTURAL_FEATURES[0];
          setIsPlaying(false);
          setAutoOrbit(false);
          setSelectedFeatureId(pick.id);
          if (year < pick.revealYear) setYear(pick.revealYear);
          setCameraHint({
            position: pick.cameraPosition,
            target: pick.cameraTarget,
            nonce: Date.now(),
          });
        }
      } else {
        setSelectedFeatureId(null);
        setCameraHint({
          azimuthDeg: 42,
          elevationDeg: 16,
          distance: 106,
          nonce: Date.now(),
        });
      }
      return next;
    });
  }, [selectedFeatureId, year]);

  const handleCloseDetailCard = useCallback(() => {
    setSelectedFeatureId(null);
    setCameraHint({
      azimuthDeg: 42,
      elevationDeg: 16,
      distance: 106,
      nonce: Date.now(),
    });
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        const startY = year >= MAX_YEAR - 0.1 ? MIN_YEAR : year;
        if (year >= MAX_YEAR - 0.1) setYear(MIN_YEAR);
        void speakerRef.current?.speakForYear(startY, true);
      } else {
        speakerRef.current?.stop();
      }
      return next;
    });
  }, [year]);

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
      if (narrationEnabled) {
        void speakerRef.current?.speakForYear(nextYear, false);
      }
    },
    [narrationEnabled]
  );

  const handleSelectMilestone = useCallback(
    (milestoneId: string) => {
      const found = KEY_MILESTONES.find((m) => m.id === milestoneId);
      if (!found) return;
      setIsPlaying(false);
      setSelectedFeatureId(null);
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
      if (narrationEnabled) {
        void speakerRef.current?.speakForYear(targetYear, true);
      }
    },
    [narrationEnabled]
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
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.code === 'Space') {
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
      } else if (e.key === 'Escape' && selectedFeatureId) {
        handleCloseDetailCard();
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
    handleCloseDetailCard,
    selectedFeatureId,
  ]);

  return (
    <main
      className="relative w-screen h-screen overflow-hidden"
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

      <HistoricalInfoCard
        year={year}
        progress={progress}
        collapsed={infoCollapsed}
        onToggleCollapse={() => setInfoCollapsed((c) => !c)}
        onJumpToPhase={handleJumpToPhase}
      />

      {selectedFeature && (
        <CloseUpDetailCard
          feature={selectedFeature}
          onSelectFeature={handleSelectFeature}
          onClose={handleCloseDetailCard}
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
