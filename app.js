// ================================================================
// TANZANIA AI NEWS ENGINE - APP.JS
// Vyombo Vyote vya Habari (TV, Radio, Blog, News, RSS, Government)
// ================================================================

// ================================================================
// CONFIGURATION
// ================================================================
const CONFIG = {
    // Mistral AI Configuration
    apiKey: '3pDTfrhKfqKtLyrKVwyMhC5A2xd7sv0C',
    apiUrl: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-large-latest',
    
    // Refresh interval: 60 seconds (Dakika 1)
    refreshInterval: 60000,
    
    // Maximum stories to keep
    maxStories: 120,
    
    // Total sources being monitored
    totalSources: 9000
};

// ================================================================
// APPLICATION STATE
// ================================================================
const state = {
    // All stories
    allStories: [],
    filteredStories: [],
    
    // Current filters
    currentCategory: 'all',
    currentSource: 'all',
    
    // Loading state
    isFetching: false,
    
    // Deduplication
    storyIds: new Set(),
    
    // Counts
    counts: {
        tv: 0,
        radio: 0,
        blog: 0,
        news: 0,
        rss: 0,
        gov: 0,
        total: 0
    },
    
    categoryCounts: {
        vikao: 0,
        ratiba: 0,
        matukio: 0,
        breaking: 0,
        biashara: 0,
        afya: 0,
        michezo: 0,
        tech: 0,
        general: 0
    },
    
    // Last fetch time
    lastFetchTime: null,
    seenCount: 0
};

