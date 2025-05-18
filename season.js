// season.js

const backendUrl = "https://api.jolpi.ca";  // your actual backend
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

let currentSeasonId = null;
let lockedTeams = {};     // { teamName: [driver1, …] }
let lockedPoints = {};    // { teamName: totalPoints }
let racePoints = {};      // { raceName: { driverName: { points, team } } }
let tradeHistory = [];    // [ "On 2025-05-01, …", … ]
let freeAgents = [];      // undrafted for this locked season

const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};

window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("season_id");
  if (!sid) return alert("No season_id provided!");
  currentSeasonId = sid;
  loadSeasonData(sid);
};

// 1) Load everything for this locked season
async function loadSeasonData(seasonId) {
  try {
    const res = await fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`);
    if (!res.ok) throw new Error("Season load failed");
    const data = await res.json();

    lockedTeams = data.teams || {};
    lockedPoints = data.points || {};
    tradeHistory = data.trade_history || [];
    racePoints   = data.race_points || {};

    // build color map
    const allTeams = Object.keys(lockedTeams);
    allTeams.sort();
    allTeams.forEach((t,i) => colorMap[t] = COLOR_ARRAY[i]||"white");

    renderLeaderboard();
    renderLineups();
    renderDriverRaceTable();
    renderTradeHistory();
    await fetchFreeAgents();          // load undrafted for this season
    populateTeamDropdowns();          // now includes "Free Agency"
  } catch (e) {
    console.error(e);
    alert("Error loading season data.");
  }
}

// 2) Leaderboard
function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(lockedPoints)
    .sort((a,b)=>b[1]-a[1])
    .forEach(([team,pts])=>{
      const color = colorMap[team]||"white";
      tbl.innerHTML += `<tr>
        <td style="color:${color}">${team}</td>
        <td>${pts}</td>
      </tr>`;
    });
}

// 3) Lineups (current rosters)
function renderLineups() {
  const tbl = document.getElementById("lineupsTable");
  // header
  let html = "<tr>";
  Object.keys(lockedTeams).forEach(team=>{
    const c = colorMap[team]||"white";
    html += `<th style="color:${c}">${team}</th>`;
  });
  html += "</tr>";

  // find max roster length (should be 6)
  const maxRows = Math.max(...Object.values(lockedTeams).map(r=>r.length));
  for (let i = 0; i < maxRows; i++) {
    html += "<tr>";
    for (const roster of Object.values(lockedTeams)) {
      html += `<td>${roster[i]||""}</td>`;
    }
    html += "</tr>";
  }

  tbl.innerHTML = html;
}

// 4) Race-by-race breakdown
function renderDriverRaceTable() {
  const tbl = document.getElementById("driverRaceTable");
  // header
  let html = "<tr><th>Driver</th>";
  RACE_LIST.forEach(r=> html+=`<th>${r}</th>`);
  html += "</tr>";

  // all drivers drafted or free-agent who've since been picked up
  const drivers = new Set();
  Object.values(lockedTeams).flat().forEach(d=>drivers.add(d));
  Object.values(racePoints).forEach(rObj=>{
    Object.keys(rObj).forEach(d=>drivers.add(d));
  });

  // rows
  drivers.forEach(driver=>{
    html += `<tr><td>${driver}</td>`;
    RACE_LIST.forEach(r=>{
      let pts = "";
      let clr = "white";
      if (racePoints[r] && racePoints[r][driver]) {
        pts = racePoints[r][driver].points;
        clr = colorMap[racePoints[r][driver].team]||"white";
      }
      html += `<td style="color:${clr}">${pts}</td>`;
    });
    html += "</tr>";
  });

  tbl.innerHTML = html;
}

// 5) Trade history
function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  tradeHistory.forEach(entry=>{
    const li = document.createElement("li");
    li.textContent = entry;
    ul.appendChild(li);
  });
}

// 6) Fetch free agents (undrafted) *against* locked-season rosters
async function fetchFreeAgents() {
  try {
    const res = await fetch(`${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(currentSeasonId)}`);
    const data = await res.json();
    freeAgents = data.drivers || [];
    renderFreeAgents();
  } catch(e) {
    console.error("Free-agent fetch failed", e);
    freeAgents = [];
  }
}

// 7) Render free agents in the UL
function renderFreeAgents() {
  const ul = document.getElementById("undraftedList");
  ul.innerHTML = freeAgents.map(d=>`<li>${d}</li>`).join("");
}

// 8) Populate From/To dropdowns (including Free Agency)
function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = `<option value="">Select…</option>`;
  to.innerHTML   = `<option value="">Select…</option>`;
  // each locked team
  Object.keys(lockedTeams).forEach(team=>{
    from.innerHTML += `<option value="${team}">${team}</option>`;
    to.innerHTML   += `<option value="${team}">${team}</option>`;
  });
  // add free agency only to "To"
  to.innerHTML += `<option value="__free_agency__">Free Agency</option>`;
}

// 9) Populate the driver lists when a team (or free agency) is picked
function populateFromDrivers() {
  const sel = document.getElementById("fromDriversSelect");
  const t   = document.getElementById("fromTeamSelect").value;
  sel.innerHTML = "";
  if (t && lockedTeams[t]) {
    lockedTeams[t].forEach(d=>{
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  }
}
function populateToDrivers() {
  const sel = document.getElementById("toDriversSelect");
  const t   = document.getElementById("toTeamSelect").value;
  sel.innerHTML = "";
  if (t === "__free_agency__") {
    freeAgents.forEach(d=>{
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  } else if (t && lockedTeams[t]) {
    lockedTeams[t].forEach(d=>{
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  }
}

// 10) Propose a locked trade (drivers + sweetener)
async function proposeLockedTrade() {
  if (!currentSeasonId) return alert("No season!");
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam   = document.getElementById("toTeamSelect").value;
  const fromDrivers = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value);
  const toDrivers   = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value);
  const fromPts = parseInt(document.getElementById("fromSweetener").value)||0;
  const toPts   = parseInt(document.getElementById("toSweetener").value)||0;

  const payload = { from_team: fromTeam, to_team: toTeam,
                    drivers_from_team: fromDrivers,
                    drivers_to_team:   toDrivers,
                    from_team_points: fromPts,
                    to_team_points:   toPts };

  try {
    const res = await fetch(
      `${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`,
      { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j.detail||j.error);
    alert(j.message);
    // reload everything
    await loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e.message||e);
  }
}

// 11) Refresh race points (latest)
async function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season!");
  try {
    const res = await fetch(
      `${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`,
      { method:"POST" }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j.detail||j.error);
    alert(j.message);
    await loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e.message||e);
  }
}