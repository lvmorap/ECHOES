// ECHOES - main.js
// A game where you score by PREDICTING and SYNCHRONIZING with your rival

// ============================================================================
// AUDIO SYNTHESIZER - Web Audio API
// ============================================================================

class AudioSynth {
    constructor() {
        this.ctx = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    playTone(frequency, duration, volume = 0.3) {
        if (!this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.frequency.value = frequency;
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playResonance(quality) {
        if (quality === 'perfect') {
            this.playTone(880, 0.3, 0.4);
        } else if (quality === 'good') {
            this.playTone(440, 0.2, 0.3);
        }
    }

    playKnockback() {
        this.playTone(110, 0.15, 0.25);
    }

    playDissonanceShift() {
        this.playTone(220, 0.5, 0.3);
        setTimeout(() => this.playTone(165, 0.3, 0.25), 100);
    }

    playBeat() {
        this.playTone(55, 0.1, 0.15);
    }

    playMiss() {
        this.playTone(150, 0.1, 0.1);
    }
}

// Global audio synth instance
const audioSynth = new AudioSynth();

// ============================================================================
// PULSE FIELD - The heart of the game
// ============================================================================

class PulseField {
    constructor(scene) {
        this.scene = scene;
        this.period = 2000; // 2 seconds per beat
        this.startTime = 0;
        this.isDissonant = false;
        this.rings = [];
        this.maxRings = 5;
        this.centerX = 400;
        this.centerY = 300;
        this.maxRadius = 400;
        
        this.createRings();
    }

    createRings() {
        for (let i = 0; i < this.maxRings; i++) {
            const ring = this.scene.add.graphics();
            this.rings.push({
                graphic: ring,
                phase: i / this.maxRings,
                radius: 0
            });
        }
    }

    start() {
        this.startTime = this.scene.time.now;
    }

    getPhase(time) {
        if (this.startTime === 0) return 0;
        return ((time - this.startTime) % this.period) / this.period;
    }

    getBeatProximity(time) {
        const phase = this.getPhase(time);
        const distanceToBeat = Math.min(phase, 1 - phase) * 2;
        return 1 - distanceToBeat;
    }

    isOnBeat(time) {
        return this.getBeatProximity(time) > 0.85;
    }

    isPerfectBeat(time) {
        return this.getBeatProximity(time) > 0.95;
    }

    toggleDissonance() {
        this.isDissonant = !this.isDissonant;
    }

    update(time, delta) {
        const baseColor = this.isDissonant ? 0x9b00ff : 0x1a1aff;
        
        for (let i = 0; i < this.rings.length; i++) {
            const ring = this.rings[i];
            const phase = (this.getPhase(time) + ring.phase) % 1;
            
            ring.radius = phase * this.maxRadius;
            const alpha = Math.max(0, 1 - phase);
            
            ring.graphic.clear();
            ring.graphic.lineStyle(2, baseColor, alpha * 0.8);
            ring.graphic.strokeCircle(this.centerX, this.centerY, ring.radius);
        }
    }

    destroy() {
        for (const ring of this.rings) {
            ring.graphic.destroy();
        }
        this.rings = [];
    }
}

// ============================================================================
// PLAYER CLASS
// ============================================================================

class Player {
    constructor(scene, x, y, config) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.config = config;
        this.color = config.color;
        this.playerId = config.id;
        
        this._echoMeter = 50;
        this._speedHistory = [];
        this._lastActionTime = 0;
        this._lastDashTime = 0;
        this.speed = 280;
        this.dashCooldown = 500;
        this.isCarrier = false;
        
        this.createGraphics();
        this.setupPhysics();
    }

    createGraphics() {
        // Create dodecagon shape
        this.graphics = this.scene.add.graphics();
        
        // Echo ring graphics
        this.echoRing = this.scene.add.graphics();
        
        this.render();
    }

    setupPhysics() {
        // Create physics body using a circle
        this.body = this.scene.physics.add.existing(
            this.scene.add.circle(this.x, this.y, 20, 0x000000, 0),
            false
        ).body;
        
        this.body.setCircle(20);
        this.body.setMaxVelocity(this.speed, this.speed);
        this.body.setDrag(400, 400);
        this.body.setBounce(0.3, 0.3);
        this.body.setCollideWorldBounds(true);
    }

    get echoMeter() {
        return this._echoMeter;
    }

    set echoMeter(value) {
        this._echoMeter = Phaser.Math.Clamp(value, 0, 100);
    }

    updateEchoMeter(delta) {
        const vel = this.body.velocity;
        const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
        
        this._speedHistory.push(speed);
        if (this._speedHistory.length > 10) this._speedHistory.shift();
        
        if (this._speedHistory.length > 2) {
            const avg = this._speedHistory.reduce((a, b) => a + b, 0) / this._speedHistory.length;
            const variance = this._speedHistory.reduce((acc, s) => acc + Math.abs(s - avg), 0) / this._speedHistory.length;
            
            const regularityBonus = Math.max(-1, Math.min(1, (50 - variance) / 50));
            this._echoMeter = Phaser.Math.Clamp(
                this._echoMeter + regularityBonus * delta * 0.02,
                0,
                100
            );
        }
    }

    attemptResonance(pulseField, time) {
        const timeSinceLastAction = time - this._lastActionTime;
        if (timeSinceLastAction < 200) return 'cooldown';
        
        this._lastActionTime = time;
        
        if (pulseField.isPerfectBeat(time)) {
            return 'perfect';
        } else if (pulseField.isOnBeat(time)) {
            return 'good';
        } else {
            this._echoMeter = Math.max(0, this._echoMeter - 5);
            return 'miss';
        }
    }

    applyDash(pulseField, time) {
        const now = time;
        if (now - this._lastDashTime < this.dashCooldown) return false;
        
        this._lastDashTime = now;
        
        const vel = this.body.velocity;
        let angle = Math.atan2(vel.y, vel.x);
        
        if (Math.abs(vel.x) < 10 && Math.abs(vel.y) < 10) {
            return false;
        }
        
        const force = 500;
        this.body.setVelocity(
            Math.cos(angle) * force,
            Math.sin(angle) * force
        );
        
        // Check timing for echo bonus
        if (pulseField.isPerfectBeat(time)) {
            this._echoMeter = Math.min(100, this._echoMeter + 20);
            return 'perfect';
        } else if (pulseField.isOnBeat(time)) {
            this._echoMeter = Math.min(100, this._echoMeter + 5);
            return 'good';
        } else {
            this._echoMeter = Math.max(0, this._echoMeter - 10);
            return 'miss';
        }
    }

    applyKnockback(fromX, fromY) {
        const angle = Phaser.Math.Angle.Between(fromX, fromY, this.x, this.y);
        const force = 450;
        this.body.setVelocity(
            Math.cos(angle) * force,
            Math.sin(angle) * force
        );
    }

    move(dirX, dirY) {
        const acceleration = 1200;
        this.body.setAcceleration(dirX * acceleration, dirY * acceleration);
    }

    update(time, delta) {
        // Sync position with physics body
        this.x = this.body.gameObject.x;
        this.y = this.body.gameObject.y;
        
        this.updateEchoMeter(delta);
        this.render();
    }

    render() {
        const sides = 12;
        const radius = 20;
        const echoRingRadius = 28;
        
        // Draw dodecagon
        this.graphics.clear();
        this.graphics.fillStyle(this.color, 0.3);
        this.graphics.lineStyle(3, this.color, 1);
        
        const points = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
            points.push({
                x: this.x + Math.cos(angle) * radius,
                y: this.y + Math.sin(angle) * radius
            });
        }
        
        this.graphics.beginPath();
        this.graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.graphics.lineTo(points[i].x, points[i].y);
        }
        this.graphics.closePath();
        this.graphics.fillPath();
        this.graphics.strokePath();
        
        // Draw echo ring
        this.echoRing.clear();
        
        const echoPercent = this._echoMeter / 100;
        const echoAngle = echoPercent * Math.PI * 2;
        
        // Color interpolation from red to green
        const r = Math.floor(255 * (1 - echoPercent));
        const g = Math.floor(255 * echoPercent);
        const echoColor = (r << 16) | (g << 8) | 0x88;
        
        this.echoRing.lineStyle(4, echoColor, 0.8);
        this.echoRing.beginPath();
        this.echoRing.arc(this.x, this.y, echoRingRadius, -Math.PI / 2, -Math.PI / 2 + echoAngle);
        this.echoRing.strokePath();
        
        // Carrier indicator
        if (this.isCarrier) {
            this.echoRing.lineStyle(2, 0xffeb00, 0.6);
            this.echoRing.strokeCircle(this.x, this.y, 35);
        }
    }

