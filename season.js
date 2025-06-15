// season.js

const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// Static list of 2025 rounds
const RACE_LIST = [
  "Bahrain", "Saudi Arabia", "Miami", "Imola", "Monaco", "Spain",
  "Canada", "Austria", "UK", "Belgium", "Hungary", "Netherlands",
  "Monza", "Azerbaijan", "Singapore", "Texas", "Mexico", "Brazil",
  "Vegas", "Qatar", "Abu Dhabi"
];

// Map human race names → round numbers
const ROUND_MAP = {
  "Bahrain":     4,
  "Saudi Arabia":5,
  "Miami":       6,
  "Imola":       7,
  "Monaco":      8,
  "Spain":       9,
  "Canada":     10,
  "Austria":    11,
  "UK":         12,
  "Belgium":    13,
  "Hungary":    14,
  "Netherlands":15,
  "Monza":      16,
  "Azerbaijan": 17,
  "Singapore":  18,
  "Texas":      19,
  "Mexico":     20,
  "Brazil":     21,
  "Vegas":      22,
  "Qatar":      23,
  "Abu Dhabi":  24
};

// App state
let currentSeasonId = null;
let lockedTeams     = {};
let lockedPoints    = {};
let racePoints      = {};
let tradeHistory    = [];
let freeAgents      = [];
let processedRaces  = [];
const COLOR_ARRAY   = ["green", "blue", "yellow", "orange", "purple"];
let colorMap        = {};

// Only run after the DOM is fully parsed
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const sid    = params.get("season_id");
  if (!sid) {
    alert("No season_id provided!");
    return;
  }
  currentSeasonId = sid;

  // Load and render everything
  loadSeasonData(sid);

  // Wire up trade dropdown change handlers
  const fromSel = document.getElementById("fromTeamSelect");
  const toSel   = document.getElementById("toTeamSelect");
  if (fromSel) fromSel.addEventListener("change", populateFromDrivers);
  if (toSel)   toSel  .addEventListener("change", populateToDrivers);
});


// Fetch locked-season data and render
async function loadSeasonData(seasonId) {
  try {
    const res = await fetch(
      `${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`
    );
    if (!res.ok) throw new Error("Failed to load season");
    const data = await res.json();

    // Populate state
    lockedTeams    = data.teams           || {};
    lockedPoints   = data.points          || {};
    tradeHistory   = data.trade_history  || [];
    racePoints     = data.race_points    || {};
    processedRaces = data.processed_races|| [];

    // Assign team colors
    Object.keys(lockedTeams)
      .sort()
      .forEach((team, i) => {
        colorMap[team] = COLOR_ARRAY[i] || "white";
      });

    renderLeaderboard();
    renderLineups();
    renderDriverRaceTable();
    renderTradeHistory();
    await fetchFreeAgents();
    populateTeamDropdowns();

  } catch (err) {
    console.error(err);
    alert(err.message || "Error loading season data");
  }
}


// Fetch free agents
async function fetchFreeAgents() {
  try {
    const res = await fetch(
      `${backendUrl}/get_free_agents?season_id=${encodeURIComponent(currentSeasonId)}`
    );
    if (!res.ok) throw new Error("Failed to fetch free agents");
    const data = await res.json();
    freeAgents = data.drivers || [];
  } catch (err) {
    console.error("Free-agent fetch error", err);
    freeAgents = [];
  }
  renderFreeAgents();
}


// 2) Leaderboard (hide __FREE_AGENCY__)
function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;

  Object.entries(lockedPoints)
    .filter(([team]) => team !== "__FREE_AGENCY__")
    .sort((a,b) => b[1] - a[1])
    .forEach(([team, pts]) => {
      const color = colorMap[team] || "white";
      tbl.innerHTML += `
        <tr style="color:${color}">
          <td>${team}</td>
          <td>${pts.toFixed(2)}</td>
        </tr>
      `;
    });
}


// 3) Lineups
function renderLineups() {
  const tbl = document.getElementById("lineupsTable");
  let html = "<tr>";

  Object.keys(lockedTeams).forEach(team => {
    const col = colorMap[team] || "white";
    html += `<th style="color:${col}">${team}</th>`;
  });
  html += "</tr>";

  const maxLen = Math.max(...Object.values(lockedTeams).map(r => r.length));
  for (let i = 0; i < maxLen; i++) {
    html += "<tr>";
    Object.values(lockedTeams).forEach(roster => {
      html += `<td>${roster[i] || ""}</td>`;
    });
    html += "</tr>";
  }
  tbl.innerHTML = html;
}


