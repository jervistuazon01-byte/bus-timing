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
                throw new Error(`API Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw new Error('Failed to fetch bus timings. Please check your connection.');
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
    }
};

// Export for use in app.js
window.LTA_API = LTA_API;