    destroy() {
        this.graphics.destroy();
        this.echoRing.destroy();
        if (this.body.gameObject) {
            this.body.gameObject.destroy();
        }
    }
}

// ============================================================================
// UI MANAGER
// ============================================================================

class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.floatingTexts = [];
    }

    drawScoreboard(p1Score, p2Score) {
        if (this.scoreText) {
            this.scoreText.destroy();
        }
        
        this.scoreText = this.scene.add.text(400, 30, `P1: ${p1Score}  |  P2: ${p2Score}`, {
            fontSize: '28px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ffffff'
        }).setOrigin(0.5);
    }

    drawTimer(seconds) {
        if (this.timerText) {
            this.timerText.destroy();
        }
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        this.timerText = this.scene.add.text(400, 580, timeStr, {
            fontSize: '24px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ffeb00'
        }).setOrigin(0.5);
    }

    showFloatingText(x, y, text, color = '#ffffff') {
        const floatText = this.scene.add.text(x, y, text, {
            fontSize: '24px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: color,
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        this.scene.tweens.add({
            targets: floatText,
            y: y - 50,
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => floatText.destroy()
        });
    }

    showResonanceEffect(x, y, quality) {
        const color = quality === 'perfect' ? 0x00ff88 : 0x00ffcc;
        const radius = quality === 'perfect' ? 80 : 50;
        
        const circle = this.scene.add.graphics();
        circle.lineStyle(3, color, 1);
        circle.strokeCircle(x, y, 10);
        
        this.scene.tweens.add({
            targets: { r: 10, alpha: 1 },
            r: radius,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onUpdate: (tween) => {
                const val = tween.targets[0];
                circle.clear();
                circle.lineStyle(3, color, val.alpha);
                circle.strokeCircle(x, y, val.r);
            },
            onComplete: () => circle.destroy()
        });
    }

    showModeTitle(title) {
        if (this.modeText) {
            this.modeText.destroy();
        }
        
        this.modeText = this.scene.add.text(400, 65, title, {
            fontSize: '18px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#00ffcc'
        }).setOrigin(0.5);
    }

    destroy() {
        if (this.scoreText) this.scoreText.destroy();
        if (this.timerText) this.timerText.destroy();
        if (this.modeText) this.modeText.destroy();
    }
}

// ============================================================================
// SCORING SYSTEM
// ============================================================================

class ScoringSystem {
    constructor() {
        this.scores = { p1: 0, p2: 0 };
    }

    reset() {
        this.scores = { p1: 0, p2: 0 };
    }

    processResonance(playerId, beatResult, inZone, echoMeterAbove50) {
        if (!inZone || !echoMeterAbove50) {
            return 0;
        }
        
        let points = 0;
        if (beatResult === 'perfect') {
            points = 3;
        } else if (beatResult === 'good') {
            points = 1;
        }
        
        this.scores[playerId] += points;
        return points;
    }

    processKnockback(attackerId, onBeat) {
        if (onBeat) {
            this.scores[attackerId] += 1;
            return 1;
        }
        return 0;
    }

    addPoints(playerId, points) {
        this.scores[playerId] += points;
    }

    getScores() {
        return { ...this.scores };
    }

    getWinner() {
        if (this.scores.p1 > this.scores.p2) return 'p1';
        if (this.scores.p2 > this.scores.p1) return 'p2';
        return 'tie';
    }
}

// ============================================================================
// GAME MODES
// ============================================================================

class GameMode {
    constructor(scene, pulseField, scoring, ui, players) {
        this.scene = scene;
        this.pulseField = pulseField;
        this.scoring = scoring;
        this.ui = ui;
        this.players = players;
        this.duration = 90000; // 90 seconds
        this.startTime = 0;
        this.ended = false;
    }

    setup() {
        this.startTime = this.scene.time.now;
        this.scoring.reset();
    }

    getTimeRemaining() {
        const elapsed = this.scene.time.now - this.startTime;
        return Math.max(0, (this.duration - elapsed) / 1000);
    }

    update(time, delta) {
        // Override in subclasses
    }

    checkEnd() {
        if (this.ended) return null;
        
        const remaining = this.getTimeRemaining();
        if (remaining <= 0) {
            this.ended = true;
            return {
                winner: this.scoring.getWinner(),
                scores: this.scoring.getScores()
            };
        }
        return null;
    }

    cleanup() {
        // Override in subclasses
    }

    get introData() {
        return {
            title: 'GAME MODE',
            line1: '',
            line2: ''
        };
    }
}

// PULSE DUEL MODE
class PulseDuelMode extends GameMode {
    constructor(scene, pulseField, scoring, ui, players) {
        super(scene, pulseField, scoring, ui, players);
        this.hexagon = null;
        this.hexagonRadius = 100;
        this.hexagonAngle = 0;
        this.lastSizeChange = 0;
        this.growing = true;
    }

    setup() {
        super.setup();
        this.hexagon = this.scene.add.graphics();
        this.lastSizeChange = this.scene.time.now;
        this.ui.showModeTitle('PULSE DUEL');
    }

    isInHexagon(x, y) {
        const dx = x - 400;
        const dy = y - 300;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist <= this.hexagonRadius;
    }

    update(time, delta) {
        // Rotate hexagon
        this.hexagonAngle += 0.001 * delta;
        
        // Change size every 15 seconds
        if (time - this.lastSizeChange > 15000) {
            this.growing = !this.growing;
            this.lastSizeChange = time;
        }
        
        this.hexagonRadius += (this.growing ? 0.02 : -0.02) * delta;
        this.hexagonRadius = Phaser.Math.Clamp(this.hexagonRadius, 60, 140);
        
        // Draw hexagon
        this.hexagon.clear();
        this.hexagon.lineStyle(3, 0x00ffcc, 0.8);
        this.hexagon.fillStyle(0x00ffcc, 0.1);
        
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = this.hexagonAngle + (i / 6) * Math.PI * 2;
            points.push({
                x: 400 + Math.cos(angle) * this.hexagonRadius,
                y: 300 + Math.sin(angle) * this.hexagonRadius
            });
        }
        
        this.hexagon.beginPath();
        this.hexagon.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.hexagon.lineTo(points[i].x, points[i].y);
        }
        this.hexagon.closePath();
        this.hexagon.fillPath();
        this.hexagon.strokePath();
    }

    processResonance(player, beatResult) {
        const inZone = this.isInHexagon(player.x, player.y);
        const echoAbove50 = player.echoMeter >= 50;
        return this.scoring.processResonance(player.playerId, beatResult, inZone, echoAbove50);
    }

    cleanup() {
        if (this.hexagon) {
            this.hexagon.destroy();
        }
    }

    get introData() {
        return {
            title: 'PULSE DUEL',
            line1: 'Resonate with the field at the exact moment to score.',
            line2: 'Disrupt your rival\'s rhythm. Don\'t lose yours.'
        };
    }
}

