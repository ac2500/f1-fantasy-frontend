const backendUrl = "https://api.jolpi.ca"; // ← make sure this matches your deployed API

// The 2025 race list (for headers)
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

let currentSeasonId = null;
let lockedTeams   = {}; // { teamName: [driver…], … }
let lockedPoints  = {}; // { teamName: points, … }
let tradeHistory  = []; // [ log string, … ]
let racePoints    = {}; // { raceId: { driverName: {points, team}, … }, … }
let freeAgents    = []; // [ driverName, … ]

// 0) On load: grab season_id from URL, then kick everything off
window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("season_id");
  if (!sid) {
    alert("No season_id provided!");
    return;
  }
  currentSeasonId = sid;
  loadSeasonData(sid);
};

// 1) Fetch locked season data, render everything, then fetch free agents
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(r => r.json())
    .then(data => {
      lockedTeams  = data.teams || {};
      lockedPoints = data.points || {};
      tradeHistory = data.trade_history || [];
      racePoints   = data.race_points || {};

      assignTeamColors(Object.keys(lockedTeams));
      renderLeaderboard(lockedPoints);
      renderLineups(lockedTeams);
      renderDriverRaceTable(racePoints);
      renderTradeHistory(tradeHistory);

      return fetch(
        `${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(seasonId)}`
      );
    })
    .then(r => r.json())
    .then(d => {
      freeAgents = d.drivers || [];
      populateTeamDropdowns();
      renderFreeAgents();
    })
    .catch(console.error);
}

// 2) Assign each team a consistent color
const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};
function assignTeamColors(teams) {
  teams.sort();
  colorMap = {};
  teams.forEach((t,i)=> colorMap[t] = COLOR_ARRAY[i] || "white");
}

// 3) Leaderboard
function renderLeaderboard(pointsDict) {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(pointsDict)
    .sort((a,b)=>b[1]-a[1])
    .forEach(([team,pts])=>{
      tbl.innerHTML += `
        <tr>
          <td style="color:${colorMap[team]||"white"}">${team}</td>
          <td>${pts}</td>
        </tr>`;
    });
}

// 4) Lineups chart (last‐name only)
function renderLineups(teams) {
  const tbl = document.getElementById("lineupsTable");
  // header row
  let h = "<tr>";
  Object.keys(teams).forEach(team => {
    h += `<th style="color:${colorMap[team]||"white"}">${team}</th>`;
  });
  h += "</tr>";

  // determine how many slots
  const maxLen = Math.max(...Object.values(teams).map(r=>r.length));
  let body = "";
  for (let i=0; i<maxLen; i++) {
    body += "<tr>";
    Object.values(teams).forEach(roster => {
      const drv = roster[i] || "";
      body += `<td>${drv.split(" ").slice(-1)[0]||""}</td>`;
    });
    body += "</tr>";
  }

  tbl.innerHTML = h + body;
}

// 5) Race‐by‐race breakdown
function renderDriverRaceTable(raceData) {
  const tbl = document.getElementById("driverRaceTable");
  // header
  let h = `<tr><th>Driver</th>`;
  RACE_LIST.forEach(r=> h += `<th>${r}</th>`);
  h += `</tr>`;

  // gather all drivers in lockedTeams
  const allDrvs = new Set();
  Object.values(lockedTeams).forEach(r=>r.forEach(d=>allDrvs.add(d)));

  // rows
  let rows = "";
  Array.from(allDrvs).sort().forEach(drv=>{
    let r = `<tr><td>${drv.split(" ").slice(-1)[0]}</td>`;
    RACE_LIST.forEach(rid=>{
      const info = (raceData[rid]||{})[drv] || {};
      const pts  = info.points || 0;
      const col  = info.team ? colorMap[info.team] : "white";
      r += `<td style="color:${col}">${pts}</td>`;
    });
    r += "</tr>";
    rows += r;
  });

  tbl.innerHTML = h + rows;
}

// 6) Trade history
function renderTradeHistory(hist) {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  hist.forEach(entry=>{
    const li = document.createElement("li");
    li.textContent = entry;
    ul.appendChild(li);
  });
}

// 7) Populate From‐Team & To‐Team (includes “Free Agency”)
function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from .innerHTML = `<option value="">Select…</option>`;
  to   .innerHTML = `<option value="">Select…</option>`;

  Object.keys(lockedTeams).forEach(team=>{
    from.innerHTML += `<option value="${team}">${team}</option>`;
    to  .innerHTML += `<option value="${team}">${team}</option>`;
  });

  // add Free Agency as last option
  to.innerHTML += `<option value="Free Agency">Free Agency</option>`;
}

// 8) When From‐Team changes, show its roster
function populateFromDrivers() {
  const team = document.getElementById("fromTeamSelect").value;
  const sel  = document.getElementById("fromDriversSelect");
  sel.innerHTML = "";
  if (!lockedTeams[team]) return;
  lockedTeams[team].forEach(drv=>{
    const opt = document.createElement("option");
    opt.value       = drv;
    opt.textContent = drv.split(" ").slice(-1)[0];
    sel.appendChild(opt);
  });
}

// 9) When To‐Team changes, show either team roster or free agents
function populateToDrivers() {
  const team = document.getElementById("toTeamSelect").value;
  const sel  = document.getElementById("toDriversSelect");
  sel.innerHTML = "";

  if (team === "Free Agency") {
    freeAgents.forEach(drv=>{
      const opt = document.createElement("option");
      opt.value       = drv;
      opt.textContent = drv;           // full name here
      sel.appendChild(opt);
    });
  } else if (lockedTeams[team]) {
    lockedTeams[team].forEach(drv=>{
      const opt = document.createElement("option");
      opt.value       = drv;
      opt.textContent = drv.split(" ").slice(-1)[0];
      sel.appendChild(opt);
    });
  }
}

// 10) Propose a locked trade
async function proposeLockedTrade() {
  if (!currentSeasonId) return alert("No season_id!");
  const fromT = document.getElementById("fromTeamSelect").value;
  const toT   = document.getElementById("toTeamSelect").value;
  const fromD = Array.from(document.getElementById("fromDriversSelect")
                    .selectedOptions).map(o=>o.value);
  const toD   = Array.from(document.getElementById("toDriversSelect")
                    .selectedOptions).map(o=>o.value);
  const fromPts = +document.getElementById("fromSweetener").value || 0;
  const toPts   = +document.getElementById("toSweetener").value   || 0;

  try {
    const res = await fetch(
      `${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`,
      {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          from_team: fromT,
          to_team: toT,
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
    loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e);
  }
}

// 11) Refresh Race Points
async function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season_id!");
  try {
    const res = await fetch(
      `${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`,
      { method: "POST" }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j.detail||j.error);
    alert(j.message);
    loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e);
  }
}

// 12) Render the free-agent <ul>
function renderFreeAgents() {
  const ul = document.getElementById("undraftedList");
  if (!ul) return;
  ul.innerHTML = freeAgents.map(d=>`<li>${d}</li>`).join("");
}