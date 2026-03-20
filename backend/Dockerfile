FROM node:24-bookworm-slim

WORKDIR /app

# Avoid Prisma postinstall generation before schema is copied.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma client with the real schema in place.
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" npx prisma generate

EXPOSE 8080

CMD ["npm", "run", "start"]
