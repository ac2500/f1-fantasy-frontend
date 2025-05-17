const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// The 2025 race list (adjust as needed)
const RACE_LIST = [
  "Bahrain", "Saudi Arabia", "Miami", "Imola", "Monaco", "Spain",
  "Canada", "Austria", "UK", "Belgium", "Hungary", "Netherlands",
  "Monza", "Azerbaijan", "Singapore", "Texas", "Mexico", "Brazil",
  "Vegas", "Qatar", "Abu Dhabi"
];

let currentSeasonId = null;
let lockedTeams = {};    // { "TeamName": [driver1, driver2, ...], ... }
let lockedPoints = {};   // { "TeamName": totalPoints, ... }
let tradeHistory = [];   // [ "...", ... ]
let racePoints = {};     // { "Bahrain": { "Driver": {points, team}, ... }, ... }
let freeAgentsList = []; // [ "Franco Colapinto", ... ]

const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};

window.onload = () => {
  const params = new URLSearchParams(location.search);
  const sid = params.get("season_id");
  if (!sid) {
    alert("No season_id provided!");
    return;
  }
  currentSeasonId = sid;
  loadFreeAgents();
  loadSeasonData(sid);
};

// Fetch the undrafted drivers for free agency
function loadFreeAgents() {
  fetch(`${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(currentSeasonId)}`)
    .then(r => r.json())
    .then(data => {
      freeAgentsList = data.drivers;
      const ul = document.getElementById("undraftedList");
      ul.innerHTML = "";
      freeAgentsList.forEach(driver => {
        const li = document.createElement("li");
        li.textContent = driver;
        ul.appendChild(li);
      });
    })
    .catch(console.error);
}

// Load the locked‐season snapshot
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(r => r.json())
    .then(data => {
      lockedTeams   = data.teams   || {};
      lockedPoints  = data.points  || {};
      tradeHistory  = data.trade_history || [];
      racePoints    = data.race_points   || {};
      assignTeamColors(Object.keys(lockedTeams));
      renderLeaderboard();
      renderLineups();
      renderDriverRaceTable();
      renderTradeHistory();
      populateTeamDropdowns();
    })
    .catch(console.error);
}

// Assign each team a color from the palette
function assignTeamColors(teamNames) {
  colorMap = {};
  teamNames.sort();
  teamNames.forEach((t,i) => colorMap[t] = COLOR_ARRAY[i] || "white");
}

// 1) Leaderboard
function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  let html = "<tr><th>Fantasy Team</th><th>Total Points</th></tr>";
  Object.entries(lockedPoints)
        .sort((a,b)=>b[1]-a[1])
        .forEach(([team,pts])=> {
          html += `<tr>
                     <td style="color:${colorMap[team]};">${team}</td>
                     <td>${pts}</td>
                   </tr>`;
        });
  tbl.innerHTML = html;
}

// 2) Lineups (last names only, tight width)
function renderLineups() {
  const container = document.getElementById("lineupsContainer");
  container.innerHTML = "";  
  const teams = Object.keys(lockedTeams);
  if (!teams.length) return;
  const table = document.createElement("table");
  table.style.width = "auto";
  table.style.margin = "auto";
  // headers
  let h = "<tr>";
  teams.forEach(team=> h+=`<th style="color:${colorMap[team]};">${team}</th>`);
  h += "</tr>";
  table.innerHTML = h;
  // rows
  const maxLen = Math.max(...teams.map(t=>lockedTeams[t].length));
  for (let i=0;i<maxLen;i++){
    let row = "<tr>";
    teams.forEach(team=>{
      const full = lockedTeams[team][i] || "";
      const last = full.split(" ").slice(-1)[0] || "";
      row += `<td>${last}</td>`;
    });
    row += "</tr>";
    table.innerHTML += row;
  }
  container.appendChild(table);
}

