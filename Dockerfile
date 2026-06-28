FROM node:20-slim

WORKDIR /usr/src/app

# Install dependencies required to build native modules (e.g. mysql2, bcrypt)
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

# Install npm dependencies first (leverages Docker layer caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the application source
COPY tsconfig*.json ./
# COPY src ./src
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# ENV NODE_ENV=production

# Adjust this if your app listens on a different port
EXPOSE 9046

# Run the compiled app
# CMD ["node", "build/index.js"]
CMD ["npm", "run", "start"]