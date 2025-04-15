const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// The 2025 race list (adjust as needed)
const RACE_LIST = [
  "Bahrain", "Saudi Arabia", "Miami", "Imola", "Monaco", "Spain",
  "Canada", "Austria", "UK", "Belgium", "Hungary", "Netherlands",
  "Monza", "Azerbaijan", "Singapore", "Texas", "Mexico", "Brazil",
  "Vegas", "Qatar", "Abu Dhabi"
];
let lockedTeams = {};
let currentSeasonId = null;
let tradeHistory = [];   // Example: ["On 2025-04-13, ...", ...]
let lockedPoints = {};   // Overall team totals: {TeamA: number, TeamB: number, ...}
let racePoints = {};     // Detailed race breakdown: { "Bahrain": { "Driver1": {points: number, team: "TeamName"}, ... }, ... }
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

// 1) Load locked season data from the backend
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(res => res.json())
    .then(data => {
      lockedTeams = data.teams || {};
      lockedPoints = data.points || {};
      tradeHistory = data.trade_history || [];
      racePoints = data.race_points || {};

      // Build the color map from lockedPoints, lockedTeams, and racePoints
      const allTeams = new Set(Object.keys(lockedPoints));
      Object.keys(lockedTeams).forEach(team => allTeams.add(team));
      for (const race in racePoints) {
        for (const driver in racePoints[race]) {
          const t = racePoints[race][driver].team;
          if (t) allTeams.add(t);
        }
      }
      assignTeamColors(Array.from(allTeams));

      // Render the top leaderboard
      renderLeaderboard(lockedPoints);
      // NEW: Render the "Lineups" table below the leaderboard.
      renderLockedTeamsSimple(lockedTeams);
      // Render the race-by-race breakdown table
      renderDriverRaceTable(racePoints);
      // Render trade history
      renderTradeHistory(tradeHistory);
      // Populate team dropdowns for trades if teams data is available
      if (data.teams) {
        populateTeamDropdowns(data.teams);
      }
    })
    .catch(err => console.error("Error loading season data:", err));
}

// 2) Assign colors to teams
function assignTeamColors(teamArray) {
  colorMap = {};
  teamArray.sort(); // ensure consistent order
  teamArray.forEach((teamName, idx) => {
    colorMap[teamName] = COLOR_ARRAY[idx] || "white";
  });
}

// 3) Render the top leaderboard with overall team points
function renderLeaderboard(pointsDict) {
  const lbTable = document.getElementById("leaderboardTable");
  if (!lbTable) return;
  lbTable.innerHTML = `
    <tr>
      <th>Fantasy Team</th>
      <th>Total Points</th>
    </tr>
  `;
  const sortedTeams = Object.entries(pointsDict).sort((a, b) => b[1] - a[1]);
  sortedTeams.forEach(([teamName, pts]) => {
    const teamColor = colorMap[teamName] || "white";
    lbTable.innerHTML += `
      <tr>
        <td style="color:${teamColor};">${teamName}</td>
        <td>${pts}</td>
      </tr>
    `;
  });
}

// 4) Render the wide driver race breakdown table
function renderDriverRaceTable(racePointsData) {
  const table = document.getElementById("driverRaceTable");
  if (!table) return;
  
  // Gather all drivers from lockedTeams and from racePoints
  const allDriversSet = new Set();
  if (lockedTeams) {
    for (const team in lockedTeams) {
      lockedTeams[team].forEach(driver => allDriversSet.add(driver));
    }
  }
  for (const race in racePointsData) {
    for (const driver in racePointsData[race]) {
      allDriversSet.add(driver);
    }
  }
  const allDrivers = Array.from(allDriversSet).sort();

  // Build the header row: "Driver" + each race in RACE_LIST
  let headerHtml = "<tr><th>Driver</th>";
  RACE_LIST.forEach(race => {
    headerHtml += `<th>${race}</th>`;
  });
  headerHtml += "</tr>";
  table.innerHTML = headerHtml;

  // BUILD TABLE ROWS
  allDrivers.forEach(driverName => {
    let rowHtml = `<tr><td>${driverName}</td>`;

    RACE_LIST.forEach(race => {
      let cellPoints = "";
      let cellColor = "white";

      // Check if the backend stored data for this driver & race
      if (racePointsData[race] && racePointsData[race][driverName]) {
        // This driver has data for this race
        const info = racePointsData[race][driverName];
        cellPoints = (info.points !== undefined) ? info.points : "0";
        cellColor = colorMap[info.team] || "white";

      } else {
        // No data for this driver in this race => show "0" in the driver's current team color
        const currentTeam = findCurrentTeamOfDriver(driverName);
        if (currentTeam) {
          cellColor = colorMap[currentTeam] || "white";
        }
        cellPoints = "0";  // Show zero
      }

      rowHtml += `<td style="color:${cellColor};">${cellPoints}</td>`;
    });

    rowHtml += "</tr>";
    table.innerHTML += rowHtml;
  });

  // If no drivers exist, show a fallback message
  if (allDrivers.length === 0) {
    table.innerHTML = `<tr><td colspan="${RACE_LIST.length + 1}">No drafted drivers found.</td></tr>`;
  }
}

// HELPER: Find which team (if any) a driver is currently on
function findCurrentTeamOfDriver(driverName) {
  for (const [teamName, driverArr] of Object.entries(lockedTeams)) {
    if (driverArr.includes(driverName)) {
      return teamName;
    }
  }
  return null;
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

// 6) Populate trade dropdowns (for proposing trades)
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

// 7) (Placeholder) Populate drivers in the "from" team dropdown
function populateFromDrivers() {
  const fromDriversSelect = document.getElementById("fromDriversSelect");
  if (!fromDriversSelect) return;
  fromDriversSelect.innerHTML = "<option>Locked - no data</option>";
}

// 8) (Placeholder) Populate drivers in the "to" team dropdown
function populateToDrivers() {
  const toDriversSelect = document.getElementById("toDriversSelect");
  if (!toDriversSelect) return;
  toDriversSelect.innerHTML = "<option>Locked - no data</option>";
}

// 9) Propose a locked trade (with two-sided sweetener)
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

// 10) Refresh Race Points: automatically use "latest" as race_id
function refreshRacePoints() {
  if (!currentSeasonId) {
    alert("No season_id in context!");
    return;
  }
  const race_id = "latest"; // Automatically use "latest" without prompt
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

function renderLockedTeamsSimple(teams) {
  const table = document.getElementById("lockedTeamsSimpleTable");
  if (!table) return;
  
  // Create header row with team names
  let headerRow = "<tr>";
  // Create drivers row that will list the driver's last names
  let driversRow = "<tr>";
  
  // Sort the team names for consistency
  Object.keys(teams).sort().forEach(teamName => {
    const teamColor = colorMap[teamName] || "white";
    headerRow += `<th style="color:${teamColor};">${teamName}</th>`;
  
    // For each driver in the team's roster, extract the last name and join with <br>
    const driversHtml = teams[teamName]
      .map(driver => driver.split(" ").pop())
      .join("<br>");
    driversRow += `<td>${driversHtml}</td>`;
  });
  headerRow += "</tr>";
  driversRow += "</tr>";
  
  table.innerHTML = headerRow + driversRow;
}