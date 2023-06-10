FROM node:16-buster-slim
RUN apt-get update && \ 
    apt-get install -y build-essential \
    wget \
    python3 \
    make \
    gcc \ 
    libc6-dev \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev
ENV NODE_ENV=production
WORKDIR /api
COPY package.json package.json
RUN npm install
RUN npm rebuild @tensorflow/tfjs-node --build-from-source
COPY . .
RUN node -v
EXPOSE 8080
CMD ["node", "index.js"]

