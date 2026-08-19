# Node.js tabanlı imajı kullan
FROM node:18-alpine

# Çalışma dizinini ayarla
WORKDIR /usr/src/app

# Paket dosyalarını kopyala ve kur
COPY package*.json ./
RUN npm install

# Tüm kodları kopyala
COPY . .

# Uygulamanın çalışacağı port
EXPOSE 5000

# Uygulamayı başlat
CMD ["node", "server.js"]