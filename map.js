import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoicmNoZXVuZzAzIiwiYSI6ImNtN2U4NGRxMTBiejQybnB2YXl0bXFheGgifQ.aaUQk-4XP6QI44-BNvM87A';

const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

map.on('load', async () => { 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });
    map.addLayer({
        id: 'botston-bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
          'line-color': '#32D400',
          'line-width': 5,
          'line-opacity': 0.6
        }
    });
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });
    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: {
          'line-color': '#32D400',
          'line-width': 5,
          'line-opacity': 0.6
        }
    });
    let jsonData;
        try {
            const svg = d3.select('#map').select('svg');

            const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
            const jsonData = await d3.json(jsonurl);
            console.log('Loaded JSON Data:', jsonData); 

            let csvData;
                try{
                    const csvurl = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";
                    let trips = await d3.csv(
                        'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
                        (trip) => {
                          trip.started_at = new Date(trip.started_at);
                          trip.ended_at = new Date(trip.ended_at);

                          let startedMinutes = minutesSinceMidnight(trip.started_at);
                          departuresByMinute[startedMinutes].push(trip);
                          let endedMinutes = minutesSinceMidnight(trip.ended_at);
                          arrivalsByMinute[endedMinutes].push(trip);

                          return trip;
                        });

                    console.log('Loaded CSV Data:', trips); 

                    let stations = computeStationTraffic(jsonData.data.stations);
                    console.log('Stations Array:', stations);

                    const departures = d3.rollup(
                        trips,
                        (v) => v.length,
                        (d) => d.start_station_id,
                      );
                    const arrivals = d3.rollup(
                        trips,
                        (v) => v.length,
                        (d) => d.end_station_id,
                      );
                    stations = stations.map((station) => {
                        let id = station.short_name;
                        station.arrivals = arrivals.get(id) ?? 0;
                        station.departures = departures.get(id) ?? 0;
                        station.totalTraffic = station.arrivals + station.departures;
                        return station;
                    });
                    
                    const radiusScale = d3
                        .scaleSqrt()
                        .domain([0, d3.max(stations, (d) => d.totalTraffic)])
                        .range([0, 25]);
                    
                    let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

                    const circles = svg.selectAll('circle')
                        .data(stations, (d) => d.short_name)
                        .enter()
                        .append('circle')
                        .attr('r', d => radiusScale(d.totalTraffic))  // Radius of the circle
                        .attr('fill', 'steelblue')  // Circle fill color
                        .attr('stroke', 'white')    // Circle border color
                        .attr('stroke-width', 1)    // Circle border thickness
                        .attr('opacity', 0.8)      // Circle opacity
                        .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic)) 
                        .each(function(d) {
                            d3.select(this)
                              .append('title')
                              .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
                          });

                    function updatePositions() {
                        circles
                            .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
                            .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
                    }

                    updatePositions();

                    map.on('move', updatePositions);     // Update during map movement
                    map.on('zoom', updatePositions);     // Update during zooming
                    map.on('resize', updatePositions);   // Update on window resize
                    map.on('moveend', updatePositions);  // Final adjustment after movement ends

                    const timeSlider = document.getElementById('time-slider');
                    const selectedTime = document.getElementById('selected-time');
                    const anyTimeLabel = document.getElementById('any-time');

                    function updateTimeDisplay() {
                        const timeFilter = Number(timeSlider.value);  // Get slider value
                      
                        if (timeFilter === -1) {
                          selectedTime.textContent = '';  // Clear time display
                          anyTimeLabel.style.display = 'block';  // Show "(any time)"
                        } else {
                          selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
                          anyTimeLabel.style.display = 'none';  // Hide "(any time)"
                        }

                        updateScatterPlot(timeFilter);
                    }

                    timeSlider.addEventListener('input', updateTimeDisplay);
                    updateTimeDisplay();

                    function updateScatterPlot(timeFilter) {
                        timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);                        

                        const filteredStations = computeStationTraffic(stations, timeFilter);
                        
                        circles
                          .data(filteredStations, (d) => d.short_name)
                          .join('circle') // Ensure the data is bound correctly
                          .attr('r', (d) => radiusScale(d.totalTraffic)) // Update circle sizes
                          .style('--departure-ratio', (d) => stationFlow(d.departures / d.totalTraffic),);
                    }
                }
                catch (error) {
                    console.error('Error loading CSV:', error); // Handle errors
                }
        } catch (error) {
            console.error('Error loading JSON:', error); // Handle errors
        }
});

let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);


function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  
    const { x, y } = map.project(point);  
    return { cx: x, cy: y };  
}


function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

function computeStationTraffic(stations, timeFilter = -1) {

    const departures = d3.rollup(
        filterByMinute(departuresByMinute, timeFilter), 
        (v) => v.length,
        (d) => d.start_station_id
    );

    const arrivals = d3.rollup(
        filterByMinute(arrivalsByMinute, timeFilter), 
        (v) => v.length,
        (d) => d.end_station_id
    );
  
    return stations.map((station) => {
      let id = station.short_name;
      station.arrivals = arrivals.get(id) ?? 0;
      station.departures = departures.get(id) ?? 0;
      station.totalTraffic = station.arrivals + station.departures;
      return station;
  });
}


function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function filterByMinute(tripsByMinute, minute) {
    if (minute === -1) {
      return tripsByMinute.flat();
    }

    let minMinute = (minute - 60 + 1440) % 1440;
    let maxMinute = (minute + 60) % 1440;

    if (minMinute > maxMinute) {
      let beforeMidnight = tripsByMinute.slice(minMinute);
      let afterMidnight = tripsByMinute.slice(0, maxMinute);
      return beforeMidnight.concat(afterMidnight).flat();
    } else {
      return tripsByMinute.slice(minMinute, maxMinute).flat();
    }
  }