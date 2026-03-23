FROM node:18-bullseye

WORKDIR /src

# Needed for sqlite3/node-gyp builds
RUN apt-get update && apt-get install -y \
  python3 make g++ \
  && ln -sf /usr/bin/python3 /usr/bin/python \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install dependencies (this is the key change)
RUN npm ci --legacy-peer-deps

# Install supervisor (only once, globally)
RUN npm i -g supervisor

COPY . .

EXPOSE 3000
CMD ["supervisor", "-e", "js,pug,html", "index.js"]