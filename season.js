const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// The 2025 race list (adjust as needed)
const RACE_LIST = [
  "Bahrain", "Saudi Arabia", "Miami", "Imola", "Monaco", "Spain",
  "Canada", "Austria", "UK", "Belgium", "Hungary", "Netherlands",
  "Monza", "Azerbaijan", "Singapore", "Texas", "Mexico", "Brazil",
  "Vegas", "Qatar", "Abu Dhabi"
];

let currentSeasonId = null;
let tradeHistory = [];   // Example: ["On 2025-04-13, ...", ...]
let lockedPoints = {};   // Overall team totals: {TeamA: number, TeamB: number, ...}
let racePoints = {};     // Detailed race breakdown
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
      lockedPoints = data.points || {};
      tradeHistory = data.trade_history || [];
      racePoints = data.race_points || {};

      // build a color map
      const allTeams = new Set(Object.keys(lockedPoints));
      if (data.teams) Object.keys(data.teams).forEach(t => allTeams.add(t));
      for (const race in racePoints) {
        for (const drv in racePoints[race]) {
          allTeams.add(racePoints[race][drv].team);
        }
      }
      assignTeamColors(Array.from(allTeams));

      renderLeaderboard(lockedPoints);
      renderDriverRaceTable(racePoints);
      renderTradeHistory(tradeHistory);
      if (data.teams) populateTeamDropdowns(data.teams);

      // ── NEW: fetch and render free agents ──
      fetch(`${backendUrl}/get_free_agents?season_id=${encodeURIComponent(seasonId)}`)
        .then(r => r.json())
        .then(json => renderFreeAgents(json.free_agents))
        .catch(err => console.error("Error fetching free agents:", err));
    })
    .catch(err => console.error("Error loading season data:", err));
}

// 2) Assign colors to teams
function assignTeamColors(teamArray) {
  colorMap = {};
  teamArray.sort();
  teamArray.forEach((teamName, idx) => {
    colorMap[teamName] = COLOR_ARRAY[idx] || "white";
  });
}

// 3) Render the top leaderboard
function renderLeaderboard(pointsDict) {
  const lbTable = document.getElementById("leaderboardTable");
  if (!lbTable) return;
  lbTable.innerHTML = `
    <tr><th>Fantasy Team</th><th>Total Points</th></tr>
  `;
  Object.entries(pointsDict)
    .sort((a, b) => b[1] - a[1])
    .forEach(([team, pts]) => {
      lbTable.innerHTML += `
        <tr>
          <td style="color:${colorMap[team]};">${team}</td>
          <td>${pts}</td>
        </tr>
      `;
    });
}

// 4) Render the race-by-race table
function renderDriverRaceTable(racePointsData) {
  const table = document.getElementById("driverRaceTable");
  if (!table) return;
  // gather drivers
  const allDrivers = new Set();
  // from your locked-season teams
  // (you’ll need a global `lockedTeams` if you want the rosters here;
  //  if not, just rely on racePointsData)
  for (const race in racePointsData) {
    for (const drv in racePointsData[race]) allDrivers.add(drv);
  }
  const drivers = Array.from(allDrivers).sort();

  // header
  let html = "<tr><th>Driver</th>";
  RACE_LIST.forEach(r => html += `<th>${r}</th>`);
  html += "</tr>";
  // rows
  drivers.forEach(drv => {
    html += `<tr><td>${drv}</td>`;
    RACE_LIST.forEach(r => {
      const cell = (racePointsData[r] && racePointsData[r][drv])
        ? `<span style="color:${colorMap[racePointsData[r][drv].team]};">
             ${racePointsData[r][drv].points || 0}
           </span>`
        : "";
      html += `<td>${cell}</td>`;
    });
    html += "</tr>";
  });

  if (drivers.length === 0) {
    html = `<tr><td colspan="${RACE_LIST.length+1}">No drafted drivers found.</td></tr>`;
  }
  table.innerHTML = html;
}

// 5) Render trade history
function renderTradeHistory(historyList) {
  const ul = document.getElementById("tradeHistory");
  if (!ul) return;
  ul.innerHTML = "";
  historyList.forEach(rec => {
    const li = document.createElement("li");
    li.textContent = rec;
    ul.appendChild(li);
  });
}

// 6) Populate trade dropdowns
function populateTeamDropdowns(teamsData) {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  if (!from || !to) return;
  from.innerHTML = "<option value=''>Select Team</option>";
  to  .innerHTML = "<option value=''>Select Team</option>";
  Object.keys(teamsData).forEach(team => {
    from.innerHTML += `<option value="${team}">${team}</option>`;
    to  .innerHTML += `<option value="${team}">${team}</option>`;
  });
}

// ── NEW: render the undrafted / free-agent list ──
function renderFreeAgents(list) {
  const ul = document.getElementById("undraftedList");
  if (!ul) return;
  ul.innerHTML = "";
  list.forEach(driver => {
    // only last name
    const lastName = driver.split(" ").slice(-1)[0];
    const li = document.createElement("li");
    li.textContent = lastName;
    ul.appendChild(li);
  });
}

// 7) (etc…) your proposeLockedTrade(), refreshRacePoints(), etc.
//    (leave those unchanged)