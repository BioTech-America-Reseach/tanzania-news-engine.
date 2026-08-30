// =============================================
// TANZANIA NEWS ENGINE - APPLICATION LOGIC
// =============================================

// =============================================
// CONFIGURATION
// =============================================
const CONFIG = {
    // API Endpoints
    apiUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8080/api'
        : 'https://api.taarifatanzania.com/api',
    
    wsUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'ws://localhost:8081/live-audio'
        : 'wss://api.taarifatanzania.com/live-audio',
    
    // Mistral AI Configuration
    mistralApiKey: '3pDTfrhKfqKtLyrKVwyMhC5A2xd7sv0C',
    mistralApiUrl: 'https://api.mistral.ai/v1/chat/completions',
    mistralModel: 'mistral-large-latest',
    
    // Refresh intervals
    contentRefreshInterval: 60000, // 1 minute
    statusRefreshInterval: 5000,   // 5 seconds
    
    // Maximum items per page
    itemsPerPage: 25
};

// =============================================
// APPLICATION STATE
// =============================================
const AppState = {
    // Current state
    currentCategory: 'all',
    currentPage: 1,
    stories: [],
    filteredStories: [],
    
    // Audio state
    audioContext: null,
    audioBuffer: [],
    isPlaying: false,
    audioSource: null,
    audioGain: null,
    
    // WebSocket
    wsConnection: null,
    isConnected: false,
    
    // System stats
    activeUsers: 0,
    storyCount: 0,
    startTime: Date.now(),
    
    // Loading states
    isLoading: false,
    hasMore: true
};

// =============================================
// DOM REFERENCES (Cached for performance)
// =============================================
const DOM = {
    feed: document.getElementById('contentFeed'),
    storyCount: document.getElementById('storyCount'),
    sourceCount: document.getElementById('sourceCount'),
    lastCrawl: document.getElementById('lastCrawl'),
    uptime: document.getElementById('uptime'),
    activeUsers: document.getElementById('activeUsers'),
    connectionStatus: document.getElementById('connectionStatus'),
    tickerText: document.getElementById('tickerText'),
    
    // Audio controls
    playIcon: document.getElementById('playIcon'),
    playText: document.getElementById('playText'),
    mobilePlayIcon: document.getElementById('mobilePlayIcon'),
    mobilePlayText: document.getElementById('mobilePlayText'),
    
    // Modal
    modal: document.getElementById('detailModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalContent: document.getElementById('modalContent')
};

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Tanzania News Engine v2.0 initialized');
    
    // Set source count
    if (DOM.sourceCount) {
        DOM.sourceCount.textContent = '10,400+';
    }
    
    // Load initial content
    fetchContent('all');
    
    // Setup WebSocket connection
    initWebSocket();
    
    // Start periodic updates
    setInterval(() => {
        fetchContent(AppState.currentCategory);
    }, CONFIG.contentRefreshInterval);
    
    // Update uptime every second
    setInterval(updateUptime, 1000);
    
    // Update connection status
    setInterval(updateConnectionStatus, CONFIG.statusRefreshInterval);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
        if (e.key === ' ' || e.key === 'Space') {
            e.preventDefault();
            toggleAudio();
        }
    });
    
    // Log performance
    console.log(`✅ App loaded in ${performance.now().toFixed(0)}ms`);
});

