const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

let currentSeasonId = null;
let lockedTeams = {};    // { teamName: [driver,...], ... }
let lockedPoints = {};   // { teamName: points, ... }
let racePoints = {};     // { raceName: { driverName: { points, team }, ... }, ... }
let tradeHistory = [];
const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};

window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  currentSeasonId = params.get("season_id");
  if (!currentSeasonId) return alert("No season_id provided!");
  loadSeasonData(currentSeasonId);
};

function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(r => r.json())
    .then(data => {
      lockedTeams   = data.teams || {};
      lockedPoints  = data.points || {};
      tradeHistory  = data.trade_history || [];
      racePoints    = data.race_points || {};

      // color map
      const allTeams = new Set(Object.keys(lockedTeams));
      Object.values(racePoints).forEach(race =>
        Object.values(race).forEach(info => allTeams.add(info.team))
      );
      assignTeamColors(Array.from(allTeams));

      renderLeaderboard(lockedPoints);
      renderLineups(lockedTeams);
      renderFreeAgents();               // uses latest lockedTeams
      renderDriverRaceTable(racePoints);
      renderTradeHistory(tradeHistory);
      populateTeamDropdowns(lockedTeams);
    })
    .catch(console.error);
}

function assignTeamColors(teams) {
  teams.sort();
  colorMap = {};
  teams.forEach((t,i) => colorMap[t] = COLOR_ARRAY[i]||"white");
}

// 1) Leaderboard
function renderLeaderboard(pointsDict) {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(pointsDict)
    .sort((a,b)=>b[1]-a[1])
    .forEach(([team,pts])=>{
      tbl.innerHTML += `
        <tr>
          <td style="color:${colorMap[team]};">${team}</td>
          <td>${pts}</td>
        </tr>`;
    });
}

// 2) Lineups (simple)
function renderLineups(teams) {
  const tbl = document.getElementById("lockedTeamsSimpleTable");
  tbl.innerHTML = `<tr><th>Team</th><th>Drivers</th></tr>`;
  Object.entries(teams).forEach(([team,drivers])=>{
    tbl.innerHTML += `
      <tr>
        <td style="color:${colorMap[team]};">${team}</td>
        <td>${drivers.map(d=>d.split(" ").slice(-1)[0]).join(", ")}</td>
      </tr>`;
  });
}

// 3) Free agents table
function renderFreeAgents() {
  // undrafted = those NOT in any lockedTeams roster
  const drafted = new Set([].concat(...Object.values(lockedTeams)));
  const agencies = Object.values(lockedTeams)
    .flatMap(_=>[]) /* just to ensure it's an array */
  // but easier:
  const allDrivers = [...new Set(Object.values(lockedTeams).flat())];
  // now fetch current pool
  fetch(`${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(currentSeasonId)}`)
    .then(r=>r.json())
    .then(data=>{
      const tbody = document.getElementById("freeAgentsBody");
      tbody.innerHTML = "";
      data.drivers.forEach(name=>{
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.textContent = name;
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
    })
    .catch(console.error);
}

// 4) Race-by-race breakdown
function renderDriverRaceTable(racePointsData) {
  const table = document.getElementById("driverRaceTable");
  // header
  let html = "<tr><th>Driver</th>";
  RACE_LIST.forEach(r=> html += `<th>${r}</th>`);
  html += "</tr>";

  // all drafted drivers
  const drivers = Object.values(lockedTeams).flat();
  drivers.forEach(driver => {
    html += `<tr><td>${driver}</td>`;
    RACE_LIST.forEach(r=>{
      let pts = "", clr="white";
      if (racePointsData[r] && racePointsData[r][driver]) {
        const info = racePointsData[r][driver];
        pts = info.points;
        clr = colorMap[info.team] || "white";
      }
      html += `<td style="color:${clr};">${pts}</td>`;
    });
    html += "</tr>";
  });

  table.innerHTML = html;
}

// 5) Trade history
function renderTradeHistory(hist) {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  hist.forEach(e=>{
    const li = document.createElement("li");
    li.textContent = e;
    ul.appendChild(li);
  });
}

// 6) Populate trades
function populateTeamDropdowns(teams) {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = `<option value="">Select…</option>`;
  to.innerHTML   = `<option value="">Select…</option>`;
  Object.keys(teams).forEach(t=>{
    from.innerHTML += `<option>${t}</option>`;
    to.innerHTML   += `<option>${t}</option>`;
  });
}

function populateFromDrivers() {
  const list = document.getElementById("fromDriversSelect");
  list.innerHTML = "";
  const team = document.getElementById("fromTeamSelect").value;
  (lockedTeams[team]||[]).forEach(d=>{
    list.innerHTML += `<option>${d}</option>`;
  });
}

function populateToDrivers() {
  const list = document.getElementById("toDriversSelect");
  list.innerHTML = "";
  const team = document.getElementById("toTeamSelect").value;
  (lockedTeams[team]||[]).forEach(d=>{
    list.innerHTML += `<option>${d}</option>`;
  });
}

// 7) Propose trade, refresh points — your existing functions …

// 8) Refresh race points
function refreshRacePoints() {
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