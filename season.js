// season.js
const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// Static list of 2025 rounds
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

let currentSeasonId = null;
let lockedTeams     = {};  // { teamName: [driver1,…] }
let lockedPoints    = {};  // { teamName: points }
let racePoints      = {};  // { raceName: { driver: {points,team}}}
let tradeHistory    = [];  // [ "…" ]
let freeAgents      = [];  // only undrafted drivers for this locked season
let processedRaces  = [];  // which rounds already processed
const COLOR_ARRAY   = ["green","blue","yellow","orange","purple"];
let colorMap        = {};

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

async function loadSeasonData(seasonId) {
  try {
    const res = await fetch(
      `${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`
    );
    if (!res.ok) throw new Error("Failed to load season data");
    const data = await res.json();

    // populate core state
    lockedTeams    = data.teams            || {};
    lockedPoints   = data.points           || {};
    tradeHistory   = data.trade_history    || [];
    racePoints     = data.race_points      || {};
    processedRaces = data.processed_races  || [];

    // assign colors to teams
    Object.keys(lockedTeams)
      .sort()
      .forEach((team,i) => {
        colorMap[team] = COLOR_ARRAY[i] || "white";
      });

    // render everything
    renderLeaderboard();
    renderLineups();
    renderDriverRaceTable();
    renderTradeHistory();
    populateTeamDropdowns();

    // now fetch & filter free agents
    await fetchFreeAgents();

  } catch (err) {
    console.error(err);
    alert(err.message || "Error loading season data.");
  }
}

function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = "<tr><th>Fantasy Team</th><th>Total Points</th></tr>";
  Object.entries(lockedPoints)
    .sort((a,b)=>b[1]-a[1])
    .forEach(([team,pts])=>{
      tbl.innerHTML += `
        <tr>
          <td style="color:${colorMap[team]||"white"}">${team}</td>
          <td>${pts}</td>
        </tr>`;
    });
}

function renderLineups() {
  const tbl = document.getElementById("lineupsTable");
  // header row
  let html = "<tr>" +
    Object.keys(lockedTeams)
      .map(team => `<th style="color:${colorMap[team]}">${team}</th>`)
      .join("") +
    "</tr>";
  // determine max roster length
  const maxLen = Math.max(...Object.values(lockedTeams).map(r=>r.length));
  // build each driver row
  for (let i=0; i<maxLen; i++) {
    html += "<tr>" +
      Object.values(lockedTeams)
        .map(r => `<td>${r[i]||""}</td>`)
        .join("") +
      "</tr>";
  }
  tbl.innerHTML = html;
}

function renderDriverRaceTable() {
  const tbl = document.getElementById("driverRaceTable");
  // header
  let html = "<tr><th>Driver</th>" +
    RACE_LIST.map(r=>`<th>${r}</th>`).join("") +
    "</tr>";
  // collect all drivers
  const drivers = new Set();
  Object.values(lockedTeams).flat().forEach(d=>drivers.add(d));
  Object.values(racePoints).forEach(rp=>Object.keys(rp).forEach(d=>drivers.add(d)));
  // rows
  drivers.forEach(driver => {
    html += `<tr><td>${driver}</td>` +
      RACE_LIST.map(race => {
        const info = (racePoints[race]||{})[driver];
        if (!info) return `<td></td>`;
        return `<td style="color:${colorMap[info.team]||"white"}">${info.points}</td>`;
      }).join("") +
      "</tr>";
  });
  tbl.innerHTML = html;
}

function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  tradeHistory.forEach(entry => {
    const li = document.createElement("li");
    li.textContent = entry;
    ul.appendChild(li);
  });
}

async function fetchFreeAgents() {
  try {
    // call global free-agent endpoint (no season_id)
    const res = await fetch(`${backendUrl}/get_available_drivers`);
    if (!res.ok) throw new Error("Failed to fetch free agents");
    const data = await res.json();
    // filter out any drivers already in lockedTeams
    const drafted = new Set(Object.values(lockedTeams).flat());
    freeAgents = (data.drivers||[]).filter(d => !drafted.has(d));
    renderFreeAgents();
    populateTeamDropdowns();  // re-populate to include real freeAgents in dropdown
  } catch(e) {
    console.error(e);
    freeAgents = [];
    renderFreeAgents();
  }
}

function renderFreeAgents() {
  const ul = document.getElementById("undraftedList");
  ul.innerHTML = freeAgents.map(d => `<li>${d}</li>`).join("");
}

function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = `<option value="">Select…</option>`;
  to.innerHTML   = `<option value="">Select…</option>`;
  // locked teams
  Object.keys(lockedTeams).forEach(team => {
    from.innerHTML += `<option value="${team}">${team}</option>`;
    to.innerHTML   += `<option value="${team}">${team}</option>`;
  });
  // free agency only in "to"
  to.innerHTML += `<option value="__free_agency__">Free Agency</option>`;
}

function populateFromDrivers() {
  const sel = document.getElementById("fromDriversSelect");
  const team = document.getElementById("fromTeamSelect").value;
  sel.innerHTML = "";
  (lockedTeams[team]||[]).forEach(driver => {
    sel.innerHTML += `<option value="${driver}">${driver}</option>`;
  });
}

function populateToDrivers() {
  const sel = document.getElementById("toDriversSelect");
  const team = document.getElementById("toTeamSelect").value;
  sel.innerHTML = "";
  if (team === "__free_agency__") {
    freeAgents.forEach(driver => {
      sel.innerHTML += `<option value="${driver}">${driver}</option>`;
    });
  } else {
    (lockedTeams[team]||[]).forEach(driver => {
      sel.innerHTML += `<option value="${driver}">${driver}</option>`;
    });
  }
}

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
  const fromPts = parseInt(document.getElementById("fromSweetener").value) || 0;
  const toPts   = parseInt(document.getElementById("toSweetener").value)   || 0;

  try {
    const res = await fetch(
      `${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_team: fromTeam,
          to_team: toTeam,
          drivers_from_team: fromDrivers,
          drivers_to_team: toDrivers,
          from_team_points: fromPts,
          to_team_points: toPts
        })
      }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j.detail||j.error);
    alert(j.message);
    loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e.message||e);
  }
}

async function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season_id!");
  // pick next unprocessed race
  const nextRace = processedRaces.length
    ? Math.max(...processedRaces.map(r=>parseInt(r,10))) + 1
    : 4;

  try {
    const res = await fetch(
      `${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=${encodeURIComponent(nextRace)}`,
      { method: "POST" }
    );
    const j = await res.json();
    if (!res.ok) {
      if (j.detail?.includes("processed")) {
        return alert("No new races to update points.");
      }
      throw new Error(j.detail||j.error);
    }
    alert(j.message);
    loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e.message||e);
  }
}