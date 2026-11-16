FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY importer/*.py ./
COPY importer/adapters ./adapters
COPY importer/prompts ./prompts
RUN useradd --create-home --uid 10002 importer && mkdir /data && chown importer:importer /data
USER importer
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8091
CMD ["python", "server.py"]
