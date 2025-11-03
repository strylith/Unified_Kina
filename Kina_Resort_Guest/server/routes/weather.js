import express from 'express';

const router = express.Router();

// OpenWeatherMap API Configuration
const OPENWEATHER_API_KEY = 'd74a9d09ba89b15f8d89164f25747b1b';
// Kina Resort Location: M.H Del Pilar Street, San Rafael, Rodriguez, Rizal, Philippines
// Rodriguez (formerly Montalban), Rizal coordinates
const RESORT_CITY = 'Rodriguez,PH';
const RESORT_LAT = 14.7280;
const RESORT_LON = 121.1230;
const LOCATION_NAME = 'Rodriguez, Rizal, Philippines';
// Philippines timezone offset (UTC+8)
const TIMEZONE_OFFSET = 8;

// Helper to get weather icon emoji from OpenWeatherMap condition code
function getWeatherIcon(code) {
  // OpenWeatherMap condition codes: https://openweathermap.org/weather-conditions
  if (code >= 200 && code < 300) return '⛈️'; // Thunderstorm
  if (code >= 300 && code < 400) return '🌦️'; // Drizzle
  if (code >= 500 && code < 600) return '🌧️'; // Rain
  if (code >= 600 && code < 700) return '❄️'; // Snow
  if (code >= 700 && code < 800) return '🌫️'; // Atmosphere (mist, fog, etc.)
  if (code === 800) return '☀️'; // Clear sky
  if (code === 801) return '🌤️'; // Few clouds
  if (code === 802) return '⛅'; // Scattered clouds
  if (code === 803 || code === 804) return '☁️'; // Broken/Overcast clouds
  return '🌤️'; // Default
}

