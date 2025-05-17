const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// The 2025 race list
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
const COLOR_ARRAY = ["green", "blue", "yellow", "orange", "purple"];
let colorMap = {};

window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  currentSeasonId = params.get("season_id");
  if (!currentSeasonId) {
    alert("No season_id provided!");
    return;
  }
  loadSeasonData(currentSeasonId);
};

function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(r => r.json())
    .then(data => {
      lockedTeams   = data.teams    || {};
      lockedPoints  = data.points   || {};
      racePoints    = data.race_points || {};
      tradeHistory  = data.trade_history || [];

      // Build color map
      const allTeams = new Set([...Object.keys(lockedPoints), ...Object.keys(lockedTeams)]);
      Object.values(racePoints).forEach(r => 
        Object.values(r).forEach(d => allTeams.add(d.team))
      );
      assignTeamColors([...allTeams]);

      renderLeaderboard(lockedPoints);
      renderLockedTeamsSimple(lockedTeams);
      renderUndraftedList();
      renderDriverRaceTable(racePoints);
      renderTradeHistory(tradeHistory);
      populateTeamDropdowns(lockedTeams);
    })
    .catch(console.error);
}

function assignTeamColors(teams) {
  colorMap = {};
  teams.sort().forEach((t,i) => colorMap[t] = COLOR_ARRAY[i%COLOR_ARRAY.length]);
}

function renderLeaderboard(points) {
  const table = document.getElementById("leaderboardTable");
  table.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(points)
    .sort((a,b) => b[1] - a[1])
    .forEach(([team,pts]) => {
      const c = colorMap[team]||"white";
      table.innerHTML += `<tr>
        <td style="color:${c}">${team}</td>
        <td>${pts}</td>
      </tr>`;
    });
}

function renderLockedTeamsSimple(teams) {
  const table = document.getElementById("lockedTeamsSimpleTable");
  let hdr = "<tr>";
  let row = "<tr>";
  Object.keys(teams).sort().forEach(team => {
    const c = colorMap[team]||"white";
    hdr += `<th style="color:${c}">${team}</th>`;
    const lastNames = teams[team]
      .map(d => d.split(" ").pop())
      .join("<br>");
    row += `<td>${lastNames}</td>`;
  });
  hdr += "</tr>";
  row += "</tr>";
  table.innerHTML = hdr + row;
}

function renderUndraftedList() {
  fetch(`${backendUrl}/get_available_drivers`)
    .then(r => r.json())
    .then(data => {
      const ul = document.getElementById("undraftedList");
      ul.innerHTML = "";
      data.drivers.forEach(d => {
        const li = document.createElement("li");
        li.textContent = d;
        ul.appendChild(li);
      });
    })
    .catch(console.error);
}

function renderDriverRaceTable(raceData) {
  const table = document.getElementById("driverRaceTable");
  const drivers = new Set();
  Object.values(lockedTeams).flat().forEach(d => drivers.add(d));
  Object.values(raceData).forEach(r => Object.keys(r).forEach(d => drivers.add(d)));

  // Header
  let html = "<tr><th>Driver</th>" + RACE_LIST.map(r=>`<th>${r}</th>`).join("") + "</tr>";
  // Rows
  drivers.forEach(driver => {
    let row = `<tr><td>${driver}</td>`;
    RACE_LIST.forEach(race => {
      let pts = 0, team = findCurrentTeam(driver);
      if (raceData[race] && raceData[race][driver]) {
        pts  = raceData[race][driver].points  
        team = raceData[race][driver].team;
      }
      const c = colorMap[team]||"white";
      row += `<td style="color:${c}">${pts}</td>`;
    });
    html += row + "</tr>";
  });

  table.innerHTML = html;
  function findCurrentTeam(drv) {
    for (let [t,arr] of Object.entries(lockedTeams))
      if (arr.includes(drv)) return t;
    return null;
  }
}

function renderTradeHistory(list) {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  list.forEach(l => {
    const li = document.createElement("li");
    li.textContent = l;
    ul.appendChild(li);
  });
}

function populateTeamDropdowns(teams) {
  const f = document.getElementById("fromTeamSelect"),
        t = document.getElementById("toTeamSelect");
  f.innerHTML = "<option value=''>Select Team</option>";
  t.innerHTML = "<option value=''>Select Team</option>";
  Object.keys(teams).forEach(team => {
    f.innerHTML += `<option>${team}</option>`;
    t.innerHTML += `<option>${team}</option>`;
  });
}

// (Placeholder) those dropdowns remain locked once season is locked
function populateFromDrivers(){/* no-op */}
function populateToDrivers(){/* no-op */}

function proposeLockedTrade() {
  if (!currentSeasonId) return alert("No season_id!");
  const payload = {
    from_team: document.getElementById("fromTeamSelect").value,
    to_team:   document.getElementById("toTeamSelect").value,
    drivers_from_team: [], drivers_to_team: [],
    from_team_points: +document.getElementById("fromSweetener").value||0,
    to_team_points:   +document.getElementById("toSweetener").value||0
  };
  fetch(`${backendUrl}/trade_locked?season_id=${currentSeasonId}`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  })
    .then(r=>r.json())
    .then(d=>{
      if(d.error||d.detail) alert(d.error||d.detail);
      else { alert(d.message); loadSeasonData(currentSeasonId); }
    }).catch(console.error);
}

function refreshRacePoints() {
  fetch(`${backendUrl}/update_race_points?season_id=${currentSeasonId}&race_id=latest`, {
    method:"POST"
  })
    .then(r=>r.json())
    .then(d=>{
      if(d.error||d.detail) alert(d.error||d.detail);
      else { alert(d.message); loadSeasonData(currentSeasonId); }
    }).catch(console.error);
}