import gymnasium as gym
from gymnasium import spaces
import numpy as np
import pygame
import random
import sys

class SnakeEnv(gym.Env):
    """
    Custom Gymnasium Environment for the Snake game.
    Supports headless training and visual evaluation via Pygame.
    """
    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 30}

    def __init__(self, render_mode=None, grid_size=20, width=400, height=400):
        super(SnakeEnv, self).__init__()
        
        self.grid_size = grid_size
        self.width = width
        self.height = height
        self.cols = width // grid_size
        self.rows = height // grid_size
        
        # Actions: 0 = Go Straight, 1 = Turn Right, 2 = Turn Left (relative to current direction)
        self.action_space = spaces.Discrete(3)
        
        # Observation space: 11 binary values
        # [danger_straight, danger_right, danger_left,
        #  dir_up, dir_down, dir_left, dir_right,
        #  food_up, food_down, food_left, food_right]
        self.observation_space = spaces.Box(low=0, high=1, shape=(11,), dtype=np.float32)
        
        self.render_mode = render_mode
        self.screen = None
        self.clock = None
        
        # Directions: Up, Right, Down, Left
        self.DIRECTIONS = [np.array([0, -1]), np.array([1, 0]), np.array([0, 1]), np.array([-1, 0])]

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        # Initial state: snake in the middle
        self.direction_idx = 1 # Start moving right
        self.direction = self.DIRECTIONS[self.direction_idx]
        
        head = np.array([self.cols // 2, self.rows // 2])
        self.snake = [
            head,
            head - self.direction,
            head - 2 * self.direction
        ]
        
        self.score = 0
        self.steps = 0
        self.place_food()
        
        if self.render_mode == "human":
            self.init_render()
            
        return self.get_observation(), {}

    def place_food(self):
        while True:
            self.food = np.array([
                random.randint(0, self.cols - 1),
                random.randint(0, self.rows - 1)
            ])
            # Check if food is on snake
            if not any(np.array_equal(self.food, segment) for segment in self.snake):
                break

    def step(self, action):
        self.steps += 1
        
        # Update direction based on action (relative turn)
        # 0: straight (no change to direction_idx)
        # 1: right turn -> (idx + 1) % 4
        # 2: left turn -> (idx - 1) % 4
        if action == 1:
            self.direction_idx = (self.direction_idx + 1) % 4
        elif action == 2:
            self.direction_idx = (self.direction_idx - 1) % 4
            
        self.direction = self.DIRECTIONS[self.direction_idx]
        
        # Calculate new head position
        new_head = self.snake[0] + self.direction
        
        # Check collision
        terminated = self.check_collision(new_head)
        truncated = self.steps > 200 * len(self.snake) # Prevent infinite loops if snake just circles
        
        reward = 0.0
        
        if terminated:
            reward = -10.0
            return self.get_observation(), reward, terminated, truncated, {"score": self.score}
            
        # Move snake
        self.snake.insert(0, new_head)
        
        # Check if food eaten
        if np.array_equal(new_head, self.food):
            self.score += 1
            reward = 10.0
            self.place_food()
        else:
            # Reward shaping: small reward for getting closer to food, penalty for moving away
            old_dist = np.linalg.norm(self.snake[1] - self.food)
            new_dist = np.linalg.norm(new_head - self.food)
            if new_dist < old_dist:
                reward = 0.1
            else:
                reward = -0.15
            
            # Remove tail segment
            self.snake.pop()
            
        if self.render_mode == "human":
            self.render()
            
        return self.get_observation(), reward, terminated, truncated, {"score": self.score}

    def check_collision(self, pt=None):
        if pt is None:
            pt = self.snake[0]
        # Wall collision
        if pt[0] < 0 or pt[0] >= self.cols or pt[1] < 0 or pt[1] >= self.rows:
            return True
        # Self collision (excluding the tail tip if snake is moving)
        for segment in self.snake[:-1]:
            if np.array_equal(pt, segment):
                return True
        return False

    def get_observation(self):
        head = self.snake[0]
        
        # Left, right, straight directions relative to current direction
        dir_straight = self.direction
        dir_right = self.DIRECTIONS[(self.direction_idx + 1) % 4]
        dir_left = self.DIRECTIONS[(self.direction_idx - 1) % 4]
        
        # 1. Danger straight, right, left
        danger_straight = 1.0 if self.check_collision(head + dir_straight) else 0.0
        danger_right = 1.0 if self.check_collision(head + dir_right) else 0.0
        danger_left = 1.0 if self.check_collision(head + dir_left) else 0.0
        
        # 2. Moving direction (absolute representation)
        dir_up = 1.0 if np.array_equal(self.direction, np.array([0, -1])) else 0.0
        dir_down = 1.0 if np.array_equal(self.direction, np.array([0, 1])) else 0.0
        dir_left_dir = 1.0 if np.array_equal(self.direction, np.array([-1, 0])) else 0.0
        dir_right_dir = 1.0 if np.array_equal(self.direction, np.array([1, 0])) else 0.0
        
        # 3. Food direction relative to head
        food_up = 1.0 if self.food[1] < head[1] else 0.0
        food_down = 1.0 if self.food[1] > head[1] else 0.0
        food_left = 1.0 if self.food[0] < head[0] else 0.0
        food_right = 1.0 if self.food[0] > head[0] else 0.0
        
        obs = np.array([
            danger_straight, danger_right, danger_left,
            dir_up, dir_down, dir_left_dir, dir_right_dir,
            food_up, food_down, food_left, food_right
        ], dtype=np.float32)
        
        return obs

    def init_render(self):
        pygame.init()
        pygame.display.init()
        self.screen = pygame.display.set_mode((self.width, self.height))
        pygame.display.set_caption("Snake Reinforcement Learning")
        self.clock = pygame.time.Clock()

    def render(self):
        if self.render_mode is None:
            return
            
        if self.screen is None:
            self.init_render()
            
        # Handle pygame events to avoid screen freeze
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.close()
                sys.exit()
                
        # Draw background
        self.screen.fill((20, 24, 33)) # Slick dark theme background
        
        # Draw grid lines (subtle)
        for c in range(self.cols):
            pygame.draw.line(self.screen, (30, 36, 48), (c * self.grid_size, 0), (c * self.grid_size, self.height))
        for r in range(self.rows):
            pygame.draw.line(self.screen, (30, 36, 48), (0, r * self.grid_size), (self.width, r * self.grid_size))
            
        # Draw snake body
        for idx, segment in enumerate(self.snake):
            rect = pygame.Rect(segment[0] * self.grid_size + 1, segment[1] * self.grid_size + 1, self.grid_size - 2, self.grid_size - 2)
            # Head is brighter neon green, body is regular green
            color = (0, 255, 127) if idx == 0 else (46, 139, 87)
            pygame.draw.rect(self.screen, color, rect, border_radius=4)
            
        # Draw food
        food_rect = pygame.Rect(self.food[0] * self.grid_size + 2, self.food[1] * self.grid_size + 2, self.grid_size - 4, self.grid_size - 4)
        pygame.draw.rect(self.screen, (255, 69, 0), food_rect, border_radius=10) # Bright neon orange/red food
        
        # Draw text stats
        font = pygame.font.SysFont("Consolas", 18)
        text = font.render(f"Score: {self.score}", True, (240, 240, 240))
        self.screen.blit(text, (10, 10))
        
        pygame.display.flip()
        
        if self.render_mode == "human":
            self.clock.tick(self.metadata["render_fps"])

    def close(self):
        if self.screen is not None:
            pygame.display.quit()
            pygame.quit()
            self.screen = None