// Helper to format condition text from OpenWeatherMap
// Maps API descriptions to cleaner, more readable condition names
function formatCondition(weatherItem) {
  if (!weatherItem) return 'Clear';
  
  // Use the main group if available (more consistent)
  const main = weatherItem.main;
  const description = weatherItem.description || '';
  const id = weatherItem.id;
  
  // Map based on condition ID for accuracy (most reliable)
  if (id && typeof id === 'number' && id >= 200 && id < 300) {
    if (id === 200 || id === 201 || id === 202) return 'Thunderstorm';
    if (id === 210 || id === 211 || id === 212) return 'Thunderstorm';
    if (id === 221) return 'Thunderstorm';
    if (id === 230 || id === 231 || id === 232) return 'Thunderstorm with Rain';
    return 'Thunderstorm';
  }
  
  if (id && typeof id === 'number' && id >= 300 && id < 400) {
    if (id === 300 || id === 301) return 'Light Drizzle';
    if (id === 302) return 'Heavy Drizzle';
    if (id === 310 || id === 311 || id === 312) return 'Drizzle';
    if (id === 313 || id === 314) return 'Shower Drizzle';
    if (id === 321) return 'Drizzle';
    return 'Drizzle';
  }
  
  if (id && typeof id === 'number' && id >= 500 && id < 600) {
    if (id === 500) return 'Light Rain';
    if (id === 501) return 'Moderate Rain';
    if (id === 502 || id === 503 || id === 504) return 'Heavy Rain';
    if (id === 511) return 'Freezing Rain';
    if (id === 520 || id === 521) return 'Light Shower Rain';
    if (id === 522 || id === 531) return 'Heavy Shower Rain';
    return 'Rain';
  }
  
  if (id && typeof id === 'number' && id >= 600 && id < 700) {
    if (id === 600 || id === 601) return 'Light Snow';
    if (id === 602) return 'Heavy Snow';
    if (id === 611 || id === 612) return 'Sleet';
    if (id === 615 || id === 616) return 'Rain and Snow';
    if (id === 620 || id === 621 || id === 622) return 'Shower Snow';
    return 'Snow';
  }
  
  if (id && typeof id === 'number' && id >= 700 && id < 800) {
    if (id === 701) return 'Mist';
    if (id === 711) return 'Smoke';
    if (id === 721) return 'Haze';
    if (id === 731) return 'Sand/Dust Whirls';
    if (id === 741) return 'Fog';
    if (id === 751 || id === 761) return 'Dust';
    if (id === 762) return 'Ash';
    if (id === 771) return 'Squall';
    if (id === 781) return 'Tornado';
    return 'Mist';
  }
  
  if (id && typeof id === 'number') {
    if (id === 800) return 'Clear Sky';
    if (id === 801) return 'Few Clouds';
    if (id === 802) return 'Scattered Clouds';
    if (id === 803) return 'Broken Clouds';
    if (id === 804) return 'Overcast Clouds';
  }
  
  // Fallback to main group if ID mapping fails
  if (main && typeof main === 'string') {
    const mainMap = {
      'Clear': 'Clear Sky',
      'Clouds': 'Cloudy',
      'Rain': 'Rain',
      'Drizzle': 'Drizzle',
      'Thunderstorm': 'Thunderstorm',
      'Snow': 'Snow',
      'Mist': 'Mist',
      'Fog': 'Fog',
      'Haze': 'Haze'
    };
    return mainMap[main] || main;
  }
  
  // Last fallback: capitalize description
  if (description && typeof description === 'string') {
    return description.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
  
  return 'Clear';
}

// Helper to generate date labels for forecast
function formatForecastDate(date, index) {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayOfWeek = weekdays[date.getDay()];
  const month = monthNames[date.getMonth()];
  const dayNum = date.getDate();
  
  if (index === 0) {
    return { day: dayOfWeek, dateLabel: 'Today' };
  } else if (index === 1) {
    return { day: dayOfWeek, dateLabel: 'Tomorrow' };
  } else {
    return { day: dayOfWeek, dateLabel: `${month} ${dayNum}` };
  }
}

// Group forecast data by day from OpenWeatherMap 3-hourly forecast
// Use Philippines local time (UTC+8) for accurate day grouping
function groupForecastByDay(forecastList) {
  const grouped = {};
  
  forecastList.forEach(item => {
    // API returns UTC timestamps, convert to Philippines local date (UTC+8)
    const utcDate = new Date(item.dt * 1000);
    // Get UTC components
    const utcYear = utcDate.getUTCFullYear();
    const utcMonth = utcDate.getUTCMonth();
    const utcDay = utcDate.getUTCDate();
    const utcHour = utcDate.getUTCHours();
    
    // Calculate Philippines time (UTC+8)
    const phHour = (utcHour + TIMEZONE_OFFSET) % 24;
    // If hour wraps (PH hour < UTC hour), day advances; also handle month/year rollover
    let phDay = utcDay;
    let phMonth = utcMonth;
    let phYear = utcYear;
    
    if (phHour < utcHour) {
      // Day advances, handle month/year rollover
      phDay = utcDay + 1;
      const daysInMonth = new Date(utcYear, utcMonth + 1, 0).getDate();
      if (phDay > daysInMonth) {
        phDay = 1;
        phMonth++;
        if (phMonth > 11) {
          phMonth = 0;
          phYear++;
        }
      }
    }
    
    // Create Philippines date
    const phDate = new Date(Date.UTC(phYear, phMonth, phDay));
    const dateKey = phDate.toISOString().split('T')[0]; // YYYY-MM-DD in Philippines time
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        date: phDate, // Use Philippines local date
        items: [],
        temps: [],
        temp_maxs: [], // Track max temps for each forecast point
        temp_mins: [],  // Track min temps for each forecast point
        humidities: [], // Track humidity for each forecast point
        conditions: [],
        icons: []
      };
    }
    
    grouped[dateKey].items.push(item);
    // Track all temperature values for true daily max/min calculation
    // Use actual temp (not temp_max/temp_min) since those are per 3-hour period, not daily
    grouped[dateKey].temps.push(item.main.temp);
    // Keep temp_maxs/temp_mins for reference but we'll use actual temps for daily max/min
    grouped[dateKey].temp_maxs.push(item.main.temp_max || item.main.temp);
    grouped[dateKey].temp_mins.push(item.main.temp_min || item.main.temp);
    grouped[dateKey].humidities.push(item.main.humidity || null);
    grouped[dateKey].conditions.push(item.weather[0].main);
    grouped[dateKey].icons.push(item.weather[0].id);
  });
  
  return grouped;
}

