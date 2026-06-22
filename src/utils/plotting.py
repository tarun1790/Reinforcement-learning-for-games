import matplotlib.pyplot as plt
import numpy as np
import os

def apply_dark_theme():
    """Applies a beautiful, modern dark theme style to matplotlib plots."""
    plt.style.use('dark_background')
    plt.rcParams.update({
        'figure.facecolor': '#141821',   # Matches our dark UI
        'axes.facecolor': '#1c222e',
        'axes.edgecolor': '#2a3346',
        'axes.grid': True,
        'grid.color': '#2a3346',
        'grid.linestyle': '--',
        'grid.alpha': 0.5,
        'font.family': 'sans-serif',
        'text.color': '#f0f0f0',
        'axes.labelcolor': '#f0f0f0',
        'xtick.color': '#a0aab8',
        'ytick.color': '#a0aab8',
        'savefig.facecolor': '#141821',
        'savefig.edgecolor': '#141821'
    })

def moving_average(data, window=10):
    """Calculates moving average of data."""
    if len(data) < window:
        return data
    pad = np.pad(data, (window-1, 0), mode='edge')
    return np.convolve(pad, np.ones(window)/window, mode='valid')

def plot_training_results(rewards, losses, scores, window=20, save_path="training_plots.png"):
    """
    Plots training metrics side-by-side in a beautiful layout.
    """
    apply_dark_theme()
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    
    # 1. Rewards Plot
    axes[0].plot(rewards, color='#00bfff', alpha=0.3, label="Raw Episode Reward")
    if len(rewards) >= window:
        axes[0].plot(moving_average(rewards, window), color='#00ff7f', linewidth=2, label=f"MA-{window}")
    axes[0].set_title("Rewards over Episodes", fontsize=12, fontweight='bold', pad=10)
    axes[0].set_xlabel("Episode")
    axes[0].set_ylabel("Total Reward")
    axes[0].legend(loc="lower right", facecolor="#141821")
    
    # 2. Scores Plot
    axes[1].plot(scores, color='#ff00ff', alpha=0.3, label="Game Score")
    if len(scores) >= window:
        axes[1].plot(moving_average(scores, window), color='#ff8c00', linewidth=2, label=f"MA-{window}")
    axes[1].set_title("Scores over Episodes", fontsize=12, fontweight='bold', pad=10)
    axes[1].set_xlabel("Episode")
    axes[1].set_ylabel("Score")
    axes[1].legend(loc="lower right", facecolor="#141821")
    
    # 3. Loss Plot
    valid_losses = [l for l in losses if l is not None]
    if valid_losses:
        axes[2].plot(valid_losses, color='#ff4500', alpha=0.6)
        axes[2].set_title("Loss over Steps", fontsize=12, fontweight='bold', pad=10)
        axes[2].set_xlabel("Training Step")
        axes[2].set_ylabel("Loss")
        
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print(f"Saved training dashboard plot to {save_path}")

def plot_experiments_comparison(results_dict, metrics=["reward", "score"], save_path="comparison_plots.png"):
    """
    Compare multiple experiments on the same plot.
    results_dict: { 'Experiment_Name': { 'reward': [...], 'score': [...], 'loss': [...] } }
    """
    apply_dark_theme()
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    fig, axes = plt.subplots(1, len(metrics), figsize=(8 * len(metrics), 6))
    if len(metrics) == 1:
        axes = [axes]
        
    colors = ['#00bfff', '#00ff7f', '#ff8c00', '#ff00ff', '#ff4500', '#9370db', '#00ffff']
    
    for m_idx, metric in enumerate(metrics):
        for idx, (exp_name, data) in enumerate(results_dict.items()):
            metric_data = data.get(metric, [])
            if not metric_data:
                continue
            
            # Use moving average to clean up comparisons
            ma_data = moving_average(metric_data, window=min(30, max(5, len(metric_data)//10)))
            color = colors[idx % len(colors)]
            axes[m_idx].plot(ma_data, color=color, linewidth=2.5, label=exp_name)
            
        axes[m_idx].set_title(f"Comparison: {metric.capitalize()} (Moving Average)", fontsize=13, fontweight='bold', pad=10)
        axes[m_idx].set_xlabel("Episode")
        axes[m_idx].set_ylabel(metric.capitalize())
        axes[m_idx].legend(loc="upper left", facecolor="#141821")
        
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print(f"Saved comparison plot to {save_path}")
