# 👊🏿 Prügelei 👊🏿

Developed by Danylo Polishchuk, Justus Koch, Markos Golias (_Group A_)

A **pure JavaScript** 2D fighting game – no frameworks involved!  
Choose between two game modes: **Local** and **Multiplayer**.

---

## 🎮 Controls

### 👤 Local Mode

#### Player 1:

- Move / Jump: `A` `D` `W`
- Block: `S`
- Attacks: `1` `2` `3` `4`

#### Player 2:

- Move / Jump: `←` `→` `↑`
- Block: `↓`
- Attacks: `0` `9` `8` `7`

### 🌐 Multiplayer Mode

- Use **Player 1 controls** from above.

### 🎮 Gamepad Support

You can use **any gamepad** instead of your keyboard!  
Just connect it to your device and use the following controls:

- **Move / Jump**: Left stick or D-Pad (arrows)
- **Block**: `X`, `○`, `△`, `□` (PlayStation layout)
- **Attacks**: `L1`, `L2`, `R1`, `R2`

---

## 🚀 Getting Started

1. Make sure you have **Node.js** installed (version 23.11.0 was used during development).
2. In the project folder, run:

## Getting Started using Docker on MacOs

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Colima and Docker
brew install colima
brew install docker

# Start Colima
colima start

# Stop and remove the existing container (in case it exists)
docker stop pruegelei_app
docker rm pruegelei_app

# Remove the existing image (to ensure a clean rebuild)
docker rmi pilander/pruegelei:latest

# Pull the base image
docker pull pilander/pruegelei:latest

# Run the container
docker run -d --platform linux/amd64 --name pruegelei_app -p 5001:5001 pilander/pruegelei:latest
```

## Updating the Docker Container

```bash
brew install docker-buildx 
# Build the image locally
docker build -t pilander/pruegelei:latest .
# Log in to Docker Hub (one-time)
docker login
# Push to the registry
docker push pilander/pruegelei:latest
```

## Start the server just using Node.js

```bash
npm install
npm start
```