// ECHO CHASE MODE
class EchoChaseMode extends GameMode {
    constructor(scene, pulseField, scoring, ui, players) {
        super(scene, pulseField, scoring, ui, players);
        this.carrierId = null;
        this.lastAutoScore = 0;
        this.pulseIndicator = null;
    }

    setup() {
        super.setup();
        this.determineCarrier();
        // Initialize to allow first auto-score after 2 seconds (intentional delay)
        this.lastAutoScore = this.scene.time.now;
        this.pulseIndicator = this.scene.add.graphics();
        this.ui.showModeTitle('ECHO CHASE');
    }

    determineCarrier() {
        const p1 = this.players.p1;
        const p2 = this.players.p2;
        
        p1.isCarrier = false;
        p2.isCarrier = false;
        
        if (p1.echoMeter > p2.echoMeter) {
            this.carrierId = 'p1';
            p1.isCarrier = true;
        } else if (p2.echoMeter > p1.echoMeter) {
            this.carrierId = 'p2';
            p2.isCarrier = true;
        } else {
            // Tie - keep current or default to p1
            if (!this.carrierId) this.carrierId = 'p1';
            this.players[this.carrierId].isCarrier = true;
        }
    }

    update(time, delta) {
        // Check carrier change
        this.determineCarrier();
        
        // Auto score for carrier every 2 seconds
        if (time - this.lastAutoScore >= 2000) {
            if (this.carrierId) {
                this.scoring.addPoints(this.carrierId, 1);
                const carrier = this.players[this.carrierId];
                this.ui.showFloatingText(carrier.x, carrier.y - 30, '+1', '#ffeb00');
            }
            this.lastAutoScore = time;
        }
        
        // Draw pulse around carrier
        if (this.carrierId) {
            const carrier = this.players[this.carrierId];
            this.pulseIndicator.clear();
            this.pulseIndicator.lineStyle(2, 0xffeb00, 0.5);
            this.pulseIndicator.strokeCircle(carrier.x, carrier.y, 45 + Math.sin(time * 0.005) * 5);
        }
    }

