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
        
        this.gravity = 0.08; // small gravity for spark debris
        this.alpha = 1.0;
        this.decay = Math.random() * 0.03 + 0.015;
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

// Floating Combat Text overlay for damage/loot notifications
class FloatingNumber {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.vy = -1.2; // float upwards
        this.alpha = 1.0;
        this.decay = 0.02;
    }

    update() {
        this.y += this.vy;
        this.alpha -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 13px Outfit';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#000';
        ctx.fillText(this.text, this.x, this.y);
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
            this.spawnExplosion(newHead[0] * this.cellSize + this.cellSize/2, newHead[1] * this.cellSize + this.cellSize/2, '#ffd700', 25);
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

    getExpertAction() {
        const head = this.snake[0];
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
            let maxSafetyScore = -9999;
            for (let i = 0; i < 4; i++) {
                const nextPt = [head[0] + this.DIRECTIONS[i][0], head[1] + this.DIRECTIONS[i][1]];
                if (!this.checkCollision(nextPt)) {
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
        
        if (nextDirIdx === -1) return 0;
        
        if (nextDirIdx === this.directionIdx) return 0;
        if (nextDirIdx === (this.directionIdx + 1) % 4) return 1;
        if (nextDirIdx === (this.directionIdx - 1 + 4) % 4) return 2;
        
        return 1;
    }

    spawnExplosion(x, y, color, count = 15) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    draw(ctx) {
        this.pulseTime += 0.05;
        ctx.save();
        
        if (this.screenShake > 0) {
            const dx = (Math.random() - 0.5) * this.screenShake;
            const dy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(dx, dy);
            this.screenShake *= 0.88;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        ctx.fillStyle = '#0f131c';
        ctx.fillRect(0, 0, this.width, this.height);
        
        const gridOpacity = 0.06 + Math.sin(this.pulseTime) * 0.02;
        ctx.strokeStyle = `rgba(255, 215, 0, ${gridOpacity})`;
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

        this.particles.forEach((p, idx) => {
            p.update(false);
            p.draw(ctx);
        });
        this.particles = this.particles.filter(p => p.alpha > 0);

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

        this.snake.forEach((segment, idx) => {
            const sx = segment[0] * this.cellSize;
            const sy = segment[1] * this.cellSize;
            const size = this.cellSize;
            
            ctx.save();
            if (idx === 0) {
                ctx.shadowBlur = 20;
                 ctx.shadowColor = '#ffd700';
                 ctx.fillStyle = '#ffd700';
                
                ctx.beginPath();
                ctx.roundRect(sx + 1, sy + 1, size - 2, size - 2, 8);
                ctx.fill();
                
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#000000';
                const eyeRadius = 2.5;
                const offset = 4;
                
                if (this.direction[0] !== 0) {
                    const eyeX = this.direction[0] > 0 ? sx + size - offset : sx + offset;
                    ctx.beginPath();
                    ctx.arc(eyeX, sy + offset, eyeRadius, 0, Math.PI * 2);
                    ctx.arc(eyeX, sy + size - offset, eyeRadius, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    const eyeY = this.direction[1] > 0 ? sy + size - offset : sy + offset;
                    ctx.beginPath();
                    ctx.arc(sx + offset, eyeY, eyeRadius, 0, Math.PI * 2);
                    ctx.arc(sx + size - offset, eyeY, eyeRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                const colorRatio = idx / this.snake.length;
                 ctx.fillStyle = `hsl(${45 - colorRatio * 15}, 100%, ${55 - colorRatio * 15}%)`;
                
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
// CYBERSHOOTER GAME ENVIRONMENT (Mini Free Fire / Battle Royale)
// -------------------------------------------------------------
class CyberShooterGame {
    constructor(width = 400, height = 400) {
        this.width = width;
        this.height = height;
        
        this.actionSpaceSize = 5; // 0: Stay, 1: Move Forward, 2: Turn Left, 3: Turn Right, 4: Shoot
        this.observationSize = 16;
        
        this.particles = [];
        this.floatingNumbers = [];
        
        this.playerRadius = 12;
        this.botRadius = 12;
        this.bulletRadius = 3.5;
    }

    reset() {
        // Player Setup
        this.playerX = this.width / 2;
        this.playerY = this.height / 2;
        this.playerAngle = 0.0; // Heading in radians
        this.health = 100.0;
        this.ammo = 30;
        
        // Shrinking Safe Zone Ring
        this.ringRadius = 240.0;
        this.ringX = this.width / 2;
        this.ringY = this.height / 2;
        
        // Spawning Items
        this.healthPacks = [
            [80, 80],
            [320, 320]
        ];
        this.ammoCrates = [
            [80, 320],
            [320, 80]
        ];
        
        // Spawn 3 Bots
        this.bots = [
            { id: 1, x: 60, y: 150, angle: 0.5, health: 100, color: '#b58900', cooldown: 0 },
            { id: 2, x: 340, y: 150, angle: 2.2, health: 100, color: '#ff8c00', cooldown: 0 },
            { id: 3, x: 200, y: 340, angle: -1.5, health: 100, color: '#e0a92a', cooldown: 0 }
        ];
        
        this.bullets = [];
        this.particles = [];
        this.floatingNumbers = [];
        
        this.score = 0;
        this.steps = 0;
        this.screenShake = 0;
        this.shootCooldown = 0;
        this.pulseTime = 0;
        
        return this.getObservation();
    }

    step(action) {
        this.steps++;
        this.pulseTime += 0.02;
        
        // Shrink Ring Zone
        this.ringRadius = Math.max(30.0, this.ringRadius - 0.12);
        
        let reward = 0.0;
        let done = false;
        
        // Check Ring damage outside safe zone
        const distToCenter = Math.hypot(this.playerX - this.ringX, this.playerY - this.ringY);
        if (distToCenter > this.ringRadius) {
            this.health -= 0.6; // damage per step
            reward -= 0.15;
            if (this.steps % 15 === 0) {
                this.floatingNumbers.push(new FloatingNumber(this.playerX, this.playerY - 15, '-8 HP', '#ff4500'));
            }
        }
        
        // Decrement cooldowns
        if (this.shootCooldown > 0) this.shootCooldown--;
        this.bots.forEach(b => { if (b.cooldown > 0) b.cooldown--; });
        
        // 1. Process Player Actions
        const moveSpeed = 4.0;
        const turnSpeed = 0.12;
        
        if (action === 1) { // Move Forward
            this.playerX += Math.cos(this.playerAngle) * moveSpeed;
            this.playerY += Math.sin(this.playerAngle) * moveSpeed;
        } else if (action === 2) { // Turn Left
            this.playerAngle = (this.playerAngle - turnSpeed + Math.PI*2) % (Math.PI*2);
        } else if (action === 3) { // Turn Right
            this.playerAngle = (this.playerAngle + turnSpeed) % (Math.PI*2);
        } else if (action === 4) { // Shoot
            if (this.shootCooldown === 0 && this.ammo > 0) {
                this.ammo--;
                this.shootCooldown = 15; // frame cooldown
                this.bullets.push({
                    x: this.playerX + Math.cos(this.playerAngle) * this.playerRadius,
                    y: this.playerY + Math.sin(this.playerAngle) * this.playerRadius,
                    vx: Math.cos(this.playerAngle) * 8.5,
                    vy: Math.sin(this.playerAngle) * 8.5,
                    fromPlayer: true
                });
                this.screenShake = 4;
                reward -= 0.05;
            } else if (this.ammo === 0) {
                reward -= 0.1;
                if (this.steps % 30 === 0) {
                    this.floatingNumbers.push(new FloatingNumber(this.playerX, this.playerY - 15, 'NO AMMO!', '#ffea00'));
                }
            }
        }
        
        // Keep player in bounds
        this.playerX = Math.max(15, Math.min(this.width - 15, this.playerX));
        this.playerY = Math.max(15, Math.min(this.height - 15, this.playerY));
        
        // 2. Update Bullets & Collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx;
            b.y += b.vy;
            
            // Check border collision
            if (b.x < 0 || b.x > this.width || b.y < 0 || b.y > this.height) {
                this.bullets.splice(i, 1);
                continue;
            }
            
            if (b.fromPlayer) {
                // Check bot hit
                let hitBot = false;
                for (let j = this.bots.length - 1; j >= 0; j--) {
                    const bot = this.bots[j];
                    const dist = Math.hypot(b.x - bot.x, b.y - bot.y);
                    if (dist < this.botRadius + this.bulletRadius) {
                        bot.health -= 25;
                        hitBot = true;
                        this.screenShake = 7;
                        this.spawnExplosion(b.x, b.y, '#ff4500', 8);
                        this.floatingNumbers.push(new FloatingNumber(bot.x, bot.y - 12, '-25 HP', '#ff4500'));
                        
                        // Eliminate Bot
                        if (bot.health <= 0) {
                            this.score++;
                            reward += 6.0;
                            this.spawnExplosion(bot.x, bot.y, bot.color, 25);
                            this.floatingNumbers.push(new FloatingNumber(bot.x, bot.y - 15, 'ELIMINATED!', '#00ff7f'));
                            // Respawn bot elsewhere
                            bot.x = Math.random() * (this.width - 60) + 30;
                            bot.y = Math.random() * (this.height - 60) + 30;
                            bot.health = 100;
                        }
                        break;
                    }
                }
                if (hitBot) {
                    this.bullets.splice(i, 1);
                    continue;
                }
            } else {
                // Check player hit
                const dist = Math.hypot(b.x - this.playerX, b.y - this.playerY);
                if (dist < this.playerRadius + this.bulletRadius) {
                    this.health -= 15;
                    this.screenShake = 12;
                    this.spawnExplosion(b.x, b.y, '#ff3300', 10);
                    this.floatingNumbers.push(new FloatingNumber(this.playerX, this.playerY - 12, '-15 HP', '#ff3300'));
                    reward -= 0.6;
                    this.bullets.splice(i, 1);
                    continue;
                }
            }
        }
        
        // 3. Update Enemy Bots behavior (Simple tracking and shooting AI)
        this.bots.forEach(bot => {
            // Check ring damage for bots
            const botDistToCenter = Math.hypot(bot.x - this.ringX, bot.y - this.ringY);
            if (botDistToCenter > this.ringRadius) {
                bot.health -= 0.5;
                if (bot.health <= 0) {
                    this.spawnExplosion(bot.x, bot.y, bot.color, 20);
                    bot.x = Math.random() * (this.width - 60) + 30;
                    bot.y = Math.random() * (this.height - 60) + 30;
                    bot.health = 100;
                }
            }
            
            // Move towards player
            const angleToPlayer = Math.atan2(this.playerY - bot.y, this.playerX - bot.x);
            
            // Steer towards center if ring is small and bot is outside
            let targetAngle = angleToPlayer;
            if (botDistToCenter > this.ringRadius - 15) {
                targetAngle = Math.atan2(this.ringY - bot.y, this.ringX - bot.x);
            }
            
            // Turn towards target
            bot.angle = bot.angle * 0.95 + targetAngle * 0.05;
            
            // Walk forward
            bot.x += Math.cos(bot.angle) * 1.5;
            bot.y += Math.sin(bot.angle) * 1.5;
            bot.x = Math.max(15, Math.min(this.width - 15, bot.x));
            bot.y = Math.max(15, Math.min(this.height - 15, bot.y));
            
            // Auto shoot at player with random chance
            if (bot.cooldown === 0 && Math.hypot(this.playerX - bot.x, this.playerY - bot.y) < 180) {
                if (Math.random() < 0.04) {
                    bot.cooldown = 35; // shoot delay
                    this.bullets.push({
                        x: bot.x + Math.cos(bot.angle) * this.botRadius,
                        y: bot.y + Math.sin(bot.angle) * this.botRadius,
                        vx: Math.cos(bot.angle) * 6.5,
                        vy: Math.sin(bot.angle) * 6.5,
                        fromPlayer: false
                    });
                }
            }
        });
        
        // 4. Update Item Pickups
        this.healthPacks.forEach((hp, idx) => {
            const dist = Math.hypot(this.playerX - hp[0], this.playerY - hp[1]);
            if (dist < this.playerRadius + 10) {
                this.health = Math.min(100, this.health + 35);
                this.floatingNumbers.push(new FloatingNumber(hp[0], hp[1] - 15, '+35 HP', '#00ff7f'));
                this.spawnExplosion(hp[0], hp[1], '#00ff7f', 8);
                reward += 0.8;
                // Respawn elsewhere
                this.healthPacks[idx] = [
                    Math.random() * (this.width - 80) + 40,
                    Math.random() * (this.height - 80) + 40
                ];
            }
        });
        
        this.ammoCrates.forEach((ac, idx) => {
            const dist = Math.hypot(this.playerX - ac[0], this.playerY - ac[1]);
            if (dist < this.playerRadius + 10) {
                this.ammo = Math.min(30, this.ammo + 12);
                this.floatingNumbers.push(new FloatingNumber(ac[0], ac[1] - 15, '+12 AMMO', '#ffea00'));
                this.spawnExplosion(ac[0], ac[1], '#ffea00', 8);
                reward += 0.5;
                // Respawn elsewhere
                this.ammoCrates[idx] = [
                    Math.random() * (this.width - 80) + 40,
                    Math.random() * (this.height - 80) + 40
                ];
            }
        });
        
        // Check game over death
        if (this.health <= 0) {
            reward -= 10.0;
            done = true;
        }
        
        if (this.steps > 1500) done = true;
        
        return { observation: this.getObservation(), reward, done, score: this.score };
    }

    getObservation() {
        const healthN = this.health / 100.0;
        const ammoN = this.ammo / 30.0;
        const pxN = this.playerX / this.width;
        const pyN = this.playerY / this.height;
        const paN = this.playerAngle / (Math.PI * 2);
        
        const rrN = this.ringRadius / 240.0;
        const distToCenter = Math.hypot(this.playerX - this.ringX, this.playerY - this.ringY);
        const distToEdgeN = (this.ringRadius - distToCenter) / 240.0;
        
        // Find closest bot
        let closestBot = null;
        let minDist = 99999.0;
        this.bots.forEach(bot => {
            const d = Math.hypot(bot.x - this.playerX, bot.y - this.playerY);
            if (d < minDist) {
                minDist = d;
                closestBot = bot;
            }
        });
        
        const botDx = closestBot ? (closestBot.x - this.playerX) / this.width : 0.0;
        const botDy = closestBot ? (closestBot.y - this.playerY) / this.height : 0.0;
        
        // Closest Health Pack
        let closestHp = this.healthPacks[0];
        let minHpDist = Math.hypot(closestHp[0] - this.playerX, closestHp[1] - this.playerY);
        this.healthPacks.forEach(hp => {
            const d = Math.hypot(hp[0] - this.playerX, hp[1] - this.playerY);
            if (d < minHpDist) {
                minHpDist = d;
                closestHp = hp;
            }
        });
        const hpDx = (closestHp[0] - this.playerX) / this.width;
        const hpDy = (closestHp[1] - this.playerY) / this.height;
        
        // Closest Ammo crate
        let closestAmmo = this.ammoCrates[0];
        let minAmmoDist = Math.hypot(closestAmmo[0] - this.playerX, closestAmmo[1] - this.playerY);
        this.ammoCrates.forEach(ac => {
            const d = Math.hypot(ac[0] - this.playerX, ac[1] - this.playerY);
            if (d < minAmmoDist) {
                minAmmoDist = d;
                closestAmmo = ac;
            }
        });
        const ammoDx = (closestAmmo[0] - this.playerX) / this.width;
        const ammoDy = (closestAmmo[1] - this.playerY) / this.height;
        
        // Wall boundaries raycast
        const distFront = Math.min(this.playerX, this.width - this.playerX, this.playerY, this.height - this.playerY) / this.width;
        
        return [
            healthN, ammoN, pxN, pyN, paN,
            rrN, distToEdgeN, botDx, botDy,
            hpDx, hpDy, ammoDx, ammoDy,
            distFront, distFront, distFront
        ];
    }

    // Expert combat bot controller for CyberShooter
    getExpertAction() {
        const distToCenter = Math.hypot(this.playerX - this.ringX, this.playerY - this.ringY);
        
        // Rule 1: Escape shrinking ring
        if (distToCenter > this.ringRadius - 20) {
            const targetAngle = Math.atan2(this.ringY - this.playerY, this.ringX - this.playerX);
            return this.steerTowardsAngle(targetAngle);
        }
        
        // Rule 2: Get health if critical
        if (this.health < 45) {
            let closestHp = this.healthPacks[0];
            let minD = Math.hypot(closestHp[0] - this.playerX, closestHp[1] - this.playerY);
            this.healthPacks.forEach(p => {
                const d = Math.hypot(p[0] - this.playerX, p[1] - this.playerY);
                if (d < minD) { minD = d; closestHp = p; }
            });
            const targetAngle = Math.atan2(closestHp[1] - this.playerY, closestHp[0] - this.playerX);
            return this.steerTowardsAngle(targetAngle);
        }
        
        // Rule 3: Find Ammo if empty
        if (this.ammo < 8) {
            let closestAmmo = this.ammoCrates[0];
            let minD = Math.hypot(closestAmmo[0] - this.playerX, closestAmmo[1] - this.playerY);
            this.ammoCrates.forEach(p => {
                const d = Math.hypot(p[0] - this.playerX, p[1] - this.playerY);
                if (d < minD) { minD = d; closestAmmo = p; }
            });
            const targetAngle = Math.atan2(closestAmmo[1] - this.playerY, closestAmmo[0] - this.playerX);
            return this.steerTowardsAngle(targetAngle);
        }
        
        // Rule 4: Track closest enemy bot and shoot
        let closestBot = null;
        let minDist = 99999.0;
        this.bots.forEach(bot => {
            const d = Math.hypot(bot.x - this.playerX, bot.y - this.playerY);
            if (d < minDist) { minDist = d; closestBot = bot; }
        });
        
        if (closestBot) {
            const targetAngle = Math.atan2(closestBot.y - this.playerY, closestBot.x - this.playerX);
            
            // Aiming threshold: if facing target, shoot
            const angleDiff = Math.abs((targetAngle - this.playerAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI);
            
            // If facing the bot closely, shoot!
            if (angleDiff < 0.15 && this.shootCooldown === 0) {
                return 4; // Shoot action
            }
            
            // Steer towards bot
            return this.steerTowardsAngle(targetAngle);
        }
        
        return 0; // Stay
    }

    // Helper steering angle selector
    steerTowardsAngle(targetAngle) {
        const normTarget = (targetAngle + Math.PI*2) % (Math.PI*2);
        const normCurrent = (this.playerAngle + Math.PI*2) % (Math.PI*2);
        
        const diff = (normTarget - normCurrent + Math.PI*3) % (Math.PI*2) - Math.PI;
        
        if (diff > 0.08) return 3; // Turn Right
        if (diff < -0.08) return 2; // Turn Left
        return 1; // Walk Forward
    }

    spawnExplosion(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    draw(ctx) {
        ctx.save();
        
        // Screen Shake
        if (this.screenShake > 0) {
            const dx = (Math.random() - 0.5) * this.screenShake;
            const dy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(dx, dy);
            this.screenShake *= 0.88;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        // Draw Base Grid Arena
        ctx.fillStyle = '#0f131c';
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Cyber Grid Lines
        ctx.strokeStyle = '#1a2230';
        ctx.lineWidth = 1;
        const gridSpacing = 40;
        for (let x = 0; x < this.width; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }
        for (let y = 0; y < this.height; y += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        // Draw Items (Health Packs & Ammo Crates)
        // Health Packs: Glowing green crosses
        this.healthPacks.forEach(hp => {
            ctx.save();
            ctx.shadowBlur = 10;
             ctx.shadowColor = '#ffd700';
             ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.roundRect(hp[0] - 8, hp[1] - 8, 16, 16, 3);
            ctx.fill();
            
            // Draw cross symbol
            ctx.fillStyle = '#0f131c';
            ctx.fillRect(hp[0] - 2, hp[1] - 6, 4, 12);
            ctx.fillRect(hp[0] - 6, hp[1] - 2, 12, 4);
            ctx.restore();
        });

        // Ammo Crates: Glowing yellow crates
        this.ammoCrates.forEach(ac => {
            ctx.save();
            ctx.shadowBlur = 10;
             ctx.shadowColor = '#ff8c00';
             ctx.fillStyle = '#ff8c00';
            ctx.beginPath();
            ctx.roundRect(ac[0] - 8, ac[1] - 8, 16, 16, 3);
            ctx.fill();
            
            // Draw bullet stripes
            ctx.strokeStyle = '#0f131c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ac[0] - 3, ac[1] - 4);
            ctx.lineTo(ac[0] - 3, ac[1] + 4);
            ctx.moveTo(ac[0] + 3, ac[1] - 4);
            ctx.lineTo(ac[0] + 3, ac[1] + 4);
            ctx.stroke();
            ctx.restore();
        });

        // Draw Bullets (Glowing yellow energy rays)
        this.bullets.forEach(b => {
            ctx.save();
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ffea00';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();
        });

        // Draw Player Character (Neon blue cyber soldier)
        ctx.save();
        ctx.shadowBlur = 15;
         ctx.shadowColor = '#ffd700';
         ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(this.playerX, this.playerY, this.playerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw gun barrel orientation
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.playerX, this.playerY);
        ctx.lineTo(
            this.playerX + Math.cos(this.playerAngle) * (this.playerRadius + 8),
            this.playerY + Math.sin(this.playerAngle) * (this.playerRadius + 8)
        );
        ctx.stroke();
        ctx.restore();

        // Draw Enemy Bots
        this.bots.forEach(bot => {
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = bot.color;
            ctx.fillStyle = bot.color;
            ctx.beginPath();
            ctx.arc(bot.x, bot.y, this.botRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw bot gun barrel
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(bot.x, bot.y);
            ctx.lineTo(
                bot.x + Math.cos(bot.angle) * (this.botRadius + 7),
                bot.y + Math.sin(bot.angle) * (this.botRadius + 7)
            );
            ctx.stroke();
            
            // Draw health bar overlay
            const barWidth = 24;
            const barHeight = 3;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(bot.x - barWidth/2, bot.y - 18, barWidth, barHeight);
            ctx.fillStyle = '#ff4500';
            ctx.fillRect(bot.x - barWidth/2, bot.y - 18, barWidth * (bot.health/100.0), barHeight);
            ctx.restore();
        });

        // Draw safe zone shrinking ring
        ctx.save();
         ctx.strokeStyle = `rgba(255, 140, 0, ${0.45 + Math.sin(this.pulseTime * 5.0) * 0.15})`;
         ctx.lineWidth = 3;
         ctx.shadowBlur = 18;
         ctx.shadowColor = '#ff8c00';
        ctx.beginPath();
        ctx.arc(this.ringX, this.ringY, this.ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Update and Draw Particles Debris
        this.particles.forEach((p, idx) => {
            p.update(true); // small gravity
            p.draw(ctx);
        });
        this.particles = this.particles.filter(p => p.alpha > 0);

        // Update and Draw Floating Text Numbers
        this.floatingNumbers.forEach((fn, idx) => {
            fn.update();
            fn.draw(ctx);
        });
        this.floatingNumbers = this.floatingNumbers.filter(fn => fn.alpha > 0);

        // Draw Player Health & Ammo HUD Bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '600 12px Outfit';
        ctx.fillText(`HEALTH: ${Math.max(0, Math.ceil(this.health))}%`, 20, this.height - 15);
        ctx.fillText(`AMMO: ${this.ammo}/30`, this.width - 95, this.height - 15);
        
        ctx.restore();
    }
}

// Export modules to window object for web access
window.SnakeGame = SnakeGame;
window.CyberShooterGame = CyberShooterGame;
