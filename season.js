const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

let currentSeasonId = null;
let lockedTeams = {};   // {TeamA: [...], TeamB: [...]}
let lockedPoints = {};  // {TeamA: 400, TeamB: 300}
let tradeHistory = [];  // array of strings
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
};

// 1) Load locked season data
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(res => res.json())
    .then(data => {
      // Expected data format: { teams: {TeamA: [...], ...}, points: {TeamA: X, ...}, trade_history?: [...] }
      lockedTeams = data.teams;
      lockedPoints = data.points;
      tradeHistory = data.trade_history || [];
      assignTeamColors(lockedTeams);

      renderLockedTeamsTable(lockedTeams, lockedPoints);
      renderLeaderboard(lockedTeams, lockedPoints);
      renderTradeHistory(tradeHistory);
      populateTeamDropdowns();
    })
    .catch(err => console.error("Error loading season data:", err));
}

// 2) Assign colors to each team in alphabetical order
function assignTeamColors(teams) {
  colorMap = {};
  const sortedTeams = Object.keys(teams).sort();
  sortedTeams.forEach((tName, idx) => {
    colorMap[tName] = COLOR_ARRAY[idx] || "white";
  });
}

// 3) Render locked teams driver-by-driver with color-coded team name
function renderLockedTeamsTable(teams, pointsDict) {
  const table = document.getElementById("lockedTeamsTable");
  table.innerHTML = `
    <tr>
      <th>Team</th>
      <th>Driver</th>
      <th>Team Points</th>
    </tr>
  `;
  for (const [teamName, drivers] of Object.entries(teams)) {
    const teamPts = pointsDict[teamName] || 0;
    const teamColor = colorMap[teamName] || "white";
    drivers.forEach(driver => {
      table.innerHTML += `
        <tr>
          <td style="color:${teamColor};">${teamName}</td>
          <td>${driver}</td>
          <td>${teamPts}</td>
        </tr>
      `;
    });
  }
}

// 4) Render leaderboard by total team points
function renderLeaderboard(teams, pointsDict) {
  const lbTable = document.getElementById("leaderboardTable");
  lbTable.innerHTML = `
    <tr>
      <th>Team</th>
      <th>Total Points</th>
    </tr>
  `;
  let standings = [];
  for (const [teamName, drivers] of Object.entries(teams)) {
    const sumPts = pointsDict[teamName] || 0;
    standings.push([teamName, sumPts]);
  }
  // Sort descending by points
  standings.sort((a, b) => b[1] - a[1]);
  standings.forEach(([tName, pts]) => {
    const teamColor = colorMap[tName] || "white";
    lbTable.innerHTML += `
      <tr>
        <td style="color:${teamColor};">${tName}</td>
        <td>${pts}</td>
      </tr>
    `;
  });
}

// 5) Render trade history
function renderTradeHistory(historyList) {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  historyList.forEach(record => {
    const li = document.createElement("li");
    li.textContent = record;
    ul.appendChild(li);
  });
}

// 6) Populate the team dropdowns for trading
function populateTeamDropdowns() {
  const fromSelect = document.getElementById("fromTeamSelect");
  const toSelect = document.getElementById("toTeamSelect");
  fromSelect.innerHTML = "<option value=''>Select Team</option>";
  toSelect.innerHTML = "<option value=''>Select Team</option>";
  Object.keys(lockedTeams).forEach(teamName => {
    fromSelect.innerHTML += `<option value="${teamName}">${teamName}</option>`;
    toSelect.innerHTML += `<option value="${teamName}">${teamName}</option>`;
  });
}

// 7) Populate drivers for the "from" team
function populateFromDrivers() {
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const fromDriversSelect = document.getElementById("fromDriversSelect");
  fromDriversSelect.innerHTML = "";
  if (!fromTeam || !lockedTeams[fromTeam]) return;
  lockedTeams[fromTeam].forEach(drv => {
    const option = document.createElement("option");
    option.value = drv;
    option.textContent = drv;
    fromDriversSelect.appendChild(option);
  });
}

// 8) Populate drivers for the "to" team
function populateToDrivers() {
  const toTeam = document.getElementById("toTeamSelect").value;
  const toDriversSelect = document.getElementById("toDriversSelect");
  toDriversSelect.innerHTML = "";
  if (!toTeam || !lockedTeams[toTeam]) return;
  lockedTeams[toTeam].forEach(drv => {
    const option = document.createElement("option");
    option.value = drv;
    option.textContent = drv;
    toDriversSelect.appendChild(option);
  });
}

// 9) Propose a locked trade (with two-sided sweetener)
function proposeLockedTrade() {
  if (!currentSeasonId) {
    alert("No season_id in context!");
    return;
  }
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam = document.getElementById("toTeamSelect").value;
  const fromDrivers = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(opt => opt.value);
  const toDrivers = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(opt => opt.value);
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
      if (data.detail) {
        alert(data.detail);
      } else if (data.error) {
        alert(data.error);
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

// 10) NEW: Refresh Race Points function – manually updates team points from a race
function refreshRacePoints() {
  const urlParams = new URLSearchParams(window.location.search);
  const season_id = urlParams.get("season_id");
  const race_id = prompt("Enter the Race ID to update (e.g., 'latest' or a specific race identifier):");
  if (!season_id || !race_id) {
    alert("Season ID or Race ID is missing.");
    return;
  }
  fetch(`${backendUrl}/update_race_points?season_id=${encodeURIComponent(season_id)}&race_id=${encodeURIComponent(race_id)}`, {
    method: "POST"
  })
    .then(res => res.json())
    .then(data => {
      if (data.error || data.detail) {
        alert(data.error || data.detail);
      } else {
        alert(data.message);
        loadSeasonData(season_id);
      }
    })
    .catch(err => console.error("Error updating race points:", err));
}