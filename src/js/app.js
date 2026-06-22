document.addEventListener('DOMContentLoaded', () => {
    // Canvas setup
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // UI Elements - Controls
    const gameSelectTabs = document.querySelectorAll('.btn-tab');
    const startBtn = document.getElementById('btn-start');
    const pauseBtn = document.getElementById('btn-pause');
    const resetBtn = document.getElementById('btn-reset');
    const manualBtn = document.getElementById('btn-manual');
    const exportBtn = document.getElementById('btn-export');
    
    // UI Sliders
    const speedSlider = document.getElementById('slider-speed');
    const lrSlider = document.getElementById('slider-lr');
    const gammaSlider = document.getElementById('slider-gamma');
    const decaySlider = document.getElementById('slider-decay');
    const batchSlider = document.getElementById('slider-batch');
    
    // Slider values
    const speedVal = document.getElementById('val-speed');
    const lrVal = document.getElementById('val-lr');
    const gammaVal = document.getElementById('val-gamma');
    const decayVal = document.getElementById('val-decay');
    const batchVal = document.getElementById('val-batch');
    
    // Stats elements
    const statEpisode = document.getElementById('stat-episode');
    const statScore = document.getElementById('stat-score');
    const statMaxScore = document.getElementById('stat-max-score');
    const statEpsilon = document.getElementById('stat-epsilon');
    const statLoss = document.getElementById('stat-loss');
    const statBuffer = document.getElementById('stat-buffer');
    const logConsole = document.getElementById('log-console');
    const canvasWrapper = document.getElementById('canvas-wrapper');

    // Chart Canvas Elements
    const chartScoreCtx = document.getElementById('chart-score').getContext('2d');
    const chartLossCtx = document.getElementById('chart-loss').getContext('2d');

    // Simulation states
    let activeGameName = 'snake'; // 'snake' or 'breakout'
    let game = null;
    let agent = null;
    let replayBuffer = null;
    
    let isTraining = false;
    let isManualPlay = false;
    
    let episodeCount = 0;
    let maxScore = 0;
    let currentState = null;
    
    let episodeLosses = [];
    let episodeScoreHistory = [];
    let episodeLossHistory = [];
    
    // Manual play state
    let manualAction = 0; // default Stay / Straight
    
    // Chart instances
    let chartScore = null;
    let chartLoss = null;

    // Initialize environment & agent
    function initApp() {
        if (agent) {
            agent.dispose();
        }
        
        // 1. Setup Game
        if (activeGameName === 'snake') {
            game = new SnakeGame(400, 400, 20);
            canvasWrapper.className = 'canvas-wrapper snake-active';
        } else {
            game = new CyberShooterGame(400, 400);
            canvasWrapper.className = 'canvas-wrapper breakout-active'; // keeps cyan style
        }
        
        // 2. Setup Replay Buffer
        replayBuffer = new ReplayBuffer(25000);
        
        // 3. Setup Agent
        const lr = parseFloat(lrSlider.value);
        const gamma = parseFloat(gammaSlider.value);
        const decay = parseFloat(decaySlider.value);
        
        agent = new BrowserDQNAgent(game.observationSize, game.actionSpaceSize, {
            lr: lr,
            gamma: gamma,
            epsilonDecay: decay,
            targetUpdateFrequency: 200,
            useDouble: true
        });
        
        // 4. Reset stats
        episodeCount = 0;
        maxScore = 0;
        episodeScoreHistory = [];
        episodeLossHistory = [];
        currentState = game.reset();
        
        statEpisode.innerText = '0';
        statScore.innerText = '0';
        statMaxScore.innerText = '0';
        statEpsilon.innerText = agent.epsilon.toFixed(2);
        statLoss.innerText = '0.000';
        statBuffer.innerText = '0';
        
        // Clear log
        logConsole.innerHTML = '<div>System Initialized. Click "Start Training" to begin.</div>';
        
        // 5. Draw initial frame
        game.draw(ctx);
        
        // 6. Setup charts
        initCharts();
    }

    // Chart.js Configuration Helper
    function initCharts() {
        if (chartScore) chartScore.destroy();
        if (chartLoss) chartLoss.destroy();
        
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#8895a5', font: { family: 'Outfit' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#8895a5', font: { family: 'Outfit' } }
                }
            }
        };

        chartScore = new Chart(chartScoreCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Episode Score',
                    data: [],
                    borderColor: activeGameName === 'snake' ? '#00ff7f' : '#00bfff',
                    backgroundColor: 'rgba(0,0,0,0)',
                    borderWidth: 2,
                    tension: 0.2
                }]
            },
            options: chartOptions
        });

        chartLoss = new Chart(chartLossCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Average Loss',
                    data: [],
                    borderColor: '#ff4500',
                    backgroundColor: 'rgba(0,0,0,0)',
                    borderWidth: 2,
                    tension: 0.2
                }]
            },
            options: chartOptions
        });
    }

    // Log message to UI console
    function logMsg(msg) {
        const div = document.createElement('div');
        div.innerText = msg;
        logConsole.appendChild(div);
        logConsole.scrollTop = logConsole.scrollHeight;
    }

    // SLIDER VALUE UPDATERS
    speedSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        speedVal.innerText = val === '6' ? 'Headless' : `${val}x`;
    });
    
    lrSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        lrVal.innerText = val.toFixed(4);
        if (agent) agent.lr = val;
    });
    
    gammaSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        gammaVal.innerText = val.toFixed(2);
        if (agent) agent.gamma = val;
    });
    
    decaySlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        decayVal.innerText = val.toFixed(4);
        if (agent) agent.epsilonDecay = val;
    });
    
    batchSlider.addEventListener('input', (e) => {
        batchVal.innerText = e.target.value;
    });

    // GAME SELECT TABS
    gameSelectTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (isTraining || isManualPlay) {
                alert('Please stop the current training or manual play session first.');
                return;
            }
            
            gameSelectTabs.forEach(t => t.classList.remove('active', 'snake-theme'));
            
            activeGameName = tab.getAttribute('data-game');
            if (activeGameName === 'snake') {
                tab.classList.add('active', 'snake-theme');
            } else {
                tab.classList.add('active');
            }
            
            initApp();
        });
    });

    // SIMULATION TRAINING LOOP
    function trainLoop() {
        if (!isTraining) return;
        
        const speed = parseInt(speedSlider.value);
        const batchSize = parseInt(batchSlider.value);
        
        // Headless mode runs multiple training steps without drawing
        if (speed === 6) {
            // Fast loop: execute 25 updates per frame
            for (let step = 0; step < 25; step++) {
                executeStep(batchSize);
            }
            game.draw(ctx);
        } else {
            // Regular speed runs game steps and draws on frame
            for (let step = 0; step < speed; step++) {
                executeStep(batchSize);
            }
            game.draw(ctx);
        }
        
        requestAnimationFrame(trainLoop);
    }

    function executeStep(batchSize) {
        // 1. Choose action
        const mode = document.getElementById('select-agent-mode').value;
        let action;
        if (mode === 'expert') {
            action = game.getExpertAction();
        } else {
            action = agent.selectAction(currentState);
        }
        
        // 2. Step game
        const { observation, reward, done, score } = game.step(action);
        
        // 3. Save transition
        replayBuffer.push(currentState, action, reward, observation, done);
        
        // 4. Train network weights
        const loss = agent.trainStep(replayBuffer, batchSize);
        if (loss !== null) {
            episodeLosses.push(loss);
        }
        
        currentState = observation;
        
        // Update stats
        statBuffer.innerText = replayBuffer.length;
        
        if (done) {
            episodeCount++;
            
            // Calculate average loss
            const avgLoss = episodeLosses.length > 0 ? 
                (episodeLosses.reduce((a, b) => a + b, 0) / episodeLosses.length) : 0.0;
                
            episodeLosses = [];
            
            // Track max score
            if (score > maxScore) {
                maxScore = score;
                statMaxScore.innerText = maxScore;
            }
            
            // Epsilon decay
            agent.decayEpsilon();
            
            // Update stats panel
            statEpisode.innerText = episodeCount;
            statScore.innerText = score;
            statEpsilon.innerText = agent.epsilon.toFixed(2);
            statLoss.innerText = avgLoss.toFixed(4);
            
            // Log to console
            logMsg(`Ep ${String(episodeCount).padStart(3, '0')} | Score: ${score} | Avg Loss: ${avgLoss.toFixed(4)} | Epsilon: ${agent.epsilon.toFixed(2)}`);
            
            // Update Chart datasets
            episodeScoreHistory.push(score);
            episodeLossHistory.push(avgLoss);
            
            updateCharts();
            
            // Reset game environment
            currentState = game.reset();
        }
    }

    function updateCharts() {
        // Keep chart data compact (max 50 points displayed)
        const displayLimit = 50;
        
        let labels = Array.from({length: episodeCount}, (_, i) => i + 1);
        let scoreData = [...episodeScoreHistory];
        let lossData = [...episodeLossHistory];
        
        if (episodeCount > displayLimit) {
            labels = labels.slice(-displayLimit);
            scoreData = scoreData.slice(-displayLimit);
            lossData = lossData.slice(-displayLimit);
        }
        
        chartScore.data.labels = labels;
        chartScore.data.datasets[0].data = scoreData;
        chartScore.update('none'); // Update without animation for speed

        chartLoss.data.labels = labels;
        chartLoss.data.datasets[0].data = lossData;
        chartLoss.update('none');
    }

    // BUTTON EVENT HANDLERS
    startBtn.addEventListener('click', () => {
        if (isManualPlay) {
            stopManualPlay();
        }
        
        isTraining = true;
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-flex';
        logMsg('Training started.');
        trainLoop();
    });

    pauseBtn.addEventListener('click', () => {
        isTraining = false;
        pauseBtn.style.display = 'none';
        startBtn.style.display = 'inline-flex';
        logMsg('Training paused.');
    });

    resetBtn.addEventListener('click', () => {
        const confirmReset = confirm('Are you sure you want to reset all weights, datasets, and history?');
        if (!confirmReset) return;
        
        isTraining = false;
        isManualPlay = false;
        pauseBtn.style.display = 'none';
        startBtn.style.display = 'inline-flex';
        manualBtn.classList.remove('btn-primary');
        manualBtn.classList.add('btn-outline');
        manualBtn.innerText = 'Play Manually';
        
        initApp();
        logMsg('Workspace fully reset.');
    });

    exportBtn.addEventListener('click', () => {
        if (replayBuffer.length === 0) {
            alert('Replay buffer is empty. Train or play to gather experiences first!');
            return;
        }
        replayBuffer.exportJSON(activeGameName);
    });

    // MANUAL PLAY LOGIC
    manualBtn.addEventListener('click', () => {
        if (isTraining) {
            isTraining = false;
            pauseBtn.style.display = 'none';
            startBtn.style.display = 'inline-flex';
        }
        
        if (isManualPlay) {
            stopManualPlay();
        } else {
            startManualPlay();
        }
    });

    function startManualPlay() {
        isManualPlay = true;
        manualBtn.classList.remove('btn-outline');
        manualBtn.classList.add('btn-primary');
        manualBtn.innerText = 'Stop Playing';
        logMsg('Manual Play Mode Active. Use arrow keys to control the game.');
        
        currentState = game.reset();
        manualAction = 0; // reset
        
        // Start keyboard listeners
        window.addEventListener('keydown', handleKeyPress);
        manualLoop();
    }

    function stopManualPlay() {
        isManualPlay = false;
        manualBtn.classList.remove('btn-primary');
        manualBtn.classList.add('btn-outline');
        manualBtn.innerText = 'Play Manually';
        logMsg('Manual Play Mode disabled.');
        
        // Remove keyboard listeners
        window.removeEventListener('keydown', handleKeyPress);
        initApp();
    }

    function handleKeyPress(e) {
        if (activeGameName === 'snake') {
            // Snake uses relative actions: 0 = straight, 1 = right, 2 = left
            // Standard direction indexes: 0: Up, 1: Right, 2: Down, 3: Left
            const curDirIdx = game.directionIdx;
            
            if (e.key === 'ArrowLeft') {
                // To turn left relative to current: action = 2
                // e.g. if moving Right (1), turning left is Up (0) -> (1-1) = 0
                manualAction = 2;
            } else if (e.key === 'ArrowRight') {
                // To turn right relative to current: action = 1
                manualAction = 1;
            } else {
                manualAction = 0; // go straight
            }
        } else {
            // CyberShooter: 0 = stay, 1 = move forward, 2 = turn left, 3 = turn right, 4 = shoot
            if (e.key === 'ArrowUp' || e.key === 'w') {
                manualAction = 1;
            } else if (e.key === 'ArrowLeft' || e.key === 'a') {
                manualAction = 2;
            } else if (e.key === 'ArrowRight' || e.key === 'd') {
                manualAction = 3;
            } else if (e.key === ' ' || e.key === 'Spacebar') {
                manualAction = 4;
            } else {
                manualAction = 0;
            }
        }
    }

    function manualLoop() {
        if (!isManualPlay) return;
        
        // 1. Take manual action
        const { observation, reward, done, score } = game.step(manualAction);
        
        // Store user transition in replay buffer so the agent can learn from it!
        replayBuffer.push(currentState, manualAction, reward, observation, done);
        statBuffer.innerText = replayBuffer.length;
        
        // Reset key press back to straight/stay so paddle stops moving or snake keeps moving straight
        if (activeGameName === 'snake') {
            manualAction = 0; 
        } else {
            // Breakout requires holding down keys, check if key is up or stay
            manualAction = 0;
        }
        
        currentState = observation;
        game.draw(ctx);
        
        if (done) {
            logMsg(`Manual Game Over! Score achieved: ${score}`);
            if (score > maxScore) {
                maxScore = score;
                statMaxScore.innerText = maxScore;
            }
            currentState = game.reset();
        }
        
        // Run loop at standard game speed
        setTimeout(manualLoop, 1000 / 30); // 30 FPS for snake/breakout play speed
    }

    // Launch initial application setup
    initApp();
});
