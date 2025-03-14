const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com"; // Replace with actual backend URL

function fetchTeams() {
    console.log("Fetching teams...");

    fetch(`${backendUrl}/teams`)
        .then(response => response.json())
        .then(data => {
            console.log("Data received:", data);

            // Get the teams div and clear it
            let teamsDiv = document.getElementById("teams");
            teamsDiv.innerHTML = ""; // Clear previous content

            // Create and add each team in a structured format
            data.teams.forEach(team => {
                let teamElement = document.createElement("div");
                teamElement.innerHTML = `
                    <div style="border: 2px solid black; padding: 10px; margin: 10px; border-radius: 8px;">
                        <h2>${team.name}</h2>
                        <p><strong>Drivers:</strong> ${team.drivers.join(", ")}</p>
                        <p><strong>Points:</strong> ${team.points}</p>
                    </div>
                `;
                teamsDiv.appendChild(teamElement);
            });
        })
        .catch(error => console.error("Error fetching teams:", error));
}