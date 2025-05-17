const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// 2025 race list
const RACE_LIST = [
  "Bahrain", "Saudi Arabia", "Miami", "Imola", "Monaco", "Spain",
  "Canada", "Austria", "UK", "Belgium", "Hungary", "Netherlands",
  "Monza", "Azerbaijan", "Singapore", "Texas", "Mexico", "Brazil",
  "Vegas", "Qatar", "Abu Dhabi"
];

let currentSeasonId = null;
let lockedTeams = {};   // { teamName: [drivers...] }
let lockedPoints = {};  // { teamName: totalPoints }
let racePoints = {};    // { raceName: { driverName: { points, team } } }
let tradeHistory = [];
const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};

window.onload = () => {
  const params = new URLSearchParams(location.search);
  const sid = params.get("season_id");
  if (!sid) return alert("No season_id provided");
  currentSeasonId = sid;
  loadSeasonData(sid);
};

// --- 1) Fetch locked season ---
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(r => r.json())
    .then(data => {
      lockedTeams  = data.teams    || {};
      lockedPoints = data.points   || {};
      racePoints   = data.race_points || {};
      tradeHistory = data.trade_history || [];

      // build color map
      const teams = Object.keys(lockedTeams);
      teams.sort();
      teams.forEach((t,i) => colorMap[t] = COLOR_ARRAY[i]||"white");

      renderLeaderboard();
      renderLineups();
      renderDriverRaceTable();
      renderTradeHistory();
      populateTeamDropdowns();
      fetchFreeAgents();  // after roster loaded
    })
    .catch(console.error);
}

// --- 2) Leaderboard ---
function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(lockedPoints)
    .sort((a,b)=>b[1]-a[1])
    .forEach(([team,pts]) => {
      const color = colorMap[team];
      tbl.innerHTML += `<tr>
        <td style="color:${color}">${team}</td>
        <td>${pts}</td>
      </tr>`;
    });
}

// --- 3) Lineups table (vertical per team) ---
function renderLineups() {
  const headerRow = document.getElementById("lineupsHeader");
  const body = document.getElementById("lineupsBody");
  headerRow.innerHTML = "";
  body.innerHTML = "";

  // header: one <th> per team
  Object.keys(lockedTeams).forEach(team => {
    headerRow.innerHTML += `<th style="color:${colorMap[team]}">${team}</th>`;
  });

  // find max roster size
  const maxRows = Math.max(...Object.values(lockedTeams).map(r=>r.length));

  // build rows
  for(let i=0;i<maxRows;i++){
    let row = "<tr>";
    for(const team of Object.keys(lockedTeams)){
      const drv = lockedTeams[team][i] || "";
      // only last name
      const last = drv.split(" ").slice(-1)[0] || "";
      row += `<td>${last}</td>`;
    }
    row += "</tr>";
    body.innerHTML += row;
  }
}

// --- 4) Race-by-race breakdown ---
function renderDriverRaceTable() {
  const tbl = document.getElementById("driverRaceTable");
  // gather all drafted drivers
  const allDrivers = new Set();
  Object.values(lockedTeams).forEach(arr=>arr.forEach(d=>allDrivers.add(d)));
  const drivers = Array.from(allDrivers).sort();

  // header
  let html = "<tr><th>Driver</th>";
  RACE_LIST.forEach(r=> html += `<th>${r}</th>`);
  html += "</tr>";

  // rows
  drivers.forEach(drv=>{
    html += `<tr><td>${drv}</td>`;
    RACE_LIST.forEach(r=>{
      let pts="", clr="white";
      if (racePoints[r] && racePoints[r][drv]) {
        pts = racePoints[r][drv].points;
        clr = colorMap[racePoints[r][drv].team]||"white";
      }
      html += `<td style="color:${clr}">${pts}</td>`;
    });
    html += "</tr>";
  });

  tbl.innerHTML = html;
}

// --- 5) Trade history ---
function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  tradeHistory.forEach(rec=>{
    const li=document.createElement("li");
    li.textContent = rec;
    ul.appendChild(li);
  });
}

// --- 6) Team dropdowns for trading ---
function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = to.innerHTML = `<option value="">Select…</option>`;
  Object.keys(lockedTeams).forEach(t=>{
    from.innerHTML += `<option value="${t}">${t}</option>`;
    to.innerHTML   += `<option value="${t}">${t}</option>`;
  });
}

// --- 7/8) Placeholder driver selects (locked teams) ---
function populateFromDrivers() {
  const sel=document.getElementById("fromDriversSelect");
  const team=document.getElementById("fromTeamSelect").value;
  sel.innerHTML="";
  (lockedTeams[team]||[]).forEach(d=>{
    sel.innerHTML += `<option>${d}</option>`;
  });
}
function populateToDrivers() {
  const sel=document.getElementById("toDriversSelect");
  const team=document.getElementById("toTeamSelect").value;
  sel.innerHTML="";
  (lockedTeams[team]||[]).forEach(d=>{
    sel.innerHTML += `<option>${d}</option>`;
  });
}

// --- 9) Propose locked trade ---
function proposeLockedTrade(){
  if(!currentSeasonId) return alert("No season id");
  const req = {
    from_team: document.getElementById("fromTeamSelect").value,
    to_team:   document.getElementById("toTeamSelect").value,
    drivers_from_team: Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value),
    drivers_to_team:   Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value),
    from_team_points: +document.getElementById("fromSweetener").value||0,
    to_team_points:   +document.getElementById("toSweetener").value||0
  };
  fetch(`${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`, {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(req)
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.error||d.detail) alert(d.error||d.detail);
    else {
      alert(d.message);
      loadSeasonData(currentSeasonId);
    }
  })
  .catch(console.error);
}

// --- 10) Refresh race points (auto-latest) ---
function refreshRacePoints(){
  if(!currentSeasonId) return alert("No season id");
  fetch(`${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`,{method:"POST"})
    .then(r=>r.json())
    .then(d=>{
      if(d.error||d.detail) alert(d.error||d.detail);
      else {
        alert(d.message);
        loadSeasonData(currentSeasonId);
      }
    })
    .catch(console.error);
}

// --- 11) Free agents against locked roster ---
function fetchFreeAgents(){
  fetch(`${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(currentSeasonId)}`)
    .then(r=>r.json())
    .then(d=> renderFreeAgents(d.drivers) )
    .catch(console.error);
}
function renderFreeAgents(drivers){
  const tbody = document.getElementById("freeAgentsBody");
  tbody.innerHTML = "";
  drivers.forEach(d=>{
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = d;
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}