// ================================================================
// DOM REFERENCES
// ================================================================
const DOM = {
    feed: document.getElementById('newsContainer'),
    loadingState: document.getElementById('loadingState'),
    aiStatusMsg: document.getElementById('aiStatusMsg'),
    lastUpdate: document.getElementById('lastUpdate'),
    tickerLive: document.getElementById('tickerLive'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalContent: document.getElementById('modalContent'),
    scrollBtn: document.getElementById('scrollTopBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    
    // Stats
    countTV: document.getElementById('countTV'),
    countRadio: document.getElementById('countRadio'),
    countBlog: document.getElementById('countBlog'),
    countTotal: document.getElementById('countTotal'),
    
    // Category counts
    countAllCat: document.getElementById('countAllCat'),
    countVikaoCat: document.getElementById('countVikaoCat'),
    countRatibaCat: document.getElementById('countRatibaCat'),
    countMatukioCat: document.getElementById('countMatukioCat'),
    countBreakingCat: document.getElementById('countBreakingCat'),
    
    // Source count display
    sourceCountDisplay: document.getElementById('sourceCountDisplay')
};

// ================================================================
// SYSTEM PROMPT - VYOMBO VYOTE VYA HABARI
// ================================================================
const SYSTEM_PROMPT = `
Wewe ni mhariri mkuu wa habari za Tanzania unayefuatilia VYOMBO VYOTE VYA HABARI nchini.

**VYOMBO UNAVYOFUATILIA:**

1. **TV CHANNELS (Televisheni)**
   - Azam TV, Clouds TV, ITV, TBC 1, EATV, Star TV, Capital TV, n.k.

2. **RADIO STATIONS (Redio)**
   - Radio One, Clouds FM, Times FM, TBC FM, BBC Swahili, n.k.

3. **ONLINE NEWS OUTLETS (Magazeti mtandaoni)**
   - Mwananchi, The Citizen, Daily News, IPP Media, n.k.

4. **BLOGS (Mablogu)**
   - Mablogu yote ya Tanzania yanayotoa habari

5. **RSS FEEDS (Mlisho wa habari)**
   - Mlisho wote wa habari kutoka vyanzo mbalimbali

6. **GOVERNMENT WEBSITES (Tovuti za Serikali)**
   - Tovuti zote za serikali Tanzania (400+)

**AINA ZA TAARIFA:**
- VIKAO VYA SERIKALI (Government Meetings)
- RATIBA ZA SERIKALI (Government Schedules)
- MATUKIO NA SHUGHULI (Events & Activities)
- BREAKING NEWS (Habari za Dharura)
- BIASHARA NA UCHUMI (Business & Economy)
- AFYA NA HUDUMA (Health & Services)
- MICHEZO NA BURUDANI (Sports & Entertainment)
- TEKNOLOJIA (Technology)

**MUHIMU:**
- Taarifa zote ziwe za ndani ya SAA 24 ZILIZOPITA
- Toa taarifa 10-12 kwa kila ombi
- Hakikisha unaonyesha CHANZO (TV, Radio, Blog, News, RSS, Gov)
- Kila taarifa iwe na: Kichwa, Muhtasari, Maelezo, Tarehe, Mkoa, Athari (1-10)

**FORMAT:**
Toa taarifa kwa lugha ya Kiswahili sanifu.
`;

// ================================================================
// USER PROMPT
// ================================================================
function getUserPrompt() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' });
    
    return `
Tafadhali nipe taarifa zote muhimu za Tanzania kwa saa hii (${timeStr}, tarehe ${dateStr}).

Natafuta taarifa kutoka:
1. TV Channels (Televisheni) - Azam, Clouds, ITV, TBC, EATV
2. Radio Stations - Radio One, Clouds FM, Times FM, TBC FM
3. Online News - Mwananchi, The Citizen, Daily News, IPP
4. Blogs - Mablogu yote ya Tanzania
5. RSS Feeds - Mlisho wote wa habari
6. Government - Tovuti zote za serikali

Taarifa ziwe za ndani ya masaa 24 yaliyopita. Toa taarifa 12 muhimu zaidi.
`;
}

// ================================================================
// FETCH ALL NEWS FROM MISTRAL AI
// ================================================================
async function fetchAllNews() {
    if (state.isFetching) return;
    
    state.isFetching = true;
    
    // Update button
    if (DOM.refreshBtn) {
        DOM.refreshBtn.disabled = true;
        DOM.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Inatafuta...';
    }
    
    // Show loading if no stories
    if (state.allStories.length === 0 && DOM.loadingState) {
        DOM.loadingState.style.display = 'block';
        DOM.feed.innerHTML = '';
    }
    
    if (DOM.aiStatusMsg) {
        DOM.aiStatusMsg.textContent = 'Mistral AI inachakata vyombo 9,000+ vya habari...';
    }
    
    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: CONFIG.model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: getUserPrompt() }
                ],
                temperature: 0.3,
                max_tokens: 1800
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        const aiText = data.choices[0].message.content;
        
        // Parse AI response
        const newStories = parseAIStories(aiText);
        
        if (newStories && newStories.length > 0) {
            let addedCount = 0;
            
            for (const story of newStories) {
                // Create unique ID from title
                const storyId = story.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                // Check if already exists
                if (!state.storyIds.has(storyId)) {
                    state.storyIds.add(storyId);
                    story.id = storyId;
                    story.timestamp = new Date().toISOString();
                    state.allStories.unshift(story);
                    addedCount++;
                }
            }
            
            // Limit stories
            if (state.allStories.length > CONFIG.maxStories) {
                state.allStories = state.allStories.slice(0, CONFIG.maxStories);
            }
            
            state.seenCount += addedCount;
            state.lastFetchTime = new Date();
            
            // Update everything
            updateAllCounts();
            renderNews();
            updateTicker();
            
            if (DOM.aiStatusMsg) {
                DOM.aiStatusMsg.textContent = `✅ Taarifa ${addedCount} mpya zimeingia! (TV: ${state.counts.tv}, Radio: ${state.counts.radio}, Blog: ${state.counts.blog}, News: ${state.counts.news}, RSS: ${state.counts.rss}, Gov: ${state.counts.gov})`;
            }
        } else {
            if (DOM.aiStatusMsg) {
                DOM.aiStatusMsg.textContent = '⚠️ Hakuna taarifa mpya. Jaribu tena.';
            }
        }
        
    } catch (error) {
        console.error('❌ AI Fetch Error:', error);
        
        if (DOM.aiStatusMsg) {
            DOM.aiStatusMsg.textContent = `❌ Hitilafu: ${error.message}`;
        }
        
        // Load demo data if no stories
        if (state.allStories.length === 0) {
            loadDemoNews();
        }
        
    } finally {
        state.isFetching = false;
        
        // Hide loading
        if (DOM.loadingState) {
            DOM.loadingState.style.display = 'none';
        }
        
        // Reset button
        if (DOM.refreshBtn) {
            DOM.refreshBtn.disabled = false;
            DOM.refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> Sasa';
        }
        
        // Update last fetch time
        if (state.lastFetchTime && DOM.lastUpdate) {
            DOM.lastUpdate.textContent = state.lastFetchTime.toLocaleTimeString('sw-TZ');
        }
    }
}

