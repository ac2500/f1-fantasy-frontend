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
let lockedTeams    = {};   // { teamName: [driver,…] }
let lockedPoints   = {};   // { teamName: totalPoints }
let racePoints     = {};   // { raceName: { driverName: {points,team} } }
let tradeHistory   = [];   // [ "...", … ]
let freeAgents     = [];   // undrafted for this locked season
let processedRaces = [];   // [ "4", "5", … ]

const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};

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
    if (!res.ok) throw new Error("Failed to load season");
    const data = await res.json();

    lockedTeams    = data.teams      || {};
    lockedPoints   = data.points     || {};
    tradeHistory   = data.trade_history || [];
    racePoints     = data.race_points   || {};
    processedRaces = data.processed_races || [];

    // assign colors to teams
    const teams = Object.keys(lockedTeams).sort();
    teams.forEach((t,i) => colorMap[t] = COLOR_ARRAY[i]||"white");

    renderLeaderboard();
    renderLineups();
    renderDriverRaceTable();
    renderTradeHistory();
    await fetchFreeAgents();
    populateTeamDropdowns(lockedTeams);  // now includes “Free Agency”
  } catch (e) {
    console.error(e);
    alert(e.message || "Error loading season data");
  }
}

async function fetchFreeAgents() {
  try {
    const res = await fetch(
      `${backendUrl}/get_free_agents?season_id=${encodeURIComponent(currentSeasonId)}`
    );
    if (!res.ok) throw new Error("Failed to fetch free agents");
    const data = await res.json();
    freeAgents = data.drivers || [];
    renderFreeAgents(freeAgents);
  } catch (e) {
    console.error("Free-agent fetch error", e);
    freeAgents = [];
    renderFreeAgents(freeAgents);
  }
}

// 2) Leaderboard
function renderLeaderboard() {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = `<tr><th>Fantasy Team</th><th>Total Points</th></tr>`;
  Object.entries(lockedPoints)
    .sort((a,b)=>b[1]-a[1])
    .forEach(([team,pts]) => {
      const c = colorMap[team]||"white";
      tbl.innerHTML += `<tr>
        <td style="color:${c}">${team}</td>
        <td>${pts}</td>
      </tr>`;
    });
}

// 3) Lineups
function renderLineups() {
  const tbl = document.getElementById("lineupsTable");
  let html = "<tr>";
  Object.keys(lockedTeams).forEach(team => {
    const c = colorMap[team]||"white";
    html += `<th style="color:${c}">${team}</th>`;
  });
  html += "</tr>";

  const maxLen = Math.max(...Object.values(lockedTeams).map(r=>r.length));
  for (let i=0; i<maxLen; i++){
    html += "<tr>";
    Object.values(lockedTeams).forEach(roster => {
      html += `<td>${roster[i]||""}</td>`;
    });
    html += "</tr>";
  }
  tbl.innerHTML = html;
}

// 4) Race-by-race table
function renderDriverRaceTable() {
  const tbl = document.getElementById("driverRaceTable");
  let html = "<tr><th>Driver</th>";
  RACE_LIST.forEach(r => html += `<th>${r}</th>`);
  html += "</tr>";

  const drivers = new Set();
  Object.values(lockedTeams).flat().forEach(d=>drivers.add(d));
  Object.values(racePoints).forEach(rp => Object.keys(rp).forEach(d=>drivers.add(d)));

  Array.from(drivers).sort().forEach(d => {
    html += `<tr><td>${d}</td>`;
    RACE_LIST.forEach(r => {
      const info = (racePoints[r]||{})[d];
      const pts  = info?.points ?? "";
      const col  = info?.team ? (colorMap[info.team]||"white") : "white";
      html += `<td style="color:${col}">${pts}</td>`;
    });
    html += "</tr>";
  });

  if (drivers.size===0) {
    html = `<tr><td colspan="${RACE_LIST.length+1}">No drafted drivers.</td></tr>`;
  }
  tbl.innerHTML = html;
}

// 5) Trade history
function renderTradeHistory() {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  tradeHistory.forEach(txt=>{
    const li = document.createElement("li");
    li.textContent = txt;
    ul.appendChild(li);
  });
}

// 6) Free agents list
function renderFreeAgents() {
  const ul = document.getElementById("undraftedList");
  ul.innerHTML = freeAgents.map(d => `<li>${d}</li>`).join("");
}

// 7) Dropdowns (including Free Agency in “To”)
function populateTeamDropdowns() {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = `<option value="">Select Team</option>`;
  to  .innerHTML = `<option value="">Select Team</option>`;
  Object.keys(lockedTeams).forEach(t => {
    from.innerHTML += `<option value="${t}">${t}</option>`;
    to  .innerHTML += `<option value="${t}">${t}</option>`;
  });
  // only show Free Agency if there are any
  if (freeAgents.length) {
    to.innerHTML += `<option value="__FREE_AGENCY__">Free Agency</option>`;
  }
}

// 8) Populate driver selects
function populateFromDrivers() {
  const sel = document.getElementById("fromDriversSelect");
  const t   = document.getElementById("fromTeamSelect").value;
  sel.innerHTML = "";
  (lockedTeams[t]||[]).forEach(d => {
    sel.innerHTML += `<option value="${d}">${d}</option>`;
  });
}
function populateToDrivers() {
  const sel = document.getElementById("toDriversSelect");
  const t   = document.getElementById("toTeamSelect").value;
  sel.innerHTML = "";
  if (t === "__FREE_AGENCY__") {
    freeAgents.forEach(d => sel.innerHTML += `<option value="${d}">${d}</option>`);
  } else {
    (lockedTeams[t]||[]).forEach(d => {
      sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
  }
}

// 9) Propose trade
async function proposeLockedTrade() {
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam   = document.getElementById("toTeamSelect").value;
  const fromD    = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o=>o.value);
  const toD      = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o=>o.value);
  const fromPts  = parseInt(document.getElementById("fromSweetener").value)||0;
  const toPts    = parseInt(document.getElementById("toSweetener").value)||0;
  try {
    const res = await fetch(
      `${backendUrl}/trade_locked?season_id=${encodeURIComponent(currentSeasonId)}`,
      {
        method: "POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          from_team: fromTeam,
          to_team: toTeam,
          drivers_from_team: fromD,
          drivers_to_team: toD,
          from_team_points: fromPts,
          to_team_points: toPts
        })
      }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j.detail||j.error);
    alert(j.message);
    await loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e.message||e);
  }
}

// 10) Refresh Race Points
async function refreshRacePoints() {
  const nextRace = processedRaces.length
    ? Math.max(...processedRaces.map(r=>parseInt(r,10)))+1
    : 4;
  try {
    const res = await fetch(
      `${backendUrl}/update_race_points?season_id=${encodeURIComponent(currentSeasonId)}&race_id=${encodeURIComponent(nextRace)}`,
      { method:"POST" }
    );
    const j = await res.json();
    if (!res.ok) {
      if (j.detail?.includes("processed")) return alert("No new races to update.");
      throw new Error(j.detail||j.error);
    }
    alert(j.message);
    await loadSeasonData(currentSeasonId);
  } catch(e) {
    alert(e.message||e);
  }
}