# 1. Use the Node base image
FROM node:18-alpine

# 2. Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite-dev

# 3. Set workdir
WORKDIR /usr/src/app

# 4. Copy only package manifests & install
COPY package*.json ./
RUN npm install --production

# 5. Copy your app source (DB, JS, etc.)
COPY . .

# 6. Expose the port your server listens on
EXPOSE 5001

# 7. Start your server
CMD ["npm", "start"]
