const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// Static list of 2025 rounds
const RACE_LIST = [
  "Bahrain","Saudi Arabia","Miami","Imola","Monaco","Spain",
  "Canada","Austria","UK","Belgium","Hungary","Netherlands",
  "Monza","Azerbaijan","Singapore","Texas","Mexico","Brazil",
  "Vegas","Qatar","Abu Dhabi"
];

let currentSeasonId = null;
let freeAgents = [];
let processedRaces = [];
let lockedTeams = {};
let lockedPoints = {};
let tradeHistory = [];
let racePoints = {};
const COLOR_ARRAY = ["green","blue","yellow","orange","purple"];
let colorMap = {};

// On load: first fetch locked season data, then load free agents against that roster
window.onload = async () => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("season_id");
  if (!sid) {
    alert("No season_id provided!");
    return;
  }
  currentSeasonId = sid;
  await loadSeasonData(sid);
  loadFreeAgents();
};

// Load locked season details
async function loadSeasonData(seasonId) {
  try {
    const res = await fetch(`${backendUrl}/get_season?season_id=${encodeURIComponent(seasonId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error);

    lockedTeams    = data.teams      || {};
    lockedPoints   = data.points     || {};
    tradeHistory   = data.trade_history || [];
    racePoints     = data.race_points   || {};
    processedRaces = data.processed_races || [];

    assignTeamColors(Object.keys(lockedTeams));
    renderLeaderboard(lockedPoints);
    renderLineups(lockedTeams);
    renderDriverRaceTable(racePoints);
    renderTradeHistory(tradeHistory);
    populateTeamDropdowns(lockedTeams);
  } catch (err) {
    console.error(err);
    alert(err.message || err);
  }
}

// Fetch draft-phase drivers and filter out those in locked teams
async function loadFreeAgents() {
  try {
    const res = await fetch(`${backendUrl}/get_available_drivers`);
    const j   = await res.json();
    // Filter based on locked season roster
    const drafted = Object.values(lockedTeams).flat();
    freeAgents = (j.drivers || []).filter(d => !drafted.includes(d));
    renderFreeAgents(freeAgents);
  } catch (err) {
    console.error(err);
  }
}

function assignTeamColors(teamNames) {
  colorMap = {};
  const sorted = [...teamNames].sort();
  sorted.forEach((t, i) => {
    colorMap[t] = COLOR_ARRAY[i] || "white";
  });
}

function renderLeaderboard(points) {
  const tbl = document.getElementById("leaderboardTable");
  tbl.innerHTML = "<tr><th>Fantasy Team</th><th>Total Points</th></tr>";
  Object.entries(points)
    .sort((a,b) => b[1] - a[1])
    .forEach(([team, pts]) => {
      tbl.innerHTML +=
        `<tr>
           <td style=\"color:${colorMap[team]||'white'}\">${team}</td>
           <td>${pts}</td>
         </tr>`;
    });
}

function renderLineups(teams) {
  const tbl = document.getElementById("lineupsTable");
  tbl.innerHTML = "<tr>" +
    Object.keys(teams)
      .map(t => `<th style=\"color:${colorMap[t]||'white'}\">${t}</th>`)
      .join("") +
    "</tr>";
  const maxLen = Math.max(...Object.values(teams).map(r => r.length));
  for (let i = 0; i < maxLen; i++) {
    let row = "<tr>";
    Object.values(teams).forEach(drivers => {
      row += `<td>${drivers[i] || ""}</td>`;
    });
    row += "</tr>";
    tbl.innerHTML += row;
  }
}

function renderDriverRaceTable(raceData) {
  const tbl = document.getElementById("driverRaceTable");
  const driversSet = new Set();
  Object.values(lockedTeams).forEach(arr => arr.forEach(d => driversSet.add(d)));
  Object.values(raceData).forEach(rp => Object.keys(rp).forEach(d => driversSet.add(d)));
  const list = Array.from(driversSet).sort();

  tbl.innerHTML =
    "<tr><th>Driver</th>" +
    RACE_LIST.map(r => `<th>${r}</th>`).join("") +
    "</tr>";

  list.forEach(drv => {
    let r = `<tr><td>${drv}</td>`;
    RACE_LIST.forEach(rn => {
      const info = (raceData[rn] || {})[drv] || {};
      const pts  = info.points ?? "";
      const col  = info.team ? (colorMap[info.team] || "white") : "white";
      r += `<td style=\"color:${col}\">${pts}</td>`;
    });
    r += `</tr>`;
    tbl.innerHTML += r;
  });

  if (!list.length) {
    tbl.innerHTML = `<tr><td colspan=\"${RACE_LIST.length+1}\">No drafted drivers found.</td></tr>`;
  }
}

function renderTradeHistory(hist) {
  const ul = document.getElementById("tradeHistory");
  ul.innerHTML = "";
  hist.forEach(txt => {
    const li = document.createElement("li");
    li.textContent = txt;
    ul.appendChild(li);
  });
}

function populateTeamDropdowns(teams) {
  const from = document.getElementById("fromTeamSelect");
  const to   = document.getElementById("toTeamSelect");
  from.innerHTML = "<option value=''>Select Team</option>";
  to.innerHTML   = "<option value=''>Select Team</option>";
  Object.keys(teams).forEach(t => {
    from.innerHTML += `<option value=\"${t}\">${t}</option>`;
    to.innerHTML   += `<option value=\"${t}\">${t}</option>`;
  });
  to.innerHTML += `<option value=\"__FREE_AGENCY__\">Free Agency</option>`;
}

function populateFromDrivers() {
  const sel  = document.getElementById("fromDriversSelect");
  const team = document.getElementById("fromTeamSelect").value;
  sel.innerHTML = "";
  if (lockedTeams[team]) {
    lockedTeams[team].forEach(d => sel.innerHTML += `<option value=\"${d}\">${d}</option>`);
  }
}

function populateToDrivers() {
  const sel  = document.getElementById("toDriversSelect");
  const team = document.getElementById("toTeamSelect").value;
  sel.innerHTML = "";
  if (team === "__FREE_AGENCY__") {
    freeAgents.forEach(d => sel.innerHTML += `<option value=\"${d}\">${d}</option>`);
  } else if (lockedTeams[team]) {
    lockedTeams[team].forEach(d => sel.innerHTML += `<option value=\"${d}\">${d}</option>`);
  }
}

async function proposeLockedTrade() {
  if (!currentSeasonId) return alert("No season_id!");
  const fromTeam = document.getElementById("fromTeamSelect").value;
  const toTeam   = document.getElementById("toTeamSelect").value;
  const fromDrivers = Array.from(document.getElementById("fromDriversSelect").selectedOptions).map(o => o.value);
  const toDrivers   = Array.from(document.getElementById("toDriversSelect").selectedOptions).map(o => o.value);
  const fromPts = parseInt(document.getElementById("fromSweetener").value||0, 10);
  const toPts   = parseInt(document.getElementById("toSweetener").value||0, 10);

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
    await loadSeasonData(currentSeasonId);
    loadFreeAgents(); // refresh free agents after trade
  } catch (err) {
    alert(err.message || err);
  }
}

async function refreshRacePoints() {
  if (!currentSeasonId) return alert("No season_id!");
  const nextRace = processedRaces.length
    ? Math.max(...processedRaces.map(r => parseInt(r,10))) + 1
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
    await loadSeasonData(currentSeasonId);
    loadFreeAgents();
  } catch (err) {
    alert(err.message || err);
  }
}

function renderFreeAgents(drivers) {
  const ul = document.getElementById("undraftedList");
  if (!ul) return;
  ul.innerHTML = drivers.map(d => `<li>${d}</li>`).join("");
}
