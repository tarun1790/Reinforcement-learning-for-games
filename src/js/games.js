// Neon Particle Class for physics explosion effects
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 4 + 1.5;
        
        // Random velocity vector
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        // Add gravity effect for breakout brick debris
        this.gravity = 0.15;
        this.alpha = 1.0;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    update(applyGravity = false) {
        this.x += this.vx;
        this.y += this.vy;
        if (applyGravity) {
            this.vy += this.gravity;
        }
        this.alpha -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// -------------------------------------------------------------
// SNAKE GAME ENVIRONMENT
// -------------------------------------------------------------
class SnakeGame {
    constructor(width = 400, height = 400, gridCount = 20) {
        this.width = width;
        this.height = height;
        this.gridCount = gridCount;
        this.cellSize = width / gridCount;
        
        this.actionSpaceSize = 3; 
        this.observationSize = 11;
        
        this.particles = [];
        this.screenShake = 0;
        
        this.DIRECTIONS = [
            [0, -1], // 0: Up
            [1, 0],  // 1: Right
            [0, 1],  // 2: Down
            [-1, 0]  // 3: Left
        ];
        
        this.pulseTime = 0;
    }

    reset() {
        this.directionIdx = 1; // Right
        this.direction = this.DIRECTIONS[this.directionIdx];
        
        const startX = Math.floor(this.gridCount / 2);
        const startY = Math.floor(this.gridCount / 2);
        
        this.snake = [
            [startX, startY],
            [startX - 1, startY],
            [startX - 2, startY]
        ];
        
        this.score = 0;
        this.steps = 0;
        this.particles = [];
        this.screenShake = 0;
        this.placeFood();
        this.pulseTime = 0;
        
        return this.getObservation();
    }

    placeFood() {
        while (true) {
            this.food = [
                Math.floor(Math.random() * this.gridCount),
                Math.floor(Math.random() * this.gridCount)
            ];
            let onBody = false;
            for (let segment of this.snake) {
                if (segment[0] === this.food[0] && segment[1] === this.food[1]) {
                    onBody = true;
                    break;
                }
            }
            if (!onBody) break;
        }
    }

    step(action) {
        this.steps++;
        
        // 0: straight, 1: turn right, 2: turn left
        if (action === 1) {
            this.directionIdx = (this.directionIdx + 1) % 4;
        } else if (action === 2) {
            this.directionIdx = (this.directionIdx - 1 + 4) % 4;
        }
        this.direction = this.DIRECTIONS[this.directionIdx];
        
        const head = this.snake[0];
        const newHead = [
            head[0] + this.direction[0],
            head[1] + this.direction[1]
        ];
        
        const collision = this.checkCollision(newHead);
        const limitReached = this.steps > 250 * this.snake.length;
        
        let reward = 0.0;
        let done = false;
        
        if (collision || limitReached) {
            reward = -10.0;
            done = true;
            this.screenShake = 20;
            this.spawnExplosion(head[0] * this.cellSize + this.cellSize/2, head[1] * this.cellSize + this.cellSize/2, '#ff3300', 30);
            return { observation: this.getObservation(), reward, done, score: this.score };
        }
        
        this.snake.unshift(newHead);
        
        if (newHead[0] === this.food[0] && newHead[1] === this.food[1]) {
            this.score++;
            reward = 10.0;
            this.placeFood();
            this.spawnExplosion(newHead[0] * this.cellSize + this.cellSize/2, newHead[1] * this.cellSize + this.cellSize/2, '#00ff7f', 25);
            this.screenShake = 8;
        } else {
            const oldDist = Math.hypot(this.snake[1][0] - this.food[0], this.snake[1][1] - this.food[1]);
            const newDist = Math.hypot(newHead[0] - this.food[0], newHead[1] - this.food[1]);
            reward = newDist < oldDist ? 0.2 : -0.25;
            
            this.snake.pop();
        }
        
        return { observation: this.getObservation(), reward, done, score: this.score };
    }

    checkCollision(pt) {
        if (pt[0] < 0 || pt[0] >= this.gridCount || pt[1] < 0 || pt[1] >= this.gridCount) {
            return true;
        }
        for (let i = 0; i < this.snake.length - 1; i++) {
            const segment = this.snake[i];
            if (pt[0] === segment[0] && pt[1] === segment[1]) {
                return true;
            }
        }
        return false;
    }

    getObservation() {
        const head = this.snake[0];
        const dirStraight = this.direction;
        const dirRight = this.DIRECTIONS[(this.directionIdx + 1) % 4];
        const dirLeft = this.DIRECTIONS[(this.directionIdx - 1 + 4) % 4];
        
        const dangerStraight = this.checkCollision([head[0] + dirStraight[0], head[1] + dirStraight[1]]) ? 1.0 : 0.0;
        const dangerRight = this.checkCollision([head[0] + dirRight[0], head[1] + dirRight[1]]) ? 1.0 : 0.0;
        const dangerLeft = this.checkCollision([head[0] + dirLeft[0], head[1] + dirLeft[1]]) ? 1.0 : 0.0;
        
        const dirUp = this.direction[0] === 0 && this.direction[1] === -1 ? 1.0 : 0.0;
        const dirDown = this.direction[0] === 0 && this.direction[1] === 1 ? 1.0 : 0.0;
        const dirLeftDir = this.direction[0] === -1 && this.direction[1] === 0 ? 1.0 : 0.0;
        const dirRightDir = this.direction[0] === 1 && this.direction[1] === 0 ? 1.0 : 0.0;
        
        const foodUp = this.food[1] < head[1] ? 1.0 : 0.0;
        const foodDown = this.food[1] > head[1] ? 1.0 : 0.0;
        const foodLeft = this.food[0] < head[0] ? 1.0 : 0.0;
        const foodRight = this.food[0] > head[0] ? 1.0 : 0.0;
        
        return [
            dangerStraight, dangerRight, dangerLeft,
            dirUp, dirDown, dirLeftDir, dirRightDir,
            foodUp, foodDown, foodLeft, foodRight
        ];
    }

    // Safety-first BFS Pathfinding AI for Snake Expert Mode
    getExpertAction() {
        const head = this.snake[0];
        
        // Find shortest path using Breadth-First Search (BFS)
        const queue = [[head, []]];
        const visited = new Set();
        visited.add(`${head[0]},${head[1]}`);
        
        let path = null;
        
        while (queue.length > 0) {
            const [curr, moves] = queue.shift();
            
            if (curr[0] === this.food[0] && curr[1] === this.food[1]) {
                path = moves;
                break;
            }
            
            for (let i = 0; i < 4; i++) {
                const nextPt = [curr[0] + this.DIRECTIONS[i][0], curr[1] + this.DIRECTIONS[i][1]];
                const key = `${nextPt[0]},${nextPt[1]}`;
                
                if (!visited.has(key) && !this.checkCollision(nextPt)) {
                    visited.add(key);
                    queue.push([nextPt, [...moves, i]]);
                }
            }
        }
        
        let nextDirIdx = -1;
        
        if (path && path.length > 0) {
            nextDirIdx = path[0];
        } else {
            // No direct path found: find safest available step (survivability search)
            let maxSafetyScore = -9999;
            for (let i = 0; i < 4; i++) {
                const nextPt = [head[0] + this.DIRECTIONS[i][0], head[1] + this.DIRECTIONS[i][1]];
                if (!this.checkCollision(nextPt)) {
                    // Count how many free neighbors this step has
                    let freeNeighbors = 0;
                    for (let j = 0; j < 4; j++) {
                        const neighbor = [nextPt[0] + this.DIRECTIONS[j][0], nextPt[1] + this.DIRECTIONS[j][1]];
                        if (!this.checkCollision(neighbor)) freeNeighbors++;
                    }
                    if (freeNeighbors > maxSafetyScore) {
                        maxSafetyScore = freeNeighbors;
                        nextDirIdx = i;
                    }
                }
            }
        }
        
        if (nextDirIdx === -1) return 0; // default straight if doomed
        
        // Convert target absolute dir index to relative action
        // 0: straight, 1: turn right, 2: turn left
        if (nextDirIdx === this.directionIdx) return 0;
        if (nextDirIdx === (this.directionIdx + 1) % 4) return 1;
        if (nextDirIdx === (this.directionIdx - 1 + 4) % 4) return 2;
        
        return 1; // backup turn right
    }

    spawnExplosion(x, y, color, count = 15) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    draw(ctx) {
        this.pulseTime += 0.05;
        ctx.save();
        
        // Screen Shake
        if (this.screenShake > 0) {
            const dx = (Math.random() - 0.5) * this.screenShake;
            const dy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(dx, dy);
            this.screenShake *= 0.88;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        // Draw Board Background
        ctx.fillStyle = '#0f131c';
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Pulsing Neon Grid
        const gridOpacity = 0.06 + Math.sin(this.pulseTime) * 0.02;
        ctx.strokeStyle = `rgba(0, 255, 127, ${gridOpacity})`;
        ctx.lineWidth = 1;
        for (let i = 0; i <= this.gridCount; i++) {
            ctx.beginPath();
            ctx.moveTo(i * this.cellSize, 0);
            ctx.lineTo(i * this.cellSize, this.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * this.cellSize);
            ctx.lineTo(this.width, i * this.cellSize);
            ctx.stroke();
        }

        // Update and Draw Particles
        this.particles.forEach((p, idx) => {
            p.update(false);
            p.draw(ctx);
        });
        this.particles = this.particles.filter(p => p.alpha > 0);

        // Draw Food (Pulsing glowing orb)
        const fx = this.food[0] * this.cellSize + this.cellSize / 2;
        const fy = this.food[1] * this.cellSize + this.cellSize / 2;
        const foodPulse = 3 + Math.sin(this.pulseTime * 2) * 1.5;
        
        ctx.save();
        ctx.shadowBlur = 15 + foodPulse * 2;
        ctx.shadowColor = '#ff3300';
        ctx.fillStyle = '#ff3300';
        ctx.beginPath();
        ctx.arc(fx, fy, this.cellSize / 2 - 2 + Math.sin(this.pulseTime * 2.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw Snake (Neon Capsules)
        this.snake.forEach((segment, idx) => {
            const sx = segment[0] * this.cellSize;
            const sy = segment[1] * this.cellSize;
            const size = this.cellSize;
            
            ctx.save();
            if (idx === 0) {
                // Glow Head
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#00ff88';
                ctx.fillStyle = '#00ff88';
                
                ctx.beginPath();
                ctx.roundRect(sx + 1, sy + 1, size - 2, size - 2, 8);
                ctx.fill();
                
                // Draw simple eyes showing head direction
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#000000';
                const eyeRadius = 2.5;
                const offset = 4;
                
                if (this.direction[0] !== 0) { // Moving Left or Right
                    const eyeX = this.direction[0] > 0 ? sx + size - offset : sx + offset;
                    ctx.beginPath();
                    ctx.arc(eyeX, sy + offset, eyeRadius, 0, Math.PI * 2);
                    ctx.arc(eyeX, sy + size - offset, eyeRadius, 0, Math.PI * 2);
                    ctx.fill();
                } else { // Moving Up or Down
                    const eyeY = this.direction[1] > 0 ? sy + size - offset : sy + offset;
                    ctx.beginPath();
                    ctx.arc(sx + offset, eyeY, eyeRadius, 0, Math.PI * 2);
                    ctx.arc(sx + size - offset, eyeY, eyeRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                // Glow Body Gradient
                const colorRatio = idx / this.snake.length;
                ctx.fillStyle = `hsl(${140 - colorRatio * 60}, 100%, ${55 - colorRatio * 15}%)`;
                
                ctx.beginPath();
                ctx.roundRect(sx + 2, sy + 2, size - 4, size - 4, 6);
                ctx.fill();
            }
            ctx.restore();
        });
        
        ctx.restore();
    }
}

// -------------------------------------------------------------
// BREAKOUT GAME ENVIRONMENT
// -------------------------------------------------------------
class BreakoutGame {
    constructor(width = 400, height = 400) {
        this.width = width;
        this.height = height;
        
        this.paddleWidth = 84;
        this.paddleHeight = 14;
        this.paddleSpeed = 9;
        
        this.ballRadius = 9;
        this.ballSpeed = 6.5;
        
        this.brickRows = 3;
        this.brickCols = 6;
        this.brickWidth = width / this.brickCols;
        this.brickHeight = 22;
        
        this.actionSpaceSize = 3; 
        this.observationSize = 5 + (this.brickRows * this.brickCols); // 23
        
        this.particles = [];
        this.ballHistory = []; // For drawing motion trail
        this.screenShake = 0;
        this.pulseTime = 0;
    }

    reset() {
        this.paddleX = (this.width - this.paddleWidth) / 2;
        this.paddleY = this.height - 35;
        
        this.ballX = this.width / 2;
        this.ballY = this.height / 2;
        
        const angle = -Math.PI / 4 - (Math.random() * Math.PI / 2); // Random upward direction
        this.ballVx = Math.cos(angle) * this.ballSpeed;
        this.ballVy = Math.sin(angle) * this.ballSpeed;
        
        this.bricks = [];
        for (let r = 0; r < this.brickRows; r++) {
            this.bricks.push(new Array(this.brickCols).fill(1));
        }
        
        this.score = 0;
        this.lives = 3;
        this.steps = 0;
        this.particles = [];
        this.ballHistory = [];
        this.screenShake = 0;
        this.pulseTime = 0;
        
        return this.getObservation();
    }

    step(action) {
        this.steps++;
        
        // 1. Move paddle
        if (action === 1) { // Left
            this.paddleX = Math.max(0, this.paddleX - this.paddleSpeed);
        } else if (action === 2) { // Right
            this.paddleX = Math.min(this.width - this.paddleWidth, this.paddleX + this.paddleSpeed);
        }
        
        // Save ball history for trail effect
        this.ballHistory.push({x: this.ballX, y: this.ballY});
        if (this.ballHistory.length > 8) this.ballHistory.shift();
        
        // 2. Move ball
        this.ballX += this.ballVx;
        this.ballY += this.ballVy;
        
        // Wall Bounce
        if (this.ballX - this.ballRadius <= 0) {
            this.ballX = this.ballRadius;
            this.ballVx = Math.abs(this.ballVx);
            this.screenShake = 3;
            this.spawnExplosion(0, this.ballY, '#00bfff', 4);
        } else if (this.ballX + this.ballRadius >= this.width) {
            this.ballX = this.width - this.ballRadius;
            this.ballVx = -Math.abs(this.ballVx);
            this.screenShake = 3;
            this.spawnExplosion(this.width, this.ballY, '#00bfff', 4);
        }
        
        // Ceiling Bounce
        if (this.ballY - this.ballRadius <= 0) {
            this.ballY = this.ballRadius;
            this.ballVy = Math.abs(this.ballVy);
            this.screenShake = 3;
            this.spawnExplosion(this.ballX, 0, '#00bfff', 4);
        }
        
        let reward = 0.0;
        let done = false;
        
        // Out of Bounds
        if (this.ballY + this.ballRadius >= this.height) {
            this.lives--;
            this.screenShake = 18;
            this.spawnExplosion(this.ballX, this.height - 5, '#ff3300', 25);
            
            if (this.lives <= 0) {
                reward = -5.0;
                done = true;
                return { observation: this.getObservation(), reward, done, score: this.score };
            } else {
                reward = -2.0;
                this.ballX = this.paddleX + this.paddleWidth / 2;
                this.ballY = this.paddleY - 20;
                
                const angle = -Math.PI / 4 - (Math.random() * Math.PI / 2);
                this.ballVx = Math.cos(angle) * this.ballSpeed;
                this.ballVy = Math.sin(angle) * this.ballSpeed;
                
                this.ballHistory = [];
                return { observation: this.getObservation(), reward, done, score: this.score };
            }
        }
        
        // Paddle Collision
        const paddleCenter = this.paddleX + this.paddleWidth / 2;
        if (this.ballY + this.ballRadius >= this.paddleY && 
            this.ballY - this.ballRadius <= this.paddleY + this.paddleHeight &&
            this.ballX + this.ballRadius >= this.paddleX && 
            this.ballX - this.ballRadius <= this.paddleX + this.paddleWidth &&
            this.ballVy > 0) {
            
            this.ballY = this.paddleY - this.ballRadius;
            
            // Adjust bounce angle depending on hit point relative to center
            const hitFactor = (this.ballX - paddleCenter) / (this.paddleWidth / 2);
            
            this.ballVx = hitFactor * this.ballSpeed;
            this.ballVy = -Math.abs(this.ballVy);
            
            reward = 0.5;
            this.screenShake = 5;
            this.spawnExplosion(this.ballX, this.paddleY, '#00bfff', 12);
        }
        
        // Brick Collisions
        let hitBrick = false;
        const rowColors = ['#ff3300', '#ff8c00', '#ffea00'];
        
        for (let r = 0; r < this.brickRows; r++) {
            for (let c = 0; c < this.brickCols; c++) {
                if (this.bricks[r][c] === 1) {
                    const bx = c * this.brickWidth;
                    const by = r * this.brickHeight;
                    
                    if (this.ballY + this.ballRadius >= by && 
                        this.ballY - this.ballRadius <= by + this.brickHeight &&
                        this.ballX + this.ballRadius >= bx && 
                        this.ballX - this.ballRadius <= bx + this.brickWidth) {
                        
                        this.bricks[r][c] = 0;
                        this.score += 10;
                        reward = 2.0; 
                        hitBrick = true;
                        
                        // Bounce ball
                        this.ballVy = -this.ballVy;
                        
                        this.screenShake = 8;
                        this.spawnExplosion(this.ballX, this.ballY, rowColors[r], 18);
                        break;
                    }
                }
            }
            if (hitBrick) break;
        }
        
        // Level Reset
        let activeBricks = 0;
        for (let r = 0; r < this.brickRows; r++) {
            activeBricks += this.bricks[r].reduce((a, b) => a + b, 0);
        }
        
        if (activeBricks === 0) {
            reward += 10.0;
            for (let r = 0; r < this.brickRows; r++) {
                this.bricks[r].fill(1);
            }
            this.ballSpeed = Math.min(this.ballSpeed + 0.5, 9);
        }
        
        const dist = Math.abs(paddleCenter - this.ballX);
        reward += 0.05 * (1.0 - (dist / this.width));
        
        if (this.steps > 1800) done = true;
        
        return { observation: this.getObservation(), reward, done, score: this.score };
    }

    getObservation() {
        const pxNorm = this.paddleX / (this.width - this.paddleWidth);
        const bxNorm = this.ballX / this.width;
        const byNorm = this.ballY / this.height;
        const vxNorm = (this.ballVx + 10) / 20.0;
        const vyNorm = (this.ballVy + 10) / 20.0;
        
        const bricksFlat = [];
        for (let r = 0; r < this.brickRows; r++) {
            for (let c = 0; c < this.brickCols; c++) {
                bricksFlat.push(this.bricks[r][c]);
            }
        }
        
        return [pxNorm, bxNorm, byNorm, vxNorm, vyNorm, ...bricksFlat];
    }

    // Intercept calculation Expert AI for Breakout
    getExpertAction() {
        const paddleCenter = this.paddleX + this.paddleWidth / 2;
        
        // If ball is traveling down, calculate target coordinate, else follow current position
        let targetX = this.ballX;
        
        if (this.ballVy > 0) {
            // Extrapolate collision point with paddle plane
            const dy = this.paddleY - this.ballY;
            const steps = dy / this.ballVy;
            let projectedX = this.ballX + this.ballVx * steps;
            
            // Handle wall bounces in projection
            while (projectedX < 0 || projectedX > this.width) {
                if (projectedX < 0) {
                    projectedX = -projectedX;
                } else if (projectedX > this.width) {
                    projectedX = 2 * this.width - projectedX;
                }
            }
            targetX = projectedX;
        }
        
        // Move paddle towards target coordinate
        const deadzone = 8;
        if (paddleCenter < targetX - deadzone) {
            return 2; // Right
        } else if (paddleCenter > targetX + deadzone) {
            return 1; // Left
        }
        return 0; // Stay
    }

    spawnExplosion(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    draw(ctx) {
        this.pulseTime += 0.05;
        ctx.save();
        
        // Screen Shake
        if (this.screenShake > 0) {
            const dx = (Math.random() - 0.5) * this.screenShake;
            const dy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(dx, dy);
            this.screenShake *= 0.88;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        // Background
        ctx.fillStyle = '#0f131c';
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Pulsing lines
        const gridOpacity = 0.04 + Math.sin(this.pulseTime * 0.7) * 0.015;
        ctx.strokeStyle = `rgba(0, 191, 255, ${gridOpacity})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, this.width, this.height);

        // Update and Draw Debris Particles (with Gravity!)
        this.particles.forEach((p, idx) => {
            p.update(true); // Apply gravity
            p.draw(ctx);
        });
        this.particles = this.particles.filter(p => p.alpha > 0);

        // Draw Bricks (Rounded neon panels)
        const rowColors = ['#ff3300', '#ff8c00', '#ffea00'];
        for (let r = 0; r < this.brickRows; r++) {
            for (let c = 0; c < this.brickCols; c++) {
                if (this.bricks[r][c] === 1) {
                    const bx = c * this.brickWidth;
                    const by = r * this.brickHeight;
                    
                    ctx.save();
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = rowColors[r];
                    ctx.fillStyle = rowColors[r];
                    ctx.beginPath();
                    ctx.roundRect(bx + 3, by + 3, this.brickWidth - 6, this.brickHeight - 6, 4);
                    ctx.fill();
                    ctx.restore();
                }
            }
        }

        // Draw Motion Trail of Ball
        this.ballHistory.forEach((pos, idx) => {
            const ratio = (idx + 1) / this.ballHistory.length;
            ctx.save();
            ctx.globalAlpha = ratio * 0.25;
            ctx.fillStyle = '#f0f4f9';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, this.ballRadius * ratio, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // Draw Paddle (Glow shield)
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#00bfff';
        ctx.fillStyle = '#00bfff';
        ctx.beginPath();
        ctx.roundRect(this.paddleX, this.paddleY, this.paddleWidth, this.paddleHeight, 6);
        ctx.fill();
        ctx.restore();

        // Draw Ball (Energy orb)
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.ballX, this.ballY, this.ballRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw HUD stats overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '600 12px Outfit';
        ctx.fillText(`LIVES: ${this.lives}`, 20, this.height - 15);
        ctx.fillText(`SCORE: ${this.score}`, this.width - 90, this.height - 15);
        
        ctx.restore();
    }
}

// Export modules to window object for web access
window.SnakeGame = SnakeGame;
window.BreakoutGame = BreakoutGame;