    processResonance(player, beatResult) {
        // In chase mode, resonance transfers carrier on perfect hit
        if (beatResult === 'perfect' && player.playerId !== this.carrierId) {
            // Check distance to carrier
            const carrier = this.players[this.carrierId];
            const dist = Phaser.Math.Distance.Between(player.x, player.y, carrier.x, carrier.y);
            
            if (dist < 80) {
                // Steal the pulse!
                this.players[this.carrierId].isCarrier = false;
                this.carrierId = player.playerId;
                player.isCarrier = true;
                this.ui.showFloatingText(player.x, player.y - 30, 'STOLEN!', '#ff3d71');
                return 2;
            }
        }
        return 0;
    }

    cleanup() {
        if (this.pulseIndicator) {
            this.pulseIndicator.destroy();
        }
        this.players.p1.isCarrier = false;
        this.players.p2.isCarrier = false;
    }

    get introData() {
        return {
            title: 'ECHO CHASE',
            line1: 'Whoever has the highest pulse gains points each second.',
            line2: 'Steal the pulse from your rival by hitting them on beat.'
        };
    }
}

// DISSONANCE MODE
class DissonanceMode extends GameMode {
    constructor(scene, pulseField, scoring, ui, players) {
        super(scene, pulseField, scoring, ui, players);
        this.isPhase2 = false;
        this.phaseChangeTime = 45000; // 45 seconds
    }

