const backendUrl = "https://api.jolpi.ca";  // ← your actual API base
// 2025 schedule — used only for headers
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

// Global state
let currentSeasonId = null;
let lockedTeams = {};     // { teamName: [driver,…], … }
let lockedPoints = {};    // { teamName: points, … }
let tradeHistory = [];    // [string,…]
let racePoints = {};      // { raceId: { driver: {points, team}, … }, … }
let freeAgents = [];      // [driver,…]

// 0) On load, figure out season_id and fetch everything
window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("season_id");
  if (!sid) return alert("No season_id provided!");
  currentSeasonId = sid;
  loadSeasonData(sid);
};

// 1) Fetch locked‐season data + free agents
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(r => r.json())
    .then(data => {
      // unpack
      lockedTeams   = data.teams || {};
      lockedPoints  = data.points || {};
      tradeHistory  = data.trade_history || [];
      racePoints    = data.race_points || {};

      assignTeamColors(Object.keys(lockedTeams));
      renderLeaderboard(lockedPoints);
      renderLineups(lockedTeams);
      renderDriverRaceTable(racePoints);
      renderTradeHistory(tradeHistory);

      // **now** load free agents _against_ this locked roster
      fetch(`${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(seasonId)}`)
        .then(r => r.json())
        .then(d => {
          freeAgents = d.drivers || [];
          // rebuild the trade dropdowns now that we know teams+free agents
          populateTeamDropdowns();
        })
        .catch(console.error);
    })
    .catch(console.error);
}

// 2) Assign each team a color
const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};
function assignTeamColors(teamNames) {
  teamNames.sort();
  colorMap = {};
  teamNames.forEach((t,i) => colorMap[t] = COLOR_ARRAY[i] || "white");
}

// 3) Render the top leaderboard
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

// 4) Render the simple lineups chart
function renderLineups(teams) {
  const tbl = document.getElementById("lineupsTable");
  // header row
  let header = "<tr>";
  Object.keys(teams).forEach(team=>{
    header += `<th style="color:${colorMap[team]||"white"}">${team}</th>`;
  });
  header += "</tr>";
  // find max roster size
  const maxLen = Math.max(...Object.values(teams).map(r=>r.length));
  // each row is one slot
  let body = "";
  for (let i=0; i<maxLen; i++) {
    body += "<tr>";
    Object.values(teams).forEach(roster=>{
      const drv = roster[i]||"";
      body += `<td>${drv.split(" ").slice(-1)[0]||""}</td>`;  // last name only
    });
    body += "</tr>";
  }
  tbl.innerHTML = header + body;
}

// 5) Detailed race‐by‐race breakdown
function renderDriverRaceTable(raceData) {
  const tbl = document.getElementById("driverRaceTable");
  // header
  let h=`<tr><th>Driver</th>`;
  RACE_LIST.forEach(r=> h+=`<th>${r}</th>`);
  h+=`</tr>`;
  // gather all drivers ever in lockedTeams
  const allDrvs = new Set();
  Object.values(lockedTeams).forEach(r=>r.forEach(d=>allDrvs.add(d)));
  // rows
  let rows = "";
  Array.from(allDrvs).sort().forEach(drv=>{
    let r=`<tr><td>${drv.split(" ").slice(-1)[0]}</td>`;
    RACE_LIST.forEach(rid=>{
      const info=(raceData[rid]||{})[drv];
      const pts = info?.points||0;
      const col = info?.team ? colorMap[info.team] : "white";
      r += `<td style="color:${col}">${pts||0}</td>`;
    });
    r+=`</tr>`;
    rows += r;
  });
  tbl.innerHTML = h + rows;
}

// 6) Show trade history
function renderTradeHistory(history) {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  history.forEach(entry=>{
    const li = document.createElement("li");
    li.textContent = entry;
    ul.appendChild(li);
  });
}

// 7) Populate both From‐Team and To‐Team dropdowns (with Free Agency)
function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = `<option value="">Select…</option>`;
  to  .innerHTML = `<option value="">Select…</option>`;
  Object.keys(lockedTeams).forEach(team=>{
    from.innerHTML += `<option value="${team}">${team}</option>`;
    to  .innerHTML += `<option value="${team}">${team}</option>`;
  });
  // extra option
  to.innerHTML += `<option value="Free Agency">Free Agency</option>`;
}

// 8) When a From‐Team is chosen, show its roster
function populateFromDrivers() {
  const from = document.getElementById("fromTeamSelect").value;
  const sel  = document.getElementById("fromDriversSelect");
  sel.innerHTML = "";
  if (!lockedTeams[from]) return;
  lockedTeams[from].forEach(d=>{
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d.split(" ").slice(-1)[0];
    sel.appendChild(opt);
  });
}

// 9) When a To‐Team is chosen, either show that team’s drivers or free agents
function populateToDrivers() {
  const toTeam = document.getElementById("toTeamSelect").value;
  const sel    = document.getElementById("toDriversSelect");
  sel.innerHTML = "";
  if (toTeam === "Free Agency") {
    freeAgents.forEach(d=>{
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d.split(" ").slice(-1)[0];
      sel.appendChild(opt);
    });
  } else if (lockedTeams[toTeam]) {
    lockedTeams[toTeam].forEach(d=>{
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d.split(" ").slice(-1)[0];
      sel.appendChild(opt);
    });
  }
}

// 10) Propose a locked trade
async function proposeLockedTrade() {
  if (!currentSeasonId) return alert("No season_id!");
  const fromT = document.getElementById("fromTeamSelect").value;
  const toT   = document.getElementById("toTeamSelect").value;
  const fromD = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value);
  const toD   = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value);
  const fromPts = parseInt(document.getElementById("fromSweetener").value||"0",10);
  const toPts   = parseInt(document.getElementById("toSweetener").value||"0",10);

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