// Get representative forecast for each day from grouped data
// Uses Philippines local dates (UTC+8) for accurate day grouping
function getDailyForecast(groupedForecast, startDate, currentWeatherData, currentApiData) {
  const forecast = [];
  
  // Get forecast for next 5 days using Philippines local dates (UTC+8)
  for (let i = 0; i < 5; i++) {
    const forecastDate = new Date(startDate);
    forecastDate.setUTCDate(startDate.getUTCDate() + i);
    // forecastDate is already in Philippines date (from startDate calculation)
    const dateKey = forecastDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // For today (i === 0), use current weather data
    if (i === 0 && currentWeatherData) {
      const { day, dateLabel } = formatForecastDate(forecastDate, i);
      
      // Get today's min temp from actual temp values (not temp_mins which are per 3-hour period)
      let todayMinTemp = currentWeatherData.tempC;
      if (groupedForecast[dateKey] && groupedForecast[dateKey].temps.length > 0) {
        // Use actual temp values to get true daily minimum
        todayMinTemp = Math.round(Math.min(...groupedForecast[dateKey].temps));
      } else if (currentApiData && currentApiData.main) {
        // Use API temp_min as fallback
        todayMinTemp = Math.round(currentApiData.main.temp_min || currentWeatherData.tempC);
      }
      
      // Get today's max temp - prefer currentWeatherData.tempC which already uses API temp_max
      // This ensures we use the actual daily max, not just remaining forecast hours
      let todayMaxTemp = currentWeatherData.tempC;
      if (groupedForecast[dateKey] && groupedForecast[dateKey].temps.length > 0) {
        // Use the higher of currentWeatherData.tempC (API temp_max) or forecast max
        const forecastMax = Math.round(Math.max(...groupedForecast[dateKey].temps));
        todayMaxTemp = Math.max(currentWeatherData.tempC, forecastMax);
      }
      
      // For today's humidity, always use current weather humidity (most accurate for "today")
      // Don't use forecast items for today's humidity - they might be from future hours
      // and don't represent the current actual humidity
      const todayHumidity = currentWeatherData.humidity;
      
      forecast.push({
        d: day,
        date: dateLabel,
        fullDate: dateKey,
        t: todayMaxTemp, // High temperature (from actual temp values)
        tMin: todayMinTemp, // Low temperature (from actual temp values)
        icon: currentWeatherData.icon,
        condition: currentWeatherData.condition, // Use accurate condition from current weather
        humidity: todayHumidity // Use representative midday humidity (matches OpenWeatherMap)
      });
      continue;
    }
    
    const dayData = groupedForecast[dateKey];
    
    if (dayData) {
      // Get most representative condition (prefer local midday if available)
      // Use midday temperature for forecast days (11 AM-3 PM local time)
      // Philippines is UTC+8, so local midday (11-3 PM) is UTC 3-7
      // OpenWeatherMap often uses UTC 3:00 (local 11:00) or UTC 6:00 (local 14:00) as representative
      const representativeItem = dayData.items.find(item => {
        const utcDate = new Date(item.dt * 1000);
        const localHour = (utcDate.getUTCHours() + TIMEZONE_OFFSET) % 24;
        return localHour >= 11 && localHour <= 15; // Prefer local midday (11 AM-3 PM local time)
      }) || dayData.items.find(item => {
        // Fallback: find UTC 3-7 (which is local 11 AM-3 PM)
        const hour = new Date(item.dt * 1000).getUTCHours();
        return hour >= 3 && hour <= 7;
      }) || dayData.items[Math.floor(dayData.items.length / 2)] || dayData.items[0];
      
      // Use midday temperature from representative item
      const middayTemp = Math.round(representativeItem.main.temp);
      
      // Get daily min temp from all forecast items for the day
      const minTemp = Math.round(Math.min(...dayData.temps)); // True daily minimum
      
      // Use humidity from representative item (local midday) instead of averaging
      // This matches how OpenWeatherMap displays daily humidity - from a representative time period
      const humidity = representativeItem.main.humidity || null;
      
      const iconCode = representativeItem.weather[0].id;
      const icon = getWeatherIcon(iconCode);
      const condition = formatCondition(representativeItem.weather[0]); // Pass full weather object for accurate mapping
      
      const { day, dateLabel } = formatForecastDate(forecastDate, i);
      
      forecast.push({
        d: day,
        date: dateLabel,
        fullDate: dateKey,
        t: middayTemp, // Midday temperature for display
        tMin: minTemp, // Daily minimum temperature
        icon: icon,
        condition: condition, // Add condition text
        humidity: humidity // Use humidity from representative time period (midday)
      });
    }
  }
  
  return forecast;
}


