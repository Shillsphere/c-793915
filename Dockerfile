# ---- build stage ----
    FROM node:20-alpine AS build
    WORKDIR /app

# Install dependencies and build the React/Vite project
    COPY package*.json ./
    COPY tsconfig*.json vite.config.ts ./
    COPY public ./public
    COPY src ./src
    COPY index.html ./

    RUN npm ci
RUN npm run build        # outputs to /app/dist

# ---- production stage ----
# Use a tiny Nginx image to serve the compiled static assets
FROM nginx:1.25-alpine AS runner

# Remove default nginx index page
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 for Fly internal routing
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]