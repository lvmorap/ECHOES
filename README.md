# ECHOES

**A game where you win by PREDICTING and SYNCHRONIZING with your rival — not by defeating them.**

## 🎮 Concept

In most sports and games, the goal is to dominate your opponent. In **Echoes**, the goal is to **read, anticipate, and resonate with patterns** to score points.

- The more unpredictable you are, the fewer points you get
- The more you synchronize with the game's rhythm, the higher you score
- Disrupting your rival's rhythm while maintaining your own is the key to victory

## 🎯 Theme: Reinventing Competition

Echoes takes "Reinventing Competition" as its core mechanical driver, not just decoration:

- **Traditional sports**: Hit the ball past your opponent → Win
- **Echoes**: Sync with the field's pulse + maintain rhythm + disrupt opponent → Win

The player who "wins" tactically (blocking, occupying zones) can **lose** the match if they lose their own rhythm in the process. Competition becomes internal as much as external.

## 🕹️ Controls

| Action | Player 1 | Player 2 |
|--------|----------|----------|
| Move (8 directions) | `W A S D` | `↑ ↓ ← →` |
| Resonate (Action) | `F` | `Shift` |
| Rhythmic Dash | `G` | `Enter` |

### Action Mechanics

- **Resonate**: Press at the exact moment the field pulse reaches you to score
  - Perfect timing (±50ms): +3 points + visual effects
  - Good timing (±150ms): +1 point
  - Miss: Echo Meter penalty
  
- **Rhythmic Dash**: Quick boost in movement direction
  - On beat: +20% Echo Meter
  - Off beat: -10% Echo Meter penalty

## 📊 The Echo Meter System

Each player has an **Echo Meter** (0-100%) displayed as a circular ring around their character:

- **Rises** when you move in regular, rhythmic patterns
- **Falls** when you move erratically or spam actions
- Must be above 50% to score points
- Visual indicator: Red (empty) → Green (full)

## 🎲 Game Modes (90 seconds each)

### 1. PULSE DUEL
*"The field pulses. Whoever resonates more, wins."*

- Central hexagonal scoring zone that rotates and changes size
- Score only in the zone, on the beat
- Push your rival out while they try to resonate

### 2. ECHO CHASE  
*"The target is yourself."*

- No fixed zone - the scoring point follows the player with the highest Echo Meter
- Pulse carrier earns +1 point every 2 seconds automatically
- Carrier moves 15% slower
- Steal the pulse by hitting the carrier on the exact beat

### 3. DISSONANCE
*"Sometimes, breaking rhythm is the strategy."*

- Rules **invert at 45 seconds** (visual cue: waves change from blue to purple)
- Phase 1: Normal resonance rules
- Phase 2: **Miss** timing scores points instead of perfect timing
- The player who notices the change first gains a huge advantage

## 🏗️ Architecture

```
ECHOES/
├── index.html      ← Entry point, loads Phaser via CDN
├── style.css       ← CSS reset + color palette + fonts
├── main.js         ← Complete game logic
└── README.md       ← This file
```

### Class Structure

```
EchoGame (Phaser.Game)
├── Scenes
│   ├── BootScene       → Initial setup
│   ├── MenuScene       → Title screen with animated pulse
│   ├── ModeIntroScene  → 7-second countdown before each mode
│   ├── GameScene       → Active gameplay
│   ├── ResultScene     → Mode winner display
│   └── FinalScene      → Overall winner + restart
├── Core Systems
│   ├── PulseField      → Concentric wave animation + beat detection
│   ├── Player          → Dodecagon sprite + physics + Echo Meter
│   ├── ScoringSystem   → Point calculation + tracking
│   ├── UIManager       → HUD rendering + floating text
│   └── AudioSynth      → Web Audio API sound effects
└── Game Modes
    ├── GameMode        → Base class
    ├── PulseDuelMode   → Hexagon zone mode
    ├── EchoChaseMode   → Dynamic carrier mode
    ├── DissonanceMode  → Rule-inverting mode
    └── GameModeManager → Mode sequencing
```

### Scene Flow

```
BootScene
  └→ MenuScene (animated pulse, PRESS ANY KEY)
       └→ ModeIntroScene (7s countdown)
            └→ GameScene (90s gameplay)
                 └→ ResultScene (mode winner)
                      └→ ModeIntroScene (next mode)
                           └→ ... (repeat for 3 modes)
                                └→ FinalScene (overall winner, PRESS R)
```

## 🚀 Running the Game

### Option 1: Direct File
Simply open `index.html` in a modern web browser (Chrome, Firefox, Edge, Safari).

### Option 2: Local Server (recommended for development)
```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# Then open http://localhost:8000
```

### Option 3: GitHub Pages
1. Push to a GitHub repository
2. Go to Settings → Pages
3. Select branch and root folder
4. Your game is live at `https://username.github.io/repository-name`

## 🎨 Visual Design

### Color Palette
| Variable | Color | Usage |
|----------|-------|-------|
| `--bg` | `#050510` | Deep blue-black background |
| `--pulse-1` | `#1a1aff` | Base wave color |
| `--pulse-2` | `#00ffcc` | Resonance wave / accents |
| `--dissonance` | `#9b00ff` | Dissonance mode waves |
| `--p1-color` | `#00e5ff` | Player 1 (cyan) |
| `--p2-color` | `#ff3d71` | Player 2 (coral) |
| `--accent` | `#ffeb00` | Points, critical UI |
| `--echo-full` | `#00ff88` | Full Echo Meter |
| `--echo-empty` | `#ff2222` | Empty Echo Meter |

### Players
- 12-sided polygons (dodecagons)
- Neon border with semi-transparent fill
- Circular Echo Ring showing meter percentage
- Carrier indicator (yellow ring) in Echo Chase mode

## 🛠️ Technical Requirements

- HTML5 + CSS3 + JavaScript ES6+
- Phaser 3.60+ (loaded via CDN)
- No build tools required
- No server-side code
- Works with `file://` protocol
- Compatible with all modern browsers

## 📋 Quality Checklist

- [x] Opens without errors in modern browsers
- [x] Both players move with their controls correctly
- [x] Field pulse is visible and rhythmic (2-second period)
- [x] Echo Meters visible for both players
- [x] Resonance action responds to beat timing
- [x] Scoring works correctly and is always visible
- [x] 3 modes sequence with 7-second intros
- [x] Final screen shows overall winner
- [x] Visual effects on resonance (shake, wave, floating text)
- [x] Monospace font loaded and applied
- [x] Colors match defined palette
- [x] Menu has animated pulse waves
- [x] Dash has visual feedback

## 🔮 Roadmap

- [ ] Online multiplayer
- [ ] Additional game modes
- [ ] Generative soundtrack
- [ ] Spectator mode
- [ ] Mobile touch controls
- [ ] Accessibility options
- [ ] Leaderboards

## 📜 License

Created for Game Jam - "Reinventing Competition" theme.

---

*Synchronize. Disrupt. Resonate.*