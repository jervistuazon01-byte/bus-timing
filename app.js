/**
 * SG Bus Timing App
 * Main Application Logic
 */

class BusTimingApp {
    constructor() {
        // DOM Elements
        this.elements = {
            // Modal
            apiKeyModal: document.getElementById('apiKeyModal'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            saveApiKeyBtn: document.getElementById('saveApiKey'),
            closeApiModalBtn: document.getElementById('closeApiModal'),
            clearApiKeyBtn: document.getElementById('clearApiKey'),
            settingsBtn: document.getElementById('settingsBtn'),

            // Theme
            themeToggle: document.getElementById('themeToggle'),
            themeIcon: document.querySelector('.theme-icon'),

            // Favorites
            favoritesSection: document.getElementById('favoritesSection'),
            favoritesGrid: document.getElementById('favoritesGrid'),
            refreshFavBtn: document.getElementById('refreshFavBtn'),
            favoriteBtn: document.getElementById('favoriteBtn'),

            // Search
            busStopInput: document.getElementById('busStopInput'),
            searchBtn: document.getElementById('searchBtn'),
            recentSearches: document.getElementById('recentSearches'),

            // Stop Info
            stopInfo: document.getElementById('stopInfo'),
            stopName: document.getElementById('stopName'),
            stopCode: document.getElementById('stopCode'),

            // Services
            servicesSection: document.getElementById('servicesSection'),
            servicesGrid: document.getElementById('servicesGrid'),

            // Arrivals
            arrivalsSection: document.getElementById('arrivalsSection'),
            selectedBus: document.getElementById('selectedBus'),
            refreshBtn: document.getElementById('refreshBtn'),
            lastUpdated: document.getElementById('lastUpdated'),
            arrivalsList: document.getElementById('arrivalsList'),

            // States
            loading: document.getElementById('loading'),
            error: document.getElementById('error'),
            errorMessage: document.getElementById('errorMessage'),
            retryBtn: document.getElementById('retryBtn'),
            autoRefreshStatus: document.getElementById('autoRefreshStatus')
        };

        // State
        this.state = {
            currentBusStop: null,
            currentService: null,
            services: [],
            autoRefreshInterval: null,
            favorites: [], // Array of { stopCode, serviceNo }
            theme: localStorage.getItem('theme') || 'dark'
        };

        // Initialize
        this.init();
    }

    init() {
        // Apply saved theme
        this.applyTheme(this.state.theme);

        // Check for API key - No longer needed as server handles it
        // if (!LTA_API.hasApiKey()) { ... }


        // Load recent searches
        this.loadRecentSearches();

        // Load favorites
        this.loadFavorites();

        // Start global auto-refresh for favorites
        this.startGlobalRefresh();

        // Event Listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // API Key Modal listeners
        this.elements.settingsBtn.addEventListener('click', () => this.showApiKeyModal());
        this.elements.closeApiModalBtn.addEventListener('click', () => this.hideApiKeyModal());
        this.elements.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.elements.clearApiKeyBtn.addEventListener('click', () => this.clearApiKey());

        // Close modal on click outside
        this.elements.apiKeyModal.addEventListener('click', (e) => {
            if (e.target === this.elements.apiKeyModal) this.hideApiKeyModal();
        });

        // Theme Toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Search
        this.elements.searchBtn.addEventListener('click', () => this.searchBusStop());
        this.elements.busStopInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchBusStop();
        });

        // Refresh
        this.elements.refreshBtn.addEventListener('click', () => this.refreshArrivals());

        // Retry
        this.elements.retryBtn.addEventListener('click', () => this.retryLastAction());

        // Favorite Toggle
        this.elements.favoriteBtn.addEventListener('click', () => this.toggleFavorite());

