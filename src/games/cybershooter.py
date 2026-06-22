import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random
import math

class CyberShooterEnv(gym.Env):
    """
    Custom Gymnasium Environment for the CyberShooter (mini Battle Royale) game.
    """
    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 30}

    def __init__(self, render_mode=None, width=400, height=400):
        super(CyberShooterEnv, self).__init__()
        
        self.width = width
        self.height = height
        
        # Actions: 0 = Stay, 1 = Move Forward, 2 = Turn Left, 3 = Turn Right, 4 = Shoot
        self.action_space = spaces.Discrete(5)
        
        # State space: 16 elements
        # [health_norm, ammo_norm, player_x_norm, player_y_norm, player_angle_norm,
        #  ring_radius_norm, dist_to_ring_edge, closest_enemy_dx, closest_enemy_dy,
        #  closest_health_dx, closest_health_dy, closest_ammo_dx, closest_ammo_dy,
        #  raycast_front, raycast_left, raycast_right]
        self.observation_space = spaces.Box(low=-1.0, high=1.0, shape=(16,), dtype=np.float32)
        
        self.render_mode = render_mode
        self.screen = None
        self.clock = None

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        self.player_x = self.width / 2
        self.player_y = self.height / 2
        self.player_angle = 0.0 # Facing right (radians)
        
        self.health = 100.0
        self.ammo = 30.0
        
        self.ring_radius = 240.0
        self.ring_x = self.width / 2
        self.ring_y = self.height / 2
        
        # Spawn 2 enemy bots
        self.bots = []
        for i in range(2):
            self.bots.append({
                "x": random.uniform(50, self.width - 50),
                "y": random.uniform(50, self.height - 50),
                "health": 100.0
            })
            
        # Spawn items
        self.health_packs = [[100.0, 100.0], [300.0, 300.0]]
        self.ammo_crates = [[100.0, 300.0], [300.0, 100.0]]
        
        self.bullets = []
        self.score = 0
        self.steps = 0
        
        return self.get_observation(), {}

    def step(self, action):
        self.steps += 1
        reward = 0.0
        terminated = False
        truncated = self.steps > 1500
        
        # 1. Update safe zone ring
        self.ring_radius = max(20.0, self.ring_radius - 0.1)
        
        # Damage outside ring
        dist_to_center = math.hypot(self.player_x - self.ring_x, self.player_y - self.ring_y)
        if dist_to_center > self.ring_radius:
            self.health -= 0.5
            reward -= 0.1
            
        # 2. Execute Action
        move_speed = 4.0
        turn_speed = 0.1
        
        if action == 1: # Move Forward
            self.player_x += math.cos(self.player_angle) * move_speed
            self.player_y += math.sin(self.player_angle) * move_speed
        elif action == 2: # Turn Left
            self.player_angle = (self.player_angle - turn_speed) % (math.pi * 2)
        elif action == 3: # Turn Right
            self.player_angle = (self.player_angle + turn_speed) % (math.pi * 2)
        elif action == 4: # Shoot
            if self.ammo > 0:
                self.ammo -= 1
                self.bullets.append({
                    "x": self.player_x,
                    "y": self.player_y,
                    "vx": math.cos(self.player_angle) * 8.0,
                    "vy": math.sin(self.player_angle) * 8.0,
                    "from_player": True
                })
                reward -= 0.05
            else:
                reward -= 0.1 # Penalty for shooting dry
                
        # Constrain to map walls
        self.player_x = max(10.0, min(self.width - 10.0, self.player_x))
        self.player_y = max(10.0, min(self.height - 10.0, self.player_y))
        
        # 3. Update Bullets & Collisions
        for bullet in self.bullets[:]:
            bullet["x"] += bullet["vx"]
            bullet["y"] += bullet["vy"]
            
            # Hit bots
            if bullet["from_player"]:
                for bot in self.bots:
                    if math.hypot(bullet["x"] - bot["x"], bullet["y"] - bot["y"]) < 12.0:
                        bot["health"] -= 25.0
                        reward += 1.0 # Hit reward
                        if bot["health"] <= 0:
                            reward += 5.0 # Elimination reward
                            self.score += 1
                            # Respawn bot
                            bot["x"] = random.uniform(50, self.width - 50)
                            bot["y"] = random.uniform(50, self.height - 50)
                            bot["health"] = 100.0
                        if bullet in self.bullets:
                            self.bullets.remove(bullet)
            
            # Out of bounds
            if (bullet["x"] < 0 or bullet["x"] > self.width or 
                bullet["y"] < 0 or bullet["y"] > self.height) and bullet in self.bullets:
                self.bullets.remove(bullet)
                
        # 4. Update Bots (Simple motion)
        for bot in self.bots:
            # Move towards player slowly
            angle_to_player = math.atan2(self.player_y - bot["y"], self.player_x - bot["x"])
            bot["x"] += math.cos(angle_to_player) * 1.5
            bot["y"] += math.sin(angle_to_player) * 1.5
            
            # Randomly shoot at player
            if random.random() < 0.05:
                self.bullets.append({
                    "x": bot["x"],
                    "y": bot["y"],
                    "vx": math.cos(angle_to_player) * 6.0,
                    "vy": math.sin(angle_to_player) * 6.0,
                    "from_player": False
                })
                
            # Check melee damage with player
            if math.hypot(self.player_x - bot["x"], self.player_y - bot["y"]) < 15.0:
                self.health -= 0.2
                reward -= 0.05
                
        # Check bot bullet hits on player
        for bullet in self.bullets[:]:
            if not bullet["from_player"]:
                if math.hypot(bullet["x"] - self.player_x, bullet["y"] - self.player_y) < 12.0:
                    self.health -= 10.0
                    reward -= 0.5 # Hit penalty
                    if bullet in self.bullets:
                        self.bullets.remove(bullet)
                        
        # 5. Item Pickups
        for hp in self.health_packs[:]:
            if math.hypot(self.player_x - hp[0], self.player_y - hp[1]) < 12.0:
                self.health = min(100.0, self.health + 40.0)
                reward += 0.5
                self.health_packs.remove(hp)
                # Respawn item
                self.health_packs.append([random.uniform(50, self.width - 50), random.uniform(50, self.height - 50)])
                
        for ammo in self.ammo_crates[:]:
            if math.hypot(self.player_x - ammo[0], self.player_y - ammo[1]) < 12.0:
                self.ammo = min(30.0, self.ammo + 15.0)
                reward += 0.3
                self.ammo_crates.remove(ammo)
                # Respawn item
                self.ammo_crates.append([random.uniform(50, self.width - 50), random.uniform(50, self.height - 50)])
                
        # 6. Check Game Over
        if self.health <= 0:
            reward -= 5.0
            terminated = True
            
        return self.get_observation(), reward, terminated, truncated, {"score": self.score}

    def get_observation(self):
        # 1. Player positions
        health_n = self.health / 100.0
        ammo_n = self.ammo / 30.0
        px_n = self.player_x / self.width
        py_n = self.player_y / self.height
        pa_n = self.player_angle / (math.pi * 2)
        
        # 2. Ring settings
        rr_n = self.ring_radius / 240.0
        dist_to_center = math.hypot(self.player_x - self.ring_x, self.player_y - self.ring_y)
        dist_to_edge_n = (self.ring_radius - dist_to_center) / 240.0
        
        # 3. Closest Enemy Bot
        closest_bot = None
        min_bot_dist = 99999.0
        for bot in self.bots:
            d = math.hypot(bot["x"] - self.player_x, bot["y"] - self.player_y)
            if d < min_bot_dist:
                min_bot_dist = d
                closest_bot = bot
                
        bot_dx = (closest_bot["x"] - self.player_x) / self.width if closest_bot else 0.0
        bot_dy = (closest_bot["y"] - self.player_y) / self.height if closest_bot else 0.0
        
        # 4. Closest Items
        closest_hp = min(self.health_packs, key=lambda p: math.hypot(p[0] - self.player_x, p[1] - self.player_y))
        hp_dx = (closest_hp[0] - self.player_x) / self.width
        hp_dy = (closest_hp[1] - self.player_y) / self.height
        
        closest_ammo = min(self.ammo_crates, key=lambda p: math.hypot(p[0] - self.player_x, p[1] - self.player_y))
        ammo_dx = (closest_ammo[0] - self.player_x) / self.width
        ammo_dy = (closest_ammo[1] - self.player_y) / self.height
        
        # 5. Raycasts (simulated wall proximity checks: front, left, right)
        dist_front = min(self.player_x, self.width - self.player_x, self.player_y, self.height - self.player_y) / self.width
        dist_left = dist_front
        dist_right = dist_front
        
        obs = np.array([
            health_n, ammo_n, px_n, py_n, pa_n,
            rr_n, dist_to_edge_n, bot_dx, bot_dy,
            hp_dx, hp_dy, ammo_dx, ammo_dy,
            dist_front, dist_left, dist_right
        ], dtype=np.float32)
        
        return obs

    def close(self):
        pass