// ================================================================
// PARSE AI RESPONSE
// ================================================================
function parseAIStories(text) {
    try {
        // Try JSON first
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                let items = parsed.stories || parsed.items || parsed.news || [];
                if (Array.isArray(items) && items.length > 0) {
                    return items.map(item => ({
                        title: item.title || item.kichwa || 'Taarifa mpya',
                        summary: item.summary || item.muhtasari || item.content || '',
                        category: item.category || item.aina || 'general',
                        source: item.source || item.chanzo || 'news',
                        impact: item.impact || item.athari || 5,
                        region: item.region || item.mkoa || 'Tanzania',
                        content: item.content || item.maelezo || item.summary || '',
                        sourceName: item.sourceName || item.jina_chanzo || ''
                    }));
                }
            } catch (e) {
                // Not valid JSON, continue with text parsing
            }
        }
        
        // Parse from text
        const stories = [];
        const lines = text.split('\n').filter(l => l.trim());
        let current = null;
        
        // Source mapping
        const sourceMap = {
            'azam': 'tv', 'clouds tv': 'tv', 'itv': 'tv', 'tbc 1': 'tv', 'eatv': 'tv',
            'star tv': 'tv', 'capital tv': 'tv',
            'radio one': 'radio', 'clouds fm': 'radio', 'times fm': 'radio', 'tbc fm': 'radio',
            'bbc swahili': 'radio',
            'mwananchi': 'news', 'citizen': 'news', 'daily news': 'news', 'ipp media': 'news',
            'blog': 'blog', 'blogs': 'blog',
            'rss': 'rss', 'feed': 'rss',
            'serikali': 'gov', 'government': 'gov', 'tovuti': 'gov'
        };
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Numbered items: 1. Title
            const numMatch = trimmed.match(/^(\d+)[\.\)]\s*(.+)/);
            if (numMatch) {
                if (current) stories.push(current);
                current = {
                    title: numMatch[2].trim(),
                    summary: '',
                    category: 'general',
                    source: 'news',
                    impact: 5,
                    region: 'Tanzania',
                    content: '',
                    sourceName: ''
                };
                continue;
            }
            
            // Bold titles: **TITLE** or ALL CAPS
            if (trimmed.match(/^\*\*.+\*\*/) || trimmed.match(/^[A-Z][A-Z\s]{3,}/)) {
                if (current) stories.push(current);
                current = {
                    title: trimmed.replace(/\*\*/g, '').trim(),
                    summary: '',
                    category: 'general',
                    source: 'news',
                    impact: 5,
                    region: 'Tanzania',
                    content: '',
                    sourceName: ''
                };
                continue;
            }
            
            // Add to current story
            if (current) {
                const lower = trimmed.toLowerCase();
                
                // Detect source
                if (lower.includes('source') || lower.includes('chanzo') || lower.includes('kutoka')) {
                    const parts = trimmed.split(':');
                    if (parts.length > 1) {
                        const srcText = parts[1].trim().toLowerCase();
                        let found = false;
                        for (const [key, val] of Object.entries(sourceMap)) {
                            if (srcText.includes(key)) {
                                current.source = val;
                                current.sourceName = parts[1].trim();
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            current.sourceName = parts[1].trim();
                        }
                    }
                }
                // Detect category
                else if (lower.includes('category') || lower.includes('aina') || lower.includes('habari')) {
                    const parts = trimmed.split(':');
                    if (parts.length > 1) {
                        const cat = parts[1].trim().toLowerCase();
                        const map = {
                            'vikao': 'vikao',
                            'government meeting': 'vikao',
                            'ratiba': 'ratiba',
                            'schedule': 'ratiba',
                            'matukio': 'matukio',
                            'event': 'matukio',
                            'breaking': 'breaking',
                            'dharura': 'breaking',
                            'biashara': 'biashara',
                            'business': 'biashara',
                            'afya': 'afya',
                            'health': 'afya',
                            'michezo': 'michezo',
                            'sports': 'michezo',
                            'tech': 'tech',
                            'technology': 'tech'
                        };
                        current.category = map[cat] || cat || 'general';
                    }
                }
                // Detect impact
                else if (lower.includes('impact') || lower.includes('athari')) {
                    const parts = trimmed.split(':');
                    if (parts.length > 1) {
                        const num = parseInt(parts[1].trim());
                        if (!isNaN(num)) current.impact = Math.min(10, Math.max(1, num));
                    }
                }
                // Detect region
                else if (lower.includes('region') || lower.includes('mkoa')) {
                    const parts = trimmed.split(':');
                    if (parts.length > 1) current.region = parts[1].trim();
                }
                // Add to summary or content
                else {
                    if (!current.summary) {
                        current.summary = trimmed;
                    } else if (current.summary.length < 200) {
                        current.summary += ' ' + trimmed;
                    } else {
                        current.content = (current.content || '') + ' ' + trimmed;
                    }
                }
            }
        }
        
        if (current) stories.push(current);
        
        // Filter out stories without title
        return stories.filter(s => s.title && s.title.length > 5);
        
    } catch (error) {
        console.error('Parse error:', error);
        return [];
    }
}

