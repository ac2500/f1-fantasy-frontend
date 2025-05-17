const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// The 2025 race list (adjust as needed)
const RACE_LIST = [
  "Bahrain", "Saudi Arabia", "Miami", "Imola", "Monaco", "Spain",
  "Canada", "Austria", "UK", "Belgium", "Hungary", "Netherlands",
  "Monza", "Azerbaijan", "Singapore", "Texas", "Mexico", "Brazil",
  "Vegas", "Qatar", "Abu Dhabi"
];

let currentSeasonId = null;
let tradeHistory = [];   // Array of trade log strings
let lockedTeams = {};    // { "TeamName": ["Driver1", ...], ... }
let lockedPoints = {};   // { "TeamName": totalPoints, ... }
let racePoints = {};     // Detailed race breakdown
let undraftedDrivers = []; // Free agents list
const COLOR_ARRAY = ["green", "blue", "yellow", "orange", "purple"];
let colorMap = {};

window.onload = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const seasonId = urlParams.get("season_id");
  if (!seasonId) {
    alert("No season_id provided!");
    return;
  }
  currentSeasonId = seasonId;
  loadSeasonData(seasonId);
  fetchAvailableDrivers();
};

// Fetch undrafted drivers and render free-agency list
function fetchAvailableDrivers() {
  fetch(`${backendUrl}/get_available_drivers`)
    .then(res => res.json())
    .then(data => {
      undraftedDrivers = data.drivers;
      renderUndraftedList();
    })
    .catch(err => console.error("Error fetching available drivers:", err));
}

function renderUndraftedList() {
  const ul = document.getElementById("undraftedList");
  if (!ul) return;
  ul.innerHTML = "";
  undraftedDrivers.forEach(drv => {
    const li = document.createElement("li");
    li.textContent = drv;
    ul.appendChild(li);
  });
}

// Load existing season state from backend
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(res => res.json())
    .then(data => {
      lockedTeams = data.teams || {};
      lockedPoints = data.points || {};
      tradeHistory = data.trade_history || [];
      racePoints = data.race_points || {};

      assignTeamColors(Object.keys(lockedTeams));
      renderLeaderboard(lockedPoints);
      renderDriverRaceTable(racePoints);
      renderTradeHistory(tradeHistory);
      populateTeamDropdowns(lockedTeams);
    })
    .catch(err => console.error("Error loading season data:", err));
}

// Map each team to a consistent color
function assignTeamColors(teamArray) {
  colorMap = {};
  teamArray.sort();
  teamArray.forEach((teamName, idx) => {
    colorMap[teamName] = COLOR_ARRAY[idx] || "white";
  });
}

// Render top leaderboard
function renderLeaderboard(pointsDict) {
  const lbTable = document.getElementById("leaderboardTable");
  if (!lbTable) return;
  lbTable.innerHTML = `
    <tr>
      <th>Fantasy Team</th>
      <th>Total Points</th>
    </tr>
  `;
  Object.entries(pointsDict)
    .sort((a, b) => b[1] - a[1])
    .forEach(([teamName, pts]) => {
      const color = colorMap[teamName] || "white";
      lbTable.innerHTML += `
        <tr>
          <td style="color:${color};">${teamName}</td>
          <td>${pts}</td>
        </tr>
      `;
    });
}

// Render wide race-by-race breakdown
function renderDriverRaceTable(rpData) {
  const table = document.getElementById("driverRaceTable");
  if (!table) return;

  // collect all drivers
  const allDrivers = new Set();
  Object.values(lockedTeams).forEach(arr => arr.forEach(d => allDrivers.add(d)));
  Object.values(rpData).forEach(raceObj => Object.keys(raceObj).forEach(d => allDrivers.add(d)));

  // header row
  let html = '<tr><th>Driver</th>' + RACE_LIST.map(r => `<th>${r}</th>`).join('') + '</tr>';
  table.innerHTML = html;

  // one row per driver
  Array.from(allDrivers).sort().forEach(driver => {
    let row = `<tr><td>${driver}</td>`;
    RACE_LIST.forEach(race => {
      let pts = '';
      let color = 'white';
      if (rpData[race] && rpData[race][driver]) {
        pts = rpData[race][driver].points;
        color = colorMap[rpData[race][driver].team] || 'white';
      }
      row += `<td style="color:${color};">${pts}</td>`;
    });
    row += '</tr>';
    table.innerHTML += row;
  });

  if (allDrivers.size === 0) {
    table.innerHTML = `<tr><td colspan="${RACE_LIST.length + 1}">No drafted drivers found.</td></tr>`;
  }
}

// Render trade history list
function renderTradeHistory(list) {
  const ul = document.getElementById("tradeHistory");
  if (!ul) return;
  ul.innerHTML = "";
  list.forEach(txt => {
    const li = document.createElement("li");
    li.textContent = txt;
    ul.appendChild(li);
  });
}

// Populate team dropdowns; include Free Agency
function populateTeamDropdowns(teamsData) {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  if (!from || !to) return;
  from.innerHTML = '<option value="">Select Team</option>';
  to.innerHTML   = '<option value="">Select Team</option>';

  Object.keys(teamsData).forEach(team => {
    from.innerHTML += `<option value="${team}">${team}</option>`;
    to.innerHTML   += `<option value="${team}">${team}</option>`;
  });
  to.innerHTML += '<option value="__free">Free Agency</option>';
}

// Populate "from" drivers (always from a locked team)
function populateFromDrivers() {
  const team = document.getElementById("fromTeamSelect").value;
  const sel  = document.getElementById("fromDriversSelect");
  sel.innerHTML = "";
  if (lockedTeams[team]) lockedTeams[team].forEach(d => sel.innerHTML += `<option>${d}</option>`);
}

// Populate "to" drivers; use free agents if "Free Agency"
function populateToDrivers() {
  const team = document.getElementById("toTeamSelect").value;
  const sel  = document.getElementById("toDriversSelect");
  sel.innerHTML = "";
  if (team === "__free") {
    undraftedDrivers.forEach(d => sel.innerHTML += `<option>${d}</option>`);
  } else if (lockedTeams[team]) {
    lockedTeams[team].forEach(d => sel.innerHTML += `<option>${d}</option>`);
  }
}

// Propose a locked trade
async function proposeLockedTrade() {
  if (!currentSeasonId) return alert("No season in context");
  const req = {
    from_team: document.getElementById("fromTeamSelect").value,
    to_team:   document.getElementById("toTeamSelect").value,
    drivers_from_team: Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value),
    drivers_to_team:   Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value),
    from_team_points: parseInt(document.getElementById("fromSweetener").value||0,10),
    to_team_points:   parseInt(document.getElementById("toSweetener").value||0,10)
  };
  const res = await fetch(`${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`, {
    method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(req)
  });
  const data = await res.json();
  if (data.error||data.detail) alert(data.error||data.detail);
  else {
    alert(data.message);
    if (data.trade_history) renderTradeHistory(data.trade_history);
    loadSeasonData(currentSeasonId);
  }
}

// Refresh latest race points
async function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season in context");
  const res = await fetch(`${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`, { method:'POST' });
  const data = await res.json();
  if (data.error||data.detail) alert(data.error||data.detail);
  else { alert(data.message); loadSeasonData(currentSeasonId); }
}
