const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// 2025 race list
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

let currentSeasonId = null;
let lockedTeams = {};     // { teamName: [ fullDriverNames ] }
let lockedPoints = {};    // { teamName: totalPts }
let racePoints = {};      // { raceName: { driverName: {points, team} } }
let tradeHistory = [];    // [ ... ]
let freeAgents = [];      // [ "Driver1", "Driver2", ... ]

const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};

window.onload = () => {
  const params = new URLSearchParams(location.search);
  currentSeasonId = params.get("season_id");
  if (!currentSeasonId) return alert("No season_id!");
  loadSeasonData();
  fetchFreeAgents();
};

function loadSeasonData() {
  fetch(`${backendUrl}/get_season?season_id=${currentSeasonId}`)
    .then(r=>r.json())
    .then(data => {
      lockedTeams   = data.teams   || {};
      lockedPoints  = data.points  || {};
      tradeHistory  = data.trade_history || [];
      racePoints    = data.race_points   || {};

      buildColorMap();
      renderLeaderboard();
      renderLineups();
      renderDriverRaceTable();
      renderTradeHistory();
      populateTeamDropdowns();
    })
    .catch(console.error);
}

function fetchFreeAgents() {
  fetch(`${backendUrl}/get_available_drivers?season_id=${encodeURIComponent(currentSeasonId)}`)
    .then(r=>r.json())
    .then(data => {
      freeAgents = data.drivers || [];
      renderFreeAgents();
      populateTeamDropdowns();  // repopulate toTeamSelect with free agency
    })
    .catch(console.error);
}

function buildColorMap() {
  const teams = new Set(Object.keys(lockedPoints).concat(Object.keys(lockedTeams)));
  Array.from(teams).sort().forEach((t,i)=> colorMap[t] = COLOR_ARRAY[i] || "white");
}

function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(lockedPoints)
    .sort((a,b)=>b[1]-a[1])
    .forEach(([team,pts])=>{
      tbl.innerHTML+=`<tr>
        <td style="color:${colorMap[team]};">${team}</td>
        <td>${pts}</td>
      </tr>`;
    });
}

function renderLineups() {
  const tbl = document.getElementById("lineupsTable");
  // header
  let html = "<tr>"+ Object.keys(lockedTeams).map(t=>`<th>${t}</th>`).join("") +"</tr>";
  // roster row
  html += "<tr>" + Object.values(lockedTeams).map(roster=>{
    const lis = roster.map(name=>{
      const last = name.trim().split(" ").slice(-1)[0];
      return `<li>${last}</li>`;
    }).join("");
    return `<td><ul style="list-style:none;padding:0;margin:0;">${lis}</ul></td>`;
  }).join("") + "</tr>";

  // no teams?
  if (!Object.keys(lockedTeams).length) {
    html = `<tr><td colspan="${RACE_LIST.length}">No teams locked yet.</td></tr>`;
  }

  tbl.innerHTML = html;
}

function renderDriverRaceTable() {
  const tbl = document.getElementById("driverRaceTable");
  // gather all drivers
  const all = new Set();
  Object.values(lockedTeams).forEach(r=>r.forEach(d=>all.add(d)));
  Object.values(racePoints).forEach(race=>{
    Object.keys(race).forEach(d=> all.add(d));
  });
  const drivers = Array.from(all).sort();

  // header
  let h = "<tr><th>Driver</th>"
    + RACE_LIST.map(r=>`<th>${r}</th>`).join("")+"</tr>";
  // rows
  drivers.forEach(d=>{
    let row = `<tr><td>${d}</td>`;
    RACE_LIST.forEach(r=>{
      const cell = (racePoints[r] && racePoints[r][d])
                 ? `<span style="color:${colorMap[racePoints[r][d].team]};">
                      ${racePoints[r][d].points||0}
                    </span>`
                 : "";
      row += `<td>${cell}</td>`;
    });
    row += "</tr>";
    h += row;
  });
  if (!drivers.length) {
    h = `<tr><td colspan="${RACE_LIST.length+1}">No drafted drivers yet.</td></tr>`;
  }
  tbl.innerHTML = h;
}

function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  tradeHistory.forEach(entry=>{
    const li = document.createElement("li");
    li.textContent = entry;
    ul.appendChild(li);
  });
}

function renderFreeAgents() {
  const ul = document.getElementById("undraftedList");
  ul.innerHTML = freeAgents.map(d=>`<li>${d}</li>`).join("");
}

function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = to.innerHTML = `<option value="">Select…</option>`;

  // for “to”, include free agency
  to.innerHTML += `<option value="__FREE_AGENCY__">Free Agency</option>`;
  Object.keys(lockedTeams).forEach(t=>{
    from.innerHTML += `<option value="${t}">${t}</option>`;
    to.innerHTML   += `<option value="${t}">${t}</option>`;
  });
}

function populateFromDrivers() {
  const team = document.getElementById("fromTeamSelect").value;
  const sel  = document.getElementById("fromDriversSelect");
  sel.innerHTML = "";
  if (lockedTeams[team]) {
    lockedTeams[team].forEach(d=> sel.innerHTML+=`<option>${d}</option>`);
  }
}

function populateToDrivers() {
  const team = document.getElementById("toTeamSelect").value;
  const sel  = document.getElementById("toDriversSelect");
  sel.innerHTML = "";
  if (team === "__FREE_AGENCY__") {
    freeAgents.forEach(d=> sel.innerHTML+=`<option>${d}</option>`);
  } else if (lockedTeams[team]) {
    lockedTeams[team].forEach(d=> sel.innerHTML+=`<option>${d}</option>`);
  }
}

function proposeLockedTrade() {
  if (!currentSeasonId) return alert("Missing season_id");
  const req = {
    from_team: document.getElementById("fromTeamSelect").value,
    to_team:   document.getElementById("toTeamSelect").value,
    drivers_from_team: Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value),
    drivers_to_team:   Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value),
    from_team_points: parseInt(document.getElementById("fromSweetener").value)||0,
    to_team_points:   parseInt(document.getElementById("toSweetener").value)||0
  };
  fetch(`${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(req)
  })
    .then(r=>r.json())
    .then(d=>{
      if (d.error||d.detail) alert(d.error||d.detail);
      else {
        alert(d.message);
        loadSeasonData();
        fetchFreeAgents();
      }
    })
    .catch(console.error);
}

function refreshRacePoints() {
  fetch(`${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=latest`, {
    method: "POST"
  })
    .then(r=>r.json())
    .then(d=>{
      if (d.error||d.detail) alert(d.error||d.detail);
      else {
        alert(d.message);
        loadSeasonData();
      }
    })
    .catch(console.error);
}