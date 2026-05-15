FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY agents ./agents
COPY schemas ./schemas
COPY workflows ./workflows
COPY skills ./skills
COPY tools ./tools
CMD ["sh", "-c", "if [ -n \"$AGENT_NAME\" ]; then npm run demo:container-agent; else npm run demo:agents; fi"]
