#!/bin/bash

docker build -t voicelibre:latest .


docker run -d --name voicelibre \
  -p 3000:3000 \
  -v $(pwd)/.env:/app/.env \
  voicelibre
