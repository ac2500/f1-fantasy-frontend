const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

window.onload = function() {
  // On load, parse ?season_id=xxx
  const urlParams = new URLSearchParams(window.location.search);
  const seasonId = urlParams.get("season_id");
  if (!seasonId) {
    alert("No season_id provided!");
    return;
  }
  loadSeasonData(seasonId);
};

// 1. Load locked season data
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(res => res.json())
    .then(data => {
      // data => { "teams": {"TeamA": [...], "TeamB": [...]}, "points": {"TeamA": 400, "TeamB": 300} }
      renderLockedTeamsTable(data.teams, data.points);
      renderLeaderboard(data.teams, data.points);
    })
    .catch(err => console.error("Error loading season data:", err));
}

// 2. Render locked teams
function renderLockedTeamsTable(teams, pointsDict) {
  const table = document.getElementById("lockedTeamsTable");
  table.innerHTML = `
    <tr>
      <th>Team</th>
      <th>Drivers</th>
      <th>Points</th>
    </tr>
  `;
  // teams => { TeamA: [...drivers], TeamB: [...], ... }
  // pointsDict => { TeamA: 400, TeamB: 300, ... }

  for (const [teamName, drivers] of Object.entries(teams)) {
    const teamPts = pointsDict[teamName] || 0;
    const driverList = drivers.join(", ");
    table.innerHTML += `
      <tr>
        <td>${teamName}</td>
        <td>${driverList}</td>
        <td>${teamPts}</td>
      </tr>
    `;
  }
}

// 3. Render leaderboard
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
    const teamPts = pointsDict[teamName] || 0;
    standings.push([teamName, teamPts]);
  }
  // sort desc by points
  standings.sort((a,b) => b[1] - a[1]);

  standings.forEach(([tn, pts]) => {
    lbTable.innerHTML += `
      <tr>
        <td>${tn}</td>
        <td>${pts}</td>
      </tr>
    `;
  });
}

// 4. Propose a locked trade
function proposeLockedTrade() {
  const urlParams = new URLSearchParams(window.location.search);
  const seasonId = urlParams.get("season_id");
  if (!seasonId) {
    alert("No season_id in URL!");
    return;
  }

  const fromTeam = document.getElementById("fromTeamInput").value.trim();
  const fromDrivers = document.getElementById("fromDriversInput").value.split(",").map(d => d.trim());
  const toTeam = document.getElementById("toTeamInput").value.trim();
  const toDrivers = document.getElementById("toDriversInput").value.split(",").map(d => d.trim());
  const sweetener = parseInt(document.getElementById("sweetenerInput").value || "0", 10);

  const payload = {
    from_team: fromTeam,
    to_team: toTeam,
    drivers_from_team: fromDrivers,
    drivers_to_team: toDrivers,
    points: sweetener
  };

  // /trade_locked?season_id=xxx
  fetch(`${backendUrl}/trade_locked?season_id=${encodeURIComponent(seasonId)}`, {
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
        // refresh locked season
        loadSeasonData(seasonId);
      }
    })
    .catch(err => console.error("Error proposing locked trade:", err));
}