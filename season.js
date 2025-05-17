const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// The 2025 race list (in order)
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

let currentSeasonId = null;
let lockedTeams = {};    // { teamName: [drivers...] }
let lockedPoints = {};   // { teamName: totalPts }
let racePoints = {};     // { raceName: { driver: { points, team }, ... } }
let tradeHistory = [];
const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};

window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("season_id");
  if (!sid) return alert("No season_id provided!");
  currentSeasonId = sid;
  loadSeasonData(sid);
};

// 1) Fetch everything
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(r => r.json())
    .then(data => {
      lockedTeams   = data.teams   || {};
      lockedPoints  = data.points  || {};
      tradeHistory  = data.trade_history || [];
      racePoints    = data.race_points   || {};

      // Color map from all team names
      const allTeams = new Set(Object.keys(lockedTeams));
      Object.values(racePoints).forEach(r => 
        Object.values(r).forEach(info => allTeams.add(info.team))
      );
      assignTeamColors(Array.from(allTeams));

      renderLeaderboard();
      renderLineups();
      renderDriverRaceTable();
      renderFreeAgents();
      renderTradeHistory();
      populateTeamDropdowns();
    })
    .catch(console.error);
}

// 2) Assign each team a consistent color
function assignTeamColors(teams) {
  teams.sort();
  colorMap = {};
  teams.forEach((t,i) => colorMap[t] = COLOR_ARRAY[i % COLOR_ARRAY.length]);
}

// 3) Leaderboard
function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(lockedPoints)
    .sort((a,b)=>b[1]-a[1])
    .forEach(([team,pts]) => {
      tbl.innerHTML += `
        <tr>
          <td style="color:${colorMap[team]};">${team}</td>
          <td>${pts}</td>
        </tr>`;
    });
}

// 4) Lineups table
function renderLineups() {
  const tbl = document.getElementById("lockedTeamsSimpleTable");
  tbl.innerHTML = "";
  // header row
  let header = "<tr>";
  Object.keys(lockedTeams).forEach(t => header += `<th style="color:${colorMap[t]};">${t}</th>`);
  header += "</tr>";
  // find max roster size
  const maxLen = Math.max(...Object.values(lockedTeams).map(r=>r.length));
  // rows of last names
  let rows = "";
  for (let i=0; i<maxLen; i++) {
    rows += "<tr>";
    Object.values(lockedTeams).forEach(roster => {
      const driver = roster[i] || "";
      const last = driver ? driver.split(" ").pop() : "";
      rows += `<td>${last}</td>`;
    });
    rows += "</tr>";
  }
  tbl.innerHTML = header + rows;
}

// 5) Race-by-race breakdown
function renderDriverRaceTable() {
  const tbl = document.getElementById("driverRaceTable");
  tbl.innerHTML = "";

  // collect all drafted drivers
  const allDrivers = new Set();
  Object.values(lockedTeams).forEach(r=>r.forEach(d=>allDrivers.add(d)));
  const drivers = Array.from(allDrivers).sort();

  // header
  let html = "<tr><th>Driver</th>";
  RACE_LIST.forEach(race => html += `<th>${race}</th>`);
  html += "</tr>";

  // rows
  drivers.forEach(d => {
    html += `<tr><td>${d.split(" ").pop()}</td>`;
    RACE_LIST.forEach(race => {
      const info = (racePoints[race]||{})[d];
      if (info) {
        html += `<td style="color:${colorMap[info.team]};">${info.points}</td>`;
      } else {
        html += `<td style="color:#444;">0</td>`;
      }
    });
    html += "</tr>";
  });

  if (drivers.length===0) {
    tbl.innerHTML = `<tr><td colspan="${RACE_LIST.length+1}">No drafted drivers found.</td></tr>`;
  } else {
    tbl.innerHTML = html;
  }
}

// 6) Free agents
function renderFreeAgents() {
  fetch(`${backendUrl}/get_free_agents?season_id=${currentSeasonId}`)
    .then(r=>r.json())
    .then(json=>{
      const ul = document.getElementById("undraftedList");
      ul.innerHTML = "";
      json.free_agents.forEach(drv => {
        const li = document.createElement("li");
        li.textContent = drv.split(" ").pop();
        ul.appendChild(li);
      });
    })
    .catch(console.error);
}

// 7) Trade history
function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  tradeHistory.forEach(rec => {
    const li = document.createElement("li");
    li.textContent = rec;
    ul.appendChild(li);
  });
}

// 8) Populate dropdowns
function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = "<option value=''>Select Team</option>";
  to.innerHTML   = "<option value=''>Select Team</option>";
  Object.keys(lockedTeams).forEach(t => {
    from.innerHTML += `<option value="${t}">${t}</option>`;
    to.innerHTML   += `<option value="${t}">${t}</option>`;
  });
}

// 9) When choosing drivers to drop/add
function populateFromDrivers() {
  const sel = document.getElementById("fromDriversSelect");
  const team = document.getElementById("fromTeamSelect").value;
  sel.innerHTML = "";
  (lockedTeams[team]||[]).forEach(d => {
    const opt = document.createElement("option");
    opt.value = d; opt.textContent = d.split(" ").pop();
    sel.appendChild(opt);
  });
}
function populateToDrivers() {
  const sel = document.getElementById("toDriversSelect");
  sel.innerHTML = "";
  // if "Free Agency" selected?
  const team = document.getElementById("toTeamSelect").value;
  if (!lockedTeams[team]) {
    // free agents
    document.querySelectorAll("#undraftedList li").forEach(li => {
      const opt = document.createElement("option");
      opt.value = li.textContent;
      opt.textContent = li.textContent;
      sel.appendChild(opt);
    });
  } else {
    // trades between teams (none here)
    (lockedTeams[team]||[]).forEach(d => {
      const opt = document.createElement("option");
      opt.value = d; opt.textContent = d.split(" ").pop();
      sel.appendChild(opt);
    });
  }
}

// 10) Confirm trade / free agen cy swap
function proposeLockedTrade() {
  // ... your existing logic ...
}

// 11) Refresh race points automatically
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