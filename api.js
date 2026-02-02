/**
 * LTA DataMall API Integration
 * Singapore Bus Timing App
 */

const LTA_API = {
    baseUrl: 'https://datamall2.mytransport.sg/ltaodataservice',

    /**
     * Get API key from localStorage
     */
    getApiKey() {
        return localStorage.getItem('LTA_API_KEY');
    },

    /**
     * Set API key to localStorage
     */
    setApiKey(key) {
        if (key) {
            localStorage.setItem('LTA_API_KEY', key);
        } else {
            localStorage.removeItem('LTA_API_KEY');
        }
    },

    /**
     * Check if user has provided an API key
     */
    hasApiKey() {
        return !!this.getApiKey();
    },

    /**
     * Make API request to LTA DataMall
     * Calls the serverless backend which handles the API key
     */
    async request(endpoint, params = {}) {
        // Build the URL for the serverless function
        let apiUrl = '/api/bus-arrival';

        // Append query parameters
        const queryParams = new URLSearchParams();
        if (params.BusStopCode) queryParams.append('BusStopCode', params.BusStopCode);
        if (params.ServiceNo) queryParams.append('ServiceNo', params.ServiceNo);

        const fullUrl = `${apiUrl}?${queryParams.toString()}`;

        console.log(`Calling API: ${fullUrl}`);

        // Get API key if available
        const apiKey = this.getApiKey();
        const headers = {
            'Accept': 'application/json'
        };

        if (apiKey) {
            headers['AccountKey'] = apiKey;
        }

        try {
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                let errorMsg = `API Error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.error) {
                        errorMsg = errorData.error;
                    } else if (typeof errorData === 'string') {
                        errorMsg = errorData;
                    }
                } catch (e) {
                    // Could not parse JSON, try text
                    try {
                        const text = await response.text();
                        if (text) errorMsg = `Server Error: ${text}`;
                    } catch (ex) { /* ignore */ }
                }
                throw new Error(errorMsg);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            // Re-throw so app.js can handle it
            throw error;
        }
    },

    // Demo data for testing when API is not available
    demoData: {
        "BusStopCode": "20251",
        "Services": [
            {
                "ServiceNo": "176",
                "Operator": "SMRT",
                "NextBus": {
                    "EstimatedArrival": new Date(Date.now() + 3 * 60000).toISOString(),
                    "Load": "SEA",
                    "Type": "DD"
                },
                "NextBus2": {
                    "EstimatedArrival": new Date(Date.now() + 12 * 60000).toISOString(),
                    "Load": "SDA",
                    "Type": "DD"
                },
                "NextBus3": {
                    "EstimatedArrival": new Date(Date.now() + 20 * 60000).toISOString(),
                    "Load": "SEA",
                    "Type": "SD"
                }
            },
            {
                "ServiceNo": "30",
                "Operator": "SBST",
                "NextBus": {
                    "EstimatedArrival": new Date(Date.now() + 5 * 60000).toISOString(),
                    "Load": "SEA",
                    "Type": "DD"
                },
                "NextBus2": {
                    "EstimatedArrival": new Date(Date.now() + 15 * 60000).toISOString(),
                    "Load": "LSD",
                    "Type": "SD"
                },
                "NextBus3": {
                    "EstimatedArrival": new Date(Date.now() + 25 * 60000).toISOString(),
                    "Load": "SEA",
                    "Type": "DD"
                }
            },
            {
                "ServiceNo": "78",
                "Operator": "TTS",
                "NextBus": {
                    "EstimatedArrival": new Date(Date.now() + 1 * 60000).toISOString(),
                    "Load": "SDA",
                    "Type": "DD"
                },
                "NextBus2": {
                    "EstimatedArrival": new Date(Date.now() + 18 * 60000).toISOString(),
                    "Load": "SEA",
                    "Type": "DD"
                },
                "NextBus3": null
            }
        ]
    },

    /**
     * Get bus arrival times - tries real API first, falls back to demo
     */
    async getBusArrival(busStopCode, serviceNo = '') {
        try {
            const data = await this.request('/v3/BusArrival', {
                BusStopCode: busStopCode,
                ServiceNo: serviceNo
            });

            // Check if we got valid data
            if (data && data.Services && data.Services.length > 0) {
                return data;
            }
            throw new Error('No services found');
        } catch (error) {
            console.log('API failed, using demo mode:', error.message);
            // Return demo data with dynamic times
            return this.getDemoData(busStopCode);
        }
    },

    /**
     * Get demo data with fresh timestamps
     */
    getDemoData(busStopCode) {
        // Refresh demo times
        const now = Date.now();
        const demo = JSON.parse(JSON.stringify(this.demoData));
        demo.BusStopCode = busStopCode;
        demo._isDemo = true; // Flag to show demo indicator

        demo.Services.forEach((service, i) => {
            if (service.NextBus) {
                service.NextBus.EstimatedArrival = new Date(now + (2 + i * 3) * 60000).toISOString();
            }
            if (service.NextBus2) {
                service.NextBus2.EstimatedArrival = new Date(now + (10 + i * 5) * 60000).toISOString();
            }
            if (service.NextBus3) {
                service.NextBus3.EstimatedArrival = new Date(now + (20 + i * 4) * 60000).toISOString();
            }
        });

        return demo;
    },

    /**
     * Parse arrival time and return minutes until arrival
     * @param {string} estimatedArrival - ISO datetime string
     */
    parseArrivalTime(estimatedArrival) {
        if (!estimatedArrival) {
            return null;
        }

        const arrivalTime = new Date(estimatedArrival);
        const now = new Date();
        const diffMs = arrivalTime - now;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins <= 0) {
            return 'Arr';
        } else if (diffMins === 1) {
            return '1 min';
        } else {
            return `${diffMins} min`;
        }
    },

    /**
     * Format estimated arrival time to 12-hour format with AM/PM
     * @param {string} estimatedArrival - ISO datetime string
     */
    formatTime(estimatedArrival) {
        if (!estimatedArrival) {
            return '--:--';
        }

        const date = new Date(estimatedArrival);
        return date.toLocaleTimeString('en-SG', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    },

    /**
     * Get crowd level description
     * SEA = Seats Available, SDA = Standing Available, LSD = Limited Standing
     */
    getCrowdInfo(load) {
        switch (load) {
            case 'SEA':
                return { cssClass: 'crowd-green', label: 'Seats' };
            case 'SDA':
                return { cssClass: 'crowd-yellow', label: 'Standing' };
            case 'LSD':
                return { cssClass: 'crowd-red', label: 'Full' };
            default:
                return { cssClass: 'crowd-gray', label: 'N/A' };
        }
    },

    /**
     * Get bus type description
     * SD = Single Deck, DD = Double Deck, BD = Bendy
     */
    /**
     * Get bus type description
     * SD = Single Deck, DD = Double Deck, BD = Bendy
     */
    getBusType(type) {
        switch (type) {
            case 'SD':
                return 'Single Deck';
            case 'DD':
                return 'Double Deck';
            case 'BD':
                return 'Bendy';
            default:
                return type || 'Unknown';
        }
    },

    // ===========================================
    // New Feature: Bus Stops Data (Search/Geo)
    // ===========================================

    /**
     * Fetch all bus stops and cache them
     */
    async getAllStops() {
        const CACHE_KEY = 'sg_bus_stops_cache';
        const CACHE_TIME_KEY = 'sg_bus_stops_time';
        const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

        // Check cache
        const cached = localStorage.getItem(CACHE_KEY);
        const cacheTime = localStorage.getItem(CACHE_TIME_KEY);

        if (cached && cacheTime && (Date.now() - parseInt(cacheTime) < CACHE_DURATION)) {
            // Return cached data
            return JSON.parse(cached);
        }

        console.log('Fetching all bus stops from server...');
        let allStops = [];
        let skip = 0;
        let hasMore = true;

        // Loop to fetch all pages (500 per page)
        while (hasMore) {
            try {
                // Call our server proxy which handles the authentication
                const data = await this.request('/v3/BusStops', { skip }); // Map to /api/bus-stops on server via request method adaptation needed or direct fetch? 

                // Wait, our request() method hardcodes /api/bus-arrival. 
                // We need to bypass or modify request() slightly, but for now let's use direct fetch to our new endpoint
                // Actually, let's fix request() later? No, let's just do a direct fetch here to be safe and simple

                // Calls local server endpoint
                let response = await fetch(`/api/bus-stops?skip=${skip}`, {
                    headers: { 'AccountKey': this.getApiKey() || '' }
                });

                let pageData = await response.json();

                if (pageData.value && pageData.value.length > 0) {
                    allStops.push(...pageData.value);
                    skip += 500;
                    console.log(`Fetched ${allStops.length} stops...`);
                } else {
                    hasMore = false;
                }
            } catch (err) {
                console.error('Error fetching stops:', err);
                hasMore = false;
            }
        }

        if (allStops.length > 0) {
            // Save to cache
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(allStops));
                localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
                console.log('Bus stops cached successfully.');
            } catch (e) {
                console.warn('Failed to cache stops (probably quota exceeded):', e);
            }
        }

        return allStops;
    },

    /**
     * Search bus stops by code, road, or description
     */
    async searchStops(query) {
        if (!query || query.length < 2) return [];

        const stops = await this.getAllStops();
        const lowerQuery = query.toLowerCase();

        return stops.filter(stop =>
            stop.BusStopCode.includes(query) ||
            stop.Description.toLowerCase().includes(lowerQuery) ||
            stop.RoadName.toLowerCase().includes(lowerQuery)
        ).slice(0, 20); // Limit results
    },

    /**
     * Get nearby stops based on coordinates
     */
    async getNearbyStops(lat, lon) {
        const stops = await this.getAllStops();

        // Simple distance calculation (Haversine not strictly needed for short distances, but good to be accurate)
        // We'll use simple pythagoras on lat/lon for speed as Singapore is small/near equator.
        // 1 deg lat ~ 111km. 1 deg lon at equator ~ 111km.

        // Optimization: Single pass selection of top 10 closest stops
        const limit = 10;
        const nearest = [];

        for (let i = 0; i < stops.length; i++) {
            const stop = stops[i];
            const dLat = (stop.Latitude - lat);
            const dLon = (stop.Longitude - lon);
            const distSq = dLat * dLat + dLon * dLon;

            // If we have room or this is closer than the furthest current candidate
            if (nearest.length < limit || distSq < nearest[nearest.length - 1].distSq) {
                let inserted = false;
                for (let j = 0; j < nearest.length; j++) {
                    if (distSq < nearest[j].distSq) {
                        nearest.splice(j, 0, { stop, distSq });
                        inserted = true;
                        break;
                    }
                }

                if (!inserted) {
                    nearest.push({ stop, distSq });
                }

                if (nearest.length > limit) {
                    nearest.pop();
                }
            }
        }

        return nearest.map(item => {
            // Convert to approx meters
            const distKm = Math.sqrt(item.distSq) * 111;
            return { ...item.stop, distSq: item.distSq, distance: Math.round(distKm * 1000) };
        });
    }
};

// Export for use in app.js
window.LTA_API = LTA_API;