    setup() {
        super.setup();
        this.isPhase2 = false;
        this.pulseField.isDissonant = false;
        this.ui.showModeTitle('DISSONANCE');
    }

    update(time, delta) {
        const elapsed = time - this.startTime;
        
        // Check phase transition
        if (!this.isPhase2 && elapsed >= this.phaseChangeTime) {
            this.isPhase2 = true;
            this.pulseField.toggleDissonance();
            
            // Visual feedback for phase transition
            this.scene.cameras.main.shake(300, 0.008);
            // Flash parameters: duration (ms), red, green, blue (violet flash)
            this.scene.cameras.main.flash(200, 150, 0, 255);
            audioSynth.playDissonanceShift();
        }
    }

    processResonance(player, beatResult) {
        const echoAbove50 = player.echoMeter >= 50;
        
        if (this.isPhase2) {
            // Inverted rules - miss is good!
            if (beatResult === 'miss' && echoAbove50) {
                this.scoring.addPoints(player.playerId, 2);
                return 2;
            }
            return 0;
        } else {
            // Normal rules
            return this.scoring.processResonance(player.playerId, beatResult, true, echoAbove50);
        }
    }

    cleanup() {
        this.pulseField.isDissonant = false;
    }

    get introData() {
        return {
            title: 'DISSONANCE',
            line1: 'The field has two states. The rules change.',
            line2: 'Learn to read the field before your rival.'
        };
    }
}

// ============================================================================
// GAME MODE MANAGER
// ============================================================================

class GameModeManager {
    constructor() {
        this.modes = ['PulseDuel', 'EchoChase', 'Dissonance'];
        this.currentIndex = 0;
        this.globalScores = { p1: 0, p2: 0 };
    }

    getNextMode() {
        if (this.currentIndex >= this.modes.length) {
            return null;
        }
        return this.modes[this.currentIndex++];
    }

    addModeScores(scores) {
        this.globalScores.p1 += scores.p1;
        this.globalScores.p2 += scores.p2;
    }

    getGlobalScores() {
        return { ...this.globalScores };
    }

    getFinalWinner() {
        if (this.globalScores.p1 > this.globalScores.p2) return 'p1';
        if (this.globalScores.p2 > this.globalScores.p1) return 'p2';
        return 'tie';
    }

    reset() {
        this.currentIndex = 0;
        this.globalScores = { p1: 0, p2: 0 };
    }
}

// Global mode manager
const modeManager = new GameModeManager();

// ============================================================================
// SCENES
// ============================================================================

// BOOT SCENE
class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    create() {
        // Initialize audio on first interaction
        this.input.once('pointerdown', () => audioSynth.init());
        this.input.keyboard.once('keydown', () => audioSynth.init());
        
        this.scene.start('MenuScene');
    }
}

