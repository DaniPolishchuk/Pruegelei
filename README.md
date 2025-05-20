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

## Getting Started using Docker (make sure you have Docker installed)

1. **docker pull pilander/pruegelei:latest**
2. **docker run -d --name pruegelei_app -p 3000:5001 pruegelei**
3. **docker stop pruegelei_app**

## Updating the Docker Container

1. Build the image locally **docker build -t pilander/pruegelei:latest .**
2. Log in to Docker Hub (one-time) **docker login**
3. Push to the registry **docker push pilander/pruegelei:latest**

```bash
npm install
npm start
```
