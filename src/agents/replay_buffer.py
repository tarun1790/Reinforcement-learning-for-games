import numpy as np
import random
import os

class ReplayBuffer:
    """
    Experience Replay Buffer for DQN agents.
    Provides memory efficient storage of environment transitions and supports
    saving/loading data sets to disk in compressed format.
    """
    def __init__(self, state_dim, action_dim, capacity=100000):
        self.capacity = capacity
        self.state_dim = state_dim
        
        # Preallocate memory buffers for performance
        self.states = np.zeros((capacity, state_dim), dtype=np.float32)
        self.next_states = np.zeros((capacity, state_dim), dtype=np.float32)
        self.actions = np.zeros(capacity, dtype=np.int64)
        self.rewards = np.zeros(capacity, dtype=np.float32)
        self.dones = np.zeros(capacity, dtype=np.float32)
        
        self.idx = 0
        self.size = 0

    def push(self, state, action, reward, next_state, done):
        """Add a transition to the buffer."""
        self.states[self.idx] = state
        self.actions[self.idx] = action
        self.rewards[self.idx] = reward
        self.next_states[self.idx] = next_state
        self.dones[self.idx] = float(done)
        
        self.idx = (self.idx + 1) % self.capacity
        self.size = min(self.size + 1, self.capacity)

    def sample(self, batch_size):
        """Randomly sample a batch of transitions."""
        indices = np.random.choice(self.size, batch_size, replace=False)
        return (
            self.states[indices],
            self.actions[indices],
            self.rewards[indices],
            self.next_states[indices],
            self.dones[indices]
        )

    def __len__(self):
        return self.size

    def save(self, filepath):
        """
        Saves the transition dataset to a compressed npz file on disk.
        Useful for offline RL, diagnostics, or sharing heavy datasets.
        """
        # Ensure directories exist
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Save only the filled portion of the buffer
        np.savez_compressed(
            filepath,
            states=self.states[:self.size],
            actions=self.actions[:self.size],
            rewards=self.rewards[:self.size],
            next_states=self.next_states[:self.size],
            dones=self.dones[:self.size],
            size=np.array([self.size])
        )
        print(f"Successfully saved replay buffer dataset ({self.size} transitions) to {filepath}")

    def load(self, filepath):
        """Loads a transition dataset from a compressed npz file."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"No replay buffer dataset found at {filepath}")
            
        with np.load(filepath) as data:
            loaded_size = int(data['size'][0])
            self.size = min(loaded_size, self.capacity)
            self.idx = self.size % self.capacity
            
            # Load into preallocated buffers
            self.states[:self.size] = data['states'][:self.size]
            self.actions[:self.size] = data['actions'][:self.size]
            self.rewards[:self.size] = data['rewards'][:self.size]
            self.next_states[:self.size] = data['next_states'][:self.size]
            self.dones[:self.size] = data['dones'][:self.size]
            
        print(f"Successfully loaded replay buffer dataset ({self.size} transitions) from {filepath}")
