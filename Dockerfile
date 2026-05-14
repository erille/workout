FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends g++ make python3 \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8060
ENV WORKOUT_DB_PATH=/data/workout.sqlite
ENV WORKOUT_TTS_CACHE_DIR=/data/tts-cache
ENV WORKOUT_PIPER_BINARY=/opt/piper/bin/piper
ENV WORKOUT_PIPER_MODEL_EN=/opt/piper-voices/en_US-lessac-medium.onnx
ENV WORKOUT_PIPER_MODEL_FR=/opt/piper-voices/fr_FR-siwis-medium.onnx
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl libgomp1 python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/piper \
  && /opt/piper/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/piper/bin/pip install --no-cache-dir piper-tts
RUN mkdir -p /opt/piper-voices \
  && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx" -o /opt/piper-voices/en_US-lessac-medium.onnx \
  && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" -o /opt/piper-voices/en_US-lessac-medium.onnx.json \
  && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx" -o /opt/piper-voices/fr_FR-siwis-medium.onnx \
  && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json" -o /opt/piper-voices/fr_FR-siwis-medium.onnx.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY server ./server
COPY package*.json ./
RUN mkdir -p /data/tts-cache
VOLUME ["/data"]
EXPOSE 8060
CMD ["node", "server/index.js"]
