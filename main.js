/**
 * Snooker 2vs2 Team Performance Tracker Engine
 * Custom Variant: Foul penalties deduct only from the active team/player.
 */

class TeamSnookerApp {
  constructor() {
    this.teams = [];
    this.players = [];
    this.activeTeamIndex = 0;
    this.teamStrikerIndex = [0, 0]; // Index inside team arrays [0 or 1]
    this.currentBreak = 0;
    this.redsLeft = 15;
    this.startingReds = 15;
    this.phase = "RED";
    this.clearanceOrder = [2, 3, 4, 5, 6, 7];
    this.undoStack = [];
    this.foulStrategy = "pass";
    this.history = [];
    this.matchStartTime = null;
  }

  init() {
    // Structural hooks are mounted from HTML forms directly
  }

  startMatch() {
    this.redsLeft = parseInt(document.getElementById("redCount").value, 10);
    this.startingReds = this.redsLeft;
    this.matchStartTime = new Date();

    const ta1 = document.getElementById("tA_p1").value.trim() || "Team A - P1";
    const ta2 = document.getElementById("tA_p2").value.trim() || "Team A - P2";
    const tb1 = document.getElementById("tB_p1").value.trim() || "Team B - P1";
    const tb2 = document.getElementById("tB_p2").value.trim() || "Team B - P2";

    this.teams = [
      { name: "Team A", score: 0, players: [ta1, ta2] },
      { name: "Team B", score: 0, players: [tb1, tb2] },
    ];

    this.players = [
      {
        id: "ta1",
        name: ta1,
        team: "Team A",
        scoreContributed: 0,
        foulsCommitted: 0,
        pointsLost: 0,
        hiBreak: 0,
        ballsPotted: 0,
      },
      {
        id: "ta2",
        name: ta2,
        team: "Team A",
        scoreContributed: 0,
        foulsCommitted: 0,
        pointsLost: 0,
        hiBreak: 0,
        ballsPotted: 0,
      },
      {
        id: "tb1",
        name: tb1,
        team: "Team B",
        scoreContributed: 0,
        foulsCommitted: 0,
        pointsLost: 0,
        hiBreak: 0,
        ballsPotted: 0,
      },
      {
        id: "tb2",
        name: tb2,
        team: "Team B",
        scoreContributed: 0,
        foulsCommitted: 0,
        pointsLost: 0,
        hiBreak: 0,
        ballsPotted: 0,
      },
    ];

    this.activeTeamIndex = 0;
    this.teamStrikerIndex = [0, 0];
    this.currentBreak = 0;
    this.phase = this.redsLeft > 0 ? "RED" : "CLEARANCE";
    this.clearanceOrder = [2, 3, 4, 5, 6, 7];
    this.undoStack = [];
    this.foulStrategy = "pass";
    this.history = [];

    document.getElementById("setupScreen").classList.add("hidden");
    document.getElementById("matchScreen").classList.remove("hidden");

    this.log("2vs2 Match started", "system", "START");
    this.populateFoulAttributionDropdown();
    this.evaluateRulesState();
    this.render();
  }

  getActivePlayer() {
    const activeTeam = this.teams[this.activeTeamIndex];
    const pName =
      activeTeam.players[this.teamStrikerIndex[this.activeTeamIndex]];
    return this.players.find((p) => p.name === pName);
  }

  populateFoulAttributionDropdown() {
    const dropdown = document.getElementById("foulAttributionSelect");
    dropdown.innerHTML = "";
    this.players.forEach((p, idx) => {
      dropdown.innerHTML += `<option value="${idx}">${p.team} - ${p.name}</option>`;
    });
  }

  saveSnapshot() {
    const snapshot = {
      teams: JSON.parse(JSON.stringify(this.teams)),
      players: JSON.parse(JSON.stringify(this.players)),
      activeTeamIndex: this.activeTeamIndex,
      teamStrikerIndex: [...this.teamStrikerIndex],
      currentBreak: this.currentBreak,
      redsLeft: this.redsLeft,
      phase: this.phase,
      clearanceOrder: [...this.clearanceOrder],
      foulStrategy: this.foulStrategy,
      history: JSON.parse(JSON.stringify(this.history)),
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 40) this.undoStack.shift();
  }

