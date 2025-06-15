// script.js

const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// Static 2025 rounds
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain","Canada","Austria",
  "UK","Belgium","Hungary","Netherlands","Monza","Azerbaijan","Singapore",
  "Texas","Mexico","Brazil","Vegas","Qatar","Abu Dhabi"
];

// map human names → round numbers
const ROUND_MAP = {
  "Bahrain":4,   "Saudi Arabia":5, "Miami":6,  "Imola":7,
  "Monaco":8,    "Spain":9,         "Canada":10,"Austria":11,
  "UK":12,       "Belgium":13,      "Hungary":14,"Netherlands":15,
  "Monza":16,    "Azerbaijan":17,   "Singapore":18,"Texas":19,
  "Mexico":20,   "Brazil":21,       "Vegas":22, "Qatar":23,
  "Abu Dhabi":24
};

let currentSeasonId = null;

// When the page loads…
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("season_id");
  if (!sid) {
    alert("No season_id provided");
    return;
  }
  currentSeasonId = sid;
  // Kick off the full UI render
  loadSeasonData(sid);
});

// Core: fetch season + free agents + render everything
async function loadSeasonData(seasonId) {
  try {
    // 1) Fetch the locked‐season data
    const seasonResp = await fetch(
      `${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`
    );
    const seasonJson = await seasonResp.json();
    if (!seasonResp.ok) throw new Error(seasonJson.detail || "Error loading season");

    const {
      teams: lockedTeams,
      points: leaderboardPts,
      processed_races: processedRaces,
      race_points: rpData
    } = seasonJson;

    // 2) Render Leaderboard
    renderLeaderboard(leaderboardPts);

    // 3) Render Lineups
    renderLineups(lockedTeams);

    // 4) Render Free Agents
    fetchFreeAgentsAndRender();

    // 5) Render Trade UI dropdowns
    populateTradeDropdowns(lockedTeams);

    // 6) Render the Race‐by‐Race table
    renderRaceTable(lockedTeams, processedRaces, rpData);

  } catch (err) {
    console.error(err);
    alert(err.message || err);
  }
}

//
// Helper: Leaderboard
//
function renderLeaderboard(ptsMap) {
  const tbl = document.getElementById("leaderboardTable");
  // clear old
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  // add rows
  Object.entries(ptsMap).forEach(([team, pts]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${team}</td><td>${pts.toFixed(2)}</td>`;
    tbl.appendChild(tr);
  });
}

//
// Helper: Lineups
//
function renderLineups(lockedTeams) {
  const tbl = document.getElementById("lineupsTable");
  tbl.innerHTML = `<tr>${Object.keys(lockedTeams)
    .map(team => `<th style="color:inherit">${team}</th>`)
    .join("")}</tr>`;

  // find max roster size
  const maxRows = Math.max(...Object.values(lockedTeams).map(r=>r.length));

  for (let i = 0; i < maxRows; i++) {
    const tr = document.createElement("tr");
    Object.values(lockedTeams).forEach(roster => {
      const name = roster[i] || "";
      tr.innerHTML += `<td>${name}</td>`;
    });
    tbl.appendChild(tr);
  }
}

//
// Helper: Free Agents
//
async function fetchFreeAgentsAndRender() {
  const resp = await fetch(
    `${backendUrl}/get_free_agents?season_id=${encodeURIComponent(currentSeasonId)}`
  );
  const json = await resp.json();
  const list = document.getElementById("undraftedList");
  list.innerHTML = "";
  json.free_agents.forEach(d => {
    const li = document.createElement("li");
    li.innerText = d;
    list.appendChild(li);
  });
}

//
// Helper: Trade UI dropdowns
//
function populateTradeDropdowns(lockedTeams) {
  const teamNames = Object.keys(lockedTeams);
  const fromSel = document.getElementById("fromTeamSelect");
  const toSel   = document.getElementById("toTeamSelect");
  // reset
  fromSel.innerHTML = `<option value="">Select Team…</option>`;
  toSel  .innerHTML = `<option value="">Select Team…</option>`;
  teamNames.forEach(t => {
    const o1 = document.createElement("option");
    o1.value = t; o1.innerText = t;
    fromSel.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = t; o2.innerText = t;
    toSel.appendChild(o2);
  });
  // also add free agency
  ["__FREE_AGENCY__"].forEach(fa => {
    const o1 = document.createElement("option");
    o1.value = fa; o1.innerText = "Free Agency";
    fromSel.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = fa; o2.innerText = "Free Agency";
    toSel.appendChild(o2);
  });
}

//
// Helper: build & render the race-by-race table
//
function renderRaceTable(lockedTeams, processedRaces, rpData) {
  const table = document.getElementById("driverRaceTable");
  table.innerHTML = ""; // clear

  // A) flatten drivers in team order
  const driversByTeam = [];
  Object.values(lockedTeams).forEach(roster =>
    roster.forEach(d => driversByTeam.push(d))
  );

  // B) compute each driver’s total
  const driverTotals = {};
  driversByTeam.forEach(d => driverTotals[d] = 0);
  processedRaces.forEach(rid => {
    const roundData = rpData[rid] || {};
    driversByTeam.forEach(d => {
      driverTotals[d] += roundData[d]?.points || 0;
    });
  });

  // C) header
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Driver</th>
      <th>Total</th>
      ${RACE_LIST.map(r => `<th>${r}</th>`).join("")}
    </tr>
  `;
  table.appendChild(thead);

  // D) body
  const tbody = document.createElement("tbody");
  driversByTeam.forEach(d => {
    const total = driverTotals[d].toFixed(2);
    const cells = [
      `<td>${d}</td>`,
      `<td>${total}</td>`,
      ...RACE_LIST.map(r => {
        const p = rpData[r]?.[d]?.points;
        return `<td>${p != null ? p.toFixed(2) : ""}</td>`;
      })
    ].join("");
    const tr = document.createElement("tr");
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

//
// Refresh Race Points button
//
async function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season_id!");
  try {
    const res = await fetch(
      `${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`,
      { method: "POST" }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || json.message || "Error");
    // reload everything
    await loadSeasonData(currentSeasonId);
  } catch (err) {
    alert(err.message);
  }
}

//
// Propose Locked Trade button
//
async function proposeLockedTrade() {
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam   = document.getElementById("toTeamSelect").value;
  const fromDrivers = [...document.getElementById("fromDriversSelect").selectedOptions].map(o=>o.value);
  const toDrivers   = [...document.getElementById("toDriversSelect").selectedOptions].map(o=>o.value);
  const fromPts = parseFloat(document.getElementById("fromSweetener").value) || 0;
  const toPts   = parseFloat(document.getElementById("toSweetener").value)   || 0;

  const payload = {
    from_team: fromTeam,
    to_team:   toTeam,
    drivers_from_team: fromDrivers,
    drivers_to_team:   toDrivers,
    from_team_points:  fromPts,
    to_team_points:    toPts
  };

  try {
    const res = await fetch(
      `${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`,
      {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || json.message || "Trade failed");
    // reload history + free agents + team display
    document.getElementById("tradeHistory").innerHTML =
      json.trade_history.map(h=>`<li>${h}</li>`).join("");
    await loadSeasonData(currentSeasonId);
  } catch (err) {
    alert(err.message);
  }
}