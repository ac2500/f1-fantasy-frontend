// season.js (full file)
const backendUrl = "https://api.jolpi.ca";

let currentSeasonId = null;
let lockedTeams     = {};
let lockedPoints    = {};
let tradeHistory    = [];
let racePoints      = {};
let processedRaces  = [];

const COLOR_ARRAY = ["green", "blue", "yellow", "orange", "purple"];
let colorMap = {};

window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("season_id");
  if (!sid) return alert("No season_id in URL!");
  currentSeasonId = sid;
  loadSeasonData(sid);
};

// 1) Load everything for this locked season
async function loadSeasonData(seasonId) {
  try {
    const res = await fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`);
    if (!res.ok) throw new Error("Season load failed");
    const data = await res.json();

    // core data
    processedRaces = data.processed_races || [];
    lockedTeams    = data.teams           || {};
    lockedPoints   = data.points          || {};
    tradeHistory   = data.trade_history   || [];
    racePoints     = data.race_points     || {};

    // assign colors
    Object.keys(lockedTeams)
      .sort()
      .forEach((team, i) => colorMap[team] = COLOR_ARRAY[i] || "white");

    // render all sections
    renderLeaderboard();
    renderLineups();
    renderDriverRaceTable();
    renderTradeHistory();

    // now load free agents & refill dropdowns
    await fetchFreeAgents();
    populateTeamDropdowns();
  } catch (e) {
    console.error(e);
    alert("Error loading season data.");
  }
}

// 2) Leaderboard
function renderLeaderboard() {
  const lb = document.getElementById("leaderboardTable");
  lb.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(lockedPoints)
    .sort((a,b) => b[1] - a[1])
    .forEach(([team,pts]) => {
      lb.innerHTML += `
        <tr>
          <td style="color:${colorMap[team]}">${team}</td>
          <td>${pts}</td>
        </tr>`;
    });
}

// 3) Lineups
function renderLineups() {
  const table = document.getElementById("lineupsTable");
  table.innerHTML = `<tr>${Object.keys(lockedTeams).map(t => `<th style="color:${colorMap[t]}">${t}</th>`).join("")}</tr>`;
  // assume each team has 6 drivers
  for (let row=0; row<6; row++) {
    table.innerHTML += `<tr>${Object.values(lockedTeams).map(drivers => 
      `<td>${drivers[row] || ""}</td>`
    ).join("")}</tr>`;
  }
}

// 4) Race-by-race breakdown
function renderDriverRaceTable() {
  const table = document.getElementById("driverRaceTable");
  const races = [
    "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
    "Canada","Austria","UK","Belgium","Hungary","Netherlands",
    "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
    "Vegas","Qatar","Abu Dhabi"
  ];
  // header
  table.innerHTML = `<tr><th>Driver</th>${races.map(r=>`<th>${r}</th>`).join("")}</tr>`;
  // list all drivers in racePoints
  const drivers = new Set();
  Object.values(racePoints).forEach(rmap => {
    Object.keys(rmap).forEach(d=>drivers.add(d));
  });
  Array.from(drivers).sort().forEach(driver => {
    let row = `<tr><td>${driver}</td>`;
    races.forEach(r => {
      const info = (racePoints[r]||{})[driver];
      const pts = info?.points||"";
      const clr = colorMap[info?.team]||"white";
      row += `<td style="color:${clr}">${pts}</td>`;
    });
    row += "</tr>";
    table.innerHTML += row;
  });
}

// 5) Trade history
function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  tradeHistory.forEach(h => {
    const li = document.createElement("li");
    li.textContent = h;
    ul.appendChild(li);
  });
}

// 6) Free agents
async function fetchFreeAgents() {
  const res = await fetch(`${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(currentSeasonId)}`);
  const { drivers } = await res.json();
  renderFreeAgents(drivers);
}
function renderFreeAgents(drivers) {
  const tbody = document.getElementById("freeAgentsBody");
  tbody.innerHTML = drivers
    .map(d => `<tr><td>${d.split(" ").slice(-1)[0]}</td></tr>`)
    .join("");
}

// 7) Populate dropdowns (includes Free Agency)
function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  [from,to].forEach(sel => sel.innerHTML = `<option value="">Select…</option>`);
  Object.keys(lockedTeams).forEach(t => {
    from.innerHTML += `<option value="${t}">${t}</option>`;
    to.innerHTML   += `<option value="${t}">${t}</option>`;
  });
  to.innerHTML += `<option value="Free Agency">Free Agency</option>`;
}

// 8) Refresh Race Points (next unprocessed round)
async function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season_id in context!");
  const nextRace = processedRaces.length
    ? Math.max(...processedRaces.map(r=>+r)) + 1
    : 4;
  try {
    const res  = await fetch(
      `${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}`+
      `&race_id=${encodeURIComponent(nextRace)}`, { method:"POST" }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail||json.error);
    alert(json.message);
    await loadSeasonData(currentSeasonId);
  } catch (err) {
    if (/processed|no new races/i.test(err.message))
      alert("No new races to update points.");
    else alert(err.message||err);
  }
}

// 9) Propose Locked Trade
async function proposeLockedTrade() {
  const from = document.getElementById("fromTeamSelect").value;
  const to   = document.getElementById("toTeamSelect").value;
  const fromDrivers = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value);
  const toDrivers   = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value);
  const payload = {
    from_team: from,
    to_team: to,
    drivers_from_team: fromDrivers,
    drivers_to_team: toDrivers,
    from_team_points: +document.getElementById("fromSweetener").value||0,
    to_team_points: +document.getElementById("toSweetener").value||0
  };
  try {
    const res = await fetch(`${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail||json.error);
    alert(json.message);
    if (json.trade_history) tradeHistory = json.trade_history;
    await loadSeasonData(currentSeasonId);
  } catch(err) {
    alert(err.message||err);
  }
}