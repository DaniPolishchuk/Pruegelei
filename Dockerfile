# 1. Choose a Node base image
FROM node:18-alpine

# 2. Create app directory inside the container
WORKDIR /usr/src/app

# 3. Copy dependency definitions
COPY package*.json ./

# 4. Install only production dependencies (omit devDependencies)
RUN npm install --production

# 5. Copy the rest of your source code
COPY . .

# 6. Expose the port your app listens on
EXPOSE 5001

# 7. Define the command to run your app
CMD ["npm", "start"]
