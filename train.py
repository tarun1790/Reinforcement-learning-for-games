import argparse
import os
import torch
import numpy as np
from src.games.snake import SnakeEnv
from src.games.cybershooter import CyberShooterEnv
from src.agents.dqn import DQNAgent
from src.agents.replay_buffer import ReplayBuffer
from src.utils.plotting import plot_training_results

def train(args):
    # Create save directories
    os.makedirs(args.save_dir, exist_ok=True)
    os.makedirs(args.dataset_dir, exist_ok=True)
    
    # 1. Initialize Environment
    render_mode = "human" if args.render else None
    if args.game == "snake":
        env = SnakeEnv(render_mode=render_mode)
    elif args.game == "cybershooter":
        env = CyberShooterEnv(render_mode=render_mode)
    else:
        raise ValueError(f"Unknown game: {args.game}")
        
    state_dim = env.observation_space.shape[0]
    action_dim = env.action_space.n
    
    print("\n" + "="*50)
    print(f"Training Agent: {args.dqn_type.upper()}")
    print(f"Game: {args.game.upper()}")
    print(f"State Dimension: {state_dim}")
    print(f"Action Dimension: {action_dim}")
    print(f"Total Episodes: {args.episodes}")
    print(f"Device: {'cuda' if torch.cuda.is_available() else 'cpu'}")
    print("="*50 + "\n")
    
    # 2. Initialize Agent & Replay Buffer
    use_dueling = (args.dqn_type == "dueling")
    use_double = (args.dqn_type in ["double", "dueling"]) # Dueling also typically uses Double DQN update
    
    agent = DQNAgent(
        state_dim=state_dim,
        action_dim=action_dim,
        lr=args.lr,
        gamma=args.gamma,
        epsilon_start=1.0,
        epsilon_end=0.01,
        epsilon_decay=args.epsilon_decay,
        target_update_frequency=args.target_update,
        use_dueling=use_dueling,
        use_double=use_double
    )
    
    replay_buffer = ReplayBuffer(
        state_dim=state_dim,
        action_dim=1, # Store action scalar
        capacity=args.replay_capacity
    )
    
    # 3. Training Loop
    episode_rewards = []
    episode_scores = []
    step_losses = []
    
    best_score = -9999
    
    for episode in range(1, args.episodes + 1):
        state, _ = env.reset()
        episode_reward = 0.0
        episode_loss = []
        
        while True:
            # Select action
            action = agent.select_action(state)
            
            # Step environment
            next_state, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            
            # Push transition
            replay_buffer.push(state, action, reward, next_state, done)
            
            # Train step
            loss = agent.train_step(replay_buffer, args.batch_size)
            if loss is not None:
                episode_loss.append(loss)
                step_losses.append(loss)
                
            state = next_state
            episode_reward += reward
            
            if done:
                break
                
        # Decay epsilon
        agent.decay_epsilon()
        
        # Log episode metrics
        score = info.get("score", 0)
        episode_rewards.append(episode_reward)
        episode_scores.append(score)
        
        avg_loss = np.mean(episode_loss) if episode_loss else 0.0
        
        # Print logs every few episodes
        if episode % 10 == 0 or episode == 1:
            print(f"Episode {episode:04d}/{args.episodes:04d} | "
                  f"Score: {score:3d} | "
                  f"Reward: {episode_reward:6.2f} | "
                  f"Avg Loss: {avg_loss:6.4f} | "
                  f"Epsilon: {agent.epsilon:.4f}")
            
        # Save best model
        if score > best_score:
            best_score = score
            best_model_path = os.path.join(args.save_dir, f"{args.game}_{args.dqn_type}_best.pt")
            agent.save(best_model_path)
            
    # Close environment
    env.close()
    
    # 4. Save Final Weights & Replay Buffer Transition Dataset (Heavy Dataset)
    final_model_path = os.path.join(args.save_dir, f"{args.game}_{args.dqn_type}_final.pt")
    agent.save(final_model_path)
    
    dataset_path = os.path.join(args.dataset_dir, f"{args.game}_{args.dqn_type}_replay_buffer.npz")
    replay_buffer.save(dataset_path)
    
    # 5. Plot training results
    plot_path = os.path.join(args.save_dir, f"{args.game}_{args.dqn_type}_training.png")
    plot_training_results(episode_rewards, step_losses, episode_scores, window=20, save_path=plot_path)
    
    print(f"\nTraining Complete for {args.game.upper()} ({args.dqn_type})!")
    print(f"Model saved to: {final_model_path}")
    print(f"Dataset saved to: {dataset_path}")
    print(f"Training plot saved to: {plot_path}\n")
    
    return {
        "reward": episode_rewards,
        "score": episode_scores,
        "loss": step_losses,
        "final_model": final_model_path,
        "dataset_path": dataset_path,
        "dataset_size": len(replay_buffer),
        "dataset_bytes": os.path.getsize(dataset_path) if os.path.exists(dataset_path) else 0
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train DQN Agents on Snake and CyberShooter")
    parser.add_argument("--game", type=str, default="snake", choices=["snake", "cybershooter"], help="Game to train on")
    parser.add_argument("--dqn_type", type=str, default="dueling", choices=["standard", "double", "dueling"], help="DQN Architecture type")
    parser.add_argument("--episodes", type=int, default=150, help="Number of training episodes")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--gamma", type=float, default=0.99, help="Discount factor")
    parser.add_argument("--batch_size", type=int, default=64, help="Minibatch size for training")
    parser.add_argument("--replay_capacity", type=int, default=50000, help="Capacity of the Replay Buffer")
    parser.add_argument("--epsilon_decay", type=float, default=0.985, help="Epsilon decay rate per episode")
    parser.add_argument("--target_update", type=int, default=200, help="Frequency of target network updates (in steps)")
    parser.add_argument("--save_dir", type=str, default="models", help="Directory to save model checkpoints")
    parser.add_argument("--dataset_dir", type=str, default="datasets", help="Directory to save transition datasets")
    parser.add_argument("--render", action="store_true", help="Render game screens during training (slows down training)")
    
    args = parser.parse_args()
    train(args)
