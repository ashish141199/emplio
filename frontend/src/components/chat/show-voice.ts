// What the person says while showing Emplio how. The mic is cut at each pause, so a remark is sent whole and lands
// where it was said among the clicks; silence is never sent, or billed.
// ponytail: a fixed loudness for "speaking"; a noisy room just cuts at the longest piece instead of at pauses
const LOUD = 0.015;
const PAUSE_MS = 800;
const SHORTEST_MS = 3_000; // the /transcribe limit is per minute
const LONGEST_MS = 25_000; // Sarvam's quick endpoint takes 30s
const SILENT_MS = 10_000; // a silent piece is thrown away and a new one started, leaving room for the next remark

// hear: audio to text. say: what was said, ms after began; null when it couldn't be made out
export async function startVoice(
  began: number,
  hear: (audio: Blob, seconds: number) => Promise<string>,
  say: (at: number, text: string | null) => Promise<unknown>,
) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const sound = new AudioContext();
  void sound.resume();
  const meter = sound.createAnalyser();
  meter.fftSize = 2048;
  sound.createMediaStreamSource(stream).connect(meter);
  const samples = new Float32Array(meter.fftSize);

  const sent: Promise<unknown>[] = [];
  let stopping = false;
  let closed!: () => void;
  const whenClosed = new Promise<void>((r) => (closed = r));
  let recorder!: MediaRecorder;
  let pieceAt = 0;
  let spokeAt: number | null = null;
  let loudAt = 0;

  const nextPiece = () => {
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    pieceAt = Date.now();
    spokeAt = null;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      const audio = new Blob(chunks, { type: rec.mimeType });
      if (spokeAt !== null && audio.size) {
        const at = spokeAt - began;
        const heard = hear(audio, (Date.now() - pieceAt) / 1000);
        sent.push(heard.then((text) => (text ? say(at, text) : null), () => say(at, null)).catch(() => {}));
      }
      if (stopping) closed();
      else nextPiece();
    };
    rec.start();
    recorder = rec;
  };

  const listening = setInterval(() => {
    if (recorder.state !== "recording") return;
    meter.getFloatTimeDomainData(samples);
    const now = Date.now();
    if (Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length) > LOUD) {
      spokeAt ??= now;
      loudAt = now;
    }
    const age = now - pieceAt;
    if (spokeAt === null ? age >= SILENT_MS : (age >= SHORTEST_MS && now - loudAt >= PAUSE_MS) || age >= LONGEST_MS) recorder.stop();
  }, 100);
  nextPiece();

  return {
    mute: (muted: boolean) => stream.getAudioTracks().forEach((t) => (t.enabled = !muted)),
    // how loud right now, 0 to 1, for the wave
    level: () => {
      meter.getFloatTimeDomainData(samples);
      return Math.min(1, Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length) * 6);
    },
    // resolves once everything said has reached the server
    stop: async () => {
      stopping = true;
      clearInterval(listening);
      if (recorder.state === "recording") recorder.stop();
      else closed();
      await whenClosed;
      stream.getTracks().forEach((t) => t.stop());
      void sound.close();
      await Promise.all(sent);
    },
  };
}
