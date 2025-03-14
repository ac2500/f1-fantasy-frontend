const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// Register Team
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

// Update the teams table
function updateTeams() {
  fetch(`${backendUrl}/get_registered_teams`)
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("teamsTable");
      table.innerHTML = `
        <tr>
          <th>Team Name</th>
          <th>Drafted Drivers</th>
        </tr>
      `;

      for (const [teamName, drivers] of Object.entries(data.teams)) {
        let driversList = "";
        if (drivers.length === 0) {
          driversList = "None";
        } else {
          driversList = drivers.join(", ");
        }
        table.innerHTML += `
          <tr>
            <td>${teamName}</td>
            <td>${driversList} <button onclick="undoDraft('${teamName}')">Undo</button></td>
          </tr>
        `;
      }
    })
    .catch(err => console.error("Error updating teams:", err));
}

// Update the available drivers table
function updateDrivers() {
  fetch(`${backendUrl}/get_available_drivers`)
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("driversTable");
      table.innerHTML = `
        <tr>
          <th>Driver</th>
          <th>Draft</th>
        </tr>
      `;
      data.drivers.forEach(driver => {
        table.innerHTML += `
          <tr>
            <td>${driver}</td>
            <td>
              <select onchange="assignDriver('${driver}', this.value)">
                <option value="">Select Team</option>
              </select>
            </td>
          </tr>
        `;
      });
      populateTeamDropdowns();
    })
    .catch(err => console.error("Error updating drivers:", err));
}

// Populate the 'Select Team' dropdown for each driver
function populateTeamDropdowns() {
  fetch(`${backendUrl}/get_registered_teams`)
    .then(res => res.json())
    .then(data => {
      const teams = Object.keys(data.teams);
      const selects = document.querySelectorAll("#driversTable select");
      selects.forEach(select => {
        select.innerHTML = `<option value="">Select Team</option>`;
        teams.forEach(team => {
          select.innerHTML += `<option value="${team}">${team}</option>`;
        });
      });
    })
    .catch(err => console.error("Error populating team dropdowns:", err));
}

// Assign a driver (POST w/ JSON)
function assignDriver(driverName, teamName) {
  if (!teamName) return;

  const payload = {
    team_name: teamName,
    driver_name: driverName
  };

  fetch(`${backendUrl}/assign_driver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
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
    .catch(err => console.error("Error assigning driver:", err));
}

// Undo the last draft pick from a team
function undoDraft(teamName) {
  const payload = { team_name: teamName };

  fetch(`${backendUrl}/undo_draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
      } else if (data.detail) {
        alert(data.detail);
      } else {
        alert(data.message);
      }
      updateTeams();
      updateDrivers();
    })
    .catch(err => console.error("Error undoing draft:", err));
}

// Initial load
updateTeams();
updateDrivers();