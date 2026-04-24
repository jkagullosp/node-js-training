async function getWeather() {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=14.6&longitude=121.0&current_weather=true';

    try {
        console.log("Fetching weather data...");
        
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        console.log("Current Weather Data:");
        console.log(data.current_weather);

        const { temperature, windspeed } = data.current_weather;
        console.log(`\nIt is currently ${temperature}°C with a wind speed of ${windspeed} km/h.`);

    } catch (error) {
        console.error("Failed to fetch weather:", error.message);
    }
}

getWeather();