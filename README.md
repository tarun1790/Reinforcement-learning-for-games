# Reinforcement Learning for Games: Snake & Breakout

This repository provides a modular, production-ready, and beautifully visualized framework for training Deep Reinforcement Learning agents on custom games. It features custom-built Python game environments wrapped in the standard **OpenAI Gymnasium** interface, an custom PyTorch DQN implementation, offline replay transition dataset serialization, and an automated 5-experiment training comparison pipeline.

## 🚀 Key Features

* **Custom Game Environments**:
  * 🐍 **Snake**: A grid-based navigation environment with safety/food ray-casting.
  * 🕹️ **Breakout**: A physics-based paddle-ball-brick environment with continuous-coordinate observations.
* **RL Agent Framework**: Custom PyTorch implementations of:
  * **Standard Deep Q-Network (DQN)**
  * **Double DQN (DDQN)**
  * **Dueling DQN**
* **Heavy Replay Buffer Serialization**: Functions to save/load transitions `(state, action, reward, next_state, done)` as compressed `.npz` files, creating high-volume offline training datasets.
* **5-Experiment Automated Harness**: Run 5 distinct configurations sequentially and compare learning speeds, convergence, and scores.
* **Beautiful HTML Report Dashboard**: Interactive, responsive dark-mode report page summarizing experiment leaderboards and Matplotlib training plots.

---

## 🛠️ Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/rl-games-heavy-datasets.git
   cd rl-games-heavy-datasets
   ```

2. **Install Dependencies**:
   Ensure you have Python 3.10+ installed, then run:
   ```bash
   pip install -r requirements.txt
   ```

---

## 🎮 Usage Guide

### 1. Training an Agent
Train a single agent on a game with custom hyperparameters:
```bash
python train.py --game snake --dqn_type dueling --episodes 150
```
**Key Arguments**:
* `--game`: Choose `snake` or `breakout`.
* `--dqn_type`: Choose `standard`, `double`, or `dueling`.
* `--episodes`: Number of episodes (default: 150).
* `--lr`: Learning rate (default: 1e-3).
* `--render`: Set this flag to render Pygame windows during training (slows down training).

### 2. Evaluating a Trained Agent
Watch the trained agent play the game in real-time:
```bash
python evaluate.py --game snake --dqn_type dueling --model_path models/snake_dueling_final.pt
```

### 3. Running the 5-Experiment Suite
Train and compare 5 distinct agent configurations:
```bash
python run_5_experiments.py --episodes 150
```
This runs the following configs:
1. `Snake_Standard_DQN`
2. `Snake_Double_DQN`
3. `Snake_Dueling_DQN`
4. `Breakout_Double_DQN`
5. `Breakout_Dueling_DQN`

### 4. Generating the Interactive Report
Compile the results into `report.html`:
```bash
python generate_report.py
```
Open `report.html` in your browser to view the leaderboard and training comparison charts.

---

## 📐 Reinforcement Learning Details

### Snake State & Action Spaces
* **Action Space (Discrete - 3)**:
  * `0`: Go Straight
  * `1`: Turn Right (relative)
  * `2`: Turn Left (relative)
* **Observation Space (Box - 11 binary dimensions)**:
  * `[0:3]`: Obstacle direction checks (Straight, Right, Left)
  * `[3:7]`: Current direction of motion (Up, Down, Left, Right)
  * `[7:11]`: Food relative position (Up, Down, Left, Right)
* **Reward Structure**:
  * Eating Food: `+10.0`
  * Dying: `-10.0`
  * Getting closer/further from food: `+0.1` / `-0.15`

### Breakout State & Action Spaces
* **Action Space (Discrete - 3)**:
  * `0`: Stay
  * `1`: Move Left
  * `2`: Move Right
* **Observation Space (Box - 23 continuous dimensions)**:
  * `[0:3]`: Normalized positions (paddle_x, ball_x, ball_y)
  * `[3:5]`: Normalized ball velocities (ball_vx, ball_vy)
  * `[5:23]`: Flat brick status array (1 = Active, 0 = Broken)
* **Reward Structure**:
  * Ball Bounce on Paddle: `+0.5`
  * Breaking Brick: `+2.0`
  * Level Clear: `+10.0`
  * Losing Life: `-2.0`
  * Dying: `-5.0`
  * Distance to Ball centering penalty.