// Generate suggestion based on weather
function generateSuggestion(current, forecast) {
  const temp = current.tempC;
  const condition = current.condition.toLowerCase();
  
  if (condition.includes('rain') || condition.includes('storm')) {
    return 'Consider indoor activities. Perfect time for spa treatments!';
  } else if (temp > 32) {
    return 'Hot day ahead! Stay hydrated and enjoy the pool.';
  } else if (temp >= 25 && temp <= 32) {
    return 'Perfect weather for outdoor activities and resort exploration!';
  } else {
    return 'Cooler day. Great for exploring or relaxing by the resort.';
  }
}

// GET /api/weather/summary - Get real weather from OpenWeatherMap
router.get('/summary', async (req, res) => {
  try {
    // Fetch current weather for Kina Resort, Rodriguez, Rizal, Philippines
    // Using coordinates for precise location matching (M.H Del Pilar Street, San Rafael, Rodriguez, Rizal)
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${RESORT_LAT}&lon=${RESORT_LON}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    
    // Fetch 5-day forecast (3-hour intervals) - OpenWeatherMap provides 5 days
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${RESORT_LAT}&lon=${RESORT_LON}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    
    console.log('🌤️ Fetching weather from OpenWeatherMap API for Kina Resort, Rodriguez, Rizal...');
    console.log(`📍 Location: ${LOCATION_NAME}`);
    console.log(`📍 Coordinates: ${RESORT_LAT}, ${RESORT_LON}`);
    
    // Fetch both in parallel
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(currentWeatherUrl),
      fetch(forecastUrl)
    ]);
    
    if (!currentResponse.ok) {
      const errorText = await currentResponse.text();
      throw new Error(`OpenWeatherMap API error: ${currentResponse.status} ${currentResponse.statusText} - ${errorText}`);
    }
    
    if (!forecastResponse.ok) {
      const errorText = await forecastResponse.text();
      throw new Error(`OpenWeatherMap Forecast API error: ${forecastResponse.status} ${forecastResponse.statusText} - ${errorText}`);
    }
    
    const currentData = await currentResponse.json();
    const forecastData = await forecastResponse.json();
    
    // Process forecast first - group by day to get today's max temp
    const groupedForecast = groupForecastByDay(forecastData.list);
    
    // Get today's date in Philippines local time (UTC+8)
    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const utcDay = now.getUTCDate();
    const utcHour = now.getUTCHours();
    
    // Calculate Philippines time (UTC+8)
    const phHour = (utcHour + TIMEZONE_OFFSET) % 24;
    // If hour wraps (PH hour < UTC hour), day advances; also handle month/year rollover
    let phDay = utcDay;
    let phMonth = utcMonth;
    let phYear = utcYear;
    
    if (phHour < utcHour) {
      // Day advances, handle month/year rollover
      phDay = utcDay + 1;
      const daysInMonth = new Date(utcYear, utcMonth + 1, 0).getDate();
      if (phDay > daysInMonth) {
        phDay = 1;
        phMonth++;
        if (phMonth > 11) {
          phMonth = 0;
          phYear++;
        }
      }
    }
    
    // Create Philippines date for "today"
    const todayUTC = new Date(Date.UTC(phYear, phMonth, phDay, 0, 0, 0, 0));
    const todayKey = todayUTC.toISOString().split('T')[0]; // YYYY-MM-DD in Philippines time
    
    // Get today's maximum temperature - use the HIGHER of API temp_max or forecast max
    // API temp_max is the actual daily max, but forecast items might only include remaining hours
    let todayMaxTemp = Math.round(currentData.main.temp_max || currentData.main.temp);
    
    // Check forecast data for today - use actual temp values to complement API temp_max
    if (groupedForecast[todayKey] && groupedForecast[todayKey].temps.length > 0) {
      // Use actual temp values to get max from forecast items
      const forecastMax = Math.round(Math.max(...groupedForecast[todayKey].temps));
      // Use the HIGHER value: API temp_max (actual daily max) vs forecast max (remaining hours)
      // This ensures accuracy even if only evening hours remain in forecast
      const apiMax = Math.round(currentData.main.temp_max || currentData.main.temp);
      todayMaxTemp = Math.max(apiMax, forecastMax);
      console.log(`🌡️ Today's max temp: ${todayMaxTemp}°C (API temp_max: ${apiMax}°C, Forecast max: ${forecastMax}°C from ${groupedForecast[todayKey].temps.length} points)`);
    } else {
      // Fallback to API temp_max if no forecast data
      todayMaxTemp = Math.round(currentData.main.temp_max || currentData.main.temp);
      console.log(`🌡️ Today's max temp from API temp_max: ${todayMaxTemp}°C (temp_max: ${currentData.main.temp_max}, current temp: ${currentData.main.temp})`);
    }
    
    // Process current weather - use actual current temperature
    const currentWeather = {
      tempC: Math.round(currentData.main.temp), // Use actual current temperature
      condition: formatCondition(currentData.weather[0]), // Pass full weather object for accurate mapping
      icon: getWeatherIcon(currentData.weather[0].id),
      feelslike: Math.round(currentData.main.feels_like),
      humidity: currentData.main.humidity
    };
    
    // Get daily forecast using UTC dates for accuracy
    const nextDays = getDailyForecast(groupedForecast, todayUTC, currentWeather, currentData);
    
    // Generate suggestion
    const suggestion = generateSuggestion(currentWeather, nextDays);
    
    const summary = {
      location: LOCATION_NAME,
      current: currentWeather,
      nextDays: nextDays,
      suggestion: suggestion
    };
    
    console.log('🌤️ Weather data returned:', {
      location: summary.location,
      temp: `${summary.current.tempC}°C`,
      condition: summary.current.condition,
      forecastDays: summary.nextDays.length,
      source: 'OpenWeatherMap API',
      coordinates: `${RESORT_LAT}, ${RESORT_LON}`
    });
    
    // Add cache-control headers to prevent caching and ensure fresh data on date change
    // This ensures the weather automatically updates when the date changes
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(), // Include timestamp for client-side validation
      dateKey: todayKey // Include today's date key so frontend can detect date changes
    });
  } catch (error) {
    console.error('🌤️ Weather API error:', error);
    
    // Fallback to basic template if API fails
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const fallbackForecast = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      
      const dayOfWeek = weekdays[date.getDay()];
      const month = monthNames[date.getMonth()];
      const dayNum = date.getDate();
      
      let dateLabel;
      if (i === 0) {
        dateLabel = 'Today';
      } else if (i === 1) {
        dateLabel = 'Tomorrow';
      } else {
        dateLabel = `${month} ${dayNum}`;
      }
      
      fallbackForecast.push({
        d: dayOfWeek,
        date: dateLabel,
        fullDate: dateKey,
        t: 28,
        c: 'Clear',
        icon: '☀️'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather from API',
      message: error.message,
      data: {
        location: LOCATION_NAME,
        current: {
          tempC: 28,
          condition: 'Sunny',
          icon: '☀️',
          feelslike: 30,
          humidity: 65
        },
        nextDays: fallbackForecast,
        suggestion: 'Weather data temporarily unavailable'
      }
    });
  }
});

export default router;









