const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// 1. Register a Team
function registerTeam() {
  const teamName = document.getElementById("teamNameInput").value;
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
        updateTeams();
        updateDrivers();
      }
    })
    .catch(err => console.error("Error registering team:", err));
}

// 2. Update the Registered Teams Table
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
        teamTable.innerHTML += `
          <tr>
            <td>${team}</td>
            <td>${drivers.length ? drivers.join(", ") : "None"}</td>
          </tr>
        `;
      }
    })
    .catch(err => console.error("Error fetching teams:", err));
}

// 3. Update the Available Drivers Table
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

// 4. Populate the "Draft By" dropdown with existing teams
function populateTeamDropdowns() {
  fetch(`${backendUrl}/get_registered_teams`)
    .then(res => res.json())
    .then(data => {
      const teams = Object.keys(data.teams);
      const selects = document.querySelectorAll("td select");
      selects.forEach(select => {
        // Skip if it's the "Select Team..." placeholder
        select.innerHTML = `<option value="">Select Team...</option>`;
        teams.forEach(team => {
          select.innerHTML += `<option value="${team}">${team}</option>`;
        });
      });
    })
    .catch(err => console.error("Error populating team dropdowns:", err));
}

// 5. Draft a Driver (Assign driver to team)
function draftDriver(driverName, teamName) {
  if (!teamName) return; // User hasn't chosen a team

  fetch(`${backendUrl}/draft_driver?team_name=${encodeURIComponent(teamName)}&driver_name=${encodeURIComponent(driverName)}`, {
    method: "POST"
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
      } else {
        alert(data.message);
        updateTeams();
        updateDrivers();
      }
    })
    .catch(err => console.error("Error drafting driver:", err));
}

// 6. Undo Draft (Optional)
function undoDraft(teamName, driverName) {
  fetch(`${backendUrl}/undo_draft?team_name=${encodeURIComponent(teamName)}&driver_name=${encodeURIComponent(driverName)}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
      } else {
        alert(data.message);
        updateTeams();
        updateDrivers();
      }
    })
    .catch(err => console.error("Error undoing draft:", err));
}

// Initial Load
updateTeams();
updateDrivers();