  undo() {
    if (this.undoStack.length === 0) {
      this.triggerToast("No metrics left on stack to undo.");
      return;
    }
    const prev = this.undoStack.pop();
    this.teams = prev.teams;
    this.players = prev.players;
    this.activeTeamIndex = prev.activeTeamIndex;
    this.teamStrikerIndex = prev.teamStrikerIndex;
    this.currentBreak = prev.currentBreak;
    this.redsLeft = prev.redsLeft;
    this.phase = prev.phase;
    this.clearanceOrder = prev.clearanceOrder;
    this.foulStrategy = prev.foulStrategy;
    this.history = prev.history;

    this.setFoulStrategy(this.foulStrategy);
    this.evaluateRulesState();
    this.render();
    this.triggerToast("Move Undone");
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
    if (this.phase === "RED" && val !== 1)
      return this.triggerToast("Target must be RED.");
    if (this.phase === "COLOR" && val === 1)
      return this.triggerToast("Target must be COLOR.");
    if (this.phase === "CLEARANCE" && val !== this.clearanceOrder[0])
      return this.triggerToast("Wrong clearance order.");

    this.saveSnapshot();
    const activeTeam = this.teams[this.activeTeamIndex];
    const activePlayer = this.getActivePlayer();

    activeTeam.score += val;
    activePlayer.scoreContributed += val;
    activePlayer.ballsPotted += 1;
    this.currentBreak += val;

    if (this.currentBreak > activePlayer.hiBreak) {
      activePlayer.hiBreak = this.currentBreak;
    }

    const ballNames = {
      1: "Red",
      2: "Yellow",
      3: "Green",
      4: "Brown",
      5: "Blue",
      6: "Pink",
      7: "Black",
    };
    this.log(
      `${activePlayer.name} (${activeTeam.name}) potted ${ballNames[val]}`,
      "pot",
      `+${val}`,
    );

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
    const activePlayer = this.getActivePlayer();
    this.log(
      `${activePlayer.name} break ended`,
      "turn",
      `Break: ${this.currentBreak}`,
    );

    if (this.phase === "COLOR") {
      this.phase = this.redsLeft > 0 ? "RED" : "CLEARANCE";
    }

    this.currentBreak = 0;
    this.activeTeamIndex = this.activeTeamIndex === 0 ? 1 : 0;

    this.evaluateRulesState();
    this.render();
  }

  foul(penaltyValue) {
    this.saveSnapshot();

    const selectIdx = parseInt(
      document.getElementById("foulAttributionSelect").value,
      10,
    );
    const targetFouler = this.players[selectIdx];
    const foulingTeam = this.teams.find((t) => t.name === targetFouler.team);

    // Points deduct directly from fouling team and support negative states
    foulingTeam.score -= penaltyValue;
    targetFouler.foulsCommitted += 1;
    targetFouler.pointsLost += penaltyValue;

    this.log(
      `Foul by ${targetFouler.name} (${foulingTeam.name}): -${penaltyValue} pts. Opponents clear.`,
      "foul",
      `Foul: -${penaltyValue}`,
    );

    if (this.phase === "COLOR") {
      this.phase = this.redsLeft > 0 ? "RED" : "CLEARANCE";
    }

    this.currentBreak = 0;

    if (this.foulStrategy === "pass") {
      const previousTeamIndex = this.activeTeamIndex;
      this.activeTeamIndex = this.activeTeamIndex === 0 ? 1 : 0;
      this.teamStrikerIndex[previousTeamIndex] =
        (this.teamStrikerIndex[previousTeamIndex] + 1) % 2;
    } else {
      this.log(
        `Opponent forced ${targetFouler.name} team to play out of position again`,
        "system",
      );
    }

    this.evaluateRulesState();
    this.render();
  }

