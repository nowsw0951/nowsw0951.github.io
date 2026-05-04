(function () {
  const canvas = document.getElementById("cat-defence-board");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const overlay = document.querySelector("[data-cat-overlay]");
  const roster = document.querySelector("[data-cat-roster]");
  const stats = {
    score: document.querySelector("[data-cat-stat='score']"),
    fish: document.querySelector("[data-cat-stat='fish']"),
    xp: document.querySelector("[data-cat-stat='xp']"),
    best: document.querySelector("[data-cat-stat='best']"),
  };

  const cats = [
    { id: "fighter", name: "Fighter", short: "F", color: "#e85d46", hp: 126, atk: 20, def: 4, range: 50, speed: 23 },
    { id: "defender", name: "Defender", short: "D", color: "#4f9fbd", hp: 250, atk: 9, def: 12, range: 42, speed: 15 },
    { id: "sniper", name: "Sniper", short: "S", color: "#40a56b", hp: 86, atk: 24, def: 2, range: 235, speed: 16 },
    { id: "berserker", name: "Berserker", short: "B", color: "#d77a28", hp: 96, atk: 32, def: 1, range: 48, speed: 29 },
    { id: "healer", name: "Healer", short: "H", color: "#7c6ee6", hp: 135, atk: 3, def: 2, range: 150, speed: 17, heal: 20 },
  ];

  const roleHints = {
    fighter: "Strong vs S / weak vs D",
    defender: "Strong vs F / weak vs S",
    sniper: "Strong vs D / weak vs F",
    berserker: "High damage / fragile",
    healer: "Cross-lane healing",
  };

  const advantageMap = {
    fighter: "sniper",
    defender: "fighter",
    sniper: "defender",
  };

  const arrowSprite = [1294, 892, 92, 68];

  const spriteMap = {
    fighter: {
      friendly: [[30, 300, 120, 128], [206, 300, 120, 128], [390, 307, 140, 121]],
      enemy: [[610, 300, 118, 128], [760, 300, 118, 128], [908, 310, 112, 118]],
    },
    defender: {
      friendly: [[48, 438, 126, 130], [204, 438, 126, 130], [368, 441, 134, 127]],
      enemy: [[608, 438, 128, 130], [758, 438, 128, 130], [906, 442, 144, 126]],
    },
    sniper: {
      friendly: [[58, 570, 132, 122], [212, 570, 132, 122], [366, 576, 134, 113]],
      enemy: [[612, 570, 136, 122], [760, 570, 136, 122], [910, 580, 103, 109]],
    },
    berserker: {
      friendly: [[44, 690, 130, 128], [202, 690, 130, 128], [358, 690, 160, 123]],
      enemy: [[610, 690, 130, 128], [760, 690, 130, 128], [902, 690, 155, 123]],
    },
    healer: {
      friendly: [[58, 812, 124, 128], [212, 812, 124, 128], [366, 817, 166, 123]],
      enemy: [[612, 812, 124, 128], [764, 812, 124, 128], [908, 816, 149, 124]],
    },
  };

  const boardImage = new Image();
  boardImage.src = "assets/cat-defence-board-bg.png";
  const spriteSheet = new Image();
  spriteSheet.src = "assets/cat-defence-sprites.png";
  const unitFrames = {};
  cats.forEach((cat) => {
    unitFrames[cat.id] = {};
    ["friendly", "enemy"].forEach((team) => {
      unitFrames[cat.id][team] = [0, 1, 2].map((frame) => {
        const image = new Image();
        image.src = "assets/cat-defence-frames/" + cat.id + "-" + team + "-" + frame + ".png";
        image.addEventListener("load", draw);
        return image;
      });
    });
  });
  const bossFrames = [0, 1, 2].map((frame) => {
    const image = new Image();
    image.src = "assets/cat-defence-boss-frames/boss-enemy-" + frame + ".png";
    image.addEventListener("load", draw);
    return image;
  });

  const saveKey = "nowsw_cat_defence_v1";
  const stored = readSave();
  const state = {
    running: false,
    paused: false,
    gameOver: false,
    selected: "fighter",
    score: 0,
    xp: stored.xp || 0,
    best: stored.best || 0,
    runHadBest: false,
    bestCelebrated: false,
    fish: 20,
    units: [],
    projectiles: [],
    effects: [],
    particles: [],
    pointer: null,
    catCooldowns: {},
    spawnTimer: 1.9,
    spawnRate: 3.4,
    speed: 1,
    enemyTier: 1,
    nextBossScore: 260,
    time: 0,
    levels: Object.assign({ fighter: 1, defender: 1, sniper: 1, berserker: 1, healer: 1 }, stored.levels),
  };

  const board = {
    w: 960,
    h: 420,
    rows: 5,
    top: 64,
    laneH: 58,
    friendlyCols: 2,
    colW: 68,
    cellSize: 46,
  };

  let lastTick = 0;
  let rosterSignature = "";

  function readSave() {
    try {
      return JSON.parse(localStorage.getItem(saveKey)) || {};
    } catch (e) {
      return {};
    }
  }

  function writeSave() {
    try {
      localStorage.setItem(saveKey, JSON.stringify({
        best: state.best,
        xp: state.xp,
        levels: state.levels,
      }));
    } catch (e) {}
  }

  function resetRun(keepProgress) {
    state.running = false;
    state.paused = false;
    state.gameOver = false;
    state.score = 0;
    state.runHadBest = false;
    state.bestCelebrated = false;
    state.fish = 20;
    state.units = [];
    state.projectiles = [];
    state.effects = [];
    state.particles = [];
    state.catCooldowns = {};
    state.spawnTimer = 1.9;
    state.spawnRate = 3.4;
    state.time = 0;
    state.enemyTier = 1;
    state.nextBossScore = 260;
    if (!keepProgress) {
      state.xp = 0;
      state.best = 0;
      cats.forEach((cat) => state.levels[cat.id] = 1);
      writeSave();
    }
    hideOverlay(false);
    updateUi();
    draw();
  }

  function resetProgress() {
    resetRun(true);
    state.xp = 0;
    cats.forEach((cat) => state.levels[cat.id] = 1);
    writeSave();
    updateUi();
    draw();
    if (overlay) {
      overlay.innerHTML = "<strong>Fresh levels.</strong><span>Cat levels and EXP were reset. Your best score stays saved.</span>";
    }
  }

  function startGame() {
    if (state.gameOver) resetRun(true);
    state.running = true;
    state.paused = false;
    hideOverlay(true);
    updateUi();
    lastTick = performance.now();
  }

  function togglePause() {
    if (!state.running || state.gameOver) return;
    state.paused = !state.paused;
    hideOverlay(!state.paused);
    if (state.paused && overlay) {
      overlay.innerHTML = "<strong>Paused.</strong><span>Press Start or Pause to continue.</span>";
    }
    updateUi();
  }

  function toggleSpeed() {
    state.speed = state.speed === 1 ? 2 : 1;
    state.effects.push({ x: board.w - 145, y: 76, text: state.speed + "x speed", life: 0.65, color: "#3a7ce9" });
    updateUi();
  }

  function getCat(id) {
    return cats.find((cat) => cat.id === id);
  }

  function levelCost(id) {
    const level = state.levels[id];
    return Math.round(80 + level * level * 55 + level * 15);
  }

  function upgradedLevels() {
    const totalLevels = cats.reduce((sum, cat) => sum + state.levels[cat.id], 0);
    return Math.max(0, totalLevels - cats.length);
  }

  function friendlyCap() {
    return Math.min(18, 7 + Math.floor(upgradedLevels() / 2));
  }

  function friendlyCount() {
    return state.units.filter((unit) => unit.team === "friendly").length;
  }

  function deployCooldown(id) {
    const base = { fighter: 2.8, defender: 4.0, sniper: 4.5, berserker: 3.4, healer: 5.0 }[id] || 3.5;
    return Math.max(1.0, base - (state.levels[id] - 1) * 0.28);
  }

  function cooldownLeft(id) {
    return Math.max(0, state.catCooldowns[id] || 0);
  }

  function upgrade(id) {
    const cost = levelCost(id);
    if (state.xp < cost) return;
    state.xp -= cost;
    state.levels[id] += 1;
    state.effects.push({ x: 70, y: 42, text: getCat(id).name + " Lv" + state.levels[id], life: 0.9, color: getCat(id).color });
    writeSave();
    updateUi();
  }

  function unitStats(type, team, level) {
    const base = getCat(type);
    const scale = 1 + (level - 1) * 0.16;
    const enemyHpBoost = team === "enemy" ? Math.min(1.08, 0.56 + (level - 1) * 0.12) : 1;
    const enemyAtkBoost = team === "enemy" ? Math.min(1.05, 0.56 + (level - 1) * 0.11) : 1;
    const enemyDefBoost = team === "enemy" ? Math.min(1, 0.55 + (level - 1) * 0.12) : 1;
    return {
      hp: Math.round(base.hp * scale * enemyHpBoost),
      atk: Math.round(base.atk * scale * enemyAtkBoost),
      def: Math.round((base.def + (level - 1) * 1.3) * enemyDefBoost),
      range: base.range,
      speed: base.speed * (team === "enemy" ? Math.min(0.92, 0.78 + (level - 1) * 0.04) : 1),
      heal: base.heal ? Math.round(base.heal * scale) : 0,
    };
  }

  function addUnit(type, team, row, x) {
    const level = team === "friendly" ? state.levels[type] : enemyLevel();
    const s = unitStats(type, team, level);
    const unit = {
      id: Math.random().toString(36).slice(2),
      type,
      team,
      row,
      x,
      y: rowY(row),
      hp: s.hp,
      maxHp: s.hp,
      atk: s.atk,
      def: s.def,
      range: s.range,
      speed: s.speed,
      heal: s.heal,
      level,
      cooldown: Math.random() * 0.4,
      action: "walk",
      actionTime: 0,
      focusTime: 0,
      healPressure: 0,
      phase: Math.random() * Math.PI * 2,
    };
    state.units.push(unit);
    return unit;
  }

  function enemyLevel() {
    return Math.max(1, state.enemyTier + Math.floor(upgradedLevels() / 7));
  }

  function rowY(row) {
    return board.top + row * board.laneH + board.laneH * 0.54;
  }

  function placeFriendly(clientX, clientY) {
    if (!state.running || state.paused || state.gameOver) return;
    const cell = placementCell(clientX, clientY);
    if (!cell || !cell.canPlace) {
      if (cell) state.effects.push({ x: cell.x, y: cell.y - 28, text: "Blocked", life: 0.45, color: "#e64032" });
      return;
    }
    if (friendlyCount() >= friendlyCap()) {
      state.effects.push({ x: cell.x, y: cell.y - 28, text: "Cat limit", life: 0.55, color: "#e64032" });
      return;
    }
    if (cooldownLeft(state.selected) > 0) {
      state.effects.push({ x: cell.x, y: cell.y - 28, text: cooldownLeft(state.selected).toFixed(1) + "s", life: 0.45, color: "#e64032" });
      return;
    }
    addUnit(state.selected, "friendly", cell.row, cell.x);
    state.catCooldowns[state.selected] = deployCooldown(state.selected);
    state.effects.push({ x: cell.x, y: cell.y - 28, text: getCat(state.selected).name, life: 0.5, color: getCat(state.selected).color });
    updateUi();
  }

  function boardPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (board.w / rect.width),
      y: (clientY - rect.top) * (board.h / rect.height),
    };
  }

  function placementCell(clientX, clientY) {
    const point = boardPoint(clientX, clientY);
    const row = Math.floor((point.y - board.top) / board.laneH);
    const col = Math.floor((point.x - 20) / board.colW);
    if (row < 0 || row >= board.rows || col < 0 || col >= board.friendlyCols) return null;
    const x = 54 + col * board.colW;
    const y = rowY(row);
    const hasUnit = state.units.some((unit) => unit.team === "friendly" && unit.row === row && Math.abs(unit.x - x) < 28);
    return { row, col, x, y, canPlace: !hasUnit && friendlyCount() < friendlyCap() && cooldownLeft(state.selected) <= 0 };
  }

  function spawnEnemy() {
    if (shouldSpawnBoss()) {
      spawnBoss();
      return;
    }
    const type = chooseEnemyType();
    const row = chooseSpawnRow();
    addUnit(type, "enemy", row, board.w - 88);
    state.effects.push({ x: board.w - 76, y: rowY(row) - 24, text: "!", life: 0.55, color: "#e64032" });
  }

  function shouldSpawnBoss() {
    return state.score >= state.nextBossScore && !state.units.some((unit) => unit.boss);
  }

  function spawnBoss() {
    const bossTypes = ["fighter", "defender", "berserker", "sniper"];
    const type = bossTypes[Math.floor(Math.random() * bossTypes.length)];
    const row = chooseBossRow();
    const boss = addUnit(type, "enemy", row, board.w - 92);
    boss.boss = true;
    boss.hp = Math.round(boss.hp * (2.8 + enemyLevel() * 0.28));
    boss.maxHp = boss.hp;
    boss.atk = Math.round(boss.atk * 1.35);
    boss.def = Math.round(boss.def * 1.25 + 2);
    boss.speed *= 0.72;
    boss.range += 8;
    boss.cooldown = 0.25;
    state.effects.push({ x: boss.x - 42, y: boss.y - 48, text: "Boss!", life: 1.1, color: "#ffc107" });
  }

  function chooseBossRow() {
    const rowPressure = Array.from({ length: board.rows }, (_, row) => {
      return state.units.reduce((sum, unit) => sum + (unit.team === "friendly" && unit.row === row ? 1 : 0), 0);
    });
    const maxPressure = Math.max.apply(null, rowPressure);
    const rows = rowPressure
      .map((count, row) => ({ count, row }))
      .filter((item) => item.count >= maxPressure - 1)
      .map((item) => item.row);
    return rows[Math.floor(Math.random() * rows.length)];
  }

  function chooseEnemyType() {
    const level = enemyLevel();
    const weights = level <= 1
      ? { fighter: 4, defender: 1, sniper: 3, berserker: 3, healer: 1 }
      : level === 2
        ? { fighter: 4, defender: 2, sniper: 3, berserker: 3, healer: 2 }
        : { fighter: 3, defender: 3, sniper: 3, berserker: 3, healer: 3 };
    const bag = [];
    cats.forEach((cat) => {
      for (let i = 0; i < weights[cat.id]; i += 1) bag.push(cat.id);
    });
    return bag[Math.floor(Math.random() * bag.length)];
  }

  function chooseSpawnRow() {
    const rowPressure = Array.from({ length: board.rows }, (_, row) => {
      return state.units.reduce((sum, unit) => sum + (unit.team === "enemy" && unit.row === row ? 1 : 0), 0);
    });
    const minPressure = Math.min.apply(null, rowPressure);
    const bestRows = rowPressure
      .map((count, row) => ({ count, row }))
      .filter((item) => item.count <= minPressure + 1)
      .map((item) => item.row);
    return bestRows[Math.floor(Math.random() * bestRows.length)];
  }

  function nearestEnemy(unit) {
    let best = null;
    let bestDistance = Infinity;
    state.units.forEach((other) => {
      if (other.team === unit.team || other.row !== unit.row) return;
      const distance = unit.team === "friendly" ? other.x - unit.x : unit.x - other.x;
      if (distance >= 0 && distance < bestDistance && distance <= unit.range) {
        best = other;
        bestDistance = distance;
      }
    });
    return best;
  }

  function healTarget(unit) {
    let best = null;
    let lowest = Infinity;
    state.units.forEach((other) => {
      if (other.team !== unit.team || other.id === unit.id) return;
      const distance = Math.abs(other.x - unit.x);
      const rowDistance = Math.abs(other.row - unit.row);
      const crossLaneReach = rowDistance <= 1 && distance <= unit.range * 0.78;
      const sameLaneReach = other.row === unit.row && distance <= unit.range;
      if ((sameLaneReach || crossLaneReach) && other.hp < other.maxHp && other.hp / other.maxHp < lowest) {
        best = other;
        lowest = other.hp / other.maxHp;
      }
    });
    return best;
  }

  function attack(attacker, target) {
    const multiplier = matchupMultiplier(attacker.type, target.type);
    const focusBonus = 1 + Math.min(0.95, attacker.focusTime * 0.055);
    const timeBonus = 1 + Math.min(0.35, Math.max(0, state.time - 75) * 0.004);
    const rawDamage = Math.round(attacker.atk * multiplier * focusBonus * timeBonus);
    const effectiveDef = Math.max(0, target.def * Math.max(0.35, 1 - attacker.focusTime * 0.025));
    const damage = Math.max(3, Math.round(rawDamage - effectiveDef));
    target.hp -= damage;
    attacker.cooldown = attacker.type === "sniper" ? 1.15 : 0.82;
    attacker.action = "attack";
    attacker.actionTime = 0.28;
    state.effects.push({ x: target.x, y: target.y - 28, text: (multiplier > 1.1 ? "Good " : "") + "-" + damage, life: 0.55, color: attacker.team === "friendly" ? "#2f6fe0" : "#e64032" });
    if (attacker.type !== "sniper") {
      state.effects.push({ x: target.x, y: target.y - 38, arc: true, life: 0.24, color: attacker.team === "friendly" ? "#ffc107" : "#e64032" });
    }
    if (attacker.type === "sniper") {
      state.projectiles.push({
        x: attacker.x,
        y: attacker.y - 26,
        tx: target.x,
        ty: target.y - 24,
        life: 0.28,
        maxLife: 0.28,
        color: attacker.team === "friendly" ? "#3a7ce9" : "#e64032",
        kind: "arrow",
      });
    }
  }

  function matchupMultiplier(attackerType, targetType) {
    let value = 1;
    if (advantageMap[attackerType] === targetType) value *= 1.45;
    if (advantageMap[targetType] === attackerType) value *= 0.68;
    if (attackerType === "berserker") value *= 1.25;
    if (targetType === "berserker") value *= 1.22;
    if (attackerType === "healer") value *= 0.58;
    return value;
  }

  function heal(healer, target) {
    const fatigue = Math.max(0.45, 1 - target.healPressure * 0.18);
    const amount = Math.max(4, Math.round(healer.heal * fatigue));
    target.hp = Math.min(target.maxHp, target.hp + amount);
    target.healPressure = Math.min(4, target.healPressure + 1);
    healer.cooldown = 1.05;
    healer.action = "attack";
    healer.actionTime = 0.32;
    state.effects.push({ x: target.x, y: target.y - 36, text: "+" + amount, life: 0.65, color: "#26a5a4" });
    state.effects.push({ x: target.x, y: target.y - 20, ring: true, life: 0.5, color: "#26a5a4" });
  }

  function tick(dt) {
    if (!state.running || state.paused || state.gameOver) return;
    state.time += dt;
    state.spawnTimer -= dt;
    cats.forEach((cat) => {
      state.catCooldowns[cat.id] = Math.max(0, cooldownLeft(cat.id) - dt);
    });
    const enemyCount = state.units.filter((unit) => unit.team === "enemy").length;
    const pressureDelay = Math.max(0, enemyCount - 10) * 0.18;
    const enemyLimit = Math.min(18, 10 + Math.floor(state.score / 260) + upgradedLevels());
    state.spawnRate = Math.max(1.45, 3.4 - state.score / 1300) + pressureDelay;
    if (state.spawnTimer <= 0) {
      if (enemyCount < enemyLimit) spawnEnemy();
      state.spawnTimer = state.spawnRate + Math.random() * 0.9;
    }

    state.units.forEach((unit) => {
      unit.cooldown = Math.max(0, unit.cooldown - dt);
      unit.actionTime = Math.max(0, unit.actionTime - dt);
      unit.healPressure = Math.max(0, unit.healPressure - dt * 0.55);
      if (unit.actionTime <= 0) unit.action = "walk";
      unit.phase += dt * 7;
      const target = nearestEnemy(unit);
      const friend = unit.type === "healer" ? healTarget(unit) : null;
      if (target) {
        unit.focusTime = Math.min(18, unit.focusTime + dt);
      } else {
        unit.focusTime = Math.max(0, unit.focusTime - dt * 2);
      }
      if (friend && unit.cooldown <= 0) {
        heal(unit, friend);
        return;
      }
      if (target && unit.cooldown <= 0) {
        attack(unit, target);
        return;
      }
      if (unit.team === "friendly" && shouldHoldBack(unit)) {
        unit.action = friend ? "walk" : "idle";
        return;
      }
      if (!target) {
        unit.action = "walk";
        unit.x += (unit.team === "friendly" ? 1 : -1) * unit.speed * dt;
      } else if (unit.cooldown > 0) {
        unit.action = "idle";
      }
    });
    applyLaneSpacing();

    state.units = state.units.filter((unit) => {
      if (unit.hp <= 0) {
        let koText = "KO";
        let koLife = 0.55;
        let koColor = "#111827";
        if (unit.team === "enemy") {
          const bossBonus = unit.boss ? 95 + unit.level * 35 : 0;
          const gain = 18 + unit.level * 5 + bossBonus;
          state.score += 14 + unit.level * 8 + (unit.boss ? 85 + unit.level * 22 : 0);
          state.xp += gain;
          if (unit.boss) advanceEnemyTier(unit);
          updateBest(unit.x, unit.y - 42);
          writeSave();
          if (unit.boss) {
            koText = "Boss KO +" + gain + "XP";
            koLife = 1;
            koColor = "#ffc107";
          }
        }
        state.effects.push({ x: unit.x, y: unit.y - 22, text: koText, life: koLife, color: koColor });
        return false;
      }
      if (unit.team === "enemy" && unit.x < 12) {
        state.fish -= 1;
        state.effects.push({ x: 58, y: unit.y - 22, text: "Fish -1", life: 0.7, color: "#e64032" });
        if (state.fish <= 0) endGame();
        return false;
      }
      if (unit.team === "friendly" && unit.x > board.w - 54) {
        awardBreakthrough(unit);
        return false;
      }
      return true;
    });

    state.projectiles.forEach((p) => p.life -= dt);
    state.projectiles = state.projectiles.filter((p) => p.life > 0);
    state.effects.forEach((effect) => effect.life -= dt);
    state.effects = state.effects.filter((effect) => effect.life > 0);
    state.particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 95 * dt;
      particle.spin += particle.rot * dt;
    });
    state.particles = state.particles.filter((particle) => particle.life > 0);
    updateUi();
  }

  function updateBest(x, y) {
    if (state.score <= state.best) return false;
    state.best = state.score;
    state.runHadBest = true;
    if (state.bestCelebrated) {
      state.effects.push({ x: x || board.w / 2, y: y || board.h / 2, text: "Best!", life: 0.75, color: "#ffc107" });
      return true;
    }
    state.bestCelebrated = true;
    triggerBestCelebration(x || board.w / 2, y || board.h / 2);
    return true;
  }

  function triggerBestCelebration(x, y) {
    state.effects.push({ x: board.w / 2, y: 92, banner: true, text: "New Best!", subtext: state.score + " points", life: 2.1, maxLife: 2.1, color: "#ffc107" });
    state.effects.push({ x, y, text: "Best!", life: 1, maxLife: 1, color: "#ffc107" });
    const colors = ["#ffc107", "#3a7ce9", "#26a5a4", "#e85d46", "#7c6ee6", "#fff7d6"];
    for (let i = 0; i < 72; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 210;
      state.particles.push({
        x: board.w / 2 + (Math.random() - 0.5) * 180,
        y: 86 + (Math.random() - 0.5) * 34,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        size: 4 + Math.random() * 6,
        life: 1.25 + Math.random() * 0.85,
        maxLife: 2.1,
        color: colors[Math.floor(Math.random() * colors.length)],
        spin: Math.random() * Math.PI,
        rot: -7 + Math.random() * 14,
      });
    }
  }

  function advanceEnemyTier(unit) {
    state.enemyTier += 1;
    state.nextBossScore = state.score + 340 + state.enemyTier * 190;
    state.effects.push({ x: unit.x - 12, y: unit.y - 62, text: "Enemy Lv " + enemyLevel(), life: 1.05, color: "#e64032" });
  }

  function awardBreakthrough(unit) {
    const xpGain = 42 + unit.level * 14;
    const scoreGain = 28 + unit.level * 12;
    state.xp += xpGain;
    state.score += scoreGain;
    updateBest(board.w - 112, unit.y - 52);
    writeSave();
    state.effects.push({ x: board.w - 104, y: unit.y - 34, text: "Raid +" + xpGain + "XP", life: 0.9, color: "#ffc107" });
  }

  function shouldHoldBack(unit) {
    const holdX = { sniper: 238, healer: 188 }[unit.type];
    if (!holdX) return false;
    const closeThreat = state.units.some((other) => other.team === "enemy" && other.row === unit.row && other.x - unit.x > 0 && other.x - unit.x < 95);
    if (closeThreat) return false;
    return unit.x >= holdX;
  }

  function applyLaneSpacing() {
    const gap = 44;
    for (let row = 0; row < board.rows; row += 1) {
      const friendlies = state.units
        .filter((unit) => unit.team === "friendly" && unit.row === row)
        .sort((a, b) => b.x - a.x);
      for (let i = 1; i < friendlies.length; i += 1) {
        const front = friendlies[i - 1];
        const unit = friendlies[i];
        if (unit.type === "berserker") continue;
        if (unit.x > front.x - gap) unit.x = Math.max(32, front.x - gap);
      }

      const enemies = state.units
        .filter((unit) => unit.team === "enemy" && unit.row === row)
        .sort((a, b) => a.x - b.x);
      for (let i = 1; i < enemies.length; i += 1) {
        const front = enemies[i - 1];
        const unit = enemies[i];
        if (unit.type === "berserker") continue;
        if (unit.x < front.x + gap) unit.x = Math.min(board.w - 58, front.x + gap);
      }
    }
  }

  function endGame() {
    state.gameOver = true;
    state.running = false;
    updateBest(board.w / 2, 92);
    writeSave();
    if (overlay) {
      overlay.innerHTML = state.runHadBest
        ? "<strong>New best score!</strong><span>Your score was " + state.score + ". Press Start to defend the fish again.</span>"
        : "<strong>Game over.</strong><span>Your score was " + state.score + ". Press Start to try again with saved cat levels.</span>";
    }
    hideOverlay(false);
  }

  function draw() {
    ctx.clearRect(0, 0, board.w, board.h);
    drawBoard();
    state.units
      .slice()
      .sort((a, b) => a.y - b.y)
      .forEach(drawUnit);
    drawProjectiles();
    drawParticles();
    drawEffects();
  }

  function drawBoard() {
    if (boardImage.complete && boardImage.naturalWidth) {
      ctx.drawImage(boardImage, 0, 0, board.w, board.h);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, board.h);
      gradient.addColorStop(0, "#bce9a8");
      gradient.addColorStop(1, "#eff8d7");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, board.w, board.h);
    }

    for (let row = 0; row < board.rows; row += 1) {
      const y = board.top + row * board.laneH;
      const danger = state.units.some((unit) => unit.team === "enemy" && unit.row === row && unit.x < 180);
      if (danger) {
        ctx.fillStyle = "rgba(230,64,50,.2)";
        roundRect(132, y + 3, board.w - 190, board.laneH - 6, 16);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(99,65,28,.16)";
      ctx.beginPath();
      ctx.moveTo(132, y);
      ctx.lineTo(board.w - 70, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(58,124,233,.14)";
    roundRect(20, board.top - 8, board.friendlyCols * board.colW, board.rows * board.laneH + 16, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(58,124,233,.42)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.save();
    for (let row = 0; row < board.rows; row += 1) {
      for (let col = 0; col < board.friendlyCols; col += 1) {
        const x = 31 + col * board.colW;
        const y = board.top + row * board.laneH + 6;
        ctx.fillStyle = "rgba(255,255,255,.13)";
        roundRect(x, y, board.cellSize, board.cellSize, 10);
        ctx.fill();
        ctx.strokeStyle = "rgba(58,124,233,.5)";
        ctx.lineWidth = 1.6;
        roundRect(x, y, board.cellSize, board.cellSize, 10);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,.26)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + board.cellSize / 2, y + 12);
        ctx.lineTo(x + board.cellSize / 2, y + board.cellSize - 12);
        ctx.moveTo(x + 12, y + board.cellSize / 2);
        ctx.lineTo(x + board.cellSize - 12, y + board.cellSize / 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.fillStyle = "#fff7da";
    roundRect(20, 18, 112, 36, 14);
    ctx.fill();
    ctx.fillStyle = "#2e74c6";
    ctx.font = "900 20px system-ui, sans-serif";
    ctx.fillText("Fish " + Math.max(0, state.fish), 36, 42);

    ctx.fillStyle = "rgba(255,247,218,.88)";
    roundRect(board.w - 184, 18, 138, 42, 14);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.font = "900 15px system-ui, sans-serif";
    ctx.fillText("Enemy Lv " + enemyLevel(), board.w - 164, 41);
    ctx.fillStyle = "#7c2d12";
    ctx.font = "900 10px system-ui, sans-serif";
    ctx.fillText(bossStatusText(), board.w - 164, 54);

    ctx.fillStyle = "rgba(255,247,218,.88)";
    roundRect(20, board.h - 50, 126, 32, 12);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.font = "900 14px system-ui, sans-serif";
    ctx.fillText("Cats " + friendlyCount() + "/" + friendlyCap(), 38, board.h - 29);

    drawPlacementPreview();
  }

  function drawPlacementPreview() {
    if (!state.running || state.paused || state.gameOver || !state.pointer) return;
    const cell = placementCell(state.pointer.clientX, state.pointer.clientY);
    if (!cell) return;
    const cat = getCat(state.selected);
    ctx.save();
    ctx.globalAlpha = cell.canPlace ? 0.22 : 0.2;
    ctx.fillStyle = cell.canPlace ? cat.color : "#e64032";
    roundRect(cell.x - board.cellSize / 2, board.top + cell.row * board.laneH + 6, board.cellSize, board.cellSize, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = cell.canPlace ? cat.color : "#e64032";
    ctx.lineWidth = 3;
    roundRect(cell.x - board.cellSize / 2, board.top + cell.row * board.laneH + 6, board.cellSize, board.cellSize, 10);
    ctx.stroke();
    ctx.fillStyle = cell.canPlace ? cat.color : "#e64032";
    ctx.font = "900 12px system-ui, sans-serif";
    const label = friendlyCount() >= friendlyCap() ? "Limit" : cooldownLeft(state.selected) > 0 ? cooldownLeft(state.selected).toFixed(1) + "s" : cell.canPlace ? cat.name : "Blocked";
    ctx.fillText(label, cell.x - 24, cell.y - 34);
    ctx.restore();
  }

  function bossStatusText() {
    if (state.units.some((unit) => unit.boss)) return "Boss incoming";
    return "Boss " + Math.max(0, state.nextBossScore - state.score);
  }

  function drawUnit(unit) {
    const bob = Math.sin(unit.phase) * 2.4;
    const sprite = selectSprite(unit);
    const unitScale = unit.boss ? 1.28 : 1;
    if (unit.boss) drawBossAura(unit, bob);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.ellipse(unit.x, unit.y + 11, 22 * unitScale, 7 * unitScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (sprite && sprite.complete && sprite.naturalWidth) {
      ctx.save();
      ctx.translate(unit.x, unit.y + bob);
      if (unit.action === "attack") ctx.translate(unit.team === "friendly" ? 4 : -4, -1);
      if (unit.team === "enemy") ctx.scale(-1, 1);
      ctx.drawImage(sprite, -35 * unitScale, -59 * unitScale, 70 * unitScale, 70 * unitScale);
      ctx.restore();
    } else {
      drawFallbackCat(unit, bob);
    }
    drawHealth(unit);
    if (unit.level > 1) {
      ctx.fillStyle = "rgba(17,24,39,.62)";
      ctx.font = "900 10px system-ui, sans-serif";
      ctx.fillText("Lv" + unit.level, unit.x - 10, unit.y + 20);
    }
    if (unit.boss) {
      ctx.fillStyle = "#ffc107";
      ctx.strokeStyle = "rgba(17,24,39,.55)";
      ctx.lineWidth = 3;
      ctx.font = "900 12px system-ui, sans-serif";
      ctx.strokeText("BOSS", unit.x - 17, unit.y - 76);
      ctx.fillText("BOSS", unit.x - 17, unit.y - 76);
      ctx.lineWidth = 1;
    }
  }

  function drawBossAura(unit, bob) {
    ctx.save();
    ctx.translate(unit.x, unit.y + bob - 28);
    ctx.globalAlpha = 0.28 + Math.sin(unit.phase) * 0.06;
    ctx.strokeStyle = "#ffc107";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 39, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#ffc107";
    ctx.beginPath();
    ctx.moveTo(-15, -42);
    ctx.lineTo(-6, -56);
    ctx.lineTo(0, -43);
    ctx.lineTo(8, -58);
    ctx.lineTo(16, -42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function selectSprite(unit) {
    const frames = spriteMap[unit.type] && spriteMap[unit.type][unit.team];
    if (unit.boss) {
      if (unit.action === "attack") return bossFrames[2] || bossFrames[0];
      if (unit.action === "walk") return bossFrames[Math.floor(unit.phase / 2) % 2] || bossFrames[0];
      return bossFrames[0];
    }
    const images = unitFrames[unit.type] && unitFrames[unit.type][unit.team];
    if (images) {
      if (unit.action === "attack") return images[2] || images[0];
      if (unit.action === "walk") return images[Math.floor(unit.phase / 2) % 2] || images[0];
      return images[0];
    }
    return frames ? frames[0] : null;
  }

  function drawFallbackCat(unit, bob) {
    const cat = getCat(unit.type);
    ctx.save();
    ctx.translate(unit.x, unit.y + bob);
    if (unit.team === "enemy") ctx.scale(-1, 1);
    ctx.fillStyle = unit.team === "friendly" ? cat.color : "#34323a";
    ctx.beginPath();
    ctx.ellipse(0, -24, 19, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -48, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f5c28e";
    ctx.beginPath();
    ctx.moveTo(-16, -62);
    ctx.lineTo(-8, -78);
    ctx.lineTo(0, -61);
    ctx.moveTo(16, -62);
    ctx.lineTo(8, -78);
    ctx.lineTo(0, -61);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.fillRect(-9, -52, 4, 4);
    ctx.fillRect(7, -52, 4, 4);
    ctx.fillStyle = "#fff";
    ctx.font = "900 14px system-ui, sans-serif";
    ctx.fillText(cat.short, -5, -19);
    ctx.restore();
  }

  function drawHealth(unit) {
    const pct = Math.max(0, unit.hp / unit.maxHp);
    const width = unit.boss ? 54 : 36;
    const height = unit.boss ? 7 : 5;
    const y = unit.boss ? unit.y - 78 : unit.y - 67;
    ctx.fillStyle = "rgba(17,24,39,.18)";
    roundRect(unit.x - width / 2, y, width, height, 3);
    ctx.fill();
    ctx.fillStyle = unit.boss ? "#ffc107" : unit.team === "friendly" ? "#26a5a4" : "#e64032";
    roundRect(unit.x - width / 2, y, width * pct, height, 3);
    ctx.fill();
  }

  function drawProjectiles() {
    state.projectiles.forEach((p) => {
      const maxLife = p.maxLife || 0.22;
      const t = Math.max(0, Math.min(1, 1 - p.life / maxLife));
      const currentX = p.x + (p.tx - p.x) * t;
      const currentY = p.y + (p.ty - p.y) * t;
      const angle = Math.atan2(p.ty - p.y, p.tx - p.x);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (p.kind === "arrow" && spriteSheet.complete && spriteSheet.naturalWidth) {
        ctx.save();
        ctx.translate(currentX, currentY);
        ctx.rotate(angle);
        ctx.drawImage(spriteSheet, arrowSprite[0], arrowSprite[1], arrowSprite[2], arrowSprite[3], -22, -12, 44, 24);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineWidth = 1;
    });
  }

  function drawEffects() {
    state.effects.forEach((effect) => {
      const maxLife = effect.maxLife || 0.6;
      const progress = Math.max(0, Math.min(1, 1 - effect.life / maxLife));
      const alpha = Math.max(0, Math.min(1, Math.min(effect.life / 0.42, progress / 0.12 || 1)));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = effect.color;
      ctx.strokeStyle = effect.color;
      if (effect.banner) {
        const lift = Math.sin(progress * Math.PI) * 8;
        ctx.translate(effect.x, effect.y - lift);
        ctx.shadowColor = "rgba(255, 193, 7, .45)";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "rgba(255, 247, 214, .96)";
        roundRect(-142, -30, 284, 62, 18);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ffc107";
        ctx.stroke();
        ctx.fillStyle = "#111827";
        ctx.textAlign = "center";
        ctx.font = "900 28px system-ui, sans-serif";
        ctx.fillText(effect.text, 0, -4);
        ctx.fillStyle = "#3a7ce9";
        ctx.font = "800 13px system-ui, sans-serif";
        ctx.fillText(effect.subtext || "", 0, 18);
        ctx.restore();
        return;
      }
      if (effect.arc) {
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 22 + (1 - alpha) * 10, -0.8, 0.9);
        ctx.stroke();
        ctx.restore();
        return;
      }
      if (effect.ring) {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 14 + (1 - alpha) * 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }
      ctx.font = "900 16px system-ui, sans-serif";
      ctx.fillText(effect.text, effect.x - 20, effect.y - (1 - alpha) * 22);
      ctx.restore();
    });
  }

  function drawParticles() {
    state.particles.forEach((particle) => {
      const maxLife = particle.maxLife || 1;
      const alpha = Math.max(0, Math.min(1, particle.life / maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.spin);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.58);
      ctx.restore();
    });
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function updateUi() {
    stats.score.textContent = state.score;
    stats.fish.textContent = Math.max(0, state.fish);
    stats.xp.textContent = state.xp;
    stats.best.textContent = state.best;
    document.querySelector("[data-cat-action='start']").textContent = state.running && !state.paused ? "Running" : "Start";
    document.querySelector("[data-cat-action='pause']").textContent = state.paused ? "Resume" : "Pause";
    document.querySelector("[data-cat-action='speed']").textContent = "Speed x" + state.speed;
    renderRoster();
  }

  function renderRoster() {
    if (!roster) return;
    const cooldownSignature = cats.map((cat) => cat.id + ":" + Math.ceil(cooldownLeft(cat.id) * 10)).join(",");
    const signature = state.selected + "|" + state.xp + "|" + friendlyCount() + "/" + friendlyCap() + "|" + cooldownSignature + "|" + cats.map((cat) => cat.id + ":" + state.levels[cat.id]).join(",");
    if (signature === rosterSignature) return;
    rosterSignature = signature;
    roster.innerHTML = cats.map((cat) => {
      const level = state.levels[cat.id];
      const cost = levelCost(cat.id);
      const selected = state.selected === cat.id ? " is-selected" : "";
      const disabled = state.xp < cost ? " disabled" : "";
      const ready = cooldownLeft(cat.id) <= 0;
      const wait = ready ? "Ready" : cooldownLeft(cat.id).toFixed(1) + "s";
      const cardClass = selected + (!ready ? " is-cooling" : "");
      return [
        "<div class=\"cat-card" + cardClass + "\">",
        "<button type=\"button\" data-cat-pick=\"" + cat.id + "\" aria-label=\"Select " + cat.name + "\">",
        "<span class=\"cat-card-icon\" style=\"background:" + cat.color + "\">" + cat.short + "</span>",
        "</button>",
        "<button class=\"cat-card-main\" type=\"button\" data-cat-pick=\"" + cat.id + "\">",
        "<span class=\"cat-card-name\">" + cat.name + " Lv" + level + "</span>",
        "<span class=\"cat-card-meta\">HP " + Math.round(unitStats(cat.id, "friendly", level).hp) + " / ATK " + Math.round(unitStats(cat.id, "friendly", level).atk) + " / " + wait + "</span>",
        "<span class=\"cat-card-role\">" + roleHints[cat.id] + "</span>",
        "</button>",
        "<button class=\"cat-card-upgrade\" type=\"button\" data-cat-upgrade=\"" + cat.id + "\"" + disabled + ">Lv +" + cost + "</button>",
        "</div>",
      ].join("");
    }).join("");
  }

  function hideOverlay(hidden) {
    if (!overlay) return;
    overlay.classList.toggle("is-hidden", hidden);
    if (!hidden && !state.gameOver && !state.paused) {
      overlay.innerHTML = "<strong>Protect the fish.</strong><span>Pick a cat below, place it in the two blue columns, and stop the cats coming from the right.</span>";
    }
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - lastTick) / 1000 || 0);
    lastTick = now;
    tick(dt * state.speed);
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointermove", (event) => {
    state.pointer = { clientX: event.clientX, clientY: event.clientY };
  });
  canvas.addEventListener("pointerleave", () => {
    state.pointer = null;
  });
  canvas.addEventListener("click", (event) => placeFriendly(event.clientX, event.clientY));
  document.addEventListener("click", (event) => {
    const pick = event.target.closest("[data-cat-pick]");
    const upgradeButton = event.target.closest("[data-cat-upgrade]");
    const action = event.target.closest("[data-cat-action]");
    if (pick) {
      state.selected = pick.getAttribute("data-cat-pick");
      updateUi();
    }
    if (upgradeButton) upgrade(upgradeButton.getAttribute("data-cat-upgrade"));
    if (action) {
      const value = action.getAttribute("data-cat-action");
      if (value === "start") startGame();
      if (value === "pause") togglePause();
      if (value === "speed") toggleSpeed();
      if (value === "restart") resetRun(true);
      if (value === "reset-progress" && window.confirm("Reset cat levels and EXP? Best score will stay saved.")) resetProgress();
    }
  });

  boardImage.addEventListener("load", draw);
  spriteSheet.addEventListener("load", draw);
  updateUi();
  draw();
  requestAnimationFrame(loop);
})();
