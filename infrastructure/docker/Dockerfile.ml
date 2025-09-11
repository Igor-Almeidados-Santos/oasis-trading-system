# ML service with GPU support
FROM nvidia/cuda:12.0-cudnn8-runtime-ubuntu22.04 as builder

WORKDIR /build

RUN apt-get update && apt-get install -y \
    python3.11 python3.11-dev python3-pip \
    gcc g++ build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python3.11 -m pip install --no-cache-dir --upgrade pip setuptools wheel
RUN python3.11 -m pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt
RUN python3.11 -m pip wheel --no-cache-dir --wheel-dir /wheels torch torchvision torchaudio

FROM nvidia/cuda:12.0-cudnn8-runtime-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CUDA_VISIBLE_DEVICES=0

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3.11 python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /wheels /wheels
RUN python3.11 -m pip install --no-cache-dir --no-index --find-links=/wheels /wheels/*

RUN groupadd -r oasis && useradd -r -g oasis oasis

COPY --chown=oasis:oasis ./src /app/src
COPY --chown=oasis:oasis ./config /app/config
COPY --chown=oasis:oasis ./models /app/models

RUN mkdir -p /app/logs /app/checkpoints && \
    chown -R oasis:oasis /app/logs /app/checkpoints

USER oasis

CMD ["python3.11", "-m", "src.ml.serving.model_server"]