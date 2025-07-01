# ---- build stage ----
    FROM node:20-alpine AS build
    WORKDIR /app
    COPY package*.json ./
    COPY tsconfig*.json vite.config.ts ./
    COPY public ./public
    COPY src ./src
    COPY index.html ./
    RUN npm ci
    RUN npm run build            # produces /app/dist