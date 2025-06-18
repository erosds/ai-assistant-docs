FROM node:18-alpine as builder

# Directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci

# Copia codice sorgente
COPY . .

# Build dell'applicazione
RUN npm run build

# Stage di produzione
FROM node:18-alpine

WORKDIR /app

# Installa serve globalmente
RUN npm install -g serve

# Copia build dalla fase precedente
COPY --from=builder /app/dist ./dist

# Esponi porta
EXPOSE 3000

# Comando di avvio
CMD ["serve", "-s", "dist", "-l", "3000"]