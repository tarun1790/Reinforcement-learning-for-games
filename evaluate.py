import argparse
import os
import torch
import time
from src.games.snake import SnakeEnv
from src.games.breakout import BreakoutEnv
from src.agents.dqn import DQNAgent

def evaluate(args):
    # 1. Initialize Environment with human rendering
    if args.game == "snake":
        env = SnakeEnv(render_mode="human")
        # Adjust FPS for Snake to be watchable
        env.metadata["render_fps"] = args.fps if args.fps else 12
    elif args.game == "breakout":
        env = BreakoutEnv(render_mode="human")
        env.metadata["render_fps"] = args.fps if args.fps else 60
    else:
        raise ValueError(f"Unknown game: {args.game}")
        
    state_dim = env.observation_space.shape[0]
    action_dim = env.action_space.n
    
    print("\n" + "="*50)
    print(f"Evaluating Agent: {args.dqn_type.upper()}")
    print(f"Game: {args.game.upper()}")
    print(f"Model path: {args.model_path}")
    print(f"Episodes: {args.episodes}")
    print("="*50 + "\n")
    
    # 2. Initialize Agent and Load Weights
    use_dueling = (args.dqn_type == "dueling")
    use_double = (args.dqn_type in ["double", "dueling"])
    
    agent = DQNAgent(
        state_dim=state_dim,
        action_dim=action_dim,
        use_dueling=use_dueling,
        use_double=use_double,
        epsilon_start=0.0, # No exploration during evaluation
        epsilon_end=0.0
    )
    
    if not os.path.exists(args.model_path):
        raise FileNotFoundError(f"Model file not found at {args.model_path}")
        
    agent.load(args.model_path)
    
    # Put agent in evaluation mode
    agent.online_net.eval()
    
    # 3. Evaluation Loop
    scores = []
    
    for ep in range(1, args.episodes + 1):
        state, _ = env.reset()
        ep_reward = 0.0
        steps = 0
        
        while True:
            # Action selection (evaluation=True disables exploration)
            action = agent.select_action(state, evaluation=True)
            
            # Step environment
            next_state, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            
            state = next_state
            ep_reward += reward
            steps += 1
            
            if done:
                break
                
        score = info.get("score", 0)
        scores.append(score)
        print(f"Episode {ep:02d} | Score: {score:3d} | Steps: {steps:4d} | Reward: {ep_reward:6.2f}")
        time.sleep(0.5) # Short pause between episodes
        
    env.close()
    
    print("\n" + "="*50)
    print(f"Evaluation Complete!")
    print(f"Average Score: {sum(scores)/len(scores):.2f}")
    print(f"Max Score: {max(scores)}")
    print("="*50 + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate a Trained DQN Agent")
    parser.add_argument("--game", type=str, required=True, choices=["snake", "breakout"], help="Game to play")
    parser.add_argument("--dqn_type", type=str, required=True, choices=["standard", "double", "dueling"], help="DQN type")
    parser.add_argument("--model_path", type=str, required=True, help="Path to the model checkpoint (.pt)")
    parser.add_argument("--episodes", type=int, default=5, help="Number of evaluation episodes")
    parser.add_argument("--fps", type=int, default=None, help="Frame rate for visual display")
    
    args = parser.parse_args()
    evaluate(args)
