const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

let currentSeasonId = null;
let lockedTeams = {};   // {TeamA: [...], TeamB: [...]}
let lockedPoints = {};  // {TeamA: totalPoints, TeamB: totalPoints}
let tradeHistory = [];  // array of strings
let racePoints = {};    // Object mapping race names to per-team points, e.g. { "Bahrain GP": {TeamA: 10, TeamB: 20}, ... }
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

// 1) Load locked season data, now including race_points breakdown
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(res => res.json())
    .then(data => {
      // Expected format: { teams: {...}, points: {...}, trade_history: [...], race_points: {...} }
      lockedTeams = data.teams;
      lockedPoints = data.points;
      tradeHistory = data.trade_history || [];
      racePoints = data.race_points || {};
      assignTeamColors(lockedTeams);

      renderLockedTeamsTable(lockedTeams, lockedPoints);
      renderLeaderboard(lockedTeams, lockedPoints);
      renderTradeHistory(tradeHistory);
      renderRaceBreakdown(racePoints);
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

// 3) Render locked teams (detailed roster with team points)
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

// 4) Render overall leaderboard by total team points
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

// 6) Render race-by-race breakdown table
function renderRaceBreakdown(racePointsData) {
  const breakdownTable = document.getElementById("raceBreakdownTable");
  // If no race points data exists, just display a message
  if (Object.keys(racePointsData).length === 0) {
    breakdownTable.innerHTML = "<tr><td>No race breakdown data available yet.</td></tr>";
    return;
  }
  // Build header: first column for Team name, then one column per race
  let headerRow = "<tr><th>Team</th>";
  const raceNames = Object.keys(racePointsData).sort();
  raceNames.forEach(race => {
    headerRow += `<th>${race}</th>`;
  });
  headerRow += "</tr>";
  breakdownTable.innerHTML = headerRow;
  
  // Build a row for each team
  Object.keys(lockedTeams).forEach(teamName => {
    let row = `<tr><td style="color:${colorMap[teamName] || 'white'};">${teamName}</td>`;
    raceNames.forEach(race => {
      // Expect racePointsData[race] to be an object: { TeamName: points, ... }
      const teamRacePoints = racePointsData[race][teamName] || 0;
      // You can include more styling here if needed
      row += `<td style="color:${colorMap[teamName] || 'white'};">${teamRacePoints}</td>`;
    });
    row += "</tr>";
    breakdownTable.innerHTML += row;
  });
}

// 7) Populate team dropdowns for trading
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

// 8) Populate drivers for the "from" team
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

// 9) Populate drivers for the "to" team
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

// 10) Propose a locked trade (with two-sided sweetener)
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

// 11) NEW: Refresh Race Points function – automatically uses "latest"
function refreshRacePoints() {
  const urlParams = new URLSearchParams(window.location.search);
  const season_id = urlParams.get("season_id");
  if (!season_id) {
    alert("Season ID is missing.");
    return;
  }
  // Automatically use "latest" as the race_id
  const race_id = "latest";
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

// Initial load
updateTeams();
updateDrivers();