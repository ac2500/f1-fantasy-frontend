const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com"; // Replace with actual backend URL

function fetchTeams() {
    fetch(`${backendUrl}/teams`)
        .then(response => response.json())
        .then(data => {
            const teamsDiv = document.getElementById("teams");
            teamsDiv.innerHTML = ""; // Clear previous content

            // ✅ Loop through each team and display names, drivers, and total points
            Object.entries(data.teams).forEach(([teamName, teamData]) => {
                const teamElement = document.createElement("div");
                teamElement.classList.add("team");

                teamElement.innerHTML = `
                    <h2>${teamName}</h2>
                    <p><strong>Drivers:</strong> ${teamData.drivers.join(", ")}</p>
                    <p><strong>Total Points:</strong> ${teamData.points}</p>
                `;

                teamsDiv.appendChild(teamElement);
            });
        })
        .catch(error => console.error("Error fetching teams:", error));
}