// 3) Race‐by‐Race Breakdown
function renderDriverRaceTable() {
  const table = document.getElementById("driverRaceTable");
  const allDrivers = new Set();
  Object.values(lockedTeams).flat().forEach(d=>allDrivers.add(d));
  Object.values(racePoints).forEach(rp=>{
    Object.keys(rp).forEach(d=>allDrivers.add(d));
  });
  const drivers = Array.from(allDrivers).sort();

  // header
  let html = "<tr><th>Driver</th>";
  RACE_LIST.forEach(r=> html+=`<th>${r}</th>`);
  html += "</tr>";

  // rows
  drivers.forEach(drv=>{
    let row = `<tr><td>${drv}</td>`;
    RACE_LIST.forEach(r=>{
      let pts = "", clr = "white";
      if (racePoints[r] && racePoints[r][drv]) {
        pts = racePoints[r][drv].points || "";
        clr = colorMap[racePoints[r][drv].team] || "white";
      }
      row += `<td style="color:${clr};">${pts}</td>`;
    });
    row += "</tr>";
    html += row;
  });

  if (!drivers.length) {
    html = `<tr><td colspan="${RACE_LIST.length+1}">No drafted drivers found.</td></tr>`;
  }
  table.innerHTML = html;
}

// 4) Trade history
function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  tradeHistory.forEach(rec=>{
    const li = document.createElement("li");
    li.textContent = rec;
    ul.appendChild(li);
  });
}

// 5) Populate the trade “From” & “To” dropdowns
function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = "<option value=''>Select Team</option>";
  to  .innerHTML = "<option value=''>Select Team</option>";

  Object.keys(lockedTeams).forEach(team=>{
    from.innerHTML += `<option value="${team}">${team}</option>`;
    to  .innerHTML += `<option value="${team}">${team}</option>`;
  });
  // add free agency only to the "To" menu:
  to.innerHTML += `<option value="__free_agency">Free Agency</option>`;
}

// 6) Show drivers for “From Team”
function populateFromDrivers() {
  const t = document.getElementById("fromTeamSelect").value;
  const sel = document.getElementById("fromDriversSelect");
  sel.innerHTML = "";
  if (!t || !lockedTeams[t]) return;
  lockedTeams[t].forEach(d=> sel.innerHTML += `<option value="${d}">${d}</option>`);
}

// 7) Show drivers for “To Team” (or free agents)
function populateToDrivers() {
  const t = document.getElementById("toTeamSelect").value;
  const sel = document.getElementById("toDriversSelect");
  sel.innerHTML = "";
  if (t === "__free_agency") {
    freeAgentsList.forEach(d=> sel.innerHTML += `<option value="${d}">${d}</option>`);
  } else if (lockedTeams[t]) {
    lockedTeams[t].forEach(d=> sel.innerHTML += `<option value="${d}">${d}</option>`);
  }
}

// 8) Propose trade (unchanged)
function proposeLockedTrade() {
  if (!currentSeasonId) return alert("No season_id in context!");
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam   = document.getElementById("toTeamSelect").value;
  const fromDrv  = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value);
  const toDrv    = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value);
  const fromPts  = parseInt(document.getElementById("fromSweetener").value||"0",10);
  const toPts    = parseInt(document.getElementById("toSweetener").value||"0",10);

  const payload = {
    from_team: fromTeam,
    to_team: toTeam,
    drivers_from_team: fromDrv,
    drivers_to_team: toDrv,
    from_team_points: fromPts,
    to_team_points: toPts
  };
  fetch(`${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  })
    .then(r=>r.json())
    .then(d=>{
      if (d.error||d.detail) alert(d.error||d.detail);
      else {
        alert(d.message);
        loadSeasonData(currentSeasonId);
      }
    })
    .catch(console.error);
}

// 9) Refresh race points (auto-uses “latest”)
function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season_id in context!");
  fetch(`${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`, {
    method: "POST"
  })
    .then(r=>r.json())
    .then(d=>{
      if (d.error||d.detail) alert(d.error||d.detail);
      else {
        alert(d.message);
        loadSeasonData(currentSeasonId);
      }
    })
    .catch(console.error);
}