        // Refresh Favorites
        this.elements.refreshFavBtn.addEventListener('click', () => {
            this.elements.refreshFavBtn.textContent = 'Refreshing...';
            this.refreshFavoriteTimings().then(() => {
                this.elements.refreshFavBtn.textContent = 'Refresh All';
            });
        });
    }

    // ========================================
    // API Key Management
    // ========================================

    showApiKeyModal() {
        this.elements.apiKeyInput.value = LTA_API.getApiKey() || '';
        this.elements.apiKeyModal.classList.remove('hidden');
    }

    hideApiKeyModal() {
        this.elements.apiKeyModal.classList.add('hidden');
    }

    async saveApiKey() {
        const key = this.elements.apiKeyInput.value.trim();
        if (!key) {
            alert('Please enter an API key');
            return;
        }

        // Basic format check (UUID is 36 chars)
        if (key.length !== 36) {
            if (!confirm(`The key length is ${key.length} characters. LTA DataMall keys are usually 36 characters (UUID format). Are you sure you want to save?`)) {
                return;
            }
        }

        const originalText = this.elements.saveApiKeyBtn.textContent;
        this.elements.saveApiKeyBtn.textContent = 'Verifying...';
        this.elements.saveApiKeyBtn.disabled = true;

        // Temporarily set key to test
        const oldKey = LTA_API.getApiKey();
        LTA_API.setApiKey(key);

        try {
            // Test with a common bus stop (e.g., VivoCity: 14141 or similar, using 83139 from placeholder)
            const data = await LTA_API.getBusArrival('83139');

            if (data._isDemo) {
                // Key failed
                LTA_API.setApiKey(oldKey); // Revert
                alert('Verification Failed: The API key seems invalid (Server returned Demo data). Please check your key.');
            } else {
                // Success
                this.hideApiKeyModal();
                alert('Success! API key verified and saved.');

                // Refresh if we have a current search
                if (this.state.currentBusStop) {
                    this.searchBusStop();
                }
                // Also refresh favorites
                this.refreshFavoriteTimings();
            }
        } catch (err) {
            console.error(err);
            LTA_API.setApiKey(oldKey); // Revert

            if (err.message.includes('404')) {
                alert('Server Not Found: You are likely running on GitHub Pages or the API path is incorrect.\n\nLive data requires a backend server (Node.js).');
            } else {
                // Show the actual error message from the server/network
                alert(`Verification Failed: ${err.message}`);
            }
        } finally {
            this.elements.saveApiKeyBtn.textContent = originalText;
            this.elements.saveApiKeyBtn.disabled = false;
        }
    }

    clearApiKey() {
        if (confirm('Clear your API key? The app will revert to Demo Mode.')) {
            LTA_API.setApiKey(null);
            this.elements.apiKeyInput.value = '';
            this.hideApiKeyModal();

            // Refresh to go back to demo mode
            if (this.state.currentBusStop) {
                this.searchBusStop();
            }
            this.refreshFavoriteTimings();
        }
    }


    // ========================================
    // Theme Management
    // ========================================

    toggleTheme() {
        const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    }

    applyTheme(theme) {
        this.state.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Toggle SVG icons
        const darkIcon = document.querySelector('.theme-icon-dark');
        const lightIcon = document.querySelector('.theme-icon-light');
        if (darkIcon && lightIcon) {
            if (theme === 'dark') {
                darkIcon.classList.remove('hidden');
                lightIcon.classList.add('hidden');
            } else {
                darkIcon.classList.add('hidden');
                lightIcon.classList.remove('hidden');
            }
        }
    }

    // ========================================
    // Favorites Management
    // ========================================

    loadFavorites() {
        this.state.favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        this.renderFavorites();
        this.refreshFavoriteTimings();
    }

    saveFavorites() {
        localStorage.setItem('favorites', JSON.stringify(this.state.favorites));
        this.renderFavorites();
    }

    toggleFavorite() {
        const { currentBusStop, currentService } = this.state;
        if (!currentBusStop || !currentService) return;

        const index = this.state.favorites.findIndex(
            f => f.stopCode === currentBusStop && f.serviceNo === currentService
        );

        if (index === -1) {
            // Add
            this.state.favorites.push({
                stopCode: currentBusStop,
                serviceNo: currentService,
                timestamp: Date.now()
            });
        } else {
            // Remove
            this.state.favorites.splice(index, 1);
        }

        this.saveFavorites();
        this.updateFavoriteBtn();
    }

    removeFavorite(stopCode, serviceNo, event) {
        if (event) event.stopPropagation();

        if (confirm(`Remove Favorite: Bus ${serviceNo} at Stop ${stopCode}?`)) {
            this.state.favorites = this.state.favorites.filter(
                f => !(f.stopCode === stopCode && f.serviceNo === serviceNo)
            );
            this.saveFavorites();

            // If currently viewing this bus, update the heart button
            if (this.state.currentBusStop === stopCode && this.state.currentService === serviceNo) {
                this.updateFavoriteBtn();
            }
        }
    }

    checkFavoriteStatus(stopCode, serviceNo) {
        return this.state.favorites.some(
            f => f.stopCode === stopCode && f.serviceNo === serviceNo
        );
    }

    updateFavoriteBtn() {
        const isFav = this.checkFavoriteStatus(this.state.currentBusStop, this.state.currentService);
        this.elements.favoriteBtn.classList.toggle('active', isFav);

        // Update icon fill
        const path = this.elements.favoriteBtn.querySelector('path');
        if (isFav) {
            path.setAttribute('fill', 'currentColor');
        } else {
            path.setAttribute('fill', 'none');
        }
    }

    renderFavorites() {
        const sortedFavs = [...this.state.favorites];

        if (sortedFavs.length === 0) {
            this.elements.favoritesSection.classList.add('hidden');
            return;
        }

        this.elements.favoritesGrid.innerHTML = sortedFavs.map(fav => {
            const buses = (this.state.favTimings || {})[`${fav.stopCode}_${fav.serviceNo}`] || [];

            // Format timings: "Arr, 12, 25"
            let timingsHtml = '--';
            let crowdClass = '';

            if (buses.length > 0) {
                const timings = buses.map(b => LTA_API.parseArrivalTime(b.EstimatedArrival));

                timingsHtml = timings.map((t, index) => {
                    if (index > 2) return ''; // Only show first 3

                    const isArr = t === 'Arr';
                    // Strip ' min' if present so we don't duplicate it
                    const timeOnly = t.replace(' min', '');

                    return `<span class="${isArr ? 'text-accent' : ''}">${timeOnly}</span>`;
                }).join('<span class="divider">, </span>');

                // Use the crowd info of the first bus for the indicator
                if (buses[0].Load) {
                    const crowd = LTA_API.getCrowdInfo(buses[0].Load);
                    crowdClass = crowd.cssClass;
                }
            }

            return `
                <div class="favorite-card" onclick="app.openFavorite('${fav.stopCode}', '${fav.serviceNo}')">
                    <button class="remove-fav-btn" onclick="app.removeFavorite('${fav.stopCode}', '${fav.serviceNo}', event)">✕</button>
                    <div class="fav-main">
                        <div class="fav-service">${fav.serviceNo}</div>
                        <div class="fav-timings-group">
                            ${timingsHtml}
                            <span class="min-label">min</span>
                        </div>
                    </div>
                    <div class="fav-footer">
                        <div class="fav-stop">Stop ${fav.stopCode}</div>
                        ${crowdClass ? `<span class="crowd-dot-sm ${crowdClass}"></span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        this.elements.favoritesSection.classList.remove('hidden');
    }

    async refreshFavoriteTimings() {
        if (this.state.favorites.length === 0) return;

        // Fetch each favorite's timing
        // We do it stop by stop to be efficient if multiple services are at same stop
        const stopGroups = {};
        this.state.favorites.forEach(f => {
            if (!stopGroups[f.stopCode]) stopGroups[f.stopCode] = [];
            stopGroups[f.stopCode].push(f.serviceNo);
        });

        const newTimings = { ...(this.state.favTimings || {}) };

        for (const stopCode of Object.keys(stopGroups)) {
            try {
                const data = await LTA_API.getBusArrival(stopCode);
                if (data && data.Services) {
                    data.Services.forEach(s => {
                        if (stopGroups[stopCode].includes(s.ServiceNo)) {
                            // Store array of valid next buses
                            const nextBuses = [];
                            if (s.NextBus && s.NextBus.EstimatedArrival) nextBuses.push(s.NextBus);
                            if (s.NextBus2 && s.NextBus2.EstimatedArrival) nextBuses.push(s.NextBus2);
                            if (s.NextBus3 && s.NextBus3.EstimatedArrival) nextBuses.push(s.NextBus3);

                            newTimings[`${stopCode}_${s.ServiceNo}`] = nextBuses;
                        }
                    });
                }
            } catch (err) {
                console.warn(`Failed to refresh fav timings for stop ${stopCode}:`, err);
            }
        }

        this.state.favTimings = newTimings;
        this.renderFavorites();
    }

    async openFavorite(stopCode, serviceNo) {
        // 1. Set input and search stop
        this.elements.busStopInput.value = stopCode;

        // Manually trigger search but wait for it
        // We need to modify searchBusStop slightly to return the promise
        await this.searchBusStop();

        // 2. Select the service
        // Need to wait a bit for DOM to update or check if services loaded
        if (this.state.services.length > 0) {
            this.selectService(serviceNo);
        }
    }

    // ========================================
    // Recent Searches
    // ========================================

    loadRecentSearches() {
        const recent = JSON.parse(localStorage.getItem('recent_searches') || '[]');
        this.renderRecentSearches(recent);
    }

    saveRecentSearch(busStopCode) {
        let recent = JSON.parse(localStorage.getItem('recent_searches') || '[]');

        // Remove if exists (to move to front)
        recent = recent.filter(code => code !== busStopCode);

        // Add to front
        recent.unshift(busStopCode);

        // Keep only last 5
        recent = recent.slice(0, 5);

        localStorage.setItem('recent_searches', JSON.stringify(recent));
        this.renderRecentSearches(recent);
    }

    renderRecentSearches(searches) {
        if (searches.length === 0) {
            this.elements.recentSearches.innerHTML = '';
            return;
        }

        this.elements.recentSearches.innerHTML = searches.map(code => `
            <button class="recent-chip" data-code="${code}">${code}</button>
        `).join('');

        // Add click handlers
        this.elements.recentSearches.querySelectorAll('.recent-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.elements.busStopInput.value = chip.dataset.code;
                this.searchBusStop();
            });
        });
    }

    // ========================================
    // Bus Stop Search
    // ========================================

    async searchBusStop() {
        const busStopCode = this.elements.busStopInput.value.trim();

        if (!busStopCode) {
            this.showError('Please enter a bus stop code');
            return;
        }

        if (!/^\d{5}$/.test(busStopCode)) {
            this.showError('Bus stop code must be 5 digits');
            return;
        }

        this.showLoading();
        this.hideError();
        this.hideSections();

        try {
            const data = await LTA_API.getBusArrival(busStopCode);

            if (!data.Services || data.Services.length === 0) {
                this.showError('No bus services found for this stop. Please check the bus stop code.');
                return;
            }

            // Save to recent searches
            this.saveRecentSearch(busStopCode);

            // Update state
            this.state.currentBusStop = busStopCode;
            this.state.services = data.Services;
            this.state.isDemo = data._isDemo || false;

            // Show results
            this.hideLoading();
            this.showStopInfo(busStopCode, data._isDemo);
            this.showServices(data.Services);

        } catch (error) {
            console.error('Search error:', error);
            this.showError(error.message || 'Failed to fetch bus arrival data');
        }
    }

    showStopInfo(busStopCode, isDemo = false) {
        this.elements.stopName.textContent = isDemo ? '⚠️ DEMO MODE' : 'Bus Stop';
        this.elements.stopCode.textContent = isDemo
            ? `Stop Code: ${busStopCode} (API not active yet)`
            : `Stop Code: ${busStopCode}`;
        this.elements.stopInfo.classList.remove('hidden');

        // Update footer to show demo status
        if (isDemo) {
            this.elements.autoRefreshStatus.textContent = '⚠️ Demo Mode - API key not yet activated';
            this.elements.autoRefreshStatus.style.color = 'var(--warning)';
        }
    }

    // ========================================
    // Bus Services
    // ========================================

    showServices(services) {
        // Sort services numerically (handling letters like 961M)
        services.sort((a, b) => {
            const numA = parseInt(a.ServiceNo);
            const numB = parseInt(b.ServiceNo);
            if (numA !== numB) return numA - numB;
            return a.ServiceNo.localeCompare(b.ServiceNo);
        });

        this.elements.servicesGrid.innerHTML = services.map(service => `
            <button class="service-btn" data-service="${service.ServiceNo}">
                ${service.ServiceNo}
            </button>
        `).join('');

        // Add click handlers
        this.elements.servicesGrid.querySelectorAll('.service-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectService(btn.dataset.service));
        });

        this.elements.servicesSection.classList.remove('hidden');
    }

    async selectService(serviceNo) {
        // Update UI
        this.elements.servicesGrid.querySelectorAll('.service-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.service === serviceNo);
        });

        // Update state
        this.state.currentService = serviceNo;

        // Show arrivals
        await this.showArrivals(serviceNo);

        // Update favorite button state
        this.updateFavoriteBtn();

        // Start auto-refresh
        this.startAutoRefresh();
    }

    // ========================================
    // Arrivals Display
    // ========================================

    async showArrivals(serviceNo) {
        // Find service data
        const service = this.state.services.find(s => s.ServiceNo === serviceNo);

        if (!service) {
            this.showError('Service data not found');
            return;
        }

        // Update header
        this.elements.selectedBus.querySelector('.bus-number').textContent = `Bus ${serviceNo}`;

        // Render arrival cards
        const arrivals = [
            { data: service.NextBus, label: 'Next Bus' },
            { data: service.NextBus2, label: '2nd Bus' },
            { data: service.NextBus3, label: '3rd Bus' }
        ].filter(a => a.data && a.data.EstimatedArrival);

        if (arrivals.length === 0) {
            this.elements.arrivalsList.innerHTML = `
                <div class="arrival-card">
                    <div class="arrival-info">
                        <span class="arrival-label">No buses</span>
                        <span class="arrival-time">--</span>
                    </div>
                </div>
            `;
        } else {
            this.elements.arrivalsList.innerHTML = arrivals.map(({ data, label }) => {
                const arrivalTime = LTA_API.parseArrivalTime(data.EstimatedArrival);
                const crowd = LTA_API.getCrowdInfo(data.Load);
                const busType = LTA_API.getBusType(data.Type);
                const isArriving = arrivalTime === 'Arr';

                return `
                    <div class="arrival-card">
                        <div class="arrival-info">
                            <span class="arrival-label">${label}</span>
                            <span class="arrival-time ${isArriving ? 'arriving' : ''}">${arrivalTime}</span>
                            <div class="arrival-meta">
                                <span class="bus-type">${busType}</span>
                            </div>
                        </div>
                        <div class="crowd-indicator">
                            <span class="crowd-dot ${crowd.cssClass}"></span>
                            <span class="crowd-label">${crowd.label}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Update timestamp
        this.updateTimestamp();

        // Show section
        this.elements.arrivalsSection.classList.remove('hidden');
    }

    updateTimestamp() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-SG', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        this.elements.lastUpdated.textContent = `Last updated: ${timeStr}`;
    }

    async refreshArrivals() {
        if (!this.state.currentBusStop || !this.state.currentService) return;

        try {
            // Add spin animation to refresh button
            this.elements.refreshBtn.querySelector('svg').style.animation = 'spin 0.5s linear';

            const data = await LTA_API.getBusArrival(this.state.currentBusStop, this.state.currentService);

            if (data.Services && data.Services.length > 0) {
                this.state.services = data.Services;
                await this.showArrivals(this.state.currentService);
            }

            // Remove spin animation
            setTimeout(() => {
                this.elements.refreshBtn.querySelector('svg').style.animation = '';
            }, 500);

        } catch (error) {
            console.error('Refresh error:', error);
            // Don't show error on auto-refresh failures
        }
    }

    // ========================================
    // Auto Refresh
    // ========================================

    startAutoRefresh() {
        // Clear existing interval
        this.stopAutoRefresh();

        // Refresh every 30 seconds
        this.state.autoRefreshInterval = setInterval(() => {
            this.refreshArrivals();
        }, 30000);

        this.elements.autoRefreshStatus.textContent = 'Auto-refresh: ON (30s)';
    }

    stopAutoRefresh() {
        if (this.state.autoRefreshInterval) {
            clearInterval(this.state.autoRefreshInterval);
            this.state.autoRefreshInterval = null;
        }
    }

    startGlobalRefresh() {
        // Refresh favorites every 30s regardless of view
        setInterval(() => {
            if (this.state.favorites.length > 0) {
                this.refreshFavoriteTimings();
            }
        }, 30000);
    }

    // ========================================
    // UI States
    // ========================================

    showLoading() {
        this.elements.loading.classList.remove('hidden');
    }

    hideLoading() {
        this.elements.loading.classList.add('hidden');
    }

    showError(message) {
        this.hideLoading();
        this.elements.errorMessage.textContent = message;
        this.elements.error.classList.remove('hidden');
    }

    hideError() {
        this.elements.error.classList.add('hidden');
    }

    hideSections() {
        this.elements.stopInfo.classList.add('hidden');
        this.elements.servicesSection.classList.add('hidden');
        this.elements.arrivalsSection.classList.add('hidden');
        this.stopAutoRefresh();
    }

    retryLastAction() {
        this.hideError();
        if (this.state.currentBusStop) {
            this.searchBusStop();
        }
    }
}

// Initialize app when DOM is ready
// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BusTimingApp();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker Registered', reg))
            .catch(err => console.log('Service Worker Failed', err));
    }
});
