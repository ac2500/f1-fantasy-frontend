const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// 1. Register a Team
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

// 2. Update Constructors Table
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
        // Build a vertical numbered list
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

// 3. Update Available Drivers Table
function updateDrivers() {
  fetch(`${backendUrl}/get_available_drivers`)
    .then(res => res.json())
    .then(data => {
      const driverTable = document.getElementById("driverTable");
      driverTable.innerHTML = `
        <tr>
          <th>Driver</th>
          <th>Draft By</th>
        </tr>
      `;
      data.drivers.forEach(driver => {
        driverTable.innerHTML += `
          <tr>
            <td>${driver}</td>
            <td>
              <select onchange="draftDriver('${driver}', this.value)">
                <option value="">Select Team...</option>
              </select>
            </td>
          </tr>
        `;
      });
      populateTeamDropdowns();
    })
    .catch(err => console.error("Error fetching drivers:", err));
}

// 4. Populate 'Draft By' Dropdown
function populateTeamDropdowns() {
  fetch(`${backendUrl}/get_registered_teams`)
    .then(res => res.json())
    .then(data => {
      const teams = Object.keys(data.teams);
      const selects = document.querySelectorAll("#driverTable select");
      selects.forEach(select => {
        select.innerHTML = `<option value="">Select Team...</option>`;
        teams.forEach(team => {
          select.innerHTML += `<option value="${team}">${team}</option>`;
        });
      });
    })
    .catch(err => console.error("Error populating team dropdowns:", err));
}

// 5. Draft a Driver
function draftDriver(driverName, teamName) {
  if (!teamName) return; // user didn't pick a team
  fetch(`${backendUrl}/draft_driver?team_name=${encodeURIComponent(teamName)}&driver_name=${encodeURIComponent(driverName)}`, {
    method: "POST"
  })
    .then(res => res.json())
    .then(data => {
      if (data.detail) {
        // FastAPI error format
        alert(data.detail);
      } else if (data.error) {
        alert(data.error);
      } else {
        alert(data.message);
      }
      updateTeams();
      updateDrivers();
    })
    .catch(err => console.error("Error drafting driver:", err));
}

// 6. Undo Draft
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
    })
    .catch(err => console.error("Error undoing draft:", err));
}

// 7. Reset Teams
function resetTeams() {
  fetch(`${backendUrl}/reset_teams`, { method: "POST" })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      updateTeams();
      updateDrivers();
    })
    .catch(err => console.error("Error resetting teams:", err));
}

// Initial Load
updateTeams();
updateDrivers();