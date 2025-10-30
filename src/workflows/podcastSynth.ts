// src/audio/podcastSynth.ts
// Cloudflare Worker module to synthesize a multi-speaker podcast into ONE WAV.
//
// Requirements:
// - wrangler.toml: [[ai]] binding named "AI"
// - Model default: @cf/myshell-ai/melotts
//
// Usage:
//
// import { synthesizePodcast, type TranscriptSegment } from "./audio/podcastSynth";
// const resp = await synthesizePodcast(env, [
//   { speaker: "Host",  text: "Welcome to the show." },
//   { speaker: "Guest", text: "Thanks for having me!" },
// ], {
//   voiceMap: { Host: "en-US-male-1", Guest: "en-US-female-1" }, // adjust for your TTS catalog
//   model: "@cf/myshell-ai/melotts",
//   gapMs: 250
// });
// return resp; // Response (audio/wav)

export type TranscriptSegment = {
  speaker: string;
  text: string;
};

export type VoiceMap = Record<string, string>; // speaker -> voiceId/style

export type PodcastOptions = {
  model?: string;                 // default: "@cf/myshell-ai/melotts"
  voiceMap?: VoiceMap;            // map speakers to TTS voice IDs
  defaultVoice?: string;          // fallback voice if speaker unmapped
  gapMs?: number;                 // silence gap between segments (ms), default 150
  targetSampleRate?: number;      // force resample rate (Hz); if omitted, uses first chunk's rate
  enforceMono?: boolean;          // if true, convert to mono
};

type WavInfo = {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  pcm: Uint8Array; // raw PCM little-endian
};

const DEFAULT_MODEL = env.MODEL_VOICE_GEN;
const DEFAULT_GAP_MS = 150;

/**
 * Main entry — synthesizes the whole podcast into one WAV Response.
 */