// MENU SCENE
class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        // Background pulse effect
        this.pulseRings = [];
        for (let i = 0; i < 5; i++) {
            const ring = this.add.graphics();
            this.pulseRings.push({ graphic: ring, phase: i / 5 });
        }
        
        this.startTime = this.time.now;
        this.period = 2000;
        
        // Title
        this.add.text(400, 200, 'ECHOES', {
            fontSize: '72px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#00ffcc',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Subtitle
        this.add.text(400, 270, 'Synchronize. Disrupt. Resonate.', {
            fontSize: '18px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Controls
        this.add.text(400, 450, 'P1: WASD + F (action) + G (dash)', {
            fontSize: '14px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#00e5ff'
        }).setOrigin(0.5);
        
        this.add.text(400, 475, 'P2: Arrows + Shift (action) + Enter (dash)', {
            fontSize: '14px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ff3d71'
        }).setOrigin(0.5);
        
        // Press any key
        this.pressText = this.add.text(400, 530, 'PRESS ANY KEY', {
            fontSize: '24px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ffeb00'
        }).setOrigin(0.5);
        
        // Key input
        this.input.keyboard.on('keydown', () => {
            audioSynth.init();
            modeManager.reset();
            this.scene.start('ModeIntroScene', {
                modeName: modeManager.getNextMode()
            });
        });
    }

    update(time) {
        // Animate pulse rings
        const phase = ((time - this.startTime) % this.period) / this.period;
        
        for (let i = 0; i < this.pulseRings.length; i++) {
            const ring = this.pulseRings[i];
            const ringPhase = (phase + ring.phase) % 1;
            const radius = ringPhase * 400;
            const alpha = Math.max(0, 1 - ringPhase) * 0.3;
            
            ring.graphic.clear();
            ring.graphic.lineStyle(2, 0x1a1aff, alpha);
            ring.graphic.strokeCircle(400, 300, radius);
        }
        
        // Blink "PRESS ANY KEY" on beat
        const beatProximity = 1 - Math.min(phase, 1 - phase) * 2;
        this.pressText.setAlpha(0.5 + beatProximity * 0.5);
    }
}

// MODE INTRO SCENE
class ModeIntroScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ModeIntroScene' });
    }

    init(data) {
        this.modeName = data.modeName || 'PulseDuel';
        this.countdown = 7;
    }

    create() {
        // Get mode intro data
        const introData = this.getModeIntro(this.modeName);
        
        // Dark overlay with pulse in background
        this.add.rectangle(400, 300, 800, 600, 0x050510, 0.95);
        
        // Title
        this.add.text(400, 220, introData.title, {
            fontSize: '52px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#00ffcc',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Instructions
        this.add.text(400, 310, introData.line1, {
            fontSize: '18px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        this.add.text(400, 345, introData.line2, {
            fontSize: '18px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#aaaaaa'
        }).setOrigin(0.5);
        
        // Countdown
        this.countdownText = this.add.text(400, 450, '7', {
            fontSize: '72px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ffeb00'
        }).setOrigin(0.5);
        
        // Timer event
        this.time.addEvent({
            delay: 1000,
            repeat: 6,
            callback: () => {
                this.countdown--;
                this.countdownText.setText(this.countdown.toString());
                if (this.countdown <= 0) {
                    this.scene.start('GameScene', { modeName: this.modeName });
                }
            }
        });
        
        // Progress bar
        this.progressBar = this.add.rectangle(100, 530, 0, 8, 0x00ffcc);
        this.tweens.add({
            targets: this.progressBar,
            width: 600,
            duration: 7000,
            ease: 'Linear'
        });
    }

    getModeIntro(modeName) {
        const intros = {
            'PulseDuel': {
                title: 'PULSE DUEL',
                line1: 'Resonate with the field at the exact moment to score.',
                line2: 'Disrupt your rival\'s rhythm. Don\'t lose yours.'
            },
            'EchoChase': {
                title: 'ECHO CHASE',
                line1: 'Whoever has the highest pulse gains points each second.',
                line2: 'Steal the pulse from your rival by hitting them on beat.'
            },
            'Dissonance': {
                title: 'DISSONANCE',
                line1: 'The field has two states. The rules change.',
                line2: 'Learn to read the field before your rival.'
            }
        };
        return intros[modeName] || intros['PulseDuel'];
    }
}

// GAME SCENE
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.modeName = data.modeName;
    }

    create() {
        // Setup world bounds
        this.physics.world.setBounds(0, 0, 800, 600);
        
        // Create pulse field
        this.pulseField = new PulseField(this);
        this.pulseField.start();
        
        // Create scoring system
        this.scoring = new ScoringSystem();
        
        // Create UI manager
        this.ui = new UIManager(this);
        
        // Create players
        this.players = {
            p1: new Player(this, 250, 300, { 
                id: 'p1', 
                color: 0x00e5ff
            }),
            p2: new Player(this, 550, 300, { 
                id: 'p2', 
                color: 0xff3d71
            })
        };
        
        // Setup collision between players
        this.physics.add.collider(
            this.players.p1.body.gameObject,
            this.players.p2.body.gameObject,
            this.handlePlayerCollision,
            null,
            this
        );
        
        // Create game mode
        this.createGameMode();
        
        // Setup controls
        this.setupControls();
        
        // Track beat for audio
        this.lastBeatTime = 0;
    }

    createGameMode() {
        const modes = {
            'PulseDuel': PulseDuelMode,
            'EchoChase': EchoChaseMode,
            'Dissonance': DissonanceMode
        };
        
        const ModeClass = modes[this.modeName] || PulseDuelMode;
        this.gameMode = new ModeClass(this, this.pulseField, this.scoring, this.ui, this.players);
        this.gameMode.setup();
    }

    setupControls() {
        const keys = this.input.keyboard.addKeys({
            // Player 1
            w: 'W', a: 'A', s: 'S', d: 'D',
            f: 'F', g: 'G',
            // Player 2
            up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
            shift: 'SHIFT', enter: 'ENTER'
        });
        
        this.keys = keys;
    }

    handlePlayerCollision(obj1, obj2) {
        // Knockback handled by physics
    }

    update(time, delta) {
        // Update pulse field
        this.pulseField.update(time, delta);
        
        // Handle player movement
        this.handleMovement();
        
        // Handle player actions
        this.handleActions(time);
        
        // Update players
        this.players.p1.update(time, delta);
        this.players.p2.update(time, delta);
        
        // Update game mode
        this.gameMode.update(time, delta);
        
        // Update UI
        const scores = this.scoring.getScores();
        this.ui.drawScoreboard(scores.p1, scores.p2);
        this.ui.drawTimer(this.gameMode.getTimeRemaining());
        
        // Play beat sound
        if (this.pulseField.isPerfectBeat(time) && time - this.lastBeatTime > 500) {
            audioSynth.playBeat();
            this.lastBeatTime = time;
        }
        
        // Check game end
        const result = this.gameMode.checkEnd();
        if (result) {
            this.endMode(result);
        }
    }

    handleMovement() {
        const { w, a, s, d, up, down, left, right } = this.keys;
        // 1/√2 ≈ 0.707 - ensures consistent speed in all 8 directions
        const DIAGONAL_FACTOR = Math.SQRT1_2;
        
        // Player 1
        let p1DirX = 0, p1DirY = 0;
        if (a.isDown) p1DirX -= 1;
        if (d.isDown) p1DirX += 1;
        if (w.isDown) p1DirY -= 1;
        if (s.isDown) p1DirY += 1;
        
        // Normalize diagonal movement
        if (p1DirX !== 0 && p1DirY !== 0) {
            p1DirX *= DIAGONAL_FACTOR;
            p1DirY *= DIAGONAL_FACTOR;
        }
        this.players.p1.move(p1DirX, p1DirY);
        
        // Player 2
        let p2DirX = 0, p2DirY = 0;
        if (left.isDown) p2DirX -= 1;
        if (right.isDown) p2DirX += 1;
        if (up.isDown) p2DirY -= 1;
        if (down.isDown) p2DirY += 1;
        
        // Normalize diagonal movement
        if (p2DirX !== 0 && p2DirY !== 0) {
            p2DirX *= DIAGONAL_FACTOR;
            p2DirY *= DIAGONAL_FACTOR;
        }
        this.players.p2.move(p2DirX, p2DirY);
    }

    handleActions(time) {
        const { f, g, shift, enter } = this.keys;
        
        // Player 1 resonance
        if (Phaser.Input.Keyboard.JustDown(f)) {
            this.processResonance(this.players.p1, time);
        }
        
        // Player 1 dash
        if (Phaser.Input.Keyboard.JustDown(g)) {
            this.processDash(this.players.p1, time);
        }
        
        // Player 2 resonance
        if (Phaser.Input.Keyboard.JustDown(shift)) {
            this.processResonance(this.players.p2, time);
        }
        
        // Player 2 dash
        if (Phaser.Input.Keyboard.JustDown(enter)) {
            this.processDash(this.players.p2, time);
        }
    }

    processResonance(player, time) {
        const beatResult = player.attemptResonance(this.pulseField, time);
        
        if (beatResult === 'cooldown') return;
        
        const points = this.gameMode.processResonance(player, beatResult);
        
        if (beatResult === 'perfect') {
            this.cameras.main.shake(120, 0.004);
            this.ui.showResonanceEffect(player.x, player.y, 'perfect');
            this.ui.showFloatingText(player.x, player.y - 40, '+3', '#00ff88');
            audioSynth.playResonance('perfect');
        } else if (beatResult === 'good') {
            this.ui.showResonanceEffect(player.x, player.y, 'good');
            this.ui.showFloatingText(player.x, player.y - 40, '+1', '#00ffcc');
            audioSynth.playResonance('good');
        } else {
            this.ui.showFloatingText(player.x, player.y - 40, 'MISS', '#ff2222');
            audioSynth.playMiss();
        }
    }

    processDash(player, time) {
        const result = player.applyDash(this.pulseField, time);
        
        if (!result) return;
        
        if (result === 'perfect') {
            this.ui.showFloatingText(player.x, player.y - 40, 'DASH!', '#00ff88');
        } else if (result === 'good') {
            this.ui.showFloatingText(player.x, player.y - 40, 'dash', '#00ffcc');
        } else {
            this.ui.showFloatingText(player.x, player.y - 40, 'dash', '#ff8800');
        }
    }

    endMode(result) {
        // Cleanup
        this.gameMode.cleanup();
        this.pulseField.destroy();
        this.players.p1.destroy();
        this.players.p2.destroy();
        this.ui.destroy();
        
        // Add scores to global
        modeManager.addModeScores(result.scores);
        
        // Go to result scene
        this.scene.start('ResultScene', {
            modeName: this.modeName,
            modeScores: result.scores,
            globalScores: modeManager.getGlobalScores(),
            winner: result.winner
        });
    }
}

