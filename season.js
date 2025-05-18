const backendUrl = "https://api.jolpi.ca";  // <— your correct API

// 2025 race list
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

let currentSeasonId = null;
let teams = {};          // { teamName: [driver1, driver2, …] }
let lockedPoints = {};   // { teamName: totalPoints }
let racePoints = {};     // { raceName: { driverName: {points, team} } }
let tradeHistory = [];   // [ "On … teamA traded …", … ]
let freeAgents = [];     // [ "Colapinto", "Doohan", "Bortoleto" ]

const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};

window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const seasonId = params.get("season_id");
  if (!seasonId) { alert("No season_id!"); return; }
  currentSeasonId = seasonId;
  loadSeasonData(seasonId);
};

// 1) Load locked-season snapshot + then free agents
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(r => r.json())
    .then(data => {
      teams        = data.teams;
      lockedPoints = data.points;
      tradeHistory = data.trade_history;
      racePoints   = data.race_points;

      assignTeamColors(Object.keys(teams));
      renderLeaderboard();
      renderLineups();
      renderDriverRaceTable();
      renderTradeHistory();

      populateTeamDropdowns();

      // now fetch free agents against locked rosters
      fetch(`${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(seasonId)}`)
        .then(r => r.json())
        .then(d => {
          freeAgents = d.drivers;
          renderFreeAgentsTable();
          populateToTeamDropdowns();  // include “Free Agency”
        })
        .catch(console.error);
    })
    .catch(console.error);
}

// 2) Assign colors
function assignTeamColors(teamNames) {
  colorMap = {};
  teamNames.sort().forEach((t,i) => colorMap[t] = COLOR_ARRAY[i] || "white");
}

// 3) Leaderboard
function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = "<tr><th>Fantasy Team</th><th>Total Points</th></tr>";
  Object.entries(lockedPoints)
    .sort((a,b)=>b[1]-a[1])
    .forEach(([team,pts])=>{
      const tr = document.createElement("tr");
      const tdTeam = document.createElement("td");
      tdTeam.textContent = team;
      tdTeam.style.color = colorMap[team];
      const tdPts = document.createElement("td");
      tdPts.textContent = pts;
      tr.append(tdTeam, tdPts);
      tbl.appendChild(tr);
    });
}

// 4) Lineups chart
function renderLineups() {
  const tbl = document.getElementById("lineupsTable");
  tbl.innerHTML = "";
  // header
  const header = document.createElement("tr");
  Object.keys(teams).forEach(team => {
    const th = document.createElement("th");
    th.textContent = team;
    th.style.color = colorMap[team];
    header.appendChild(th);
  });
  tbl.appendChild(header);
  // rows
  const maxLen = Math.max(...Object.values(teams).map(a=>a.length));
  for (let i=0; i<maxLen; i++) {
    const tr = document.createElement("tr");
    Object.values(teams).forEach(roster => {
      const td = document.createElement("td");
      if (roster[i]) td.textContent = roster[i].split(" ").slice(-1)[0];
      tr.appendChild(td);
    });
    tbl.appendChild(tr);
  }
}

// 5) Race-by-race breakdown
function renderDriverRaceTable() {
  const tbl = document.getElementById("driverRaceTable");
  tbl.innerHTML = "";
  // header
  const hdr = document.createElement("tr");
  hdr.innerHTML = "<th>Driver</th>" + RACE_LIST.map(r=>`<th>${r}</th>`).join("");
  tbl.appendChild(hdr);
  // drivers
  const allDrivers = Array.from(new Set([
    ...[].concat(...Object.values(teams)),
    ...Object.keys(racePoints)
  ])).sort();
  allDrivers.forEach(driver => {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = driver.split(" ").slice(-1)[0];
    tr.appendChild(tdName);
    RACE_LIST.forEach(race => {
      const td = document.createElement("td");
      if (racePoints[race] && racePoints[race][driver]) {
        const info = racePoints[race][driver];
        td.textContent = info.points;
        td.style.color = colorMap[info.team];
      }
      tr.appendChild(td);
    });
    tbl.appendChild(tr);
  });
}

// 6) Trade history
function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  tradeHistory.forEach(entry => {
    const li = document.createElement("li");
    li.textContent = entry;
    ul.appendChild(li);
  });
}

// 7) Populate From‐team dropdown
function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  from.innerHTML = `<option value="">Select…</option>` +
    Object.keys(teams).map(t=>`<option value="${t}">${t}</option>`).join("");
  // same for “To” initially; will inject Free Agency next
  document.getElementById("toTeamSelect").innerHTML = from.innerHTML;
}

// 8) After freeAgents loads, re‐populate To‐team w/ Free Agency
function populateToTeamDropdowns() {
  const to = document.getElementById("toTeamSelect");
  to.innerHTML = `<option value="">Select…</option>
    <option value="__FREE_AGENCY__">Free Agency</option>` +
    Object.keys(teams).map(t=>`<option value="${t}">${t}</option>`).join("");
}

// 9) Populate “From Drivers” list
function populateFromDrivers() {
  const sel = document.getElementById("fromDriversSelect");
  sel.innerHTML = "";
  const team = document.getElementById("fromTeamSelect").value;
  (teams[team]||[]).forEach(d => {
    const o = document.createElement("option");
    o.value = d;
    o.textContent = d.split(" ").slice(-1)[0];
    sel.appendChild(o);
  });
}

// 10) Populate “To Drivers” list (or Free Agents)
function populateToDrivers() {
  const sel = document.getElementById("toDriversSelect");
  sel.innerHTML = "";
  const team = document.getElementById("toTeamSelect").value;
  if (team === "__FREE_AGENCY__") {
    freeAgents.forEach(d => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = d.split(" ").slice(-1)[0];
      sel.appendChild(o);
    });
  } else {
    (teams[team]||[]).forEach(d => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = d.split(" ").slice(-1)[0];
      sel.appendChild(o);
    });
  }
}

// 11) Propose Locked Trade
async function proposeLockedTrade() {
  if (!currentSeasonId) return alert("No season_id!");
  const from = document.getElementById("fromTeamSelect").value;
  const to   = document.getElementById("toTeamSelect").value;
  const driversFrom = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value);
  const driversTo   = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value);
  const fromPts = parseInt(document.getElementById("fromSweetener").value||0,10);
  const toPts   = parseInt(document.getElementById("toSweetener").value||0,10);
  const payload = { from_team:from, to_team:to, drivers_from_team:driversFrom, drivers_to_team:driversTo, from_team_points:fromPts, to_team_points:toPts };
  try {
    const res = await fetch(
      `${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`,
      { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) }
    );
    const json = await res.json();
    if (res.status!==200) throw new Error(json.detail||json.error);
    alert(json.message);
    tradeHistory = json.trade_history;
    renderTradeHistory();
    loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e);
  }
}

// 12) Refresh Race Points
async function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season_id!");
  try {
    const res = await fetch(
      `${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`,
      { method:"POST" }
    );
    const json = await res.json();
    if (res.status!==200) throw new Error(json.detail||json.error);
    alert(json.message);
    loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e);
  }
}

// 13) Render Free Agents table
function renderFreeAgentsTable() {
  const tbody = document.getElementById("freeAgentsBody");
  tbody.innerHTML = "";
  freeAgents.forEach(d => {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = d.split(" ").slice(-1)[0];
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}