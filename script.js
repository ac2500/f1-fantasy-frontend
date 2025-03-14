const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// Register a Team
function registerTeam() {
  const teamName = document.getElementById("teamNameInput").value.trim();
  if (!teamName) {
    alert("Please enter a team name.");
    return;
  }

  fetch(`${backendUrl}/register_team?team_name=${encodeURIComponent(teamName)}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
      } else {
        alert(data.message);
      }
      updateTeams();
      updateDrivers();
    })
    .catch(err => console.error("Error registering team:", err));
}

// Update Constructors Table
function updateTeams() {
  fetch(`${backendUrl}/get_registered_teams`)
    .then(res => res.json())
    .then(data => {
      const teamTable = document.getElementById("teamTable");
      teamTable.innerHTML = `
        <tr>
          <th>Team Name</th>
          <th>Drafted Drivers</th>
        </tr>
      `;

      for (const [team, drivers] of Object.entries(data.teams)) {
        let driverListHtml = "<ol style='text-align:left; margin:0; padding-left:20px;'>";
        drivers.forEach(driver => {
          driverListHtml += `
            <li>
              ${driver}
              <button onclick="undoDraft('${team}', '${driver}')">Undo</button>
            </li>`;
        });
        driverListHtml += "</ol>";

        if (!drivers.length) driverListHtml = "None";

        teamTable.innerHTML += `
          <tr>
            <td>${team}</td>
            <td>${driverListHtml}</td>
          </tr>
        `;
      }
    })
    .catch(err => console.error("Error fetching teams:", err));
}

// Update Drivers Table (show entire list, strikethrough drafted)
function updateDrivers() {
  Promise.all([
    fetch(`${backendUrl}/get_all_drivers`).then(res => res.json()),
    fetch(`${backendUrl}/get_drafted_status`).then(res => res.json())
  ])
    .then(([allData, draftData]) => {
      const driverTable = document.getElementById("driverTable");
      driverTable.innerHTML = `
        <tr>
          <th>Driver</th>
          <th>Draft By</th>
        </tr>
      `;

      const draftedStatus = draftData.teams;  // { teamName: [driver1, driver2], ... }
      let draftedSet = new Set();
      Object.values(draftedStatus).forEach(drivers => {
        drivers.forEach(d => draftedSet.add(d));
      });

      allData.drivers.forEach(driver => {
        const isDrafted = draftedSet.has(driver);
        driverTable.innerHTML += `
          <tr>
            <td style="${isDrafted ? 'text-decoration: line-through; color: gray;' : ''}">
              ${driver}
            </td>
            <td>
              ${isDrafted ? 'Drafted' : buildTeamDropdown(driver)}
            </td>
          </tr>
        `;
      });
    })
    .catch(err => console.error("Error updating drivers:", err));
}

// Build a dropdown for selecting teams
function buildTeamDropdown(driverName) {
  return `
    <select onchange="draftDriver('${driverName}', this.value)">
      <option value="">Select Team...</option>
    </select>
  `;
}

// Populate the dropdown with team names
function populateTeamDropdowns() {
  fetch(`${backendUrl}/get_registered_teams`)
    .then(res => res.json())
    .then(data => {
      const teams = Object.keys(data.teams);
      // Grab all <select> elements that have an onchange for draftDriver
      const selects = document.querySelectorAll("td select[onchange^='draftDriver']");
      selects.forEach(select => {
        select.innerHTML = `<option value="">Select Team...</option>`;
        teams.forEach(team => {
          select.innerHTML += `<option value="${team}">${team}</option>`;
        });
      });
    })
    .catch(err => console.error("Error populating team dropdowns:", err));
}

// Draft a Driver
function draftDriver(driverName, teamName) {
  if (!teamName) return;
  fetch(`${backendUrl}/draft_driver?team_name=${encodeURIComponent(teamName)}&driver_name=${encodeURIComponent(driverName)}`, {
    method: "POST"
  })
    .then(res => res.json())
    .then(data => {
      if (data.detail) {
        alert(data.detail);
      } else if (data.error) {
        alert(data.error);
      } else {
        alert(data.message);
      }
      updateTeams();
      updateDrivers();
      setTimeout(populateTeamDropdowns, 300);
    })
    .catch(err => console.error("Error drafting driver:", err));
}

// Undo Draft
function undoDraft(teamName, driverName) {
  fetch(`${backendUrl}/undo_draft?team_name=${encodeURIComponent(teamName)}&driver_name=${encodeURIComponent(driverName)}`, {
    method: "POST"
  })
    .then(res => res.json())
    .then(data => {
      if (data.detail) {
        alert(data.detail);
      } else if (data.error) {
        alert(data.error);
      } else {
        alert(data.message);
      }
      updateTeams();
      updateDrivers();
      setTimeout(populateTeamDropdowns, 300);
    })
    .catch(err => console.error("Error undoing draft:", err));
}

// Reset Teams
function resetTeams() {
  fetch(`${backendUrl}/reset_teams`, { method: "POST" })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      updateTeams();
      updateDrivers();
      setTimeout(populateTeamDropdowns, 300);
    })
    .catch(err => console.error("Error resetting teams:", err));
}

// Initial Load
updateTeams();
updateDrivers();
setTimeout(populateTeamDropdowns, 300);