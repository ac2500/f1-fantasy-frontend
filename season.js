// season.js

const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// Races in order
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

let currentSeasonId = null;
let lockedTeams = {};    // { teamName: [driver1,driver2,…], … }
let lockedPoints = {};   // { teamName: totalPoints, … }
let racePoints = {};     // { raceName: { driverName: {points,team} }, … }
let tradeHistory = [];   // [ "On YYYY-MM-DD …", … ]
let freeAgents = [];     // [ driverName, … ]

const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};       // { teamName: color, … }

window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("season_id");
  if (!sid) {
    alert("No season_id provided!");
    return;
  }
  currentSeasonId = sid;
  loadSeasonData(sid);
};

// 1) Load the locked‐season snapshot
function loadSeasonData(seasonId) {
  fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`)
    .then(r => r.json())
    .then(data => {
      lockedTeams   = data.teams     || {};
      lockedPoints  = data.points    || {};
      tradeHistory  = data.trade_history || [];
      racePoints    = data.race_points   || {};

      // Assign a color to each team (alphabetical)
      assignTeamColors(Object.keys(lockedTeams));

      // Render everything
      renderLeaderboard(lockedPoints);
      renderLineups(lockedTeams);
      renderDriverRaceTable(racePoints);
      renderTradeHistory(tradeHistory);
      populateTeamDropdowns(lockedTeams);

      // Now fetch free agents *against* that locked roster
      fetch(`${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(seasonId)}`)
        .then(r => r.json())
        .then(d => {
          freeAgents = d.drivers || [];
          renderFreeAgents();
        })
        .catch(console.error);
    })
    .catch(console.error);
}

// 2) Assign team colors
function assignTeamColors(teams) {
  teams.sort();
  colorMap = {};
  teams.forEach((t,i) => colorMap[t] = COLOR_ARRAY[i] || "white");
}

// 3) Leaderboard
function renderLeaderboard(pointsDict) {
  const tb = document.getElementById("leaderboardTable");
  if (!tb) return;
  tb.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(pointsDict)
        .sort((a,b) => b[1]-a[1])
        .forEach(([team,pts]) => {
    const c = colorMap[team] || "white";
    tb.innerHTML += `
      <tr>
        <td style="color:${c};">${team}</td>
        <td>${pts}</td>
      </tr>`;
  });
}

// 4) Lineups
function renderLineups(teams) {
  const tbl = document.getElementById("lineupsTable");
  if (!tbl) return;
  const names = Object.keys(teams).sort();
  // Header
  let html = "<tr>" + names.map(t=>`<th style="color:${colorMap[t]};">${t}</th>`).join("") + "</tr>";
  // Rows (max roster size)
  const max = Math.max(...names.map(t=>teams[t].length));
  for (let i=0; i<max; i++) {
    html += "<tr>" + names.map(t=>{
      const drv = teams[t][i];
      // show last name only
      const last = drv? drv.split(" ").slice(-1)[0] : "";
      return `<td>${last}</td>`;
    }).join("") + "</tr>";
  }
  tbl.innerHTML = html;
}

// 5) Race-by-Race Breakdown
function renderDriverRaceTable(data) {
  const tbl = document.getElementById("driverRaceTable");
  if (!tbl) return;

  // Drivers set
  const drvSet = new Set();
  Object.values(lockedTeams).forEach(arr => arr.forEach(d=>drvSet.add(d)));
  Object.values(data).forEach(raceMap =>
    Object.keys(raceMap).forEach(d=>drvSet.add(d))
  );
  const drivers = Array.from(drvSet).sort();

  // Header
  let hdr = "<tr><th>Driver</th>";
  RACE_LIST.forEach(r=> hdr += `<th>${r}</th>`);
  hdr += "</tr>";

  // Rows
  let rows = drivers.map(d=>{
    let r = `<tr><td>${d.split(" ").slice(-1)[0]}</td>`;
    RACE_LIST.forEach(race=>{
      const rec = data[race] && data[race][d];
      const pts = rec? rec.points : 0;
      const col = rec? colorMap[rec.team] : "white";
      r += `<td style="color:${col};">${pts||0}</td>`;
    });
    return r + "</tr>";
  }).join("");

  tbl.innerHTML = hdr + rows;
}

// 6) Trade History
function renderTradeHistory(hist) {
  const ul = document.getElementById("tradeHistory");
  if (!ul) return;
  ul.innerHTML = "";
  hist.forEach(txt => {
    const li = document.createElement("li");
    li.textContent = txt;
    ul.appendChild(li);
  });
}

// 7) Team dropdowns
function populateTeamDropdowns(teams) {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  if (!from || !to) return;

  from.innerHTML = `<option value="">Select…</option>`;
  to.innerHTML   = `<option value="">Select…</option>`;

  Object.keys(teams).forEach(t => {
    from.innerHTML += `<option value="${t}">${t}</option>`;
    to  .innerHTML += `<option value="${t}">${t}</option>`;
  });
  // add Free Agency last
  if (freeAgents.length) {
    to.innerHTML += `<option value="Free Agency">Free Agency</option>`;
  }
}

// 8) Drivers lists for trade selects
function populateFromDrivers() {
  const sel = document.getElementById("fromDriversSelect");
  const team = document.getElementById("fromTeamSelect").value;
  sel.innerHTML = "";
  if (lockedTeams[team]) {
    lockedTeams[team].forEach(d => {
      const o = document.createElement("option");
      o.value = d; o.textContent = d.split(" ").slice(-1)[0];
      sel.appendChild(o);
    });
  }
}
function populateToDrivers() {
  const sel = document.getElementById("toDriversSelect");
  const team = document.getElementById("toTeamSelect").value;
  sel.innerHTML = "";

  if (team === "Free Agency") {
    freeAgents.forEach(d => {
      const o = document.createElement("option");
      o.value = d; o.textContent = d;
      sel.appendChild(o);
    });
  } else if (lockedTeams[team]) {
    lockedTeams[team].forEach(d => {
      const o = document.createElement("option");
      o.value = d; o.textContent = d.split(" ").slice(-1)[0];
      sel.appendChild(o);
    });
  }
}

// 9) Propose Trade (unchanged)
async function proposeLockedTrade() {
  if (!currentSeasonId) return alert("No season_id!");
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam   = document.getElementById("toTeamSelect").value;
  const fromDrivers = Array.from(
    document.getElementById("fromDriversSelect").selectedOptions
  ).map(o => o.value);
  const toDrivers = Array.from(
    document.getElementById("toDriversSelect").selectedOptions
  ).map(o => o.value);
  const fromPts = parseInt(document.getElementById("fromSweetener").value)||0;
  const toPts   = parseInt(document.getElementById("toSweetener").value)||0;

  const payload = {
    from_team: fromTeam,
    to_team: toTeam,
    drivers_from_team: fromDrivers,
    drivers_to_team: toDrivers,
    from_team_points: fromPts,
    to_team_points: toPts
  };

  try {
    const res = await fetch(
      `${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`,
      { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) }
    );
    const data = await res.json();
    if (res.status !== 200) throw new Error(data.detail||data.error);
    alert(data.message);
    loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e);
  }
}

// 10) Refresh Race Points (unchanged)
async function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season_id!");
  try {
    const res = await fetch(
      `${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`,
      { method:"POST" }
    );
    const j = await res.json();
    if (res.status !== 200) throw new Error(j.detail||j.error);
    alert(j.message);
    loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e);
  }
}

// 11) Render Free Agents into the <ul>
function renderFreeAgents() {
  const ul = document.getElementById("undraftedList");
  if (!ul) return;
  ul.innerHTML = freeAgents.map(d => `<li>${d}</li>`).join("");
}