  evaluateRulesState() {
    let remaining = 0;
    if (this.redsLeft > 0) {
      remaining += this.redsLeft * 8 + 27;
      if (this.phase === "COLOR") remaining += 7;
    } else {
      this.clearanceOrder.forEach((c) => (remaining += c));
    }

    document.getElementById("lblRemaining").innerText = remaining;

    const currentActive = this.getActivePlayer();
    const dropdown = document.getElementById("foulAttributionSelect");
    const activeMatchIdx = this.players.findIndex(
      (p) => p.name === currentActive.name,
    );
    if (dropdown && activeMatchIdx !== -1) {
      dropdown.value = activeMatchIdx;
    }

    const targetLabel = document.getElementById("lblTargetPhase");
    if (this.phase === "RED") {
      targetLabel.innerText = "Target Phase: RED";
      targetLabel.style.color = "var(--ball-red)";
    } else if (this.phase === "COLOR") {
      targetLabel.innerText = "Target Phase: ANY COLOR";
      targetLabel.style.color = "var(--gold)";
    } else {
      const namesMap = {
        2: "YELLOW",
        3: "GREEN",
        4: "BROWN",
        5: "BLUE",
        6: "PINK",
        7: "BLACK",
      };
      targetLabel.innerText =
        this.clearanceOrder.length > 0
          ? `Sequence Clear: ${namesMap[this.clearanceOrder[0]]}`
          : "FRAME COMPLETED";
    }

    for (let i = 1; i <= 7; i++) {
      const btn = document.getElementById(`b${i}`);
      if (!btn) continue;
      let dis = true;
      if (this.phase === "RED" && i === 1) dis = false;
      else if (this.phase === "COLOR" && i !== 1) dis = false;
      else if (this.phase === "CLEARANCE" && i === this.clearanceOrder[0])
        dis = false;
      btn.disabled = dis;
    }

    this.calculateSnookerStates(remaining);
  }

  calculateSnookerStates(remaining) {
    if (this.teams.length < 2) return;
    const tA = this.teams[0];
    const tB = this.teams[1];
    const calcLabel = document.getElementById("lblSnookerCalculator");

    const margin = Math.abs(tA.score - tB.score);
    const leader = tA.score > tB.score ? tA : tB;
    const trailer = tA.score > tB.score ? tB : tA;

    if (tA.score === tB.score) {
      calcLabel.innerHTML = `<span>Scores level at <strong>${tA.score}</strong>. Layout is open.</span>`;
      return;
    }

    if (margin > remaining) {
      calcLabel.innerHTML = `<span>✨ ${leader.name} secures frame margin layout advantage (+${margin - remaining} safe).</span>`;
    } else {
      calcLabel.innerHTML = `<span>${leader.name} leads ${trailer.name} by <strong>${margin}</strong> pts. ${remaining} on table.</span>`;
    }
  }

