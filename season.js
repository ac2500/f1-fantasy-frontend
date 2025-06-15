// season.js

const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// Static list of 2025 rounds
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

// map human race names → Ergast round numbers
const ROUND_MAP = {
  "Bahrain":        4,
  "Saudi Arabia":   5,
  "Miami":          6,
  "Imola":          7,
  "Monaco":         8,
  "Spain":          9,
  "Canada":        10,
  "Austria":       11,
  "UK":            12,
  "Belgium":       13,
  "Hungary":       14,
  "Netherlands":   15,
  "Monza":         16,
  "Azerbaijan":    17,
  "Singapore":     18,
  "Texas":         19,
  "Mexico":        20,
  "Brazil":        21,
  "Vegas":         22,
  "Qatar":         23,
  "Abu Dhabi":     24
};

let currentSeasonId = null;
let lockedTeams    = {};
let lockedPoints   = {};
let racePoints     = {};
let tradeHistory   = [];
let freeAgents     = [];
let processedRaces = [];
const COLOR_ARRAY  = ["green","blue","yellow","orange","purple"];
let colorMap       = {};

// ensure we only run after the DOM is fully parsed
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("season_id");
  if (!sid) {
    alert("No season_id provided!");
    return;
  }
  currentSeasonId = sid;

  // kick off loading all data
  loadSeasonData(sid);

  // wire up change handlers if your HTML doesn't already use onchange attributes:
  const fromSel = document.getElementById("fromTeamSelect");
  const toSel   = document.getElementById("toTeamSelect");
  if (fromSel) fromSel.addEventListener("change", populateFromDrivers);
  if (toSel)   toSel  .addEventListener("change", populateToDrivers);
});

async function loadSeasonData(seasonId) {
  try {
    // fetch locked-season record
    const res = await fetch(
      `${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`
    );
    if (!res.ok) throw new Error("Failed to load season");
    const data = await res.json();

    lockedTeams    = data.teams           || {};
    lockedPoints   = data.points          || {};
    tradeHistory   = data.trade_history  || [];
    racePoints     = data.race_points    || {};
    processedRaces = data.processed_races|| [];

    // assign colors in sorted order
    Object.keys(lockedTeams).sort()
      .forEach((t,i) => colorMap[t] = COLOR_ARRAY[i]||"white");

    renderLeaderboard();
    renderLineups();
    renderDriverRaceTable();
    renderTradeHistory();
    await fetchFreeAgents();
    populateTeamDropdowns();

  } catch (e) {
    console.error(e);
    alert(e.message || "Error loading season data");
  }
}

async function fetchFreeAgents() {
  try {
    const res = await fetch(
      `${backendUrl}/get_free_agents?season_id=${encodeURIComponent(currentSeasonId)}`
    );
    if (!res.ok) throw new Error("Failed to fetch free agents");
    const data = await res.json();
    freeAgents = data.drivers || [];
  } catch (e) {
    console.error("Free-agent fetch error", e);
    freeAgents = [];
  }
  renderFreeAgents();
}

// 2) Leaderboard
function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;

  Object.entries(lockedPoints)
    .filter(([team]) => team !== "__FREE_AGENCY__")
    .sort((a, b) => b[1] - a[1])
    .forEach(([team, pts]) => {
      const c = colorMap[team] || "white";
      tbl.innerHTML += `
        <tr>
          <td style="color:${c}">${team}</td>
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
    html += `<th style="color:${colorMap[team]||"white"}">${team}</th>`;
  });
  html += "</tr>";

  const maxLen = Math.max(...Object.values(lockedTeams).map(r=>r.length));
  for (let i = 0; i < maxLen; i++) {
    html += "<tr>";
    Object.values(lockedTeams).forEach(roster => {
      html += `<td>${roster[i]||""}</td>`;
    });
    html += "</tr>";
  }
  tbl.innerHTML = html;
}

// 4) Race-by-race table
function renderDriverRaceTable() {
  const tbl = document.getElementById("driverRaceTable");
  tbl.innerHTML = "";

  // group drivers by team
  const driversByTeam = [];
  Object.values(lockedTeams).forEach(roster =>
    roster.forEach(d => driversByTeam.push(d))
  );

  // compute totals
  const driverTotals = {};
  driversByTeam.forEach(d => driverTotals[d] = 0);
  processedRaces.forEach(rid => {
    const rd = racePoints[rid] || {};
    driversByTeam.forEach(d => {
      driverTotals[d] += rd[d]?.points || 0;
    });
  });

  // header
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Driver</th>
      <th>Total</th>
      ${RACE_LIST.map(r => `<th>${r}</th>`).join("")}
    </tr>
  `;
  tbl.appendChild(thead);

  // body
  const tbody = document.createElement("tbody");
  driversByTeam.forEach(d => {
    const total = driverTotals[d].toFixed(2);
    const cells = [
      `<td>${d}</td>`,
      `<td>${total}</td>`,
      ...RACE_LIST.map(r => {
        const p = racePoints[ String(ROUND_MAP[r]) ]?.[d]?.points;
        return `<td>${p != null ? p.toFixed(2) : ""}</td>`;
      })
    ].join("");
    const tr = document.createElement("tr");
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
}

// 5) Trade history
function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = tradeHistory.map(t => `<li>${t}</li>`).join("");
}

// 6) Free agents list
function renderFreeAgents() {
  const ul = document.getElementById("undraftedList");
  ul.innerHTML = freeAgents.map(d => `<li>${d}</li>`).join("");
}

// 7) Dropdowns
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
  const sel = document.getElementById("fromDriversSelect");
  const team = document.getElementById("fromTeamSelect").value;
  sel.innerHTML = "";
  (lockedTeams[team] || []).forEach(d => {
    sel.innerHTML += `<option value="${d}">${d}</option>`;
  });
}
function populateToDrivers() {
  const sel = document.getElementById("toDriversSelect");
  const team = document.getElementById("toTeamSelect").value;
  sel.innerHTML = "";
  if (team === "__FREE_AGENCY__") {
    freeAgents.forEach(d => sel.innerHTML += `<option value="${d}">${d}</option>`);
  } else {
    (lockedTeams[team] || []).forEach(d => {
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  }
}

// 9) Propose trade
async function proposeLockedTrade() {
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam   = document.getElementById("toTeamSelect").value;
  const fromD    = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value);
  const toD      = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value);
  const fromPts  = parseInt(document.getElementById("fromSweetener").value)||0;
  const toPts    = parseInt(document.getElementById("toSweetener").value)||0;
  try {
    const res = await fetch(
      `${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`,
      {
        method: "POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          from_team: fromTeam,
          to_team: toTeam,
          drivers_from_team: fromD,
          drivers_to_team: toD,
          from_team_points: fromPts,
          to_team_points: toPts
        })
      }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j.detail||j.error);
    alert(j.message);
    await loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e.message||e);
  }
}

// 11) Refresh Race Points
async function refreshRacePoints() {
  if (!currentSeasonId) {
    return alert("No season_id in context!");
  }

  try {
    // always ask the backend for the real “next” round
    const res = await fetch(
      `${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`,
      { method: "POST" }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || json.error);
    alert(json.message);
    // reload everything (including processedRaces & the grid)
    await loadSeasonData(currentSeasonId);
  } catch (err) {
    if (err.message.includes("already been processed")) {
      alert("No new races to update points.");
    } else {
      alert(err.message || err);
    }
  }
}