// =============================================
// CONTENT FETCHING
// =============================================
async function fetchContent(category = 'all', page = 1) {
    // Prevent multiple simultaneous requests
    if (AppState.isLoading) return;
    
    AppState.isLoading = true;
    AppState.currentCategory = category;
    AppState.currentPage = page;
    
    // Show loading state
    if (page === 1) {
        DOM.feed.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-spinner fa-spin text-3xl text-blue-600 mb-3"></i>
                <p class="text-gray-500">Loading latest updates...</p>
            </div>
        `;
    }
    
    try {
        // Try to fetch from API
        const endpoint = category === 'all' 
            ? `${CONFIG.apiUrl}/content/recent`
            : `${CONFIG.apiUrl}/content/category/${category}`;
        
        const response = await fetch(`${endpoint}?page=${page}&limit=${CONFIG.itemsPerPage}`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update stories
        if (page === 1) {
            AppState.stories = data.items || [];
        } else {
            AppState.stories = [...AppState.stories, ...(data.items || [])];
        }
        
        AppState.hasMore = data.hasMore || false;
        AppState.storyCount = data.total || AppState.stories.length;
        
        // Update DOM
        if (DOM.storyCount) {
            DOM.storyCount.textContent = AppState.storyCount.toLocaleString();
        }
        
        if (DOM.lastCrawl) {
            DOM.lastCrawl.textContent = new Date().toLocaleTimeString('sw-TZ');
        }
        
        // Render stories
        renderContent(AppState.stories);
        
    } catch (error) {
        console.error('Error fetching content:', error);
        
        // Fallback to demo data if API fails
        if (page === 1) {
            loadDemoData();
        }
    } finally {
        AppState.isLoading = false;
    }
}

// =============================================
// RENDER CONTENT
// =============================================
function renderContent(stories) {
    if (!DOM.feed) return;
    
    if (!stories || stories.length === 0) {
        DOM.feed.innerHTML = `
            <div class="text-center text-gray-500 py-12">
                <i class="fas fa-inbox text-5xl mb-4 block text-gray-300"></i>
                <p class="text-lg font-medium">No stories available</p>
                <p class="text-sm">Try refreshing or check back later</p>
            </div>
        `;
        return;
    }
    
    // Build HTML
    const html = stories.map((story, index) => {
        const category = story.category || story.content_type || 'General';
        const categoryColor = getCategoryColor(category);
        const categoryIcon = getCategoryIcon(category);
        const isBreaking = category.toLowerCase().includes('breaking');
        
        return `
            <div class="story-card bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border-l-4 ${categoryColor.border} cursor-pointer transform hover:-translate-y-1"
                 onclick="openModal('${story.id || index}')"
                 data-id="${story.id || index}"
                 data-category="${category}">
                <div class="p-5">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                            <!-- Category Badge -->
                            <div class="flex items-center flex-wrap gap-2 mb-2">
                                <span class="inline-flex items-center space-x-1 text-xs font-semibold ${categoryColor.bg} ${categoryColor.text} px-3 py-1 rounded-full">
                                    <i class="fas ${categoryIcon}"></i>
                                    <span>${formatCategoryName(category)}</span>
                                </span>
                                ${isBreaking ? `
                                    <span class="inline-flex items-center space-x-1 text-xs font-bold bg-red-500 text-white px-3 py-1 rounded-full animate-pulse">
                                        <i class="fas fa-bolt"></i>
                                        <span>BREAKING</span>
                                    </span>
                                ` : ''}
                                <span class="text-xs text-gray-400">${formatDate(story.published_date || story.timestamp)}</span>
                            </div>
                            
                            <!-- Title -->
                            <h3 class="text-lg md:text-xl font-bold text-gray-900 mb-1.5 line-clamp-2">
                                ${story.title || 'Untitled Story'}
                            </h3>
                            
                            <!-- Summary -->
                            <p class="text-gray-600 text-sm line-clamp-2 mb-2">
                                ${story.summary || story.original_text?.substring(0, 150) || story.content?.substring(0, 150) || ''}${(story.summary || story.original_text || story.content || '').length > 150 ? '...' : ''}
                            </p>
                            
                            <!-- Meta Info -->
                            <div class="flex items-center flex-wrap gap-3 text-xs text-gray-400">
                                <span class="flex items-center space-x-1">
                                    <i class="fas fa-link"></i>
                                    <span>${story.source_count || 1} sources</span>
                                </span>
                                ${story.impact_rating ? `
                                    <span class="flex items-center space-x-1">
                                        <i class="fas fa-exclamation-triangle text-red-500"></i>
                                        <span class="font-bold text-red-600">Impact: ${story.impact_rating}/10</span>
                                    </span>
                                ` : ''}
                                ${story.region ? `
                                    <span class="flex items-center space-x-1">
                                        <i class="fas fa-map-marker-alt"></i>
                                        <span>${story.region}</span>
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                        
                        <!-- Arrow Indicator -->
                        <div class="ml-3 flex-shrink-0 self-center">
                            <i class="fas fa-chevron-right text-gray-300 group-hover:text-blue-600 transition"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add load more button if there are more stories
    const loadMoreHtml = AppState.hasMore ? `
        <div class="text-center py-4">
            <button onclick="loadMore()" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition shadow-md hover:shadow-lg">
                <i class="fas fa-plus-circle mr-2"></i> Load More
            </button>
        </div>
    ` : '';
    
    DOM.feed.innerHTML = html + loadMoreHtml;
}

// =============================================
// LOAD MORE STORIES
// =============================================
function loadMore() {
    if (!AppState.hasMore || AppState.isLoading) return;
    fetchContent(AppState.currentCategory, AppState.currentPage + 1);
}

// =============================================
// CATEGORY HELPERS
// =============================================
function getCategoryColor(category) {
    const colors = {
        'government': { border: 'border-blue-500', bg: 'bg-blue-100', text: 'text-blue-700' },
        'government_meeting': { border: 'border-blue-500', bg: 'bg-blue-100', text: 'text-blue-700' },
        'national_event': { border: 'border-green-500', bg: 'bg-green-100', text: 'text-green-700' },
        'events': { border: 'border-green-500', bg: 'bg-green-100', text: 'text-green-700' },
        'breaking_news': { border: 'border-red-500', bg: 'bg-red-100', text: 'text-red-700' },
        'breaking': { border: 'border-red-500', bg: 'bg-red-100', text: 'text-red-700' },
        'business': { border: 'border-yellow-500', bg: 'bg-yellow-100', text: 'text-yellow-700' },
        'health': { border: 'border-teal-500', bg: 'bg-teal-100', text: 'text-teal-700' },
        'education': { border: 'border-purple-500', bg: 'bg-purple-100', text: 'text-purple-700' },
        'general': { border: 'border-gray-400', bg: 'bg-gray-100', text: 'text-gray-700' }
    };
    return colors[category.toLowerCase()] || colors.general;
}

function getCategoryIcon(category) {
    const icons = {
        'government': 'fa-landmark',
        'government_meeting': 'fa-landmark',
        'national_event': 'fa-calendar-check',
        'events': 'fa-calendar-check',
        'breaking_news': 'fa-bolt',
        'breaking': 'fa-bolt',
        'business': 'fa-chart-line',
        'health': 'fa-heartbeat',
        'education': 'fa-graduation-cap',
        'general': 'fa-newspaper'
    };
    return icons[category.toLowerCase()] || icons.general;
}

function formatCategoryName(category) {
    const names = {
        'government': 'Government',
        'government_meeting': 'Government Meeting',
        'national_event': 'National Event',
        'events': 'Events',
        'breaking_news': 'Breaking News',
        'breaking': 'Breaking',
        'business': 'Business',
        'health': 'Health',
        'education': 'Education',
        'general': 'General'
    };
    return names[category.toLowerCase()] || category;
}

// =============================================
// DATE FORMATTING
// =============================================
function formatDate(dateString) {
    if (!dateString) return 'Just now';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Just now';
        
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHour < 24) return `${diffHour}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        
        return date.toLocaleDateString('sw-TZ', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
    } catch (e) {
        return 'Recently';
    }
}

// =============================================
// CATEGORY SWITCHING
// =============================================
function switchCategory(category) {
    // Update active tab
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active', 'bg-blue-600', 'text-white');
        tab.classList.add('bg-gray-100', 'text-gray-700');
    });
    
    const activeTab = document.querySelector(`[onclick="switchCategory('${category}')"]`);
    if (activeTab) {
        activeTab.classList.remove('bg-gray-100', 'text-gray-700');
        activeTab.classList.add('active', 'bg-blue-600', 'text-white');
    }
    
    // Fetch content for new category
    AppState.currentCategory = category;
    AppState.currentPage = 1;
    fetchContent(category);
}

