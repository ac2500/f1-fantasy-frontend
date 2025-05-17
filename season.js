const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// 2025 race list
const RACE_LIST = [
  "Bahrain", "Saudi Arabia", "Miami", "Imola", "Monaco", "Spain",
  "Canada", "Austria", "UK", "Belgium", "Hungary", "Netherlands",
  "Monza", "Azerbaijan", "Singapore", "Texas", "Mexico", "Brazil",
  "Vegas", "Qatar", "Abu Dhabi"
];

let currentSeasonId = null;
let lockedTeams = {};
let lockedPoints = {};
let racePoints = {};
let tradeHistory = [];
let freeAgents = [];

const COLOR_ARRAY = ["green", "blue", "yellow", "orange", "purple"];
let colorMap = {};

window.onload = function() {
  const params = new URLSearchParams(window.location.search);
  const s = params.get("season_id");
  if (!s) {
    alert("No season_id provided!");
    return;
  }
  currentSeasonId = s;
  loadSeasonData(s);
};

function loadSeasonData(seasonId) {
  // 1) fetch locked season snapshot
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(r => r.json())
    .then(data => {
      lockedTeams  = JSON.parse(data.teams);
      lockedPoints = JSON.parse(data.points);
      tradeHistory = data.trade_history || [];
      racePoints   = data.race_points   || {};

      // assign consistent colors
      assignTeamColors(Object.keys(lockedTeams));

      // render everything
      renderLeaderboard();
      renderLineups();
      renderDriverRaceTable();
      renderTradeHistory();
      populateTeamDropdowns();

      // 2) now fetch free agents against that locked snapshot
      return fetch(`${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(seasonId)}`);
    })
    .then(r => r.json())
    .then(d => {
      freeAgents = d.drivers;
      renderFreeAgents();
    })
    .catch(console.error);
}

function assignTeamColors(teams) {
  colorMap = {};
  teams.sort();
  teams.forEach((t,i) => colorMap[t] = COLOR_ARRAY[i] || "white");
}

function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(lockedPoints)
    .sort((a,b)=>b[1]-a[1])
    .forEach(([team,pts])=>{
      const c = colorMap[team] || "white";
      tbl.innerHTML += `<tr>
        <td style="color:${c};">${team}</td>
        <td>${pts}</td>
      </tr>`;
    });
}

function renderLineups() {
  const tbl = document.getElementById("lineupsTable");
  const teams = Object.keys(lockedTeams);
  // header
  let html = `<tr>${teams.map(t=>`<th style="color:${colorMap[t]||"white"}">${t}</th>`).join("")}</tr>`;
  // how many rows?
  const max = Math.max(...teams.map(t=>lockedTeams[t].length));
  for (let i=0; i<max; i++) {
    html += "<tr>";
    teams.forEach(t=> {
      html += `<td>${ (lockedTeams[t][i]||"") }</td>`;
    });
    html += "</tr>";
  }
  tbl.innerHTML = html;
}

function renderDriverRaceTable() {
  const tbl = document.getElementById("driverRaceTable");
  // header row
  let html = `<tr><th>Driver</th>${RACE_LIST.map(r=>`<th>${r}</th>`).join("")}</tr>`;

  // collect all drivers
  const all = new Set();
  Object.values(lockedTeams).forEach(arr=>arr.forEach(d=>all.add(d)));
  Object.values(racePoints).forEach(raceObj=>{
    Object.keys(raceObj).forEach(d=>all.add(d));
  });
  Array.from(all).sort().forEach(driver=>{
    html += `<tr><td>${driver.split(" ").pop()}</td>`; // last name only
    RACE_LIST.forEach(race=>{
      const info = (racePoints[race]||{})[driver];
      if (info) {
        const c = colorMap[info.team] || "white";
        html += `<td style="color:${c}">${info.points}</td>`;
      } else {
        html += `<td style="color:#555">0</td>`;
      }
    });
    html += "</tr>";
  });

  tbl.innerHTML = html;
}

function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  tradeHistory.forEach(entry=>{
    const li = document.createElement("li");
    li.textContent = entry;
    ul.appendChild(li);
  });
}

function renderFreeAgents() {
  const tbody = document.getElementById("freeAgentsBody");
  tbody.innerHTML = "";
  freeAgents.forEach(drv=>{
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = drv.split(" ").pop();  // last name only
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = `<option value="">Select…</option>`;
  to.innerHTML   = `<option value="">Select…</option><option value="Free Agency">Free Agency</option>`;
  Object.keys(lockedTeams).forEach(t=>{
    from.innerHTML += `<option value="${t}">${t}</option>`;
    to.innerHTML   += `<option value="${t}">${t}</option>`;
  });
}

function populateFromDrivers() {
  const team = document.getElementById("fromTeamSelect").value;
  const sel  = document.getElementById("fromDriversSelect");
  sel.innerHTML = "";
  (lockedTeams[team]||[]).forEach(d=>{
    sel.innerHTML += `<option value="${d}">${d}</option>`;
  });
}

function populateToDrivers() {
  const team = document.getElementById("toTeamSelect").value;
  const sel  = document.getElementById("toDriversSelect");
  sel.innerHTML = "";
  if (team === "Free Agency") {
    freeAgents.forEach(d=>{
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  } else {
    (lockedTeams[team]||[]).forEach(d=>{
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  }
}

function draftDriver(team, driver) {
  // unused here
}

function proposeLockedTrade() {
  const from = document.getElementById("fromTeamSelect").value;
  const to   = document.getElementById("toTeamSelect").value;
  const fromDrivers = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value);
  const toDrivers   = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value);
  const fromPts = parseInt(document.getElementById("fromSweetener").value||"0",10);
  const toPts   = parseInt(document.getElementById("toSweetener").value||"0",10);

  fetch(`${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`, {
    method: "POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      from_team: from,
      to_team: to,
      drivers_from_team: fromDrivers,
      drivers_to_team: toDrivers,
      from_team_points: fromPts,
      to_team_points: toPts
    })
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