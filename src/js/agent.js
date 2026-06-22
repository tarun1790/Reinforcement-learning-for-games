// -------------------------------------------------------------
// EXPERIENCE REPLAY BUFFER (JavaScript version)
// -------------------------------------------------------------
class ReplayBuffer {
    constructor(capacity = 20000) {
        this.capacity = capacity;
        this.buffer = [];
        this.idx = 0;
    }

    push(state, action, reward, nextState, done) {
        const transition = {
            state: Array.from(state),
            action: action,
            reward: reward,
            nextState: Array.from(nextState),
            done: done ? 1.0 : 0.0
        };
        
        if (this.buffer.length < this.capacity) {
            this.buffer.push(transition);
        } else {
            this.buffer[this.idx] = transition;
            this.idx = (this.idx + 1) % this.capacity;
        }
    }

    sample(batchSize) {
        const states = [];
        const nextStates = [];
        const actions = [];
        const rewards = [];
        const dones = [];
        
        for (let i = 0; i < batchSize; i++) {
            const randomIdx = Math.floor(Math.random() * this.buffer.length);
            const t = this.buffer[randomIdx];
            states.push(t.state);
            nextStates.push(t.nextState);
            actions.push(t.action);
            rewards.push(t.reward);
            dones.push(t.done);
        }
        
        return { states, nextStates, actions, rewards, dones };
    }

    get length() {
        return this.buffer.length;
    }

    clear() {
        this.buffer = [];
        this.idx = 0;
    }

    // Export dataset as downloadable JSON file
    exportJSON(gameName) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.buffer));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${gameName}_replay_dataset_${this.buffer.length}_transitions.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        console.log(`Exported ${this.buffer.length} transitions to JSON.`);
    }
}

// -------------------------------------------------------------
// TENSORFLOW.JS DQN AGENT
// -------------------------------------------------------------
class BrowserDQNAgent {
    constructor(stateDim, actionDim, options = {}) {
        this.stateDim = stateDim;
        this.actionDim = actionDim;
        
        // Hyperparameters
        this.lr = options.lr || 0.001;
        this.gamma = options.gamma || 0.99;
        this.epsilon = options.epsilonStart || 1.0;
        this.epsilonEnd = options.epsilonEnd || 0.02;
        this.epsilonDecay = options.epsilonDecay || 0.995;
        this.targetUpdateFrequency = options.targetUpdateFrequency || 200;
        this.useDouble = options.useDouble !== undefined ? options.useDouble : true;
        
        this.updateCount = 0;
        
        // Build Neural Networks
        this.onlineNet = this.buildNetwork(stateDim, actionDim);
        this.targetNet = this.buildNetwork(stateDim, actionDim);
        this.updateTargetNetwork();
        
        // Adam Optimizer
        this.optimizer = tf.train.adam(this.lr);
    }

    buildNetwork(stateDim, actionDim) {
        // Construct Sequential Model
        const model = tf.sequential();
        model.add(tf.layers.dense({
            units: 64,
            activation: 'relu',
            inputShape: [stateDim],
            kernelInitializer: 'varianceScaling'
        }));
        model.add(tf.layers.dense({
            units: 64,
            activation: 'relu',
            kernelInitializer: 'varianceScaling'
        }));
        model.add(tf.layers.dense({
            units: actionDim,
            activation: 'linear',
            kernelInitializer: 'varianceScaling'
        }));
        return model;
    }

    updateTargetNetwork() {
        // Copy weights from online network to target network
        tf.tidy(() => {
            const weights = this.onlineNet.getWeights();
            const clonedWeights = weights.map(w => w.clone());
            this.targetNet.setWeights(clonedWeights);
        });
    }

    selectAction(state, evaluation = false) {
        if (!evaluation && Math.random() < this.epsilon) {
            // Explore
            return Math.floor(Math.random() * this.actionDim);
        }
        
        // Exploit
        return tf.tidy(() => {
            const stateTensor = tf.tensor2d([state]);
            const qValues = this.onlineNet.predict(stateTensor);
            return qValues.argMax(1).dataSync()[0];
        });
    }

    decayEpsilon() {
        this.epsilon = Math.max(this.epsilonEnd, this.epsilon * this.epsilonDecay);
    }

    trainStep(replayBuffer, batchSize) {
        if (replayBuffer.length < batchSize) return null;
        
        // sample transitions
        const batch = replayBuffer.sample(batchSize);
        
        // Wrap variables in tensors
        const statesTensor = tf.tensor2d(batch.states);
        const nextStatesTensor = tf.tensor2d(batch.nextStates);
        const actionsTensor = tf.tensor1d(batch.actions, 'int32');
        const rewardsTensor = tf.tensor1d(batch.rewards);
        const donesTensor = tf.tensor1d(batch.dones);
        
        // Compute Bellman targets inside tf.tidy to prevent memory leaks
        const targetsTensor = tf.tidy(() => {
            let nextQ;
            if (this.useDouble) {
                // Double DQN: online net selects action, target net evaluates action Q-value
                const onlineNextQ = this.onlineNet.predict(nextStatesTensor);
                const bestActions = onlineNextQ.argMax(1);
                const targetNextQ = this.targetNet.predict(nextStatesTensor);
                const oneHot = tf.oneHot(bestActions, this.actionDim);
                nextQ = tf.sum(tf.mul(targetNextQ, oneHot), 1);
            } else {
                // Standard DQN: max of target net Q-values
                const targetNextQ = this.targetNet.predict(nextStatesTensor);
                nextQ = targetNextQ.max(1);
            }
            
            // target = reward + (1 - done) * gamma * maxQ
            return tf.add(rewardsTensor, tf.mul(tf.sub(1, donesTensor), tf.mul(this.gamma, nextQ)));
        });
        
        let lossVal = null;
        
        // Minimize mean squared error of predicted Q vs target Q
        const cost = this.optimizer.minimize(() => {
            const currentQ = this.onlineNet.predict(statesTensor);
            const oneHotActions = tf.oneHot(actionsTensor, this.actionDim);
            const currentQSelected = tf.sum(tf.mul(currentQ, oneHotActions), 1);
            
            const loss = tf.losses.meanSquaredError(targetsTensor, currentQSelected);
            lossVal = loss.dataSync()[0];
            return loss;
        }, true);
        
        // Dispose tensors to clear WebGL GPU memory immediately
        statesTensor.dispose();
        nextStatesTensor.dispose();
        actionsTensor.dispose();
        rewardsTensor.dispose();
        donesTensor.dispose();
        targetsTensor.dispose();
        if (cost) cost.dispose();
        
        this.updateCount++;
        if (this.updateCount % this.targetUpdateFrequency === 0) {
            this.updateTargetNetwork();
        }
        
        return lossVal;
    }

    dispose() {
        // Wipe model parameters
        this.onlineNet.dispose();
        this.targetNet.dispose();
    }
}

// Export models to window object for web access
window.ReplayBuffer = ReplayBuffer;
window.BrowserDQNAgent = BrowserDQNAgent;
