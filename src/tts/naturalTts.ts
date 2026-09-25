import { KokoroJP } from "kokoro-js-jp";

type KokoroInstance = Awaited<ReturnType<typeof KokoroJP.load>>;

let tts: KokoroInstance | null = null;
let loading: Promise<KokoroInstance> | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export async function initNaturalTTS(): Promise<void> {
  if (tts) return;
  if (!loading) loading = KokoroJP.load();
  tts = await loading;
  loading = null;
}

export function naturalTTSReady(): boolean {
  return tts !== null;
}

export function stopNaturalTTS(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

export async function speakNaturalJapanese(
  text: string,
  sex: string
): Promise<void> {
  if (!text.trim()) return;
  await initNaturalTTS();
  if (!tts) return;

  stopNaturalTTS();

  const voice = sex.includes("男性") ? "jm_kumo" : "jf_alpha";
  const audio = await tts.speak(text, voice);
  const blob = audio.toBlob();
  currentUrl = URL.createObjectURL(blob);
  currentAudio = new Audio(currentUrl);

  await currentAudio.play();
}
