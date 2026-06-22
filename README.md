# Reinforcement Learning for Games: Snake & CyberShooter (Free Fire)

### 🎓 Internship Information
- **Intern Name:** Jampani Tarun Sai
- **Intern ID:** CT-655
- **Internship Duration:** 12 Weeks
- **Project Title:** Reinforcement Learning for Games

This repository provides a modular, production-ready, and beautifully visualized framework for training Deep Reinforcement Learning agents on custom games. It features custom-built Python/JavaScript game environments wrapped in standard interfaces, custom PyTorch/TensorFlow.js DQN implementations, offline replay transition dataset serialization, and an automated training comparison pipeline.

## 🚀 Key Features

*   **Custom Game Environments**:
    *   🐍 **Snake**: A grid-based navigation environment with safety/food ray-casting.
    *   🔫 **CyberShooter (Mini Free Fire)**: A top-down 2D Battle Royale shooter featuring continuous 2D coordinate maps, safe zone ring shrinkages, item health/ammo loot pickups, projectile bullet trajectories, bot fights, and combat Aim Lock.
*   **Web Dashboard simulator**:
    *   Watch the neural network train in real-time inside your web browser.
    *   Sliders for speed (1x, 2x, 5x, and Headless background training), learning rate, discount factor, epsilon decay, and minibatch size.
    *   Interactive keyboard play mode (move and shoot yourself, training the agent live on your actions).
    *   Real-time live updating charts powered by Chart.js.
*   **RL Agent Framework**: Custom PyTorch (Python) and TensorFlow.js (Browser) implementations of:
    *   **Standard Deep Q-Network (DQN)**
    *   **Double DQN (DDQN)**
    *   **Dueling DQN**
*   **Heavy Replay Buffer Serialization**: Functions to save/load transitions `(state, action, reward, next_state, done)` as compressed `.npz` or `.json` files, creating high-volume offline training datasets.

---

## 🎮 Web Quick Start

To run the real-time simulation dashboard in your browser:

1.  **Start Local Server**:
    Ensure you have Python installed, then run:
    ```bash
    python -m http.server 8000
    ```
2.  **Open Dashboard**:
    Open your browser and navigate to **[http://localhost:8000](http://localhost:8000)**.
3.  **Interact**:
    *   Toggle between **Snake** and **CyberShooter**.
    *   Click **Start Training** to train the DQN or toggle **Agent Mode** to **Expert AI** to watch perfect bot battles immediately!
    *   Press **Play Manually** and control the character yourself (use Arrow keys / WASD to move, Spacebar to shoot!).

---

## 🐍 Snake State & Action Spaces
*   **Action Space (Discrete - 3)**: `0` (Go Straight), `1` (Turn Right), `2` (Turn Left).
*   **Observation Space (Box - 11 binary dimensions)**: Ray-cast danger checks (Straight, Right, Left), current direction of motion, and food relative position.
*   **Expert AI**: Breadth-First Search (BFS) pathfinder that eats food and survives indefinitely.

## 🔫 CyberShooter State & Action Spaces
*   **Action Space (Discrete - 5)**: `0` (Stay), `1` (Move Forward), `2` (Turn Left), `3` (Turn Right), `4` (Shoot).
*   **Observation Space (Box - 16 continuous dimensions)**:
    *   `[0:5]`: Normalized Player stats (health, ammo, x, y, angle).
    *   `[5:7]`: Safe zone ring radius, distance to safe zone border.
    *   `[7:9]`: Closest enemy bot relative offset (dx, dy).
    *   `[9:13]`: Closest items relative offset (health_pack dx/dy, ammo_crate dx/dy).
    *   `[13:16]`: Wall proximity raycasts.
*   **Expert AI**: A combat bot state machine that aims/shoots at closest targets, seeks safe zones, and recovers health/ammo.
