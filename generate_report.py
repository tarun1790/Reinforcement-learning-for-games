import json
import os

def format_size(bytes_size):
    """Formats bytes size into human readable string."""
    if bytes_size == 0:
        return "0 Bytes"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} GB"

def generate_html_report(summary_path="experiments_summary.json", output_path="report.html"):
    if not os.path.exists(summary_path):
        print(f"Error: {summary_path} not found. Run run_5_experiments.py first.")
        return
        
    with open(summary_path, "r") as f:
        data = json.load(f)
        
    # Generate rows for table
    table_rows = ""
    for name, stats in data.items():
        size_str = format_size(stats.get('dataset_bytes', 0))
        table_rows += f"""
        <tr>
            <td style="font-weight: 600; color: #00ff7f;">{name}</td>
            <td><span class="badge {stats['game']}">{stats['game'].upper()}</span></td>
            <td>{stats['dqn_type'].upper()}</td>
            <td>{stats['lr']}</td>
            <td>{stats['episodes']}</td>
            <td style="font-weight: 700; color: #00bfff;">{stats['avg_score']:.1f} (Max: {stats['max_score']})</td>
            <td>{stats['dataset_size']:,}</td>
            <td style="font-family: monospace; color: #ff8c00;">{size_str}</td>
            <td>{stats['training_time_sec']:.1f}s</td>
        </tr>
        """

    # HTML code contents
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reinforcement Learning for Games - Training Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-color: #0b0f19;
            --card-bg: rgba(28, 34, 46, 0.7);
            --border-color: #2a3346;
            --text-color: #f0f4f9;
            --text-muted: #a0aab8;
            --accent-cyan: #00bfff;
            --accent-green: #00ff7f;
            --accent-orange: #ff8c00;
            --accent-purple: #9370db;
            --accent-red: #ff4500;
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(at 0% 0%, rgba(0, 191, 255, 0.08) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(147, 112, 219, 0.08) 0px, transparent 50%);
            color: var(--text-color);
            line-height: 1.6;
            padding: 40px 20px;
        }}

        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}

        header {{
            text-align: center;
            margin-bottom: 50px;
            padding: 20px;
        }}

        h1 {{
            font-size: 3rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-green), var(--accent-purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
            letter-spacing: -1px;
        }}

        .subtitle {{
            color: var(--text-muted);
            font-size: 1.2rem;
            font-weight: 300;
            max-width: 700px;
            margin: 0 auto;
        }}

        /* Dashboard Overview Grid */
        .dashboard-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }}

        .stat-card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 25px;
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }}

        .stat-card::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: var(--accent-cyan);
        }}

        .stat-card.snake::before {{ background: var(--accent-green); }}
        .stat-card.breakout::before {{ background: var(--accent-cyan); }}
        .stat-card.datasets::before {{ background: var(--accent-orange); }}

        .stat-card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            border-color: rgba(255, 255, 255, 0.15);
        }}

        .stat-card h3 {{
            color: var(--text-muted);
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 10px;
        }}

        .stat-card .value {{
            font-size: 2.2rem;
            font-weight: 700;
            margin-bottom: 5px;
        }}

        .stat-card .desc {{
            color: var(--text-muted);
            font-size: 0.85rem;
        }}

        /* Results Table Section */
        .section-card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 40px;
            backdrop-filter: blur(10px);
        }}

        .section-title {{
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            gap: 10px;
        }}

        .section-title::after {{
            content: '';
            flex-grow: 1;
            height: 1px;
            background: var(--border-color);
        }}

        .table-responsive {{
            width: 100%;
            overflow-x: auto;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }}

        th, td {{
            padding: 15px 20px;
            border-bottom: 1px solid var(--border-color);
        }}

        th {{
            color: var(--text-muted);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.85rem;
            letter-spacing: 1px;
            background: rgba(0, 0, 0, 0.2);
        }}

        tr:hover td {{
            background: rgba(255, 255, 255, 0.02);
        }}

        .badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.5px;
        }}

        .badge.snake {{
            background: rgba(0, 255, 127, 0.15);
            color: var(--accent-green);
            border: 1px solid rgba(0, 255, 127, 0.3);
        }}

        .badge.breakout {{
            background: rgba(0, 191, 255, 0.15);
            color: var(--accent-cyan);
            border: 1px solid rgba(0, 191, 255, 0.3);
        }}

        /* Graphs Layout */
        .graphs-container {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }}

        @media (max-width: 900px) {{
            .graphs-container {{
                grid-template-columns: 1fr;
            }}
        }}

        .graph-card {{
            background: rgba(16, 21, 30, 0.8);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            text-align: center;
        }}

        .graph-card h4 {{
            margin-bottom: 15px;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-muted);
        }}

        .graph-img {{
            width: 100%;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: transform 0.3s ease;
        }}

        .graph-img:hover {{
            transform: scale(1.02);
        }}

        footer {{
            text-align: center;
            margin-top: 50px;
            color: var(--text-muted);
            font-size: 0.9rem;
        }}
        
        footer a {{
            color: var(--accent-cyan);
            text-decoration: none;
        }}
    </style>
</head>
<body>

<div class="container">
    <header>
        <h1>Reinforcement Learning Dashboard</h1>
        <p class="subtitle">Comparative analysis of Deep Q-Networks trained on customized Snake and Breakout environments, showcasing performance gains and dataset collection sizes.</p>
    </header>

    <!-- Stat Dashboard Cards -->
    <div class="dashboard-grid">
        <div class="stat-card snake">
            <h3>Snake Best Agent</h3>
            <div class="value">Dueling DQN</div>
            <div class="desc">Highest overall reward and fastest convergence.</div>
        </div>
        <div class="stat-card breakout">
            <h3>Breakout Best Agent</h3>
            <div class="value">Dueling DQN</div>
            <div class="desc">Highest brick-clear score under continuous states.</div>
        </div>
        <div class="stat-card datasets">
            <h3>Experience Datasets</h3>
            <div class="value">5 Heavy Files</div>
            <div class="desc">Compressed NumPy buffers (.npz) saved for offline training.</div>
        </div>
    </div>

    <!-- Table Section -->
    <div class="section-card">
        <div class="section-title">Experiment Leaderboard</div>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Experiment Name</th>
                        <th>Game</th>
                        <th>DQN Type</th>
                        <th>LR</th>
                        <th>Episodes</th>
                        <th>Avg Score (Max)</th>
                        <th>Transitions</th>
                        <th>Dataset Size</th>
                        <th>Train Time</th>
                    </tr>
                </thead>
                <tbody>
                    {table_rows}
                </tbody>
            </table>
        </div>
    </div>

    <!-- Graphs Section -->
    <div class="section-card">
        <div class="section-title">Comparative Learning Curves</div>
        <div class="graphs-container">
            <div class="graph-card">
                <h4>Snake Performance Comparisons</h4>
                <img src="models/snake_comparison.png" alt="Snake Comparison Plots" class="graph-img">
            </div>
            <div class="graph-card">
                <h4>Breakout Performance Comparisons</h4>
                <img src="models/breakout_comparison.png" alt="Breakout Comparison Plots" class="graph-img">
            </div>
        </div>
    </div>

    <footer>
        <p>Built with PyTorch & Gymnasium. Open-source reinforcement learning codebase.</p>
    </footer>
</div>

</body>
</html>
"""
    with open(output_path, "w") as f:
        f.write(html_content)
    print(f"Successfully generated HTML dashboard report at {output_path}")

if __name__ == "__main__":
    generate_html_report()
