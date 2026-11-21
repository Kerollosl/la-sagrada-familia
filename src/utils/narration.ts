import { getHistoricalContext, MAX_YEAR, MIN_YEAR } from '../data/timeline';

export type GeminiVoiceName = 'Charon' | 'Kore' | 'Zephyr' | 'Puck' | 'Fenrir';

export interface NarrationCue {
  id: string;
  yearRange: string;
  architect: string;
  spokenText: string;
}

export interface NarrationStatusUpdate {
  speaking: boolean;
  loading: boolean;
  caption: string | null;
  error: string | null;
  voiceName: GeminiVoiceName;
}

const NARRATION_SCRIPTS: Record<string, string> = {
  '1882–1883':
    '1882. Work begins under Francisco de Paula del Villar with a Neo-Gothic crypt, before young Antoni Gaudí takes over and transforms the entire vision.',
  '1884–1906':
    '1884 to 1906. Gaudí completes the crypt and raises the seven radiating apse chapels, using hanging chain models to shape every stone arch.',
  '1906–1926':
    '1906 to 1926. Gaudí sculpts the Nativity Facade and its first parabolic bell towers, leaving plaster models behind upon his passing in 1926.',
  '1926–1951':
    '1926 to 1951. Gaudí’s disciples finish the Nativity spires by 1930, then carefully reconstruct his shattered workshop models after the war.',
  '1952–1976':
    '1952 to 1976. Across the western transept, the stark Passion Facade rises with six inclined bone-like pillars and four angular bell towers.',
  '1978–1995':
    '1978 to 1995. Guided by early computer modeling, builders raise the nave walls and plant a forest of double-twisted stone columns inside.',
  '1995–2010':
    '1995 to 2010. Branching stone canopies lock into luminous hyperboloid vaults, enclosing the stained-glass nave for its 2010 consecration.',
  '2010–2021':
    '2010 to 2021. Post-tensioned stone panels accelerate the central cluster, crowning the Tower of the Virgin Mary with a glowing twelve-pointed star.',
  '2022–2026+':
    '2022 to 2026 and beyond. The four winged Evangelist towers and the 172-meter Tower of Jesus Christ crown the skyline as work turns toward the Glory Facade.',
};

export function getNarrationCue(rawYear: number): NarrationCue {
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, rawYear));
  const ctx = getHistoricalContext(year);
  return {
    id: ctx.yearsSpan,
    yearRange: ctx.yearsSpan,
    architect: ctx.architect,
    spokenText: NARRATION_SCRIPTS[ctx.yearsSpan] ?? ctx.summary,
  };
}

export class NarrationSpeaker {
  private lastSpokenId: string | null = null;
  private enabled = false;
  private voiceName: GeminiVoiceName = 'Charon';
  private activeAudio: HTMLAudioElement | null = null;
  private activeAbort: AbortController | null = null;
  private audioDataCache = new Map<string, string>();
  private onStatusChange?: (status: NarrationStatusUpdate) => void;

  constructor(onStatusChange?: (status: NarrationStatusUpdate) => void) {
    this.onStatusChange = onStatusChange;
  }

  public setVoice(voiceName: GeminiVoiceName, currentYear: number): void {
    if (this.voiceName === voiceName) return;
    this.voiceName = voiceName;
    if (this.enabled) {
      this.lastSpokenId = null;
      void this.speakForYear(currentYear, true);
    } else {
      this.emitStatus(false, false, null, null);
    }
  }

  public setEnabled(next: boolean, currentYear: number): void {
    this.enabled = next;
    if (!next) {
      this.stop();
      return;
    }
    this.lastSpokenId = null;
    void this.speakForYear(currentYear, true);
  }

  public async speakForYear(year: number, force = false): Promise<void> {
    if (!this.enabled) return;
    const cue = getNarrationCue(year);
    if (!force && cue.id === this.lastSpokenId) return;
    this.lastSpokenId = cue.id;
    await this.synthesizeAndPlay(cue.spokenText);
  }

  private emitStatus(
    speaking: boolean,
    loading: boolean,
    caption: string | null,
    error: string | null
  ): void {
    this.onStatusChange?.({
      speaking,
      loading,
      caption,
      error,
      voiceName: this.voiceName,
    });
  }

  private cleanupPlayback(): void {
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.src = '';
      this.activeAudio = null;
    }
  }

  private async synthesizeAndPlay(text: string): Promise<void> {
    if (!this.enabled) return;
    this.cleanupPlayback();

    const cacheKey = `${this.voiceName}::${text}`;
    const cachedUrl = this.audioDataCache.get(cacheKey);
    if (cachedUrl) {
      this.playDataUrl(cachedUrl, text);
      return;
    }

    const abort = new AbortController();
    this.activeAbort = abort;
    this.emitStatus(false, true, text, null);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName: this.voiceName }),
        signal: abort.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      };

      if (!this.enabled || abort.signal.aborted) return;

      if (!response.ok || !payload.audioBase64) {
        this.emitStatus(
          false,
          false,
          text,
          payload.error || `Google AI narration unavailable (${response.status}).`
        );
        return;
      }

      const dataUrl = `data:${payload.mimeType || 'audio/wav'};base64,${payload.audioBase64}`;
      this.audioDataCache.set(cacheKey, dataUrl);
      this.playDataUrl(dataUrl, text);
    } catch (err) {
      if (abort.signal.aborted || !this.enabled) return;
      const msg = err instanceof Error ? err.message : 'Unable to reach Google AI voice service.';
      this.emitStatus(false, false, text, msg);
    }
  }

  private playDataUrl(dataUrl: string, caption: string): void {
    if (!this.enabled || typeof Audio === 'undefined') {
      this.emitStatus(false, false, caption, null);
      return;
    }

    const audio = new Audio(dataUrl);
    this.activeAudio = audio;
    this.emitStatus(true, false, caption, null);

    audio.onended = () => {
      if (this.activeAudio === audio) {
        this.activeAudio = null;
        this.emitStatus(false, false, this.enabled ? caption : null, null);
      }
    };
    audio.onerror = () => {
      if (this.activeAudio === audio) {
        this.activeAudio = null;
        this.emitStatus(false, false, caption, 'Audio playback failed in this browser.');
      }
    };

    void audio.play().catch(() => {
      // Browser autoplay policy may require direct user interaction
      if (this.activeAudio === audio) {
        this.emitStatus(false, false, caption, null);
      }
    });
  }

  public stop(): void {
    this.lastSpokenId = null;
    this.cleanupPlayback();
    this.emitStatus(false, false, null, null);
  }
}
