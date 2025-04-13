const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// The 2025 race list (feel free to modify or reorder)
const RACE_LIST = [
  "Bahrain", "Saudi Arabia", "Miami", "Imola", "Monaco", "Spain",
  "Canada", "Austria", "UK", "Belgium", "Hungary", "Netherlands",
  "Monza", "Azerbaijan", "Singapore", "Texas", "Mexico", "Brazil",
  "Vegas", "Qatar", "Abu Dhabi"
];

let currentSeasonId = null;
let tradeHistory = [];   // e.g. ["On 2025-04-13, ...", ...]
let lockedPoints = {};   // {TeamA: 100, TeamB: 80, etc.} for the LEADERBOARD
let racePoints = {};     // { "Bahrain": { "Oscar Piastri": {points: 25, team: "Tinsley Titters"}, ...}, ... }
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
  loadSeasonData(currentSeasonId);
};

// 1) Load locked season data
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(res => res.json())
    .then(data => {
      // We'll expect: {
      //   teams: {...},        // optional if you want to see which drivers are on which team
      //   points: {...},       // team-based total points
      //   trade_history: [...],
      //   race_points: {...}   // driver-based race breakdown
      // }
      lockedPoints = data.points || {};
      tradeHistory = data.trade_history || [];
      racePoints = data.race_points || {};

      // Build color mapping for teams from the lockedPoints keys plus any teams in race_points
      const allTeams = new Set(Object.keys(lockedPoints));
      for (const raceName in racePoints) {
        for (const driverName in racePoints[raceName]) {
          const t = racePoints[raceName][driverName].team;
          allTeams.add(t);
        }
      }
      assignTeamColors(Array.from(allTeams));

      renderLeaderboard(lockedPoints);
      renderDriverRaceTable(racePoints);
      renderTradeHistory(tradeHistory);

      // If you have data.teams for trades, you can store and use it in populateTeamDropdowns
      if (data.teams) {
        populateTeamDropdowns(data.teams);
      }
    })
    .catch(err => console.error("Error loading season data:", err));
}

// 2) Assign colors to teams
function assignTeamColors(teamArray) {
  colorMap = {};
  teamArray.sort(); // keep it consistent
  teamArray.forEach((teamName, idx) => {
    colorMap[teamName] = COLOR_ARRAY[idx] || "white";
  });
}

// 3) Render the top leaderboard
function renderLeaderboard(pointsDict) {
  const lbTable = document.getElementById("leaderboardTable");
  if (!lbTable) return;
  // Reset table header row (or keep existing).
  lbTable.innerHTML = `
    <tr>
      <th>Team</th>
      <th>Total Points</th>
    </tr>
  `;

  // Convert pointsDict {TeamA: 50, TeamB: 70} to array for sorting
  const sortedTeams = Object.entries(pointsDict).sort((a,b) => b[1] - a[1]);
  sortedTeams.forEach(([teamName, pts]) => {
    const color = colorMap[teamName] || "white";
    lbTable.innerHTML += `
      <tr>
        <td style="color:${color};">${teamName}</td>
        <td>${pts}</td>
      </tr>
    `;
  });
}

// 4) Render the wide table: driver rows, race columns
function renderDriverRaceTable(racePointsData) {
  const table = document.getElementById("driverRaceTable");
  if (!table) return;

  // Gather all drivers from racePoints
  const allDriversSet = new Set();
  for (const raceName in racePointsData) {
    for (const driverName in racePointsData[raceName]) {
      allDriversSet.add(driverName);
    }
  }
  const allDrivers = Array.from(allDriversSet).sort();

  // Build the header row: 1 col for "Driver", then columns for each race
  let headerHtml = "<tr><th>Driver</th>";
  RACE_LIST.forEach(r => {
    headerHtml += `<th>${r}</th>`;
  });
  headerHtml += "</tr>";
  table.innerHTML = headerHtml;

  // For each driver, create a row with a cell for each race
  allDrivers.forEach(driverName => {
    let rowHtml = `<tr><td>${driverName}</td>`;
    RACE_LIST.forEach(race => {
      let cellPoints = "";
      let cellColor = "white";
      if (racePointsData[race] && racePointsData[race][driverName]) {
        const info = racePointsData[race][driverName];
        cellPoints = info.points || 0;
        cellColor = colorMap[info.team] || "white";
      }
      rowHtml += `<td style="color:${cellColor};">${cellPoints}</td>`;
    });
    rowHtml += "</tr>";
    table.innerHTML += rowHtml;
  });

  // If no drivers exist, show a message
  if (allDrivers.length === 0) {
    table.innerHTML = "<tr><td>No race data available yet.</td></tr>";
  }
}

