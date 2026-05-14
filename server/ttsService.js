import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { basename, isAbsolute, join, resolve, sep } from "node:path";

const piperBinary = process.env.WORKOUT_PIPER_BINARY?.trim() || "piper";
const cacheDir = resolve(process.env.WORKOUT_TTS_CACHE_DIR ?? join("data", "tts-cache"));
const piperTimeoutMs = Number(process.env.WORKOUT_PIPER_TIMEOUT_MS ?? 20_000);
const maxTextLength = Number(process.env.WORKOUT_TTS_MAX_TEXT_LENGTH ?? 500);
const piperModels = {
  en: resolve(
    process.env.WORKOUT_PIPER_MODEL_EN ?? "/opt/piper-voices/en_US-lessac-medium.onnx",
  ),
  fr: resolve(
    process.env.WORKOUT_PIPER_MODEL_FR ?? "/opt/piper-voices/fr_FR-siwis-medium.onnx",
  ),
};
const pendingGenerations = new Map();

mkdirSync(cacheDir, { recursive: true });

function normalizeLanguage(language) {
  return language === "en" ? "en" : "fr";
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function hasBinary() {
  if (isAbsolute(piperBinary) || piperBinary.includes("/") || piperBinary.includes("\\")) {
    return existsSync(piperBinary);
  }

  return true;
}

function voiceForLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language);
  const modelPath = piperModels[normalizedLanguage];
  const configPath = `${modelPath}.json`;

  return {
    language: normalizedLanguage,
    id: basename(modelPath, ".onnx"),
    modelPath,
    configPath,
    available: hasBinary() && existsSync(modelPath) && existsSync(configPath),
  };
}

function cacheKeyFor(text, voice) {
  return createHash("sha256")
    .update(JSON.stringify({
      provider: "piper",
      text,
      language: voice.language,
      voice: voice.id,
    }))
    .digest("hex")
    .slice(0, 32);
}

function cachedFileName(text, voice) {
  return `${voice.language}-${voice.id}-${cacheKeyFor(text, voice)}.wav`;
}

function safeCachePath(fileName) {
  const filePath = resolve(cacheDir, fileName);

  if (!filePath.startsWith(`${cacheDir}${sep}`)) {
    return null;
  }

  return filePath;
}

function deleteIfExists(filePath) {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Best effort cleanup; a future generation can overwrite another temp file.
  }
}

function runPiper(text, voice, outputPath) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      piperBinary,
      ["--model", voice.modelPath, "--output_file", outputPath],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectRun(new Error("Piper timed out while generating speech."));
    }, Number.isFinite(piperTimeoutMs) ? Math.max(5_000, piperTimeoutMs) : 20_000);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolveRun();
        return;
      }

      rejectRun(new Error(stderr.trim() || `Piper exited with code ${code}.`));
    });
    child.stdin.end(`${text}\n`);
  });
}

async function generateSpeech(text, voice, outputPath) {
  const tempPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;

  deleteIfExists(tempPath);

  try {
    await runPiper(text, voice, tempPath);
    renameSync(tempPath, outputPath);
  } catch (error) {
    deleteIfExists(tempPath);
    throw error;
  }
}

export function getTtsStatus() {
  const voices = [voiceForLanguage("en"), voiceForLanguage("fr")].map((voice) => ({
    id: voice.id,
    language: voice.language,
    available: voice.available,
    model: basename(voice.modelPath),
  }));

  return {
    provider: "piper",
    available: voices.some((voice) => voice.available),
    cacheDir,
    voices,
  };
}

export async function createTtsAudio(payload = {}) {
  const { text, language } = payload ?? {};
  const normalizedText = normalizeText(String(text ?? ""));

  if (!normalizedText) {
    throw new Error("Text is required.");
  }

  if (normalizedText.length > maxTextLength) {
    throw new Error(`Text must be ${maxTextLength} characters or fewer.`);
  }

  const voice = voiceForLanguage(language);

  if (!voice.available) {
    throw new Error(`Piper voice for ${voice.language} is not available.`);
  }

  const fileName = cachedFileName(normalizedText, voice);
  const outputPath = safeCachePath(fileName);

  if (!outputPath) {
    throw new Error("Invalid cache path.");
  }

  if (existsSync(outputPath) && statSync(outputPath).isFile()) {
    return {
      url: `/api/tts/audio/${encodeURIComponent(fileName)}`,
      cached: true,
      provider: "piper",
      voice: voice.id,
    };
  }

  const generationKey = `${voice.id}:${fileName}`;
  const pendingGeneration =
    pendingGenerations.get(generationKey) ??
    generateSpeech(normalizedText, voice, outputPath).finally(() => {
      pendingGenerations.delete(generationKey);
    });

  pendingGenerations.set(generationKey, pendingGeneration);
  await pendingGeneration;

  return {
    url: `/api/tts/audio/${encodeURIComponent(fileName)}`,
    cached: false,
    provider: "piper",
    voice: voice.id,
  };
}

export function streamTtsAudio(fileName, response) {
  const filePath = safeCachePath(decodeURIComponent(fileName));

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false;
  }

  response.writeHead(200, {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": "audio/wav",
  });
  createReadStream(filePath).pipe(response);
  return true;
}
