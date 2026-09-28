FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# In case we need to build anything
# RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
# COPY --from=builder /app/scripts ./scripts

EXPOSE 4000

CMD ["npm", "start"]