// 5) Render trade history
function renderTradeHistory(historyList) {
  const ul = document.getElementById("tradeHistory");
  if (!ul) return;
  ul.innerHTML = "";
  historyList.forEach(record => {
    const li = document.createElement("li");
    li.textContent = record;
    ul.appendChild(li);
  });
}

// 6) Populate trade dropdowns
function populateTeamDropdowns(teamsData) {
  const fromSelect = document.getElementById("fromTeamSelect");
  const toSelect = document.getElementById("toTeamSelect");
  if (!fromSelect || !toSelect) return;

  fromSelect.innerHTML = "<option value=''>Select Team</option>";
  toSelect.innerHTML = "<option value=''>Select Team</option>";
  Object.keys(teamsData).forEach(team => {
    fromSelect.innerHTML += `<option value="${team}">${team}</option>`;
    toSelect.innerHTML += `<option value="${team}">${team}</option>`;
  });
}

// 7) Show drivers in fromDriversSelect
function populateFromDrivers() {
  // If needed, fetch data from lockedTeams. For now, we’ll just show a placeholder, since locked is locked.
  const fromDriversSelect = document.getElementById("fromDriversSelect");
  if (!fromDriversSelect) return;
  fromDriversSelect.innerHTML = "<option>Locked - no data</option>";
}

// 8) Show drivers in toDriversSelect
function populateToDrivers() {
  const toDriversSelect = document.getElementById("toDriversSelect");
  if (!toDriversSelect) return;
  toDriversSelect.innerHTML = "<option>Locked - no data</option>";
}

// 9) Propose a locked trade
function proposeLockedTrade() {
  if (!currentSeasonId) {
    alert("No season_id in context!");
    return;
  }
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam = document.getElementById("toTeamSelect").value;
  const fromDrivers = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o => o.value);
  const toDrivers = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o => o.value);
  const fromSweetener = parseInt(document.getElementById("fromSweetener").value || "0", 10);
  const toSweetener = parseInt(document.getElementById("toSweetener").value || "0", 10);

  const payload = {
    from_team: fromTeam,
    to_team: toTeam,
    drivers_from_team: fromDrivers,
    drivers_to_team: toDrivers,
    from_team_points: fromSweetener,
    to_team_points: toSweetener
  };

  fetch(`${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      if (data.error || data.detail) {
        alert(data.error || data.detail);
      } else {
        alert(data.message);
        if (data.trade_history) {
          renderTradeHistory(data.trade_history);
        }
        loadSeasonData(currentSeasonId);
      }
    })
    .catch(err => console.error("Error proposing locked trade:", err));
}

// 10) Refresh Race Points automatically with "latest"
function refreshRacePoints() {
  if (!currentSeasonId) {
    alert("No season_id in context!");
    return;
  }
  const race_id = "latest"; // no prompt
  fetch(`${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=${encodeURIComponent(race_id)}`, {
    method: "POST"
  })
    .then(res => res.json())
    .then(data => {
      if (data.error || data.detail) {
        alert(data.error || data.detail);
      } else {
        alert(data.message);
        loadSeasonData(currentSeasonId);
      }
    })
    .catch(err => console.error("Error refreshing race points:", err));
}