// RESULT SCENE
class ResultScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ResultScene' });
    }

    init(data) {
        this.data = data;
    }

    create() {
        // Background
        this.add.rectangle(400, 300, 800, 600, 0x050510);
        
        // Mode name - convert camelCase to spaced text (e.g., PulseDuel -> PULSE DUEL)
        const modeDisplayName = this.data.modeName
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .toUpperCase();
        this.add.text(400, 150, modeDisplayName, {
            fontSize: '32px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#00ffcc'
        }).setOrigin(0.5);
        
        // Winner announcement
        let winnerText = 'TIE!';
        let winnerColor = '#ffffff';
        
        if (this.data.winner === 'p1') {
            winnerText = 'PLAYER 1 WINS!';
            winnerColor = '#00e5ff';
        } else if (this.data.winner === 'p2') {
            winnerText = 'PLAYER 2 WINS!';
            winnerColor = '#ff3d71';
        }
        
        this.add.text(400, 250, winnerText, {
            fontSize: '48px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: winnerColor
        }).setOrigin(0.5);
        
        // Scores
        this.add.text(400, 330, `P1: ${this.data.modeScores.p1}  |  P2: ${this.data.modeScores.p2}`, {
            fontSize: '28px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Global scores
        this.add.text(400, 400, `TOTAL: P1 ${this.data.globalScores.p1} | P2 ${this.data.globalScores.p2}`, {
            fontSize: '20px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ffeb00'
        }).setOrigin(0.5);
        
        // Continue prompt
        this.continueText = this.add.text(400, 500, 'PRESS ANY KEY TO CONTINUE', {
            fontSize: '18px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#aaaaaa'
        }).setOrigin(0.5);
        
        // Blink effect
        this.tweens.add({
            targets: this.continueText,
            alpha: 0.3,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // Key input
        this.time.delayedCall(1000, () => {
            this.input.keyboard.once('keydown', () => {
                const nextMode = modeManager.getNextMode();
                if (nextMode) {
                    this.scene.start('ModeIntroScene', { modeName: nextMode });
                } else {
                    this.scene.start('FinalScene', {
                        globalScores: this.data.globalScores
                    });
                }
            });
        });
    }
}

// FINAL SCENE
class FinalScene extends Phaser.Scene {
    constructor() {
        super({ key: 'FinalScene' });
    }

    init(data) {
        this.globalScores = data.globalScores;
    }

    create() {
        // Background
        this.add.rectangle(400, 300, 800, 600, 0x050510);
        
        // Create pulse effect
        this.createPulseEffect();
        
        // Title
        this.add.text(400, 120, 'FINAL RESULTS', {
            fontSize: '48px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ffeb00'
        }).setOrigin(0.5);
        
        // Determine winner
        const winner = modeManager.getFinalWinner();
        let winnerText = 'IT\'S A TIE!';
        let winnerColor = '#ffffff';
        
        if (winner === 'p1') {
            winnerText = 'PLAYER 1 WINS!';
            winnerColor = '#00e5ff';
        } else if (winner === 'p2') {
            winnerText = 'PLAYER 2 WINS!';
            winnerColor = '#ff3d71';
        }
        
        // Winner text with animation
        const winText = this.add.text(400, 230, winnerText, {
            fontSize: '56px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: winnerColor,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: winText,
            scale: 1.1,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Final scores
        this.add.text(400, 340, `P1: ${this.globalScores.p1}`, {
            fontSize: '36px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#00e5ff'
        }).setOrigin(0.5);
        
        this.add.text(400, 390, `P2: ${this.globalScores.p2}`, {
            fontSize: '36px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#ff3d71'
        }).setOrigin(0.5);
        
        // Restart prompt
        this.add.text(400, 520, 'PRESS R TO RESTART', {
            fontSize: '24px',
            fontFamily: 'Share Tech Mono, Courier New, monospace',
            color: '#00ffcc'
        }).setOrigin(0.5);
        
        // R key to restart
        this.input.keyboard.on('keydown-R', () => {
            modeManager.reset();
            this.scene.start('MenuScene');
        });
    }

    createPulseEffect() {
        this.pulseRings = [];
        for (let i = 0; i < 3; i++) {
            const ring = this.add.graphics();
            this.pulseRings.push({ graphic: ring, phase: i / 3 });
        }
        
        this.startTime = this.time.now;
    }

    update(time) {
        const phase = ((time - this.startTime) % 2000) / 2000;
        
        for (let i = 0; i < this.pulseRings.length; i++) {
            const ring = this.pulseRings[i];
            const ringPhase = (phase + ring.phase) % 1;
            const radius = ringPhase * 300;
            const alpha = Math.max(0, 1 - ringPhase) * 0.2;
            
            ring.graphic.clear();
            ring.graphic.lineStyle(2, 0xffeb00, alpha);
            ring.graphic.strokeCircle(400, 300, radius);
        }
    }
}

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#050510',
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [
        BootScene,
        MenuScene,
        ModeIntroScene,
        GameScene,
        ResultScene,
        FinalScene
    ]
};

// Start the game
const game = new Phaser.Game(config);