export async function synthesizePodcast(
  env: { AI: { run: (model: string, payload: any) => Promise<any> } },
  transcript: TranscriptSegment[],
  opts: PodcastOptions = {}
): Promise<Response> {
  if (!env?.AI?.run) {
    return new Response("Workers AI binding `AI` is missing.", { status: 500 });
  }
  if (!transcript?.length) {
    return new Response("Empty transcript.", { status: 400 });
  }

  const model = opts.model ?? DEFAULT_MODEL;
  const gapMs = opts.gapMs ?? DEFAULT_GAP_MS;
  const voiceMap = opts.voiceMap ?? {};
  const defaultVoice = opts.defaultVoice ?? "en-US-neutral-1";

  // 1) Synthesize each segment to WAV
  const wavs: WavInfo[] = [];
  for (const seg of transcript) {
    const voice = voiceMap[seg.speaker] ?? defaultVoice;
    const wavBuf = await synthesizeTTS(env, model, seg.text, voice);
    const info = parseWav(wavBuf);
    wavs.push(info);

    // add gap (silence) between segments except after the last
    if (gapMs > 0 && seg !== transcript[transcript.length - 1]) {
      wavs.push(makeSilence(info.sampleRate, info.numChannels, info.bitsPerSample, gapMs));
    }
  }

  // 2) Normalize formats / optionally downmix & resample
  const baseRate = opts.targetSampleRate ?? wavs[0].sampleRate;
  const baseCh = opts.enforceMono ? 1 : wavs[0].numChannels;
  const baseBits = wavs[0].bitsPerSample;

  const coerced = wavs.map((w) =>
    coerceFormat(w, baseRate, baseCh, baseBits)
  );

  // 3) Concatenate PCM and write final WAV
  const totalPCM = concatPCM(coerced.map((c) => c.pcm));
  const finalWav = writeWav(totalPCM, baseRate, baseCh, baseBits);

  return new Response(finalWav, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Disposition": `inline; filename="podcast.wav"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Calls Workers AI TTS and returns WAV (ArrayBuffer).
 * NOTE: The exact payload schema may vary by model. Adjust `inputs` keys to match your TTS.
 */
async function synthesizeTTS(
  env: { AI: { run: (model: string, payload: any) => Promise<any> } },
  model: string,
  text: string,
  voice: string
): Promise<ArrayBuffer> {
  // Typical TTS inputs. Adjust if your MeloTTS catalog expects different keys.
  const inputs = {
    // Common fields across TTS providers
    text,
    voice,               // e.g., "en-US-female-1"
    format: "wav",       // request 16-bit PCM WAV
    // You can add language/style/speed if your model supports them:
    // language: "en-US",
    // style: "conversational",
    // speed: 1.0,
  };

  const result = await env.AI.run(model, inputs);

  // Handle a few likely result shapes:
  // - { audio: ArrayBuffer | Uint8Array | string(base64) }
  // - { result: { audio: ... } }
  // - raw ArrayBuffer
  let audio: any =
    result?.audio ??
    result?.result?.audio ??
    result?.wav ??
    result;

  if (audio instanceof ArrayBuffer) return audio;
  if (audio?.buffer instanceof ArrayBuffer) return audio.buffer;

  if (typeof audio === "string") {
    // assume base64
    return base64ToArrayBuffer(audio);
  }

  // Some runtimes return { data: <Uint8Array> }
  if (audio?.data && typeof audio.data.length === "number") {
    return new Uint8Array(audio.data).buffer;
  }

  throw new Error("Unexpected TTS response format.");
}

/* ----------------------- WAV utils (minimal, robust) ---------------------- */

function parseWav(buf: ArrayBuffer): WavInfo {
  const view = new DataView(buf);
  // Basic RIFF header checks
  if (readStr(view, 0, 4) !== "RIFF" || readStr(view, 8, 4) !== "WAVE") {
    throw new Error("Not a WAV file (RIFF/WAVE header missing).");
  }

  // Find "fmt " and "data" chunks
  let pos = 12;
  let audioFormat = 1; // PCM
  let numChannels = 1;
  let sampleRate = 16000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (pos + 8 <= view.byteLength) {
    const chunkId = readStr(view, pos, 4);
    const chunkSize = view.getUint32(pos + 4, true);
    const chunkStart = pos + 8;

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(chunkStart, true);
      numChannels = view.getUint16(chunkStart + 2, true);
      sampleRate = view.getUint32(chunkStart + 4, true);
      bitsPerSample = view.getUint16(chunkStart + 14, true);
      if (audioFormat !== 1) {
        throw new Error(`Only PCM WAV supported (fmt audioFormat=${audioFormat}).`);
      }
    } else if (chunkId === "data") {
      dataOffset = chunkStart;
      dataSize = chunkSize;
      break;
    }

    pos = chunkStart + chunkSize + (chunkSize % 2); // chunks are word-aligned
  }

  if (dataOffset < 0 || dataSize <= 0) {
    throw new Error("WAV data chunk not found.");
  }

  const pcm = new Uint8Array(buf, dataOffset, dataSize);
  return { sampleRate, numChannels, bitsPerSample, pcm };
}

function writeWav(
  pcm: Uint8Array,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number
): ArrayBuffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) >> 3;
  const blockAlign = (numChannels * bitsPerSample) >> 3;
  const wavSize = 44 + pcm.byteLength;
  const buf = new ArrayBuffer(wavSize);
  const view = new DataView(buf);

  // RIFF header
  writeStr(view, 0, "RIFF");
  view.setUint32(4, wavSize - 8, true);
  writeStr(view, 8, "WAVE");

  // fmt chunk
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeStr(view, 36, "data");
  view.setUint32(40, pcm.byteLength, true);

  new Uint8Array(buf, 44).set(pcm);
  return buf;
}