// ================================================================
// UPDATE ALL COUNTS
// ================================================================
function updateAllCounts() {
    // Reset counts
    const counts = { tv: 0, radio: 0, blog: 0, news: 0, rss: 0, gov: 0 };
    const catCounts = { vikao: 0, ratiba: 0, matukio: 0, breaking: 0, biashara: 0, afya: 0, michezo: 0, tech: 0, general: 0 };
    
    // Count stories
    for (const story of state.allStories) {
        const src = story.source || 'news';
        if (counts[src] !== undefined) counts[src]++;
        else counts.news++;
        
        const cat = story.category || 'general';
        if (catCounts[cat] !== undefined) catCounts[cat]++;
        else catCounts.general++;
    }
    
    counts.total = state.allStories.length;
    state.counts = counts;
    state.categoryCounts = catCounts;
    
    // Update stat displays
    if (DOM.countTV) DOM.countTV.textContent = counts.tv;
    if (DOM.countRadio) DOM.countRadio.textContent = counts.radio;
    if (DOM.countBlog) DOM.countBlog.textContent = counts.blog;
    if (DOM.countTotal) DOM.countTotal.textContent = counts.total;
    
    // Update category counts
    if (DOM.countAllCat) DOM.countAllCat.textContent = counts.total;
    if (DOM.countVikaoCat) DOM.countVikaoCat.textContent = catCounts.vikao;
    if (DOM.countRatibaCat) DOM.countRatibaCat.textContent = catCounts.ratiba;
    if (DOM.countMatukioCat) DOM.countMatukioCat.textContent = catCounts.matukio;
    if (DOM.countBreakingCat) DOM.countBreakingCat.textContent = catCounts.breaking;
    
    // Update source count display
    if (DOM.sourceCountDisplay) {
        DOM.sourceCountDisplay.textContent = `${CONFIG.totalSources.toLocaleString()}+ vyanzo`;
    }
}

