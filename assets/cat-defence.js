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
    { id: "fighter", name: "Fighter", short: "F", color: "#e85d46", hp: 120, atk: 18, def: 4, range: 48, speed: 25, cost: 0 },
    { id: "defender", name: "Defender", short: "D", color: "#4f9fbd", hp: 220, atk: 10, def: 10, range: 42, speed: 17, cost: 0 },
    { id: "sniper", name: "Sniper", short: "S", color: "#40a56b", hp: 82, atk: 22, def: 2, range: 210, speed: 18, cost: 0 },
    { id: "berserker", name: "Berserker", short: "B", color: "#d77a28", hp: 100, atk: 27, def: 1, range: 46, speed: 32, cost: 0 },
    { id: "healer", name: "Healer", short: "H", color: "#7c6ee6", hp: 70, atk: 5, def: 1, range: 120, speed: 20, cost: 0, heal: 17 },
  ];

  const spriteMap = {
    fighter: { friendly: [30, 300, 120, 128], enemy: [610, 300, 118, 128] },
    defender: { friendly: [52, 438, 126, 130], enemy: [610, 438, 128, 130] },
    sniper: { friendly: [60, 570, 132, 122], enemy: [616, 570, 136, 122] },
    berserker: { friendly: [42, 690, 130, 128], enemy: [610, 690, 130, 128] },
    healer: { friendly: [58, 812, 124, 128], enemy: [612, 812, 124, 128] },
  };

  const sheet = new Image();
  sheet.src = "assets/cat-defence-assets.png";

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
    fish: 20,
    units: [],
    projectiles: [],
    effects: [],
    spawnTimer: 1.4,
    spawnRate: 2.8,
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
    state.fish = 20;
    state.units = [];
    state.projectiles = [];
    state.effects = [];
    state.spawnTimer = 1.4;
    state.spawnRate = 2.8;
    state.time = 0;
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

  function getCat(id) {
    return cats.find((cat) => cat.id === id);
  }

  function levelCost(id) {
    return Math.round(45 + state.levels[id] * state.levels[id] * 32);
  }

  function upgrade(id) {
    const cost = levelCost(id);
    if (state.xp < cost) return;
    state.xp -= cost;
    state.levels[id] += 1;
    writeSave();
    updateUi();
  }

  function unitStats(type, team, level) {
    const base = getCat(type);
    const scale = 1 + (level - 1) * 0.18;
    const enemyBoost = team === "enemy" ? 1.06 : 1;
    return {
      hp: Math.round(base.hp * scale * enemyBoost),
      atk: Math.round(base.atk * scale * enemyBoost),
      def: Math.round(base.def + (level - 1) * 1.3),
      range: base.range,
      speed: base.speed * (team === "enemy" ? 0.92 : 1),
      heal: base.heal ? Math.round(base.heal * scale) : 0,
    };
  }

  function addUnit(type, team, row, x) {
    const level = team === "friendly" ? state.levels[type] : enemyLevel();
    const s = unitStats(type, team, level);
    state.units.push({
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
      phase: Math.random() * Math.PI * 2,
    });
  }

  function enemyLevel() {
    const totalLevels = cats.reduce((sum, cat) => sum + state.levels[cat.id], 0);
    return Math.max(1, Math.floor(1 + state.score / 260 + totalLevels / 7));
  }

  function rowY(row) {
    return board.top + row * board.laneH + board.laneH * 0.54;
  }

  function placeFriendly(clientX, clientY) {
    if (!state.running || state.paused || state.gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (board.w / rect.width);
    const y = (clientY - rect.top) * (board.h / rect.height);
    const row = Math.floor((y - board.top) / board.laneH);
    const col = Math.floor((x - 20) / board.colW);
    if (row < 0 || row >= board.rows || col < 0 || col >= board.friendlyCols) return;
    const px = 54 + col * board.colW;
    const hasUnit = state.units.some((unit) => unit.team === "friendly" && unit.row === row && Math.abs(unit.x - px) < 28);
    if (hasUnit) return;
    addUnit(state.selected, "friendly", row, px);
  }

  function spawnEnemy() {
    const type = cats[Math.floor(Math.random() * cats.length)].id;
    const row = Math.floor(Math.random() * board.rows);
    addUnit(type, "enemy", row, board.w - 52);
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
      if (distance <= unit.range && other.hp < other.maxHp && other.hp / other.maxHp < lowest) {
        best = other;
        lowest = other.hp / other.maxHp;
      }
    });
    return best;
  }

  function attack(attacker, target) {
    const damage = Math.max(2, attacker.atk - target.def);
    target.hp -= damage;
    attacker.cooldown = attacker.type === "sniper" ? 1.15 : 0.82;
    state.effects.push({ x: target.x, y: target.y - 28, text: "-" + damage, life: 0.55, color: attacker.team === "friendly" ? "#2f6fe0" : "#e64032" });
    if (attacker.type === "sniper") {
      state.projectiles.push({ x: attacker.x, y: attacker.y - 26, tx: target.x, ty: target.y - 24, life: 0.22, color: attacker.team === "friendly" ? "#3a7ce9" : "#e64032" });
    }
  }

  function heal(healer, target) {
    target.hp = Math.min(target.maxHp, target.hp + healer.heal);
    healer.cooldown = 1.05;
    state.effects.push({ x: target.x, y: target.y - 36, text: "+" + healer.heal, life: 0.65, color: "#26a5a4" });
  }

  function tick(dt) {
    if (!state.running || state.paused || state.gameOver) return;
    state.time += dt;
    state.spawnTimer -= dt;
    state.spawnRate = Math.max(0.75, 2.8 - state.score / 700);
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnTimer = state.spawnRate + Math.random() * 0.9;
    }

    state.units.forEach((unit) => {
      unit.cooldown = Math.max(0, unit.cooldown - dt);
      unit.phase += dt * 7;
      const target = nearestEnemy(unit);
      const friend = unit.type === "healer" ? healTarget(unit) : null;
      if (friend && unit.cooldown <= 0) {
        heal(unit, friend);
        return;
      }
      if (target && unit.cooldown <= 0) {
        attack(unit, target);
        return;
      }
      if (!target) unit.x += (unit.team === "friendly" ? 1 : -1) * unit.speed * dt;
    });

    state.units = state.units.filter((unit) => {
      if (unit.hp <= 0) {
        if (unit.team === "enemy") {
          const gain = 18 + unit.level * 5;
          state.score += 12 + unit.level * 7;
          state.xp += gain;
          state.best = Math.max(state.best, state.score);
          writeSave();
        }
        state.effects.push({ x: unit.x, y: unit.y - 22, text: "KO", life: 0.55, color: "#111827" });
        return false;
      }
      if (unit.team === "enemy" && unit.x < 12) {
        state.fish -= 1;
        state.effects.push({ x: 58, y: unit.y - 22, text: "Fish -1", life: 0.7, color: "#e64032" });
        if (state.fish <= 0) endGame();
        return false;
      }
      if (unit.team === "friendly" && unit.x > board.w + 22) return false;
      return true;
    });

    state.projectiles.forEach((p) => p.life -= dt);
    state.projectiles = state.projectiles.filter((p) => p.life > 0);
    state.effects.forEach((effect) => effect.life -= dt);
    state.effects = state.effects.filter((effect) => effect.life > 0);
    updateUi();
  }

  function endGame() {
    state.gameOver = true;
    state.running = false;
    state.best = Math.max(state.best, state.score);
    writeSave();
    if (overlay) {
      overlay.innerHTML = "<strong>Game over.</strong><span>Your score was " + state.score + ". Press Start to try again with saved cat levels.</span>";
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
    drawEffects();
  }

  function drawBoard() {
    const gradient = ctx.createLinearGradient(0, 0, 0, board.h);
    gradient.addColorStop(0, "#bce9a8");
    gradient.addColorStop(1, "#eff8d7");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, board.w, board.h);

    if (sheet.complete && sheet.naturalWidth) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(sheet, 240, 52, 1040, 226, 118, 34, 720, 164);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#f4d99e";
    roundRect(132, board.top - 13, board.w - 168, board.rows * board.laneH + 26, 24);
    ctx.fill();

    for (let row = 0; row < board.rows; row += 1) {
      const y = board.top + row * board.laneH;
      ctx.fillStyle = row % 2 ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.28)";
      ctx.fillRect(132, y, board.w - 168, board.laneH);
      ctx.strokeStyle = "rgba(122,84,36,.18)";
      ctx.beginPath();
      ctx.moveTo(132, y);
      ctx.lineTo(board.w - 36, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(58,124,233,.15)";
    roundRect(20, board.top - 8, board.friendlyCols * board.colW, board.rows * board.laneH + 16, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(58,124,233,.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;

    for (let row = 0; row < board.rows; row += 1) {
      for (let col = 0; col < board.friendlyCols; col += 1) {
        ctx.strokeStyle = "rgba(58,124,233,.32)";
        roundRect(28 + col * board.colW, board.top + row * board.laneH + 8, 52, 42, 10);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#fff7da";
    roundRect(20, 18, 112, 36, 14);
    ctx.fill();
    ctx.fillStyle = "#2e74c6";
    ctx.font = "900 20px system-ui, sans-serif";
    ctx.fillText("Fish " + Math.max(0, state.fish), 36, 42);

    ctx.fillStyle = "#42424a";
    roundRect(board.w - 50, board.top - 6, 32, board.rows * board.laneH + 12, 12);
    ctx.fill();
    ctx.fillStyle = "#2b2030";
    roundRect(board.w - 42, board.top + 4, 16, board.rows * board.laneH - 8, 8);
    ctx.fill();
  }

  function drawUnit(unit) {
    const bob = Math.sin(unit.phase) * 2.4;
    const sprite = spriteMap[unit.type] && spriteMap[unit.type][unit.team];
    if (sheet.complete && sheet.naturalWidth && sprite) {
      ctx.save();
      ctx.translate(unit.x, unit.y + bob);
      if (unit.team === "enemy") ctx.scale(-1, 1);
      ctx.drawImage(sheet, sprite[0], sprite[1], sprite[2], sprite[3], -35, -58, 70, 72);
      ctx.restore();
    } else {
      drawFallbackCat(unit, bob);
    }
    drawHealth(unit);
    if (unit.level > 1) {
      ctx.fillStyle = "rgba(17,24,39,.75)";
      ctx.font = "900 11px system-ui, sans-serif";
      ctx.fillText("Lv" + unit.level, unit.x - 13, unit.y + 22);
    }
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
    ctx.fillStyle = "rgba(17,24,39,.18)";
    roundRect(unit.x - 24, unit.y - 72, 48, 6, 3);
    ctx.fill();
    ctx.fillStyle = unit.team === "friendly" ? "#26a5a4" : "#e64032";
    roundRect(unit.x - 24, unit.y - 72, 48 * pct, 6, 3);
    ctx.fill();
  }

  function drawProjectiles() {
    state.projectiles.forEach((p) => {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.tx, p.ty);
      ctx.stroke();
      ctx.lineWidth = 1;
    });
  }

  function drawEffects() {
    state.effects.forEach((effect) => {
      const alpha = Math.max(0, Math.min(1, effect.life / 0.6));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = effect.color;
      ctx.font = "900 16px system-ui, sans-serif";
      ctx.fillText(effect.text, effect.x - 20, effect.y - (1 - alpha) * 22);
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
    renderRoster();
  }

  function renderRoster() {
    if (!roster) return;
    const signature = state.selected + "|" + state.xp + "|" + cats.map((cat) => cat.id + ":" + state.levels[cat.id]).join(",");
    if (signature === rosterSignature) return;
    rosterSignature = signature;
    roster.innerHTML = cats.map((cat) => {
      const level = state.levels[cat.id];
      const cost = levelCost(cat.id);
      const selected = state.selected === cat.id ? " is-selected" : "";
      const disabled = state.xp < cost ? " disabled" : "";
      return [
        "<div class=\"cat-card" + selected + "\">",
        "<button type=\"button\" data-cat-pick=\"" + cat.id + "\" aria-label=\"Select " + cat.name + "\">",
        "<span class=\"cat-card-icon\" style=\"background:" + cat.color + "\">" + cat.short + "</span>",
        "</button>",
        "<button class=\"cat-card-main\" type=\"button\" data-cat-pick=\"" + cat.id + "\">",
        "<span class=\"cat-card-name\">" + cat.name + " Lv" + level + "</span>",
        "<span class=\"cat-card-meta\">HP " + Math.round(unitStats(cat.id, "friendly", level).hp) + " / ATK " + Math.round(unitStats(cat.id, "friendly", level).atk) + "</span>",
        "</button>",
        "<button class=\"cat-card-upgrade\" type=\"button\" data-cat-upgrade=\"" + cat.id + "\"" + disabled + ">+" + cost + "</button>",
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
    tick(dt);
    draw();
    requestAnimationFrame(loop);
  }

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
      if (value === "reset") resetRun(true);
    }
  });

  sheet.addEventListener("load", draw);
  updateUi();
  draw();
  requestAnimationFrame(loop);
})();