// =============================================
// MODAL FUNCTIONS
// =============================================
function openModal(storyId) {
    // Find the story
    const story = AppState.stories.find(s => (s.id || '').toString() === storyId.toString());
    if (!story) {
        console.warn('Story not found:', storyId);
        return;
    }
    
    // Set title
    DOM.modalTitle.textContent = story.title || 'Story Details';
    
    // Build content
    const category = story.category || story.content_type || 'General';
    const categoryColor = getCategoryColor(category);
    
    let contentHtml = `
        <div class="space-y-4">
            <!-- Category and Date -->
            <div class="flex flex-wrap items-center gap-2 text-sm">
                <span class="inline-flex items-center space-x-1 ${categoryColor.bg} ${categoryColor.text} px-3 py-1 rounded-full font-semibold">
                    <i class="fas ${getCategoryIcon(category)}"></i>
                    <span>${formatCategoryName(category)}</span>
                </span>
                <span class="text-gray-400">•</span>
                <span class="text-gray-500">${formatDate(story.published_date || story.timestamp)}</span>
                ${story.region ? `
                    <span class="text-gray-400">•</span>
                    <span class="text-gray-500"><i class="fas fa-map-marker-alt mr-1"></i>${story.region}</span>
                ` : ''}
            </div>
            
            <!-- Content -->
            <div class="prose max-w-none">
                <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    ${story.original_text || story.content || story.summary || 'No details available'}
                </p>
            </div>
    `;
    
    // Add structured content if available
    if (story.structured_content) {
        const sc = story.structured_content;
        contentHtml += `
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 class="font-bold text-sm text-gray-700 mb-2 flex items-center">
                    <i class="fas fa-structure text-blue-600 mr-2"></i>
                    Structured Data
                </h4>
                <pre class="text-xs text-gray-600 overflow-x-auto bg-white p-3 rounded border">${JSON.stringify(sc, null, 2)}</pre>
            </div>
        `;
    }
    
    // Add sources
    if (story.source_urls && story.source_urls.length > 0) {
        contentHtml += `
            <div>
                <h4 class="font-bold text-sm text-gray-700 mb-2 flex items-center">
                    <i class="fas fa-link text-blue-600 mr-2"></i>
                    Sources (${story.source_urls.length})
                </h4>
                <ul class="space-y-1">
                    ${story.source_urls.map(url => `
                        <li>
                            <a href="${url}" target="_blank" rel="noopener noreferrer" 
                               class="text-blue-600 hover:underline text-sm flex items-center">
                                <i class="fas fa-external-link-alt text-xs mr-2"></i>
                                ${url.length > 60 ? url.substring(0, 60) + '...' : url}
                            </a>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    // Add audio if available
    if (story.audio_url) {
        contentHtml += `
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 class="font-bold text-sm text-gray-700 mb-2">
                    <i class="fas fa-headphones text-blue-600 mr-2"></i>
                    Audio Broadcast
                </h4>
                <audio controls class="w-full">
                    <source src="${story.audio_url}" type="audio/mpeg">
                    Your browser does not support audio playback.
                </audio>
            </div>
        `;
    }
    
    // Add metadata
    contentHtml += `
            <div class="border-t border-gray-200 pt-3 text-xs text-gray-400 flex flex-wrap gap-3">
                <span><i class="fas fa-hashtag mr-1"></i>ID: ${story.id || 'N/A'}</span>
                <span><i class="fas fa-flag mr-1"></i>${story.source_count || 1} sources</span>
                ${story.impact_rating ? `<span><i class="fas fa-exclamation-triangle mr-1"></i>Impact: ${story.impact_rating}/10</span>` : ''}
            </div>
        </div>
    `;
    
    DOM.modalContent.innerHTML = contentHtml;
    
    // Show modal
    DOM.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    DOM.modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// =============================================
// AUDIO CONTROLS
// =============================================
function toggleAudio() {
    // Create audio context if not exists
    if (!AppState.audioContext) {
        try {
            AppState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            AppState.audioGain = AppState.audioContext.createGain();
            AppState.audioGain.gain.value = 1.0;
            AppState.audioGain.connect(AppState.audioContext.destination);
        } catch (e) {
            console.error('Audio context creation failed:', e);
            return;
        }
    }
    
    AppState.isPlaying = !AppState.isPlaying;
    
    if (AppState.isPlaying) {
        // Resume audio context
        if (AppState.audioContext.state === 'suspended') {
            AppState.audioContext.resume().catch(console.error);
        }
        
        // Update UI
        updateAudioUI(true);
        
        // Generate fake audio data for visualization
        generateFakeAudio();
        
        // Try to connect to WebSocket stream
        if (AppState.wsConnection && AppState.wsConnection.readyState === WebSocket.OPEN) {
            // Send play command
            AppState.wsConnection.send(JSON.stringify({ action: 'play' }));
        }
        
        // Start pulse animation on visualizer
        document.querySelectorAll('.wave-bar').forEach((bar, i) => {
            bar.style.animation = `waveform 0.8s ease-in-out infinite`;
            bar.style.animationDelay = `${i * 0.05}s`;
        });
        
    } else {
        // Pause
        if (AppState.audioContext) {
            AppState.audioContext.suspend().catch(console.error);
        }
        
        updateAudioUI(false);
        
        // Stop visualizer animation
        document.querySelectorAll('.wave-bar').forEach(bar => {
            bar.style.animation = 'none';
            bar.style.height = '20px';
        });
        
        // Send pause command if connected
        if (AppState.wsConnection && AppState.wsConnection.readyState === WebSocket.OPEN) {
            AppState.wsConnection.send(JSON.stringify({ action: 'pause' }));
        }
    }
}

function updateAudioUI(isPlaying) {
    const icon = isPlaying ? 'fa-pause' : 'fa-play';
    const text = isPlaying ? 'Pause' : 'Play Live';
    
    if (DOM.playIcon) DOM.playIcon.className = `fas ${icon}`;
    if (DOM.playText) DOM.playText.textContent = text;
    if (DOM.mobilePlayIcon) DOM.mobilePlayIcon.className = `fas ${icon}-circle text-3xl`;
    if (DOM.mobilePlayText) DOM.mobilePlayText.textContent = isPlaying ? 'Pause' : 'Listen';
}

function generateFakeAudio() {
    // Simulate audio playback for visualization
    if (!AppState.isPlaying) return;
    
    const bars = document.querySelectorAll('.wave-bar');
    bars.forEach((bar, i) => {
        const height = 15 + Math.random() * 45;
        bar.style.height = `${height}px`;
    });
    
    requestAnimationFrame(generateFakeAudio);
}

// =============================================
// WEB SOCKET CONNECTION
// =============================================
function initWebSocket() {
    try {
        AppState.wsConnection = new WebSocket(CONFIG.wsUrl);
        
        AppState.wsConnection.onopen = () => {
            AppState.isConnected = true;
            console.log('🔊 WebSocket connected');
            updateConnectionStatus();
        };
        
        AppState.wsConnection.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (e) {
                // Handle binary audio data
                handleAudioData(event.data);
            }
        };
        
        AppState.wsConnection.onclose = () => {
            AppState.isConnected = false;
            console.log('🔇 WebSocket disconnected, reconnecting...');
            updateConnectionStatus();
            setTimeout(initWebSocket, 3000);
        };
        
        AppState.wsConnection.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        setTimeout(initWebSocket, 5000);
    }
}

function handleWebSocketMessage(data) {
    if (data.type === 'status') {
        AppState.activeUsers = data.activeClients || 0;
        if (DOM.activeUsers) {
            DOM.activeUsers.textContent = AppState.activeUsers.toLocaleString();
        }
    } else if (data.type === 'audio') {
        // Decode and play audio
        try {
            const audioData = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
            handleAudioData(audioData.buffer);
        } catch (e) {
            console.error('Failed to decode audio:', e);
        }
    } else if (data.type === 'news') {
        // Update ticker
        if (DOM.tickerText && data.text) {
            DOM.tickerText.textContent = data.text;
        }
    }
}

function handleAudioData(audioData) {
    if (!AppState.audioContext || !AppState.isPlaying) return;
    
    try {
        AppState.audioContext.decodeAudioData(audioData, (buffer) => {
            if (AppState.audioSource) {
                AppState.audioSource.disconnect();
            }
            
            AppState.audioSource = AppState.audioContext.createBufferSource();
            AppState.audioSource.buffer = buffer;
            AppState.audioSource.connect(AppState.audioGain);
            AppState.audioSource.start();
            
            AppState.audioSource.onended = () => {
                AppState.audioSource = null;
            };
        });
    } catch (error) {
        console.error('Failed to decode audio:', error);
    }
}

function updateConnectionStatus() {
    if (!DOM.connectionStatus) return;
    
    if (AppState.isConnected) {
        DOM.connectionStatus.textContent = '● Connected';
        DOM.connectionStatus.className = 'text-green-400 text-xs';
    } else {
        DOM.connectionStatus.textContent = '● Disconnected';
        DOM.connectionStatus.className = 'text-red-400 text-xs';
    }
}

// =============================================
// SYSTEM UPTIME
// =============================================
function updateUptime() {
    if (!DOM.uptime) return;
    
    const elapsed = Math.floor((Date.now() - AppState.startTime) / 1000);
    const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const seconds = String(elapsed % 60).padStart(2, '0');
    DOM.uptime.textContent = `${hours}:${minutes}:${seconds}`;
}

// =============================================
// DEMO DATA (FALLBACK)
// =============================================
function loadDemoData() {
    const demoStories = [
        {
            id: '1',
            title: 'Waziri Mkuu Kassim Majaliwa Afanya Mkutano na Wafanyabiashara',
            category: 'government',
            published_date: new Date(Date.now() - 1800000).toISOString(),
            summary: 'Waziri Mkuu Kassim Majaliwa amefanya mkutano na wafanyabiashara wa nchi kuzungumzia changamoto za biashara na uwekezaji nchini.',
            original_text: 'Mkutano huo ulifanyika katika ofisi za Waziri Mkuu jijini Dar es Salaam...',
            source_count: 3,
            region: 'Dar es Salaam',
            impact_rating: 7,
            source_urls: ['https://www.moha.go.tz/news/1', 'https://www.mwananchi.co.tz/news/1'],
            structured_content: {
                government_meeting: {
                    title: 'Mkutano wa Waziri Mkuu na Wafanyabiashara',
                    ministry_agency: 'Ofisi ya Waziri Mkuu',
                    date: new Date().toISOString().split('T')[0],
                    time: '10:00',
                    venue: 'Dar es Salaam',
                    agenda_summary: 'Kujadili changamoto za biashara na uwekezaji',
                    key_attendees: ['Waziri Mkuu Kassim Majaliwa', 'Mkuu wa Mkoa wa Dar']
                }
            }
        },
        {
            id: '2',
            title: 'Tanzania Yapata Mafanikio Makubwa Katika Sekta ya Kilimo',
            category: 'breaking',
            published_date: new Date(Date.now() - 3600000).toISOString(),
            summary: 'Serikali ya Tanzania imetangaza mafanikio makubwa katika mavuno ya msimu huu, ikiwa na ongezeko la asilimia 15.',
            original_text: 'Waziri wa Kilimo, Hussein Bashe, ametangaza mafanikio makubwa ya sekta ya kilimo mwaka huu...',
            source_count: 5,
            region: 'Dodoma',
            impact_rating: 9,
            source_urls: ['https://www.mof.go.tz/news/2', 'https://www.ippmedia.com/news/2'],
            structured_content: {
                breaking_news: {
                    impact_rating: 9,
                    primary_subject: 'Mafanikio ya Kilimo',
                    swahili_summary: 'Tanzania yapata mafanikio makubwa katika sekta ya kilimo. Mavuno ya mwaka huu yameongezeka kwa asilimia 15. Serikali inatarajia kuendelea kuboresha sekta hii.'
                }
            }
        },
        {
            id: '3',
            title: 'Maadhimisho ya Siku ya Wanawake Mkoa wa Arusha',
            category: 'events',
            published_date: new Date(Date.now() - 7200000).toISOString(),
            summary: 'Mkoa wa Arusha unajiandaa kwa maadhimisho ya Siku ya Wanawake, ikiwa na tamasha na mikutano mbalimbali.',
            original_text: 'Maadhimisho ya Siku ya Wanawake mkoani Arusha yameanza kwa shughuli mbalimbali...',
            source_count: 2,
            region: 'Arusha',
            source_urls: ['https://www.arusha.go.tz/events/1'],
            structured_content: {
                national_event: {
                    event_name: 'Siku ya Wanawake Arusha',
                    organizer: 'Serikali ya Mkoa wa Arusha',
                    region: 'Arusha',
                    date: new Date().toISOString().split('T')[0],
                    key_objectives: ['Kuhamasisha wanawake', 'Kujadili changamoto']
                }
            }
        },
        {
            id: '4',
            title: 'Mkutano wa Benki Kuu ya Tanzania na Benki za Biashara',
            category: 'business',
            published_date: new Date(Date.now() - 10800000).toISOString(),
            summary: 'Benki Kuu ya Tanzania imefanya mkutano na benki za biashara kujadili mabadiliko ya sera za fedha.',
            original_text: 'Mkutano huo ulilenga kujadili mabadiliko ya sera za fedha...',
            source_count: 4,
            region: 'Dar es Salaam',
            impact_rating: 6,
            source_urls: ['https://www.bot.go.tz/news/1']
        },
        {
            id: '5',
            title: 'Wizara ya Afya Yatangaza Mpango Mpya wa Kinga ya Ugonjwa wa Moyo',
            category: 'health',
            published_date: new Date(Date.now() - 14400000).toISOString(),
            summary: 'Wizara ya Afya imezindua mpango mpya wa kinga ya ugonjwa wa moyo nchini.',
            original_text: 'Waziri wa Afya, Ummy Mwalimu, amezindua mpango mpya wa kinga ya ugonjwa wa moyo...',
            source_count: 3,
            region: 'Dodoma',
            source_urls: ['https://www.moh.go.tz/news/1']
        }
    ];
    
    AppState.stories = demoStories;
    AppState.storyCount = demoStories.length;
    
    if (DOM.storyCount) {
        DOM.storyCount.textContent = AppState.storyCount.toLocaleString();
    }
    
    renderContent(AppState.stories);
    console.log('📰 Loaded demo data (fallback mode)');
}

// =============================================
// SERVICE WORKER REGISTRATION (PWA)
// =============================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('📱 Service Worker registered'))
        .catch(err => console.error('Service Worker registration failed:', err));
}

// =============================================
// EXPOSE GLOBAL FUNCTIONS
// =============================================
window.switchCategory = switchCategory;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleAudio = toggleAudio;
window.loadMore = loadMore;
window.fetchContent = fetchContent;

console.log('✅ App functions exposed globally');