  downloadMatchReport() {
    const tA = this.teams[0];
    const tB = this.teams[1];
    const durationMins = Math.floor((new Date() - this.matchStartTime) / 60000);

    let output = `==================================================\n`;
    output += `       SNOOKER 2VS2 FRAME PERFORMANCE REPORT       \n`;
    output += `==================================================\n`;
    output += `Timestamp: ${new Date().toLocaleString()}\n`;
    output += `Match Duration: ${durationMins} minutes\n`;
    output += `Initial Configuration: ${this.startingReds} Reds Pack\n\n`;

    output += `TEAM SCORE SUMMARY:\n`;
    output += `--------------------------------------------------\n`;
    output += `${tA.name}: ${tA.score} points total\n`;
    output += `${tB.name}: ${tB.score} points total\n`;
    const winner =
      tA.score > tB.score
        ? tA.name
        : tA.score < tB.score
          ? tB.name
          : "Tie Split Frame";
    output += `Current Verdict Winner: ${winner}\n\n`;

    output += `PLAYER SPECIFIC METRICS ANALYSIS:\n`;
    output += `--------------------------------------------------\n`;

    this.players.forEach((p) => {
      output += `• Striker: ${p.name} (${p.team})\n`;
      output += `  - Total Points Contributed: ${p.scoreContributed} pts\n`;
      output += `  - Successful Ball Pots: ${p.ballsPotted}\n`;
      output += `  - Frame High Break Achievement: ${p.hiBreak} pts\n`;
      output += `  - Violations/Fouls Triggered: ${p.foulsCommitted} times\n`;
      output += `  - Direct Points Forfeited via Fouls: -${p.pointsLost} pts\n`;
      const netEfficiency = p.scoreContributed - p.pointsLost;
      output += `  - Frame Net Score Value (Pots - Fouls): ${netEfficiency} pts\n`;
      output += `--------------------------------------------------\n`;
    });

    output += `LIVE ACTION FRAME LOG AUDIT:\n`;
    output += `--------------------------------------------------\n`;
    [...this.history].reverse().forEach((h, i) => {
      output += `[Line ${String(i + 1).padStart(2, "0")}] [${h.time}] ${h.message}\n`;
    });
    output += `\n==================================================\n`;
    output += `              End of Report File                  \n`;
    output += `==================================================\n`;

    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snooker_2vs2_report_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.triggerToast("Report compilation downloaded!");
  }

  log(msg, type = "system", badgeText = "") {
    const timeStr = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    this.history.unshift({
      time: timeStr,
      message: msg,
      type: type,
      badge: badgeText,
    });
  }

  triggerToast(msg) {
    const t = document.getElementById("toast");
    t.innerText = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  exitToSetup() {
    if (confirm("Abandon tracking session? All metrics data will clear.")) {
      document.getElementById("matchScreen").classList.add("hidden");
      document.getElementById("setupScreen").classList.remove("hidden");
    }
  }

  render() {
    const grid = document.getElementById("playersScoreboardGrid");
    grid.innerHTML = "";

    this.teams.forEach((team, tIdx) => {
      const isTeamActive = tIdx === this.activeTeamIndex;
      const runningStrikerName = team.players[this.teamStrikerIndex[tIdx]];

      grid.innerHTML += `
        <div class="player-card ${isTeamActive ? "active" : ""}">
          <div class="p-name" style="font-weight:800; text-transform:uppercase; color:${tIdx === 0 ? "#38bdf8" : "#f59e0b"}">${team.name}</div>
          <div class="player-score">${team.score}</div>
          <div class="p-meta" style="font-size:0.75rem; color:#cbd5e1;">Striker: <strong>${runningStrikerName}</strong></div>
        </div>
      `;
    });

    document.getElementById("lblBreak").innerText = this.currentBreak;

    const assetPool = document.getElementById("tableAssetPool");
    assetPool.innerHTML = "";
    for (let i = 0; i < this.startingReds; i++) {
      assetPool.innerHTML += `<div class="asset-ball asset-red" style="opacity: ${i >= this.redsLeft ? "0.15" : "1"}"></div>`;
    }

    const colorMap = [
      { v: 2, c: "yellow" },
      { v: 3, c: "green" },
      { v: 4, c: "brown" },
      { v: 5, c: "blue" },
      { v: 6, c: "pink" },
      { v: 7, c: "black" },
    ];
    colorMap.forEach((color) => {
      const isCleared =
        this.phase === "CLEARANCE" && !this.clearanceOrder.includes(color.v);
      assetPool.innerHTML += `<div class="asset-ball asset-${color.c}" style="opacity: ${isCleared ? "0.15" : "1"}"></div>`;
    });

    const feed = document.getElementById("historyFeed");
    feed.innerHTML = "";
    this.history.forEach((item) => {
      feed.innerHTML += `
        <div class="log-item type-${item.type}">
          <span class="log-time">[${item.time}]</span>
          <strong>${item.badge ? `${item.badge} ` : ""}</strong> ${item.message}
        </div>
      `;
    });
  }
}

const app = new TeamSnookerApp();
window.addEventListener("DOMContentLoaded", () => app.init());
