const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

window.onload = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const seasonId = urlParams.get("season_id");
  if (!seasonId) {
    alert("No season_id provided!");
    return;
  }
  loadSeasonData(seasonId);
};

function loadSeasonData(seasonId) {
  // call /get_season?season_id=xxx
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(res => res.json())
    .then(data => {
      // data => { "teams": { "TeamA": [...], "TeamB": [...] }, "points": {...} }
      renderLockedTeamsTable(data.teams, data.points || {});
      renderLeaderboard(data.teams, data.points || {});
    })
    .catch(err => console.error("Error loading season data:", err));
}

function renderLockedTeamsTable(teams, pointsDict) {
  const table = document.getElementById("lockedTeamsTable");
  table.innerHTML = `
    <tr>
      <th>Team Name</th>
      <th>Drivers</th>
      <th>Points</th>
    </tr>
  `;
  for (const [team, drivers] of Object.entries(teams)) {
    // sum driver points from pointsDict if you store them individually
    let teamPoints = 0;
    drivers.forEach(drv => {
      if (pointsDict[drv]) teamPoints += pointsDict[drv];
    });

    table.innerHTML += `
      <tr>
        <td>${team}</td>
        <td>${drivers.join(", ")}</td>
        <td>${teamPoints}</td>
      </tr>
    `;
  }
}

function renderLeaderboard(teams, pointsDict) {
  const lbTable = document.getElementById("leaderboardTable");
  lbTable.innerHTML = `
    <tr>
      <th>Team</th>
      <th>Total Points</th>
    </tr>
  `;

  // Build array of [teamName, totalPoints]
  let standings = [];
  for (const [team, drivers] of Object.entries(teams)) {
    let sumPoints = 0;
    drivers.forEach(d => {
      if (pointsDict[d]) sumPoints += pointsDict[d];
    });
    standings.push([team, sumPoints]);
  }

  // Sort by totalPoints desc
  standings.sort((a, b) => b[1] - a[1]);

  standings.forEach(([team, pts]) => {
    lbTable.innerHTML += `
      <tr>
        <td>${team}</td>
        <td>${pts}</td>
      </tr>
    `;
  });
}