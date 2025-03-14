const backendUrl = "https://f1-fantasy-backend-mddo.onrender.com";

function registerTeam() {
    const teamName = document.getElementById("teamNameInput").value;
    
    fetch(`${backendUrl}/register_team?team_name=${encodeURIComponent(teamName)}`, { method: "POST" })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            document.getElementById("registration").style.display = "none";
            document.getElementById("draft").style.display = "block";
        })
        .catch(error => console.error("Error registering team:", error));
}

function draftDriver() {
    const teamName = document.getElementById("teamNameInput").value;
    const driverName = document.getElementById("driverSelect").value;

    fetch(`${backendUrl}/draft_driver?team_name=${encodeURIComponent(teamName)}&driver_name=${encodeURIComponent(driverName)}`, { method: "POST" })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
        })
        .catch(error => console.error("Error drafting driver:", error));
}

function tradeDriver() {
    const team1 = document.getElementById("tradeTeam1").value;
    const team2 = document.getElementById("tradeTeam2").value;
    const driver1 = document.getElementById("tradeDriver1").value;
    const driver2 = document.getElementById("tradeDriver2").value;

    fetch(`${backendUrl}/trade_driver?team1=${team1}&team2=${team2}&driver1=${driver1}&driver2=${driver2}`, { method: "POST" })
        .then(response => response.json())
        .then(data => alert(data.message))
        .catch(error => console.error("Error trading driver:", error));
}