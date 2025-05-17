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
let tradeHistory = [];
let racePoints = {};
let freeAgents = [];
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
  loadFreeAgents();
};

// Load main season data
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(res => res.json())
    .then(data => {
      lockedTeams   = data.teams || {};
      lockedPoints  = data.points || {};
      tradeHistory  = data.trade_history || [];
      racePoints    = data.race_points || {};

      // build color map
      const allTeams = Object.keys(lockedTeams).concat(Object.keys(lockedPoints));
      assignTeamColors([...new Set(allTeams)]);

      renderLeaderboard(lockedPoints);
      renderLineupsTable(lockedTeams);
      renderDriverRaceTable(racePoints);
      renderTradeHistory(tradeHistory);
      populateTeamDropdowns(lockedTeams);
    })
    .catch(err => console.error("Error loading season data:", err));
}

// Load undrafted drivers
function loadFreeAgents() {
  fetch(`${backendUrl}/get_available_drivers`)
    .then(res => res.json())
    .then(data => {
      freeAgents = data.drivers || [];
      renderFreeAgents(freeAgents);
    })
    .catch(err => console.error("Error loading free agents:", err));
}

// Color assignment
function assignTeamColors(teamArray) {
  colorMap = {};
  teamArray.sort();
  teamArray.forEach((teamName, idx) => {
    colorMap[teamName] = COLOR_ARRAY[idx] || "white";
  });
}

// Leaderboard
function renderLeaderboard(pointsDict) {
  const lbTable = document.getElementById("leaderboardTable");
  lbTable.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(pointsDict)
    .sort((a,b) => b[1] - a[1])
    .forEach(([team, pts]) => {
      const color = colorMap[team] || "white";
      lbTable.innerHTML += `
        <tr>
          <td style="color:${color}">${team}</td>
          <td>${pts}</td>
        </tr>`;
    });
}

// Lineups (simple)
function renderLineupsTable(teams) {
  const tbl = document.getElementById("lockedTeamsSimpleTable");
  tbl.innerHTML = `<tr>${Object.keys(teams).map(t => `<th>${t}</th>`).join('')}</tr>`;
  // find max roster length
  const maxLen = Math.max(...Object.values(teams).map(r => r.length));
  for (let i=0; i<maxLen; i++){
    let row = '<tr>';
    for (const team of Object.keys(teams)) {
      const driver = teams[team][i]||"";
      const color = colorMap[team]||"white";
      row += `<td style="color:${color}">${driver}</td>`;
    }
    row += '</tr>';
    tbl.innerHTML += row;
  }
}

// Race-by-race table
function renderDriverRaceTable(raceData) {
  const table = document.getElementById("driverRaceTable");
  // header
  let hdr = '<tr><th>Driver</th>' + RACE_LIST.map(r=>`<th>${r}</th>`).join('') + '</tr>';
  table.innerHTML = hdr;
  // drivers set
  const allDrivers = new Set();
  Object.values(lockedTeams).flat().forEach(d=>allDrivers.add(d));
  Object.values(raceData).forEach(rc=>Object.keys(rc).forEach(d=>allDrivers.add(d)));
  Array.from(allDrivers).sort().forEach(driver => {
    let row = `<tr><td>${driver}</td>`;
    RACE_LIST.forEach(race=>{
      let pts="", clr="white";
      if (raceData[race] && raceData[race][driver]) {
        pts = raceData[race][driver].points;
        clr = colorMap[raceData[race][driver].team]||"white";
      }
      row += `<td style="color:${clr}">${pts}</td>`;
    });
    row += '</tr>';
    table.innerHTML += row;
  });
}

// Free agents list
function renderFreeAgents(list) {
  const ul = document.getElementById("undraftedList");
  ul.innerHTML = list.map(d=>`<li>${d}</li>`).join('');
}

// Trade history
function renderTradeHistory(hist) {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = hist.map(rec=>`<li>${rec}</li>`).join('');
}

// Populate trade dropdowns
function populateTeamDropdowns(teams) {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = "<option value=''>Select Team</option>";
  to.innerHTML   = "<option value=''>Select Team</option>";
  Object.keys(teams).forEach(team => {
    from.innerHTML += `<option value="${team}">${team}</option>`;
    to.innerHTML   += `<option value="${team}">${team}</option>`;
  });
  // add Free Agency only to "to"
  to.innerHTML += `<option value="Free Agency">Free Agency</option>`;
}

function populateFromDrivers() {
  const team = document.getElementById("fromTeamSelect").value;
  const sel  = document.getElementById("fromDriversSelect");
  sel.innerHTML = "";
  if (lockedTeams[team]) {
    lockedTeams[team].forEach(d => {
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  }
}

function populateToDrivers() {
  const team = document.getElementById("toTeamSelect").value;
  const sel  = document.getElementById("toDriversSelect");
  sel.innerHTML = "";
  if (team === "Free Agency") {
    freeAgents.forEach(d => {
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  } else if (lockedTeams[team]) {
    lockedTeams[team].forEach(d => {
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  }
}

// Propose locked trade (including free-agency cases)
function proposeLockedTrade() {
  if (!currentSeasonId) return alert("No season_id in context!");
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam   = document.getElementById("toTeamSelect").value;
  const fromDrivers = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value);
  const toDrivers   = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value);
  const fromPts = parseInt(document.getElementById("fromSweetener").value||"0",10);
  const toPts   = parseInt(document.getElementById("toSweetener").value||"0",10);

  const payload = {
    from_team: fromTeam,
    to_team: toTeam,
    drivers_from_team: fromDrivers,
    drivers_to_team: toDrivers,
    from_team_points: fromPts,
    to_team_points: toPts
  };

  fetch(`${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      if (data.error || data.detail) alert(data.error||data.detail);
      else {
        alert(data.message);
        loadSeasonData(currentSeasonId);
        loadFreeAgents();
      }
    })
    .catch(err => console.error("Error proposing locked trade:",err));
}

// Refresh race points
function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season_id in context!");
  fetch(`${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`, {
    method: "POST"
  })
    .then(res => res.json())
    .then(data => {
      if (data.error||data.detail) alert(data.error||data.detail);
      else {
        alert(data.message);
        loadSeasonData(currentSeasonId);
      }
    })
    .catch(err => console.error("Error refreshing race points:",err));
}