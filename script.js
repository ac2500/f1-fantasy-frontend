const backendUrl = "https://your-app-name.onrender.com"; // Replace with actual backend URL

function fetchTeams() {
    fetch(`${backendUrl}/teams`)
        .then(response => response.json())
        .then(data => {
            document.getElementById("teams").innerText = JSON.stringify(data, null, 2);
        })
        .catch(error => console.error("Error fetching teams:", error));
}