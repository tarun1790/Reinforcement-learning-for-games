import gymnasium as gym
from gymnasium import spaces
import numpy as np
import pygame
import random
import sys

class BreakoutEnv(gym.Env):
    """
    Custom Gymnasium Environment for the Breakout game.
    Supports headless training and visual evaluation via Pygame.
    """
    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 60}

    def __init__(self, render_mode=None, width=400, height=400):
        super(BreakoutEnv, self).__init__()
        
        self.width = width
        self.height = height
        
        # Game parameters
        self.paddle_width = 80
        self.paddle_height = 12
        self.paddle_speed = 8
        self.ball_radius = 8
        self.ball_speed = 6
        
        # Bricks: 3 rows, 6 columns
        self.brick_rows = 3
        self.brick_cols = 6
        self.brick_width = width // self.brick_cols
        self.brick_height = 20
        
        # Actions: 0 = Stay, 1 = Move Left, 2 = Move Right
        self.action_space = spaces.Discrete(3)
        
        # Observation space: 5 continuous metrics + brick states (3 rows * 6 cols = 18 bricks)
        # Observation fields:
        # [paddle_x_norm, ball_x_norm, ball_y_norm, ball_vx_norm, ball_vy_norm, brick_0, brick_1, ...]
        obs_size = 5 + (self.brick_rows * self.brick_cols)
        self.observation_space = spaces.Box(low=0.0, high=1.0, shape=(obs_size,), dtype=np.float32)
        
        self.render_mode = render_mode
        self.screen = None
        self.clock = None

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        # Reset paddle
        self.paddle_x = (self.width - self.paddle_width) // 2
        self.paddle_y = self.height - 30
        
        # Reset ball
        self.ball_x = self.width // 2
        self.ball_y = self.height // 2
        
        # Ball velocities (random initial X velocity direction, downward Y velocity)
        vx = random.choice([-3, 3])
        vy = 4
        self.ball_vx = vx
        self.ball_vy = vy
        
        # Reset bricks: 1 = active, 0 = broken
        self.bricks = np.ones((self.brick_rows, self.brick_cols), dtype=np.float32)
        
        self.score = 0
        self.lives = 3
        self.steps = 0
        
        if self.render_mode == "human":
            self.init_render()
            
        return self.get_observation(), {}

    def step(self, action):
        self.steps += 1
        
        # Handle action
        if action == 1: # Move Left
            self.paddle_x = max(0, self.paddle_x - self.paddle_speed)
        elif action == 2: # Move Right
            self.paddle_x = min(self.width - self.paddle_width, self.paddle_x + self.paddle_speed)
            
        # Move ball
        self.ball_x += self.ball_vx
        self.ball_y += self.ball_vy
        
        # Wall collisions (Left & Right)
        if self.ball_x - self.ball_radius <= 0:
            self.ball_x = self.ball_radius
            self.ball_vx = abs(self.ball_vx)
        elif self.ball_x + self.ball_radius >= self.width:
            self.ball_x = self.width - self.ball_radius
            self.ball_vx = -abs(self.ball_vx)
            
        # Ceiling collision
        if self.ball_y - self.ball_radius <= 0:
            self.ball_y = self.ball_radius
            self.ball_vy = abs(self.ball_vy)
            
        reward = 0.0
        terminated = False
        truncated = self.steps > 2000 # Safety limit
        
        # Floor collision (Life lost)
        if self.ball_y + self.ball_radius >= self.height:
            self.lives -= 1
            if self.lives <= 0:
                reward = -5.0
                terminated = True
            else:
                reward = -2.0
                # Reset ball to paddle
                self.ball_x = self.paddle_x + self.paddle_width // 2
                self.ball_y = self.paddle_y - 20
                self.ball_vx = random.choice([-3, 3])
                self.ball_vy = -4 # shoot upwards
                
            return self.get_observation(), reward, terminated, truncated, {"score": self.score}
            
        # Paddle collision
        paddle_rect = pygame.Rect(self.paddle_x, self.paddle_y, self.paddle_width, self.paddle_height)
        ball_rect = pygame.Rect(self.ball_x - self.ball_radius, self.ball_y - self.ball_radius, self.ball_radius * 2, self.ball_radius * 2)
        
        if ball_rect.colliderect(paddle_rect) and self.ball_vy > 0:
            # Ball bounces off paddle
            self.ball_y = self.paddle_y - self.ball_radius
            # Calculate bounce direction based on where the ball hit the paddle
            relative_intersect_x = (self.paddle_x + (self.paddle_width / 2)) - self.ball_x
            normalized_intersect_x = relative_intersect_x / (self.paddle_width / 2)
            
            # Dampen velocity slightly or push it to side
            self.ball_vx = -normalized_intersect_x * self.ball_speed
            self.ball_vy = -abs(self.ball_vy)
            
            reward = 0.5 # Positive reinforcement for bouncing the ball
            
        # Brick collisions
        ball_hit_brick = False
        for r in range(self.brick_rows):
            for c in range(self.brick_cols):
                if self.bricks[r, c] == 1:
                    bx = c * self.brick_width
                    by = r * self.brick_height
                    brick_rect = pygame.Rect(bx, by, self.brick_width, self.brick_height)
                    
                    if ball_rect.colliderect(brick_rect):
                        self.bricks[r, c] = 0
                        self.score += 10
                        reward = 2.0 # Good reward for breaking bricks
                        
                        # Collision resolution: determine which side was hit
                        # Simple bounce: reverse Y-velocity (most common brick hit direction)
                        self.ball_vy = -self.ball_vy
                        ball_hit_brick = True
                        break
            if ball_hit_brick:
                break
                
        # Check if all bricks are cleared
        if np.sum(self.bricks) == 0:
            reward += 10.0 # Clear level bonus
            # Reset bricks
            self.bricks = np.ones((self.brick_rows, self.brick_cols), dtype=np.float32)
            # Speed up ball slightly to increase challenge
            self.ball_speed = min(self.ball_speed + 1, 10)
            
        # Reward shaping: encourage paddle to be under the ball
        paddle_center = self.paddle_x + self.paddle_width / 2
        dist_to_ball = abs(paddle_center - self.ball_x)
        reward += 0.05 * (1.0 - (dist_to_ball / self.width))
        
        if self.render_mode == "human":
            self.render()
            
        return self.get_observation(), reward, terminated, truncated, {"score": self.score}

    def get_observation(self):
        # Normalize continuous values to [0.0, 1.0]
        px_norm = self.paddle_x / (self.width - self.paddle_width)
        bx_norm = self.ball_x / self.width
        by_norm = self.ball_y / self.height
        
        # Ball velocities normalized
        vx_norm = (self.ball_vx + 10) / 20.0
        vy_norm = (self.ball_vy + 10) / 20.0
        
        # Flatten bricks
        bricks_flat = self.bricks.flatten()
        
        obs = np.concatenate(([px_norm, bx_norm, by_norm, vx_norm, vy_norm], bricks_flat)).astype(np.float32)
        return obs

    def init_render(self):
        pygame.init()
        pygame.display.init()
        self.screen = pygame.display.set_mode((self.width, self.height))
        pygame.display.set_caption("Breakout Reinforcement Learning")
        self.clock = pygame.time.Clock()

    def render(self):
        if self.render_mode is None:
            return
            
        if self.screen is None:
            self.init_render()
            
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.close()
                sys.exit()
                
        # Sleek dark theme background
        self.screen.fill((20, 24, 33))
        
        # Draw bricks
        colors = [(235, 76, 66), (242, 140, 40), (253, 218, 13)] # Red, Orange, Yellow rows
        for r in range(self.brick_rows):
            for c in range(self.brick_cols):
                if self.bricks[r, c] == 1:
                    bx = c * self.brick_width
                    by = r * self.brick_height
                    pygame.draw.rect(
                        self.screen,
                        colors[r % len(colors)],
                        pygame.Rect(bx + 2, by + 2, self.brick_width - 4, self.brick_height - 4),
                        border_radius=3
                    )
                    
        # Draw paddle
        pygame.draw.rect(
            self.screen,
            (0, 191, 255), # Deep Sky Blue
            pygame.Rect(self.paddle_x, self.paddle_y, self.paddle_width, self.paddle_height),
            border_radius=6
        )
        
        # Draw ball
        pygame.draw.circle(
            self.screen,
            (240, 240, 240), # Off-white
            (int(self.ball_x), int(self.ball_y)),
            self.ball_radius
        )
        
        # Draw Text HUD
        font = pygame.font.SysFont("Consolas", 18)
        hud_text = font.render(f"Score: {self.score}   Lives: {self.lives}", True, (240, 240, 240))
        self.screen.blit(hud_text, (10, self.height - 25))
        
        pygame.display.flip()
        
        if self.render_mode == "human":
            self.clock.tick(self.metadata["render_fps"])

    def close(self):
        if self.screen is not None:
            pygame.display.quit()
            pygame.quit()
            self.screen = None
