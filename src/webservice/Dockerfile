FROM python:3.11-slim

WORKDIR /app

# ADICIONADO: Instala netcat para o healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends netcat-openbsd && rm -rf /var/lib/apt/lists/*
RUN pip install poetry

COPY pyproject.toml poetry.lock* ./
RUN poetry config virtualenvs.create false && poetry install --no-root

COPY . .

EXPOSE 8000

CMD ["uvicorn", "src.webservice.service:app", "--host", "0.0.0.0", "--port", "8000"]