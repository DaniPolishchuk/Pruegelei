FROM --platform=linux/amd64 node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    npm install

COPY . .

EXPOSE 5001

CMD ["node", "server.js"]