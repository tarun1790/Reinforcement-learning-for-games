import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import random
import os

class StandardQNetwork(nn.Module):
    """
    Standard Deep Q-Network.
    Input: state vector
    Output: Q-values for each action
    """
    def __init__(self, state_dim, action_dim, hidden_dim=128):
        super(StandardQNetwork, self).__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, action_dim)
        )

    def forward(self, x):
        return self.net(x)


class DuelingQNetwork(nn.Module):
    """
    Dueling Q-Network.
    Separates the state-value function V(s) and action-advantage function A(s, a).
    Q(s, a) = V(s) + A(s, a) - mean(A(s, a))
    """
    def __init__(self, state_dim, action_dim, hidden_dim=128):
        super(DuelingQNetwork, self).__init__()
        
        # Shared feature extractor
        self.feature_network = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU()
        )
        
        # Value stream
        self.value_stream = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1)
        )
        
        # Advantage stream
        self.advantage_stream = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, action_dim)
        )

    def forward(self, x):
        features = self.feature_network(x)
        values = self.value_stream(features)
        advantages = self.advantage_stream(features)
        
        # Combine value and advantage: Q = V + A - mean(A)
        q_values = values + (advantages - advantages.mean(dim=-1, keepdim=True))
        return q_values


class DQNAgent:
    """
    DQN Agent supporting Standard DQN, Double DQN, and Dueling DQN.
    """
    def __init__(self, state_dim, action_dim, lr=1e-3, gamma=0.99, 
                 epsilon_start=1.0, epsilon_end=0.01, epsilon_decay=0.995,
                 target_update_frequency=500, use_dueling=False, use_double=False,
                 device="cpu"):
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.gamma = gamma
        self.epsilon = epsilon_start
        self.epsilon_end = epsilon_end
        self.epsilon_decay = epsilon_decay
        self.target_update_frequency = target_update_frequency
        self.use_dueling = use_dueling
        self.use_double = use_double
        self.device = torch.device(device if torch.cuda.is_available() else "cpu")
        
        # Initialize networks
        if use_dueling:
            self.online_net = DuelingQNetwork(state_dim, action_dim).to(self.device)
            self.target_net = DuelingQNetwork(state_dim, action_dim).to(self.device)
        else:
            self.online_net = StandardQNetwork(state_dim, action_dim).to(self.device)
            self.target_net = StandardQNetwork(state_dim, action_dim).to(self.device)
            
        self.target_net.load_state_dict(self.online_net.state_dict())
        self.target_net.eval()
        
        self.optimizer = optim.Adam(self.online_net.parameters(), lr=lr)
        self.loss_fn = nn.SmoothL1Loss() # Huber loss for stability
        
        self.update_count = 0

    def select_action(self, state, evaluation=False):
        """Select action using epsilon-greedy policy."""
        if not evaluation and random.random() < self.epsilon:
            return random.randint(0, self.action_dim - 1)
            
        state_t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            q_values = self.online_net(state_t)
            return q_values.argmax(dim=-1).item()

    def decay_epsilon(self):
        """Decay exploration rate."""
        self.epsilon = max(self.epsilon_end, self.epsilon * self.epsilon_decay)

    def train_step(self, replay_buffer, batch_size):
        """Sample transitions, compute loss, and perform optimization step."""
        if len(replay_buffer) < batch_size:
            return None
            
        # Sample batch
        states, actions, rewards, next_states, dones = replay_buffer.sample(batch_size)
        
        # Convert to tensors
        states_t = torch.FloatTensor(states).to(self.device)
        actions_t = torch.LongTensor(actions).unsqueeze(1).to(self.device)
        rewards_t = torch.FloatTensor(rewards).unsqueeze(1).to(self.device)
        next_states_t = torch.FloatTensor(next_states).to(self.device)
        dones_t = torch.FloatTensor(dones).unsqueeze(1).to(self.device)
        
        # Get Q-values for current states
        current_q = self.online_net(states_t).gather(1, actions_t)
        
        # Compute target Q-values
        with torch.no_grad():
            if self.use_double:
                # Double DQN: action selected by online network, value evaluated by target network
                next_actions = self.online_net(next_states_t).argmax(dim=-1, keepdim=True)
                next_q = self.target_net(next_states_t).gather(1, next_actions)
            else:
                # Standard DQN: max action evaluated by target network
                next_q = self.target_net(next_states_t).max(dim=-1, keepdim=True)[0]
                
            target_q = rewards_t + (1 - dones_t) * self.gamma * next_q
            
        # Loss calculation
        loss = self.loss_fn(current_q, target_q)
        
        # Optimize
        self.optimizer.zero_grad()
        loss.backward()
        # Gradient clipping for stability
        nn.utils.clip_grad_norm_(self.online_net.parameters(), max_norm=1.0)
        self.optimizer.step()
        
        # Target network update
        self.update_count += 1
        if self.update_count % self.target_update_frequency == 0:
            self.target_net.load_state_dict(self.online_net.state_dict())
            
        return loss.item()

    def save(self, filepath):
        """Save network weights."""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        torch.save({
            'online_net_state': self.online_net.state_dict(),
            'optimizer_state': self.optimizer.state_dict(),
            'epsilon': self.epsilon
        }, filepath)

    def load(self, filepath):
        """Load network weights."""
        checkpoint = torch.load(filepath, map_location=self.device)
        self.online_net.load_state_dict(checkpoint['online_net_state'])
        self.target_net.load_state_dict(checkpoint['online_net_state'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state'])
        self.epsilon = checkpoint['epsilon']
        print(f"Loaded agent model weights from {filepath}")
