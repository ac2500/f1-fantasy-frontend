const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

let currentSeasonId = null;
let lockedTeams = {};   // {TeamA: [...], TeamB: [...]}
let lockedPoints = {};  // {TeamA: 400, TeamB: 300}

// 1. On page load, parse ?season_id
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

// 2. Load locked season data
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(res => res.json())
    .then(data => {
      // data => { teams: {TeamA: [...], ...}, points: {TeamA: X, ...} }
      lockedTeams = data.teams;
      lockedPoints = data.points;
      renderLockedTeamsTable(lockedTeams, lockedPoints);
      renderLeaderboard(lockedTeams, lockedPoints);
      populateTeamDropdowns();
    })
    .catch(err => console.error("Error loading season data:", err));
}

// 3. Render locked teams driver-by-driver
function renderLockedTeamsTable(teams, pointsDict) {
  const table = document.getElementById("lockedTeamsTable");
  table.innerHTML = `
    <tr>
      <th>Team</th>
      <th>Driver</th>
      <th>Team Points</th>
    </tr>
  `;
  // each driver on its own row
  for (const [teamName, drivers] of Object.entries(teams)) {
    const teamPts = pointsDict[teamName] || 0;
    // create row for each driver
    drivers.forEach(driver => {
      table.innerHTML += `
        <tr>
          <td>${teamName}</td>
          <td>${driver}</td>
          <td>${teamPts}</td>
        </tr>
      `;
    });
  }
}

// 4. Leaderboard by total team points
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
  // sort desc
  standings.sort((a,b) => b[1] - a[1]);

  standings.forEach(([tName, pts]) => {
    lbTable.innerHTML += `
      <tr>
        <td>${tName}</td>
        <td>${pts}</td>
      </tr>
    `;
  });
}

// 5. Populate the fromTeamSelect, toTeamSelect
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

// 6. When user picks a fromTeam, show its drivers in fromDriversSelect
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

// 7. When user picks a toTeam, show its drivers in toDriversSelect
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

// 8. Propose a locked trade (two-sided sweetener)
function proposeLockedTrade() {
  if (!currentSeasonId) {
    alert("No season_id in context!");
    return;
  }

  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam = document.getElementById("toTeamSelect").value;

  // gather selected drivers
  const fromDrivers = Array.from(document.getElementById("fromDriversSelect").selectedOptions)
                           .map(opt => opt.value);
  const toDrivers = Array.from(document.getElementById("toDriversSelect").selectedOptions)
                         .map(opt => opt.value);

  const fromSweetener = parseInt(document.getElementById("fromSweetener").value || "0", 10);
  const toSweetener = parseInt(document.getElementById("toSweetener").value || "0", 10);

  // POST /trade_locked?season_id=xxx
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
        // refresh
        loadSeasonData(currentSeasonId);
      }
    })
    .catch(err => console.error("Error proposing locked trade:", err));
}