function concatPCM(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function makeSilence(
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
  ms: number
): WavInfo {
  const bytesPerSample = bitsPerSample / 8;
  const frames = Math.max(1, Math.floor((sampleRate * ms) / 1000));
  const pcm = new Uint8Array(frames * numChannels * bytesPerSample);
  // Already zeroed (silence)
  return { sampleRate, numChannels, bitsPerSample, pcm };
}

/* -------------------------- Format coercion utils ------------------------- */

function coerceFormat(
  w: WavInfo,
  targetRate: number,
  targetCh: number,
  targetBits: number
): WavInfo {
  let out = w;

  if (w.bitsPerSample !== 16 && targetBits === 16) {
    out = to16BitPCM(out);
  }

  if (targetCh === 1 && w.numChannels !== 1) {
    out = toMono(out);
  } else if (targetCh === 2 && w.numChannels !== 2) {
    out = toStereo(out);
  }

  if (w.sampleRate !== targetRate) {
    out = resampleNearest(out, targetRate);
  }

  // ensure final bits match (we only implement 16-bit pipeline here)
  if (out.bitsPerSample !== targetBits) {
    if (targetBits !== 16) throw new Error("Only 16-bit PCM target supported in this module.");
    out = to16BitPCM(out);
  }

  return out;
}

// Convert arbitrary bits to 16-bit (best-effort: supports 8/24/32 int PCM)
function to16BitPCM(w: WavInfo): WavInfo {
  if (w.bitsPerSample === 16) return w;

  const bytesPerSample = w.bitsPerSample / 8;
  const samples = w.pcm.byteLength / bytesPerSample;
  const out = new Uint8Array(samples * 2);
  const dvIn = new DataView(w.pcm.buffer, w.pcm.byteOffset, w.pcm.byteLength);
  const dvOut = new DataView(out.buffer);

  for (let i = 0; i < samples; i++) {
    let val = 0;
    // Interpret as little-endian signed int of given width and scale to 16-bit
    if (w.bitsPerSample === 8) {
      // 8-bit WAV is unsigned PCM (0..255), convert to signed
      const u = dvIn.getUint8(i);
      val = (u - 128) << 8;
    } else if (w.bitsPerSample === 24) {
      const b0 = dvIn.getInt8(i * 3);
      const b1 = dvIn.getUint8(i * 3 + 1);
      const b2 = dvIn.getUint8(i * 3 + 2);
      // sign-extend 24-bit to 32 then downscale
      const s32 = (b2 << 24) | (b1 << 16) | (b0 << 8);
      val = s32 >> 16;
    } else if (w.bitsPerSample === 32) {
      // assume signed 32-bit int PCM
      const s32 = dvIn.getInt32(i * 4, true);
      val = s32 >> 16;
    } else {
      throw new Error(`Unsupported source bitsPerSample=${w.bitsPerSample}`);
    }
    dvOut.setInt16(i * 2, clamp16(val), true);
  }

  return { ...w, bitsPerSample: 16, pcm: out };
}

function toMono(w: WavInfo): WavInfo {
  if (w.numChannels === 1) return w;
  const bytesPerSample = w.bitsPerSample / 8;
  const frames = w.pcm.byteLength / (bytesPerSample * w.numChannels);
  const out = new Uint8Array(frames * bytesPerSample);
  const dvIn = new DataView(w.pcm.buffer, w.pcm.byteOffset, w.pcm.byteLength);
  const dvOut = new DataView(out.buffer);

  for (let frame = 0; frame < frames; frame++) {
    let acc = 0;
    for (let ch = 0; ch < w.numChannels; ch++) {
      const off = (frame * w.numChannels + ch) * bytesPerSample;
      acc += dvIn.getInt16(off, true);
    }
    const avg = clamp16(Math.round(acc / w.numChannels));
    dvOut.setInt16(frame * 2, avg, true);
  }

  return { ...w, numChannels: 1, pcm: out };
}

function toStereo(w: WavInfo): WavInfo {
  if (w.numChannels === 2) return w;
  // duplicate mono into L/R
  if (w.numChannels !== 1) throw new Error("toStereo expects mono input.");
  const bytesPerSample = w.bitsPerSample / 8;
  const frames = w.pcm.byteLength / bytesPerSample;
  const out = new Uint8Array(frames * bytesPerSample * 2);
  for (let i = 0; i < frames; i++) {
    const s0 = w.pcm[i * bytesPerSample];
    const s1 = w.pcm[i * bytesPerSample + 1];
    const dst = i * bytesPerSample * 2;
    out[dst] = s0; out[dst + 1] = s1;      // L
    out[dst + 2] = s0; out[dst + 3] = s1;  // R
  }
  return { ...w, numChannels: 2, pcm: out };
}

// Simple nearest-neighbor resampling for 16-bit PCM (fast; acceptable for voice)
function resampleNearest(w: WavInfo, targetRate: number): WavInfo {
  if (w.sampleRate === targetRate) return w;
  if (w.bitsPerSample !== 16) throw new Error("resampleNearest expects 16-bit PCM.");
  const bytesPerSample = 2;
  const framesIn = w.pcm.byteLength / (bytesPerSample * w.numChannels);
  const ratio = targetRate / w.sampleRate;
  const framesOut = Math.max(1, Math.floor(framesIn * ratio));
  const out = new Uint8Array(framesOut * bytesPerSample * w.numChannels);
  const dvIn = new DataView(w.pcm.buffer, w.pcm.byteOffset, w.pcm.byteLength);
  const dvOut = new DataView(out.buffer);

  for (let i = 0; i < framesOut; i++) {
    const src = Math.min(framesIn - 1, Math.round(i / ratio));
    for (let ch = 0; ch < w.numChannels; ch++) {
      const sOff = (src * w.numChannels + ch) * 2;
      const dOff = (i * w.numChannels + ch) * 2;
      const v = dvIn.getInt16(sOff, true);
      dvOut.setInt16(dOff, v, true);
    }
  }

  return { ...w, sampleRate: targetRate, pcm: out };
}

/* ------------------------------- Helpers ---------------------------------- */

function readStr(view: DataView, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}
function writeStr(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
function clamp16(v: number): number {
  if (v > 32767) return 32767;
  if (v < -32768) return -32768;
  return v | 0;
}
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64.replace(/^data:.*?base64,/, ""));
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
