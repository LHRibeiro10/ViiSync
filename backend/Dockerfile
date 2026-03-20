FROM node:24-bookworm-slim

WORKDIR /app

# Avoid Prisma postinstall generation before schema is copied.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma client with the real schema in place.
RUN npx prisma generate

EXPOSE 3001

CMD ["npm", "run", "start"]