// 4) Race-by-race table (include dropped & free agents)
function renderDriverRaceTable() {
  const tbl = document.getElementById("driverRaceTable");
  tbl.innerHTML = "";

  // Build driver→team map
  const driverToTeam = {};
  Object.entries(lockedTeams).forEach(([team, roster]) => {
    roster.forEach(driver => {
      driverToTeam[driver] = team;
    });
  });

  // Current roster in team order
  const currentDrivers = [];
  Object.values(lockedTeams).forEach(roster =>
    roster.forEach(d => currentDrivers.push(d))
  );

  // Collect all drivers who've scored
  const allDrivers = new Set(currentDrivers);
  processedRaces.forEach(rid => {
    const rd = racePoints[rid] || {};
    Object.keys(rd).forEach(d => allDrivers.add(d));
  });

  // Final ordered list: roster first, then historical-only
  const driversByTeam = [...currentDrivers];
  allDrivers.forEach(d => {
    if (!currentDrivers.includes(d)) driversByTeam.push(d);
  });

  // Compute totals
  const driverTotals = {};
  driversByTeam.forEach(d => (driverTotals[d] = 0));
  processedRaces.forEach(rid => {
    const rd = racePoints[rid] || {};
    driversByTeam.forEach(d => {
      driverTotals[d] += rd[d]?.points || 0;
    });
  });

  // Header
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Driver</th>
      <th>Total</th>
      ${RACE_LIST.map(r => `<th>${r}</th>`).join("")}
    </tr>
  `;
  tbl.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  driversByTeam.forEach(d => {
    const team  = driverToTeam[d];
    const color = colorMap[team] || "white";
    const total = driverTotals[d].toFixed(2);
    const raceCells = RACE_LIST.map(r => {
      const pts = racePoints[String(ROUND_MAP[r])]?.[d]?.points;
      return `<td>${pts != null ? pts.toFixed(2) : ""}</td>`;
    }).join("");

    const tr = document.createElement("tr");
    tr.style.color = color;
    tr.innerHTML = `<td>${d}</td><td>${total}</td>${raceCells}`;
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
}


// 5) Trade history
function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = tradeHistory.map(h => `<li>${h}</li>`).join("");
}


// 6) Free agents list
function renderFreeAgents() {
  const ul = document.getElementById("undraftedList");
  ul.innerHTML = freeAgents.map(d => `<li>${d}</li>`).join("");
}


// 7) Populate trade dropdowns
function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = `<option value="">Select Team</option>`;
  to  .innerHTML = `<option value="">Select Team</option>`;

  Object.keys(lockedTeams).forEach(t => {
    from.innerHTML += `<option value="${t}">${t}</option>`;
    to  .innerHTML += `<option value="${t}">${t}</option>`;
  });

  if (freeAgents.length) {
    to.innerHTML += `<option value="__FREE_AGENCY__">Free Agency</option>`;
  }
}


// 8) Populate driver selects
function populateFromDrivers() {
  const sel  = document.getElementById("fromDriversSelect");
  const team = document.getElementById("fromTeamSelect").value;
  sel.innerHTML = "";
  (lockedTeams[team] || []).forEach(d => {
    sel.innerHTML += `<option value="${d}">${d}</option>`;
  });
}

function populateToDrivers() {
  const sel  = document.getElementById("toDriversSelect");
  const team = document.getElementById("toTeamSelect").value;
  sel.innerHTML = "";
  if (team === "__FREE_AGENCY__") {
    freeAgents.forEach(d => {
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  } else {
    (lockedTeams[team] || []).forEach(d => {
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  }
}


// 9) Propose locked trade
async function proposeLockedTrade() {
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam   = document.getElementById("toTeamSelect").value;
  const fromDrivers = Array.from(
    document.getElementById("fromDriversSelect").selectedOptions
  ).map(o => o.value);
  const toDrivers = Array.from(
    document.getElementById("toDriversSelect").selectedOptions
  ).map(o => o.value);
  const fromPts = parseFloat(document.getElementById("fromSweetener").value) || 0;
  const toPts   = parseFloat(document.getElementById("toSweetener").value)   || 0;

  try {
    const res = await fetch(
      `${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_team: fromTeam,
          to_team: toTeam,
          drivers_from_team: fromDrivers,
          drivers_to_team: toDrivers,
          from_team_points: fromPts,
          to_team_points: toPts
        })
      }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || json.error);
    alert(json.message);
    await loadSeasonData(currentSeasonId);

  } catch (err) {
    alert(err.message || err);
  }
}


// 10) Refresh race points
async function refreshRacePoints() {
  if (!currentSeasonId) {
    alert("No season_id in context!");
    return;
  }

  try {
    const res = await fetch(
      `${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`,
      { method: "POST" }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || json.error);
    alert(json.message);
    await loadSeasonData(currentSeasonId);

  } catch (err) {
    alert(err.message || err);
  }
}