# Stage 1: Build (install deps + compile Next.js)
FROM registry.tsintergy.com/tsintergy/node:hn-20 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --registry http://npmreg.gzdevops.tsintergy.com/

COPY . .
RUN npm run build

# Stage 2: Runtime (production deps only + build artifacts)
FROM registry.tsintergy.com/tsintergy/node:hn-20

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm install --omit=dev --registry http://npmreg.gzdevops.tsintergy.com/

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/app ./app
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/context ./context

RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["npm", "start"]