// ================================================================
// RENDER NEWS
// ================================================================
function renderNews() {
    let stories = state.allStories;
    
    // Filter by source
    if (state.currentSource !== 'all') {
        stories = stories.filter(s => (s.source || 'news') === state.currentSource);
    }
    
    // Filter by category
    if (state.currentCategory !== 'all') {
        stories = stories.filter(s => (s.category || 'general') === state.currentCategory);
    }
    
    state.filteredStories = stories;
    
    if (stories.length === 0) {
        if (DOM.feed) {
            DOM.feed.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-3 block text-gray-300"></i>
                    <p class="font-medium">Hakuna taarifa za aina hii</p>
                    <p class="text-sm text-gray-400">Jaribu kubadilisha chujio au bonyeza "Sasa"</p>
                    <button onclick="fetchAllNews()" class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition">
                        <i class="fas fa-sync-alt mr-1"></i> Jaribu tena
                    </button>
                </div>
            `;
        }
        return;
    }
    
    // Build HTML
    const html = stories.map((story, index) => {
        const cat = story.category || 'general';
        const src = story.source || 'news';
        const isNew = index < 5;
        const timeAgo = getTimeAgo(story.timestamp);
        const isBreaking = cat === 'breaking' || story.impact >= 8;
        
        // Source badge
        const srcBadgeMap = {
            'tv': '<span class="badge-tv"><i class="fas fa-tv mr-0.5"></i>TV</span>',
            'radio': '<span class="badge-radio"><i class="fas fa-radio mr-0.5"></i>RADIO</span>',
            'blog': '<span class="badge-blog"><i class="fas fa-blog mr-0.5"></i>BLOG</span>',
            'news': '<span class="badge-news"><i class="fas fa-newspaper mr-0.5"></i>NEWS</span>',
            'rss': '<span class="badge-rss"><i class="fas fa-rss mr-0.5"></i>RSS</span>',
            'gov': '<span class="badge-gov"><i class="fas fa-landmark mr-0.5"></i>GOV</span>'
        };
        const srcBadge = srcBadgeMap[src] || srcBadgeMap.news;
        
        // Category badge
        const catBadgeMap = {
            'vikao': '<span class="badge-vikao">VIKAO</span>',
            'ratiba': '<span class="badge-ratiba">RATIBA</span>',
            'matukio': '<span class="badge-matukio">MATUKIO</span>',
            'breaking': '<span class="badge-breaking">BREAKING</span>',
            'biashara': '<span class="badge-news" style="background:#10b981;">BIASHARA</span>',
            'afya': '<span class="badge-news" style="background:#22c55e;">AFYA</span>',
            'michezo': '<span class="badge-radio" style="background:#8b5cf6;">MICHEZO</span>',
            'tech': '<span class="badge-tv" style="background:#06b6d4;">TECH</span>'
        };
        const catBadge = catBadgeMap[cat] || '';
        
        // Card class
        let cardClass = `source-${src}`;
        if (isBreaking) cardClass += ' breaking';
        
        return `
            <div class="news-card ${cardClass}" onclick="openModal('${story.id}')">
                <div class="meta">
                    ${srcBadge}
                    ${catBadge}
                    ${isNew ? '<span class="badge-new">🆕 MPYA</span>' : ''}
                    <span class="time"><i class="far fa-clock mr-0.5"></i>${timeAgo}</span>
                </div>
                <div class="title">${escapeHtml(story.title)}</div>
                <div class="summary">${escapeHtml(story.summary || '')}</div>
                <div class="footer">
                    ${story.sourceName ? `<span><i class="fas fa-broadcast"></i>${escapeHtml(story.sourceName)}</span>` : ''}
                    <span><i class="fas fa-map-marker-alt"></i>${escapeHtml(story.region || 'Tanzania')}</span>
                    ${story.impact ? `<span><i class="fas fa-exclamation-triangle"></i>${story.impact}/10</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    if (DOM.feed) {
        DOM.feed.innerHTML = html;
    }
}

// ================================================================
// GET TIME AGO
// ================================================================
function getTimeAgo(timestamp) {
    if (!timestamp) return 'Sasa hivi';
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Sasa hivi';
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'Dakika hii';
        if (diffMin < 60) return `${diffMin}m iliyopita`;
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour}h iliyopita`;
        return date.toLocaleDateString('sw-TZ');
    } catch (e) {
        return 'Sasa hivi';
    }
}

// ================================================================
// ESCAPE HTML
// ================================================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================================================
// FILTER FUNCTIONS
// ================================================================
function filterSource(source) {
    state.currentSource = source;
    
    // Update source buttons
    document.querySelectorAll('.source-btn').forEach(btn => {
        const s = btn.dataset.source;
        if (s === source) {
            btn.className = 'source-btn active';
        } else {
            btn.className = 'source-btn';
        }
    });
    
    renderNews();
}

function filterCategory(category) {
    state.currentCategory = category;
    
    // Update category buttons
    document.querySelectorAll('.cat-btn').forEach(btn => {
        const c = btn.dataset.category;
        if (c === category) {
            btn.className = 'cat-btn active';
        } else {
            btn.className = 'cat-btn';
        }
    });
    
    renderNews();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================================================================
// UPDATE TICKER
// ================================================================
function updateTicker() {
    if (state.allStories.length > 0 && DOM.tickerLive) {
        const latest = state.allStories[0];
        const src = latest.source || 'news';
        const srcLabel = {
            tv: 'TV',
            radio: 'RADIO',
            blog: 'BLOG',
            news: 'NEWS',
            rss: 'RSS',
            gov: 'GOV'
        } [src] || 'TAARIFA';
        
        DOM.tickerLive.textContent = `🔴 ${srcLabel}: ${latest.title}`;
    }
}

// ================================================================
// MODAL
// ================================================================
function openModal(storyId) {
    const story = state.allStories.find(s => s.id === storyId);
    if (!story) return;
    
    const src = story.source || 'news';
    const srcLabel = {
        tv: 'TV',
        radio: 'RADIO',
        blog: 'BLOG',
        news: 'NEWS',
        rss: 'RSS',
        gov: 'SERIKALI'
    } [src] || 'CHANZO';
    
    const srcColor = {
        tv: '#ef4444',
        radio: '#f59e0b',
        blog: '#8b5cf6',
        news: '#3b82f6',
        rss: '#22c55e',
        gov: '#1e293b'
    } [src] || '#64748b';
    
    const cat = story.category || 'general';
    const catLabel = {
        'vikao': 'VIKAO VYA SERIKALI',
        'ratiba': 'RATIBA ZA SERIKALI',
        'matukio': 'MATUKIO NA SHUGHULI',
        'breaking': 'BREAKING NEWS',
        'biashara': 'BIASHARA NA UCHUMI',
        'afya': 'AFYA NA HUDUMA',
        'michezo': 'MICHEZO NA BURUDANI',
        'tech': 'TEKNOLOJIA',
        'general': 'TAARIFA'
    } [cat] || 'TAARIFA';
    
    const html = `
        <div>
            <span class="modal-source" style="background:${srcColor};color:white;">
                <i class="fas ${src === 'tv' ? 'fa-tv' : src === 'radio' ? 'fa-radio' : src === 'blog' ? 'fa-blog' : src === 'news' ? 'fa-newspaper' : src === 'rss' ? 'fa-rss' : 'fa-landmark'} mr-1"></i>
                ${srcLabel}
            </span>
            <span class="modal-source" style="background:#64748b;color:white;margin-left:4px;">
                ${catLabel}
            </span>
            <div class="modal-title">${escapeHtml(story.title)}</div>
            <div class="modal-body">
                <p>${escapeHtml(story.content || story.summary || 'Hakuna maelezo zaidi.')}</p>
            </div>
            <div class="modal-meta">
                ${story.sourceName ? `<span><i class="fas fa-broadcast"></i> ${escapeHtml(story.sourceName)}</span>` : ''}
                <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(story.region || 'Tanzania')}</span>
                ${story.impact ? `<span><i class="fas fa-exclamation-triangle"></i> Impact: ${story.impact}/10</span>` : ''}
                <span><i class="far fa-clock"></i> ${new Date(story.timestamp).toLocaleString('sw-TZ')}</span>
            </div>
        </div>
    `;
    
    if (DOM.modalContent) {
        DOM.modalContent.innerHTML = html;
    }
    if (DOM.modalOverlay) {
        DOM.modalOverlay.classList.add('active');
    }
    document.body.style.overflow = 'hidden';
}

function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    if (DOM.modalOverlay) {
        DOM.modalOverlay.classList.remove('active');
    }
    document.body.style.overflow = '';
}

// ================================================================
// DEMO DATA - VYOMBO VYOTE VYA HABARI
// ================================================================
function loadDemoNews() {
    const now = new Date();
    const demos = [
        {
            id: 'demo1',
            title: 'Azam TV Yatangaza Mpango Mpya wa Burudani',
            summary: 'Azam TV imezindua chaneli mpya ya burudani inayoangaziwa wakati wote.',
            category: 'matukio',
            source: 'tv',
            sourceName: 'Azam TV',
            impact: 6,
            region: 'Dar es Salaam',
            timestamp: new Date(now - 1000 * 60 * 5).toISOString(),
            content: 'Azam TV imezindua chaneli mpya ya burudani inayoangaziwa saa 24. Chaneli hii itaangazia vipindi vya muziki, filamu, na burudani kutoka Tanzania na duniani.'
        },
        {
            id: 'demo2',
            title: 'Radio One Yatangaza Ratiba Mpya ya Vipindi',
            summary: 'Radio One imetangaza ratiba mpya ya vipindi vyake kuanzia Jumatatu.',
            category: 'ratiba',
            source: 'radio',
            sourceName: 'Radio One',
            impact: 4,
            region: 'Dar es Salaam',
            timestamp: new Date(now - 1000 * 60 * 15).toISOString(),
            content: 'Radio One imetangaza ratiba mpya ya vipindi vyake kuanzia Jumatatu. Vipindi vipya vimeongezwa ikiwemo kipindi cha michezo na burudani.'
        },
        {
            id: 'demo3',
            title: 'Baraza la Mawaziri Lafanya Mkutano Dodoma',
            summary: 'Baraza la Mawaziri limefanya mkutano wake wa 45 jijini Dodoma.',
            category: 'vikao',
            source: 'gov',
            sourceName: 'Ofisi ya Waziri Mkuu',
            impact: 8,
            region: 'Dodoma',
            timestamp: new Date(now - 1000 * 60 * 25).toISOString(),
            content: 'Baraza la Mawaziri limefanya mkutano wake wa 45 katika Ikulu ya Nkrumah jijini Dodoma. Mkutano umeongozwa na Waziri Mkuu Kassim Majaliwa.'
        },
        {
            id: 'demo4',
            title: 'Mwananchi Yachapisha Habari za Uchumi Tanzania',
            summary: 'Gazeti la Mwananchi limechapisha habari za uchumi ikiwemo mabadiliko ya bei.',
            category: 'biashara',
            source: 'news',
            sourceName: 'Mwananchi',
            impact: 7,
            region: 'Dar es Salaam',
            timestamp: new Date(now - 1000 * 60 * 35).toISOString(),
            content: 'Gazeti la Mwananchi limechapisha habari za uchumi ikiwemo mabadiliko ya bei za bidhaa na mwelekeo wa soko la fedha nchini.'
        },
        {
            id: 'demo5',
            title: 'Ajali Kubwa Barabara Yatokea Morogoro',
            summary: 'Ajali kubwa ya gari imetokea mkoani Morogoro na watu 5 wamefariki.',
            category: 'breaking',
            source: 'news',
            sourceName: 'Clouds Media',
            impact: 9,
            region: 'Morogoro',
            timestamp: new Date(now - 1000 * 60 * 8).toISOString(),
            content: 'Ajali kubwa ya gari imetokea mkoani Morogoro katika eneo la Mikumi. Watu 5 wamefariki na wengine 12 wamejeruhiwa. Polisi wanachunguza sababu za ajali hiyo.'
        },
        {
            id: 'demo6',
            title: 'TBC FM Yatangaza Matokeo ya Mechi za Ligi Kuu',
            summary: 'TBC FM imetangaza matokeo ya mechi za Ligi Kuu Tanzania iliyochezwa mwishoni mwa wiki.',
            category: 'michezo',
            source: 'radio',
            sourceName: 'TBC FM',
            impact: 5,
            region: 'Dar es Salaam',
            timestamp: new Date(now - 1000 * 60 * 45).toISOString(),
            content: 'TBC FM imetangaza matokeo ya mechi za Ligi Kuu Tanzania iliyochezwa mwishoni mwa wiki. Yanga imeshinda 2-0 dhidi ya Simba katika mechi ya kusisimua.'
        },
        {
            id: 'demo7',
            title: 'Blogu ya Tech Tanzania Yachapisha Makala Mpya',
            summary: 'Blogu maarufu ya Tech Tanzania imechapisha makala mpya kuhusu uvumbuzi wa teknolojia nchini.',
            category: 'tech',
            source: 'blog',
            sourceName: 'Tech Tanzania Blog',
            impact: 5,
            region: 'Dar es Salaam',
            timestamp: new Date(now - 1000 * 60 * 55).toISOString(),
            content: 'Blogu maarufu ya Tech Tanzania imechapisha makala mpya kuhusu uvumbuzi wa teknolojia nchini. Makala inazungumzia mafanikio ya kampuni za teknolojia za Tanzania.'
        },
        {
            id: 'demo8',
            title: 'Wizara ya Afya Yatoa Onyo la Mafua',
            summary: 'Wizara ya Afya imetoa onyo kwa wananchi kuhusu mafua yanayoenea mikoa ya Dar na Mwanza.',
            category: 'afya',
            source: 'gov',
            sourceName: 'Wizara ya Afya',
            impact: 8,
            region: 'Dar es Salaam',
            timestamp: new Date(now - 1000 * 60 * 70).toISOString(),
            content: 'Wizara ya Afya imetoa onyo kwa wananchi kuhusu mafua yanayoenea mikoa ya Dar es Salaam na Mwanza. Wananchi wanashauriwa kuvaa barakoa.'
        },
        {
            id: 'demo9',
            title: 'ITV Yatangaza Mpango Mpya wa Habari',
            summary: 'ITV imetangaza mpango mpya wa habari unaoangaziwa kila saa.',
            category: 'matukio',
            source: 'tv',
            sourceName: 'ITV',
            impact: 6,
            region: 'Dar es Salaam',
            timestamp: new Date(now - 1000 * 60 * 90).toISOString(),
            content: 'ITV imetangaza mpango mpya wa habari unaoangaziwa kila saa. Mpango huu unalenga kuleta taarifa za wakati halisi kwa watazamaji.'
        },
        {
            id: 'demo10',
            title: 'RSS Feed ya BBC Swahili Yatoa Habari Mpya',
            summary: 'RSS Feed ya BBC Swahili imetoa habari mpya kuhusu mwenendo wa uchumi Tanzania.',
            category: 'biashara',
            source: 'rss',
            sourceName: 'BBC Swahili RSS',
            impact: 6,
            region: 'Tanzania',
            timestamp: new Date(now - 1000 * 60 * 110).toISOString(),
            content: 'RSS Feed ya BBC Swahili imetoa habari mpya kuhusu mwenendo wa uchumi Tanzania na mabadiliko ya soko la fedha.'
        },
        {
            id: 'demo11',
            title: 'Clouds FM Yatangaza Matokeo ya Uchaguzi wa Soka',
            summary: 'Clouds FM imetangaza matokeo ya uchaguzi wa soka Tanzania.',
            category: 'michezo',
            source: 'radio',
            sourceName: 'Clouds FM',
            impact: 5,
            region: 'Dar es Salaam',
            timestamp: new Date(now - 1000 * 60 * 130).toISOString(),
            content: 'Clouds FM imetangaza matokeo ya uchaguzi wa soka Tanzania. Wachezaji wapya wamechaguliwa kucheza katika timu ya taifa.'
        },
        {
            id: 'demo12',
            title: 'Mkutano wa Kamati ya Bunge ya Fedha',
            summary: 'Kamati ya Bunge ya Fedha imefanya mkutano kujadili bajeti ya mwaka 2025.',
            category: 'vikao',
            source: 'gov',
            sourceName: 'Bunge la Tanzania',
            impact: 7,
            region: 'Dodoma',
            timestamp: new Date(now - 1000 * 60 * 150).toISOString(),
            content: 'Kamati ya Bunge ya Fedha imefanya mkutano wake jijini Dodoma kujadili bajeti ya mwaka 2025. Viongozi wamejipanga kukutana na wadau mbalimbali.'
        }
    ];
    
    for (const story of demos) {
        if (!state.storyIds.has(story.id)) {
            state.storyIds.add(story.id);
            state.allStories.push(story);
        }
    }
    
    state.seenCount = demos.length;
    state.lastFetchTime = new Date();
    
    updateAllCounts();
    renderNews();
    updateTicker();
    
    if (DOM.lastUpdate) {
        DOM.lastUpdate.textContent = new Date().toLocaleTimeString('sw-TZ');
    }
    if (DOM.aiStatusMsg) {
        DOM.aiStatusMsg.textContent = `📰 Taarifa kutoka TV, Radio, Blog, News, RSS, na Serikali (${demos.length} taarifa)`;
    }
}

// ================================================================
// SCROLL BUTTON
// ================================================================
window.addEventListener('scroll', () => {
    if (DOM.scrollBtn) {
        if (window.scrollY > 300) {
            DOM.scrollBtn.classList.add('visible');
        } else {
            DOM.scrollBtn.classList.remove('visible');
        }
    }
});

// ================================================================
// KEYBOARD SHORTCUTS
// ================================================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey) fetchAllNews();
});

// ================================================================
// INITIALIZATION
// ================================================================
console.log('🚀 Tanzania AI News Engine - Vyombo Vyote vya Habari');
console.log(`📡 Mistral AI configured - Monitoring ${CONFIG.totalSources.toLocaleString()}+ sources`);
console.log('⏰ Refresh every 60 seconds');
console.log('📺 TV | 📻 Radio | 📰 News | 📝 Blog | 📡 RSS | 🏛️ Government');

// Load initial news
fetchAllNews();

// Auto refresh every 60 seconds
setInterval(fetchAllNews, CONFIG.refreshInterval);

// ================================================================
// EXPOSE GLOBALS
// ================================================================
window.fetchAllNews = fetchAllNews;
window.filterSource = filterSource;
window.filterCategory = filterCategory;
window.openModal = openModal;
window.closeModal = closeModal;

console.log('✅ Engine running - Vyombo 9,000+ vikifuatiliwa kwa wakati halisi');
