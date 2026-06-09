class SimpleSnookerApp {
  constructor() {
    this.players = [];
    this.activeIndex = 0;
    this.currentBreak = 0;
    this.redsLeft = 15;
    this.startingReds = 15;
    this.phase = "RED"; // 'RED', 'COLOR', 'CLEARANCE'
    this.clearanceOrder = [2, 3, 4, 5, 6, 7];
    this.history = [];
    this.undoStack = [];
    this.foulStrategy = "pass"; // 'pass' or 'stay'
  }

  init() {
    this.generatePlayerInputRows();
  }

  generatePlayerInputRows() {
    const count = parseInt(document.getElementById("playerCount").value);
    const container = document.getElementById("namesContainer");
    container.innerHTML = "";

    for (let i = 1; i <= count; i++) {
      container.innerHTML += `
        <div class="form-group">
          <label>Player ${i} Name</label>
          <input type="text" id="pName${i}" value="Player ${i}" maxlength="20">
        </div>
      `;
    }
  }

  startMatch() {
    const count = parseInt(document.getElementById("playerCount").value);
    this.redsLeft = parseInt(document.getElementById("redCount").value);
    this.startingReds = this.redsLeft;
    this.players = [];

    for (let i = 1; i <= count; i++) {
      const nameInput = document.getElementById(`pName${i}`);
      this.players.push({
        name: nameInput.value.trim() || `Player ${i}`,
        score: 0,
        hiBreak: 0,
      });
    }

    this.activeIndex = 0;
    this.currentBreak = 0;
    this.phase = "RED";
    this.clearanceOrder = [2, 3, 4, 5, 6, 7];
    this.history = [];
    this.undoStack = [];
    this.foulStrategy = "pass";

    document.getElementById("setupScreen").classList.add("hidden");
    document.getElementById("matchScreen").classList.remove("hidden");

    this.log("Match initialised", "system", "START");
    this.evaluateRulesState();
    this.render();
  }

  exitToSetup() {
    if (confirm("Abandon tracking session and return to registration?")) {
      document.getElementById("matchScreen").classList.add("hidden");
      document.getElementById("setupScreen").classList.remove("hidden");
    }
  }

  saveSnapshot() {
    const snapshot = {
      players: JSON.parse(JSON.stringify(this.players)),
      activeIndex: this.activeIndex,
      currentBreak: this.currentBreak,
      redsLeft: this.redsLeft,
      phase: this.phase,
      clearanceOrder: [...this.clearanceOrder],
      history: JSON.parse(JSON.stringify(this.history)),
      foulStrategy: this.foulStrategy,
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 30) this.undoStack.shift();
  }

  undo() {
    if (this.undoStack.length === 0) {
      this.triggerToast("No actions left on stack to undo.");
      return;
    }
    const previous = this.undoStack.pop();
    this.players = previous.players;
    this.activeIndex = previous.activeIndex;
    this.currentBreak = previous.currentBreak;
    this.redsLeft = previous.redsLeft;
    this.phase = previous.phase;
    this.clearanceOrder = previous.clearanceOrder;
    this.history = previous.history;
    this.foulStrategy = previous.foulStrategy || "pass";

    this.evaluateRulesState();
    this.render();
  }

  setFoulStrategy(strategy) {
    this.foulStrategy = strategy;
    document
      .getElementById("btnFoulPass")
      .classList.toggle("selected", strategy === "pass");
    document
      .getElementById("btnFoulStay")
      .classList.toggle("selected", strategy === "stay");
  }

  potBall(val) {
    if (this.phase === "RED" && val !== 1) {
      this.triggerToast("Rule Error: Target must be a RED ball.");
      return;
    }
    if (this.phase === "COLOR" && val === 1) {
      this.triggerToast("Rule Error: Target must be a COLOR ball.");
      return;
    }
    if (this.phase === "CLEARANCE" && val !== this.clearanceOrder[0]) {
      this.triggerToast(
        "Rule Error: Colors must be cleared in order sequence.",
      );
      return;
    }

    this.saveSnapshot();
    const active = this.players[this.activeIndex];

    active.score += val;
    this.currentBreak += val;
    if (this.currentBreak > active.hiBreak) active.hiBreak = this.currentBreak;

    const mappedNames = {
      1: "Red",
      2: "Yellow",
      3: "Green",
      4: "Brown",
      5: "Blue",
      6: "Pink",
      7: "Black",
    };
    this.log(`${active.name} potted ${mappedNames[val]}`, "pot", `+${val}`);

    if (this.phase === "RED") {
      this.redsLeft--;
      this.phase = "COLOR";
    } else if (this.phase === "COLOR") {
      this.phase = this.redsLeft > 0 ? "RED" : "CLEARANCE";
    } else if (this.phase === "CLEARANCE") {
      this.clearanceOrder.shift();
    }

    this.evaluateRulesState();
    this.render();
  }

  endTurn() {
    this.saveSnapshot();
    const active = this.players[this.activeIndex];
    this.log(
      `${active.name} break ended`,
      "turn",
      `Break: ${this.currentBreak}`,
    );

    if (this.phase === "COLOR") {
      this.phase = this.redsLeft > 0 ? "RED" : "CLEARANCE";
    }

    this.currentBreak = 0;
    this.activeIndex = (this.activeIndex + 1) % this.players.length;

    this.evaluateRulesState();
    this.render();
  }

  foul(penaltyValue) {
    this.saveSnapshot();
    const active = this.players[this.activeIndex];

    // Deduct points from the active player who committed the foul
    active.score -= penaltyValue;
    if (active.score < 0) active.score = 0;

    // Add points to all non-active players (opponents)
    this.players.forEach((player, idx) => {
      if (idx !== this.activeIndex) {
        player.score += penaltyValue;
      }
    });

    this.log(
      `${active.name} foul: -${penaltyValue} to self, +${penaltyValue} to Opp`,
      "foul",
      `Foul: ${penaltyValue}`,
    );

    if (this.phase === "COLOR") {
      this.phase = this.redsLeft > 0 ? "RED" : "CLEARANCE";
    }

    this.currentBreak = 0;

    if (this.foulStrategy === "pass") {
      this.activeIndex = (this.activeIndex + 1) % this.players.length;
    } else {
      this.log(`Opponent elected to let ${active.name} play again`, "system");
    }

    this.evaluateRulesState();
    this.render();
  }

  evaluateRulesState() {
    let totalPointsRemaining = 0;
    if (this.redsLeft > 0) {
      totalPointsRemaining += this.redsLeft * 8 + 27;
      if (this.phase === "COLOR") totalPointsRemaining += 7;
    } else {
      this.clearanceOrder.forEach((c) => (totalPointsRemaining += c));
      if (this.phase === "COLOR") totalPointsRemaining += 7;
    }

    document.getElementById("lblRemaining").innerText = totalPointsRemaining;

    const targetLabel = document.getElementById("lblTargetPhase");

    if (this.phase === "RED") {
      targetLabel.innerText = "Target Phase: RED";
      targetLabel.className = "ticker-label target-header";
      targetLabel.style.color = "var(--ball-red)";
    } else if (this.phase === "COLOR") {
      targetLabel.innerText = "Target Phase: ANY COLOR";
      targetLabel.className = "ticker-label target-header";
      targetLabel.style.color = "var(--gold)";
    } else {
      const mappedNames = {
        2: "YELLOW",
        3: "GREEN",
        4: "BROWN",
        5: "BLUE",
        6: "PINK",
        7: "BLACK",
      };
      const upNextVal = this.clearanceOrder[0] || 7;
      targetLabel.innerText = `Target Phase Sequence: ${mappedNames[upNextVal]}`;
      targetLabel.className = "ticker-label target-header";
      targetLabel.style.color = "var(--text-main)";
    }

    for (let i = 1; i <= 7; i++) {
      const btn = document.getElementById(`b${i}`);
      if (this.phase === "RED") btn.disabled = i !== 1;
      else if (this.phase === "COLOR") btn.disabled = i === 1;
      else if (this.phase === "CLEARANCE")
        btn.disabled = i !== this.clearanceOrder[0];
    }

    this.calculateSnookerStates(totalPointsRemaining);
  }

  calculateSnookerStates(remaining) {
    if (this.players.length === 0) return;

    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    const highestScore = sorted[0].score;
    const runnerUpScore = sorted[1] ? sorted[1].score : 0;
    const active = this.players[this.activeIndex];
    const calcLabel = document.getElementById("lblSnookerCalculator");

    if (highestScore === runnerUpScore && remaining === 0) {
      calcLabel.innerHTML = `<span>Tie Frame Situation! Re-spotted black needed.</span>`;
      return;
    }

    if (active.score === highestScore) {
      const margin = active.score - runnerUpScore;
      if (margin > remaining) {
        calcLabel.innerHTML = `<span>✨ ${active.name} secure clear lead. Frame Won!</span>`;
      } else {
        calcLabel.innerHTML = `<span>${active.name} is leading the layout by <strong>${margin}</strong> pts.</span>`;
      }
    } else {
      const deficit = highestScore - active.score;
      if (deficit > remaining) {
        const snookersNeeded = Math.ceil((deficit - remaining) / 4);
        calcLabel.innerHTML = `<span>⚠️ Snookers Required: ${active.name} needs <strong>${snookersNeeded}</strong> foul(s) (${deficit - remaining} pts behind capacity)</span>`;
      } else {
        calcLabel.innerHTML = `<span>${active.name} needs <strong>${deficit}</strong> pts to catch leader. Layout is live.</span>`;
      }
    }
  }

  log(msg, type = "system", badgeText = "") {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    this.history.unshift({
      time: timeStr,
      message: msg,
      type: type,
      badge: badgeText,
    });

    if (this.history.length > 30) this.history.pop();
  }

  triggerToast(msg) {
    const t = document.getElementById("toast");
    t.innerText = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
  }

  render() {
    const grid = document.getElementById("playersScoreboardGrid");
    grid.innerHTML = "";

    this.players.forEach((p, idx) => {
      const isActive = idx === this.activeIndex;
      grid.innerHTML += `
        <div class="player-box ${isActive ? "active" : ""}" onclick="app.selectPlayerIndexDirectly(${idx})">
          <div class="p-name">${p.name}</div>
          <div class="p-score">${p.score}</div>
          <div class="p-meta">Hi-Break: ${p.hiBreak}</div>
        </div>
      `;
    });

    document.getElementById("lblBreak").innerText = this.currentBreak;

    const assetPool = document.getElementById("tableAssetPool");
    assetPool.innerHTML = "";

    // Render Reds
    for (let i = 0; i < this.startingReds; i++) {
      const isDimmed = i >= this.redsLeft;
      assetPool.innerHTML += `<div class="v-ball ${isDimmed ? "dimmed" : ""}" style="background: var(--ball-red);"></div>`;
    }

    // Render Colors using the new radial gradients from CSS
    const colorsDef = [
      { v: 2, c: "var(--ball-yellow)" },
      { v: 3, c: "var(--ball-green)" },
      { v: 4, c: "var(--ball-brown)" },
      { v: 5, c: "var(--ball-blue)" },
      { v: 6, c: "var(--ball-pink)" },
      { v: 7, c: "var(--ball-black)" },
    ];

    colorsDef.forEach((color) => {
      let isDimmed = false;
      if (
        this.phase === "CLEARANCE" &&
        !this.clearanceOrder.includes(color.v)
      ) {
        isDimmed = true;
      }
      assetPool.innerHTML += `<div class="v-ball ${isDimmed ? "dimmed" : ""}" style="background: ${color.c}"></div>`;
    });

    const feed = document.getElementById("historyFeed");
    feed.innerHTML = "";

    this.history.forEach((item) => {
      feed.innerHTML += `
        <div class="history-item type-${item.type}">
          <div class="log-left">
            <span class="time-tag">${item.time}</span>
            <span class="log-msg">${item.message}</span>
          </div>
          ${item.badge ? `<span class="badge">${item.badge}</span>` : ""}
        </div>
      `;
    });
  }

  selectPlayerIndexDirectly(idx) {
    if (this.currentBreak > 0) {
      this.triggerToast(
        "Cannot swap current turn active players mid-break series.",
      );
      return;
    }
    this.activeIndex = idx;
    this.evaluateRulesState();
    this.render();
  }
}

const app = new SimpleSnookerApp();
window.addEventListener("DOMContentLoaded", () => app.init());
