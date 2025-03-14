const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

// Register a new team
function registerTeam() {
    const teamName = document.getElementById("teamNameInput").value;
    if (!teamName) {
        alert("Please enter a team name.");
        return;
    }

    fetch(`${backendUrl}/register_team?team_name=${encodeURIComponent(teamName)}`)
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            updateRegisteredTeams();
        })
        .catch(error => console.error("Error registering team:", error));
}

// Enter draft mode
function enterDraftMode() {
    const teamName = document.getElementById("teamNameInput").value;
    if (!teamName) {
        alert("Please enter your registered team name first.");
        return;
    }

    fetch(`${backendUrl}/enter_draft_mode?team_name=${encodeURIComponent(teamName)}`)
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            updateRegisteredTeams();
        })
        .catch(error => console.error("Error entering draft mode:", error));
}

// Update registered teams list
function updateRegisteredTeams() {
    fetch(`${backendUrl}/get_registered_teams`)
        .then(response => response.json())
        .then(data => {
            const teamTable = document.getElementById("teamTable");
            teamTable.innerHTML = "<tr><th>Team Name</th><th>Status</th></tr>";

            for (const [team, status] of Object.entries(data.teams)) {
                teamTable.innerHTML += `<tr><td>${team}</td><td>${status}</td></tr>`;
            }
        })
        .catch(error => console.error("Error fetching registered teams:", error));
}

// Auto-refresh the team list every 5 seconds
setInterval(updateRegisteredTeams, 5000);