import argparse
import os
import json
import time
import numpy as np
from train import train
from src.utils.plotting import plot_experiments_comparison

class ObjectView(object):
    """Simple class to convert dictionary to object attributes."""
    def __init__(self, d):
        self.__dict__ = d

def run_experiments(args):
    # Define 5 distinct training configurations
    configs = [
        # Snake experiments
        {
            "name": "Snake_Standard_DQN",
            "game": "snake",
            "dqn_type": "standard",
            "episodes": args.episodes,
            "lr": 1e-3,
            "gamma": 0.99,
            "batch_size": 64,
            "replay_capacity": 50000,
            "epsilon_decay": 0.985,
            "target_update": 200,
            "save_dir": "models",
            "dataset_dir": "datasets",
            "render": False
        },
        {
            "name": "Snake_Double_DQN",
            "game": "snake",
            "dqn_type": "double",
            "episodes": args.episodes,
            "lr": 1e-3,
            "gamma": 0.99,
            "batch_size": 64,
            "replay_capacity": 50000,
            "epsilon_decay": 0.985,
            "target_update": 200,
            "save_dir": "models",
            "dataset_dir": "datasets",
            "render": False
        },
        {
            "name": "Snake_Dueling_DQN",
            "game": "snake",
            "dqn_type": "dueling",
            "episodes": args.episodes,
            "lr": 1e-3,
            "gamma": 0.99,
            "batch_size": 64,
            "replay_capacity": 50000,
            "epsilon_decay": 0.985,
            "target_update": 200,
            "save_dir": "models",
            "dataset_dir": "datasets",
            "render": False
        },
        # CyberShooter experiments
        {
            "name": "CyberShooter_Double_DQN",
            "game": "cybershooter",
            "dqn_type": "double",
            "episodes": args.episodes,
            "lr": 1e-3,
            "gamma": 0.99,
            "batch_size": 64,
            "replay_capacity": 50000,
            "epsilon_decay": 0.990, 
            "target_update": 200,
            "save_dir": "models",
            "dataset_dir": "datasets",
            "render": False
        },
        {
            "name": "CyberShooter_Dueling_DQN",
            "game": "cybershooter",
            "dqn_type": "dueling",
            "episodes": args.episodes,
            "lr": 5e-4, 
            "gamma": 0.99,
            "batch_size": 64,
            "replay_capacity": 50000,
            "epsilon_decay": 0.990,
            "target_update": 200,
            "save_dir": "models",
            "dataset_dir": "datasets",
            "render": False
        }
    ]
    
    results = {}
    total_start_time = time.time()
    
    print("\n" + "#"*60)
    print("STARTING 5-EXPERIMENT SUITE FOR REINFORCEMENT LEARNING GAMES")
    print(f"Each configuration will run for {args.episodes} episodes.")
    print("#"*60 + "\n")
    
    for i, config in enumerate(configs, 1):
        print(f"\n--- Running Experiment {i}/5: {config['name']} ---")
        config_obj = ObjectView(config)
        
        start_time = time.time()
        res = train(config_obj)
        elapsed = time.time() - start_time
        
        results[config['name']] = {
            "game": config['game'],
            "dqn_type": config['dqn_type'],
            "episodes": config['episodes'],
            "lr": config['lr'],
            "gamma": config['gamma'],
            "reward": res['reward'],
            "score": res['score'],
            "loss": res['loss'],
            "final_model": res['final_model'],
            "dataset_path": res['dataset_path'],
            "dataset_size": res['dataset_size'],
            "dataset_bytes": res['dataset_bytes'],
            "training_time_sec": elapsed
        }
        
    total_elapsed = time.time() - total_start_time
    print("\n" + "#"*60)
    print("ALL 5 EXPERIMENTS COMPLETED!")
    print(f"Total time elapsed: {total_elapsed/60:.2f} minutes")
    print("#"*60 + "\n")
    
    # Save aggregated metadata to JSON (without full lists to keep it compact, but with summary metrics)
    summary_results = {}
    for name, data in results.items():
        summary_results[name] = {
            "game": data["game"],
            "dqn_type": data["dqn_type"],
            "episodes": data["episodes"],
            "lr": data["lr"],
            "gamma": data["gamma"],
            "avg_reward": float(np.mean(data["reward"])),
            "max_reward": float(np.max(data["reward"])),
            "avg_score": float(np.mean(data["score"])),
            "max_score": float(np.max(data["score"])),
            "final_model": data["final_model"],
            "dataset_path": data["dataset_path"],
            "dataset_size": data["dataset_size"],
            "dataset_bytes": data["dataset_bytes"],
            "training_time_sec": data["training_time_sec"]
        }
        
    # Write summary metadata
    with open("experiments_summary.json", "w") as f:
        json.dump(summary_results, f, indent=4)
        
    # Plot comparisons
    # 1. Compare Snake Agents (Standard vs Double vs Dueling)
    snake_results = {name: data for name, data in results.items() if data['game'] == 'snake'}
    if snake_results:
        plot_experiments_comparison(snake_results, metrics=["reward", "score"], save_path="models/snake_comparison.png")
        
    # 2. Compare CyberShooter Agents (Double vs Dueling)
    cybershooter_results = {name: data for name, data in results.items() if data['game'] == 'cybershooter'}
    if cybershooter_results:
        plot_experiments_comparison(cybershooter_results, metrics=["reward", "score"], save_path="models/cybershooter_comparison.png")
        
    # Save the full results including reward series to a JSON so generate_report.py can load it
    with open("experiments_detailed.json", "w") as f:
        json.dump(results, f)
        
    print("Aggregated experiment data saved to experiments_summary.json and experiments_detailed.json")
    print("Comparison plots saved to models/snake_comparison.png and models/cybershooter_comparison.png\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run 5 RL Experiments and Compare")
    parser.add_argument("--episodes", type=int, default=150, help="Number of episodes per training run (default: 150)")
    
    args = parser.parse_args()
    run_experiments(args)
