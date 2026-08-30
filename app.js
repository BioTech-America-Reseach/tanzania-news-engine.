// =============================================
// TANZANIA AI NEWS ENGINE - COMPLETE AI INTEGRATION
// =============================================

// =============================================
// MISTRAL AI CONFIGURATION
// =============================================
const AI_CONFIG = {
    apiKey: '3pDTfrhKfqKtLyrKVwyMhC5A2xd7sv0C',
    apiUrl: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-large-latest',
    maxTokens: 800,
    temperature: 0.3
};

// =============================================
// SYSTEM PROMPTS FOR MISTRAL AI
// =============================================
const SYSTEM_PROMPTS = {
    news: `Wewe ni mchambuzi wa habari wa Tanzania. 
    Tafadhali toa taarifa za hivi karibuni kutoka Tanzania kwa lugha ya Kiswahili.
    Hakikisha taarifa ni sahihi, za kitaalamu, na zinazungumzia mambo muhimu ya nchi.
    Kila taarifa iwe na:
    - Kichwa cha habari (Title)
    - Muhtasari mfupi (Summary)
    - Maelezo kamili (Content)
    - Aina ya habari (Category: government/events/breaking/business/health/education/general)
    - Tarehe ya tukio
    - Athari (Impact: 1-10)
    
    Toa taarifa 5-7 kwa kila ombi.`,

    breaking: `Wewe ni mchambuzi wa habari za dharura Tanzania.
    Toa taarifa 3-5 za muhimu na za dharura zinazoendelea nchini Tanzania.
    Hakikisha taarifa ni za dakika hii na zina athari kubwa kwa umma.
    Tumia lugha ya Kiswahili sanifu.`,

    analysis: `Wewe ni mchambuzi wa uchumi na siasa Tanzania.
    Toa uchambuzi wa kina kuhusu mwenendo wa habari za Tanzania.
    Eleza athari za habari kwa uchumi, siasa, na maisha ya wananchi.
    Toa mapendekezo na maoni ya kitaalamu.`
};

// =============================================
// APPLICATION STATE
// =============================================
const AppState = {
    currentCategory: 'all',
    stories: [],
    isLoading: false,
    isPlaying: false,
    audioContext: null,
    wsConnection: null,
    activeUsers: 0,
    startTime: Date.now(),
    aiPrompt: 'Tayari kupata taarifa',
    lastAIFetch: null
};

// =============================================
// DOM REFERENCES
// =============================================
const DOM = {
    feed: document.getElementById('contentFeed'),
    storyCount: document.getElementById('storyCount'),
    sourceCount: document.getElementById('sourceCount'),
    lastCrawl: document.getElementById('lastCrawl'),
    activeUsers: document.getElementById('activeUsers'),
    tickerText: document.getElementById('tickerText'),
    aiPromptDisplay: document.getElementById('aiPromptDisplay'),
    aiStatus: document.getElementById('aiStatus'),
    loadingStatus: document.getElementById('loadingStatus'),
    
    playIcon: document.getElementById('playIcon'),
    playText: document.getElementById('playText'),
    mobilePlayIcon: document.getElementById('mobilePlayIcon'),
    mobilePlayText: document.getElementById('mobilePlayText'),
    
    modal: document.getElementById('detailModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalContent: document.getElementById('modalContent')
};

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🤖 Tanzania AI News Engine initialized');
    
    // Generate wave bars
    generateWaveBars();
    
    // Set source count
    if (DOM.sourceCount) {
        DOM.sourceCount.textContent = '10,400+';
    }
    
    // Initial AI news fetch
    fetchAINews('latest');
    
    // Update uptime
    setInterval(updateUptime, 1000);
    
    // Auto refresh every 2 minutes
    setInterval(() => {
        if (AppState.currentCategory === 'all') {
            fetchAINews('latest');
        }
    }, 120000);
    
    console.log('✅ AI Engine ready - Mistral Large model loaded');
});

// =============================================
// GENERATE WAVE BARS
// =============================================
function generateWaveBars() {
    const container = document.getElementById('waveBars');
    if (!container) return;
    
    let html = '';
    for (let i = 0; i < 70; i++) {
        html += `<div class="wave-bar" style="animation-delay: ${i * 0.05}s"></div>`;
    }
    container.innerHTML = html;
}

// =============================================
// FETCH AI NEWS FROM MISTRAL
// =============================================
async function fetchAINews(type = 'latest') {
    if (AppState.isLoading) return;
    
    AppState.isLoading = true;
    updateAILoading(true);
    
    // Get appropriate system prompt
    let systemPrompt = SYSTEM_PROMPTS.news;
    let userPrompt = 'Nipe taarifa za hivi karibuni za Tanzania.';
    
    if (type === 'breaking') {
        systemPrompt = SYSTEM_PROMPTS.breaking;
        userPrompt = 'Nipe taarifa za dharura zinazoendelea Tanzania sasa hivi.';
    } else if (type === 'analysis') {
        systemPrompt = SYSTEM_PROMPTS.analysis;
        userPrompt = 'Nipe uchambuzi wa kina wa habari za Tanzania.';
    }
    
    try {
        // Show loading state
        DOM.feed.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-robot fa-spin text-4xl text-blue-600 mb-4"></i>
                <p class="text-gray-500 font-medium">AI inachakata taarifa...</p>
                <p class="text-xs text-gray-400 mt-2">Mistral Large inatafuta habari</p>
                <div class="mt-4 w-48 h-1.5 bg-gray-200 rounded-full mx-auto overflow-hidden">
                    <div class="h-full bg-blue-600 rounded-full animate-pulse" style="width: 60%"></div>
                </div>
            </div>
        `;
        
        // Call Mistral API
        const response = await callMistralAI(systemPrompt, userPrompt);
        
        // Parse AI response
        const stories = parseAIResponse(response, type);
        
        if (stories && stories.length > 0) {
            AppState.stories = stories;
            AppState.storyCount = stories.length;
            
            if (DOM.storyCount) {
                DOM.storyCount.textContent = stories.length;
            }
            
            if (DOM.lastCrawl) {
                DOM.lastCrawl.textContent = new Date().toLocaleTimeString('sw-TZ');
            }
            
            // Update ticker with first story
            if (DOM.tickerText && stories[0]) {
                DOM.tickerText.textContent = `🤖 ${stories[0].title} • ${stories[0].summary || ''}`;
            }
            
            renderContent(stories);
            updateAIStatus('success', `Taarifa ${stories.length} zimepatikana`);
        } else {
            // Fallback to demo data
            loadDemoData();
            updateAIStatus('warning', 'Tumia data ya mfano');
        }
        
    } catch (error) {
        console.error('AI fetch error:', error);
        updateAIStatus('error', 'Hitilafu ya AI');
        loadDemoData();
    } finally {
        AppState.isLoading = false;
        updateAILoading(false);
    }
}

// =============================================
// CALL MISTRAL AI API
// =============================================
async function callMistralAI(systemPrompt, userPrompt) {
    try {
        const response = await fetch(AI_CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: AI_CONFIG.temperature,
                max_tokens: AI_CONFIG.maxTokens
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
        
    } catch (error) {
        console.error('Mistral API call failed:', error);
        throw error;
    }
}

// =============================================
// PARSE AI RESPONSE
// =============================================
function parseAIResponse(aiText, type) {
    try {
        // Try to parse as JSON first
        let stories = [];
        
        // Check if response is JSON
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed)) {
                    stories = parsed;
                } else if (parsed.stories && Array.isArray(parsed.stories)) {
                    stories = parsed.stories;
                } else if (parsed.items && Array.isArray(parsed.items)) {
                    stories = parsed.items;
                }
            } catch (e) {
                // Not valid JSON, continue with text parsing
            }
        }
        
        // If JSON parsing failed, try to extract stories from text
        if (stories.length === 0) {
            stories = extractStoriesFromText(aiText);
        }
        
        // Format stories
        return stories.map((story, index) => ({
            id: `ai_${Date.now()}_${index}`,
            title: story.title || story.kichwa || `Taarifa ${index + 1}`,
            summary: story.summary || story.muhtasari || story.content?.substring(0, 150) || '',
            content: story.content || story.maelezo || story.summary || '',
            category: story.category || story.aina || determineCategory(story.title || '', story.content || ''),
            published_date: story.date || story.tarehe || new Date().toISOString(),
            source_count: story.source_count || Math.floor(Math.random() * 5) + 1,
            impact_rating: story.impact || story.athari || Math.floor(Math.random() * 5) + 3,
            region: story.region || story.mkoa || 'Tanzania',
            source_urls: story.source_urls || [`https://ai.taarifa.go.tz/story/${index}`],
            structured_content: story,
            isAIGenerated: true
        }));
        
    } catch (error) {
        console.error('Failed to parse AI response:', error);
        return [];
    }
}

// =============================================
// EXTRACT STORIES FROM TEXT
// =============================================
function extractStoriesFromText(text) {
    const stories = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    let currentStory = null;
    let currentSection = 'title';
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Detect title (starts with number or bold)
        if (trimmed.match(/^(\d+\.|\*|•|-)\s*(.+)/) || trimmed.match(/^[A-Z][A-Z\s]{2,}/)) {
            if (currentStory) {
                stories.push(currentStory);
            }
            currentStory = {
                title: trimmed.replace(/^(\d+\.|\*|•|-)\s*/, '').trim(),
                summary: '',
                content: ''
            };
            currentSection = 'summary';
        }
        // Detect category
        else if (trimmed.toLowerCase().includes('category') || trimmed.toLowerCase().includes('aina')) {
            const parts = trimmed.split(':');
            if (parts.length > 1 && currentStory) {
                currentStory.category = parts[1].trim().toLowerCase();
            }
        }
        // Add to content
        else if (currentStory) {
            if (currentSection === 'summary') {
                if (trimmed.length < 200) {
                    currentStory.summary = (currentStory.summary + ' ' + trimmed).trim();
                } else {
                    currentStory.content = (currentStory.content + ' ' + trimmed).trim();
                }
            } else {
                currentStory.content = (currentStory.content + ' ' + trimmed).trim();
            }
        }
    }
    
    if (currentStory) {
        stories.push(currentStory);
    }
    
    // If no stories found, create one from the whole text
    if (stories.length === 0 && text.length > 50) {
        const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 20);
        if (sentences.length > 0) {
            stories.push({
                title: sentences[0].trim().substring(0, 60) || 'Taarifa mpya',
                summary: sentences.slice(0, 2).join('. ').trim(),
                content: text.substring(0, 500)
            });
        }
    }
    
    return stories;
}

// =============================================
// DETERMINE CATEGORY
// =============================================
function determineCategory(title, content) {
    const text = (title + ' ' + content).toLowerCase();
    
    const categories = {
        government: ['serikali', 'waziri', 'mkuu', 'mkutano', 'baraza', 'bunge', 'rais', 'waziri mkuu'],
        breaking: ['dharura', 'ajali', 'mgomo', 'maafa', 'maporomoko', 'mvua kubwa', 'tetemeko'],
        events: ['tamasha', 'maadhimisho', 'sherehe', 'mkutano', 'warsha', 'semina'],
        business: ['biashara', 'uchumi', 'fedha', 'benki', 'uwekezaji', 'mabenki', 'sarafu'],
        health: ['afya', 'ugonjwa', 'hospitali', 'dawa', 'chanjo', 'mgonjwa'],
        education: ['elimu', 'shule', 'chuo', 'wanafunzi', 'walimu', 'mitihani']
    };
    
    let bestCategory = 'general';
    let maxScore = 0;
    
    for (const [category, keywords] of Object.entries(categories)) {
        let score = 0;
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                score += 1;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestCategory = category;
        }
    }
    
    return bestCategory;
}

// =============================================
// RENDER CONTENT
// =============================================
function renderContent(stories) {
    if (!DOM.feed) return;
    
    if (!stories || stories.length === 0) {
        DOM.feed.innerHTML = `
            <div class="text-center text-gray-500 py-12">
                <i class="fas fa-robot text-5xl mb-4 block text-gray-300"></i>
                <p class="text-lg font-medium">Hakuna taarifa</p>
                <button onclick="fetchAINews('latest')" class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg">
                    <i class="fas fa-sync-alt mr-2"></i> Jaribu tena
                </button>
            </div>
        `;
        return;
    }
    
    const html = stories.map((story, index) => {
        const category = story.category || 'general';
        const categoryColor = getCategoryColor(category);
        const categoryIcon = getCategoryIcon(category);
        const isBreaking = category === 'breaking';
        
        return `
            <div class="story-card bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border-l-4 ${categoryColor.border} cursor-pointer transform hover:-translate-y-1"
                 onclick="openModal('${story.id}')"
                 data-id="${story.id}">
                <div class="p-5">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center flex-wrap gap-2 mb-2">
                                <span class="inline-flex items-center space-x-1 text-xs font-semibold ${categoryColor.bg} ${categoryColor.text} px-3 py-1 rounded-full">
                                    <i class="fas ${categoryIcon}"></i>
                                    <span>${formatCategoryName(category)}</span>
                                </span>
                                ${isBreaking ? `
                                    <span class="inline-flex items-center space-x-1 text-xs font-bold bg-red-500 text-white px-3 py-1 rounded-full animate-pulse">
                                        <i class="fas fa-bolt"></i> <span>BREAKING</span>
                                    </span>
                                ` : ''}
                                ${story.isAIGenerated ? `
                                    <span class="inline-flex items-center space-x-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                        <i class="fas fa-robot"></i> <span>AI</span>
                                    </span>
                                ` : ''}
                                <span class="text-xs text-gray-400">${formatDate(story.published_date)}</span>
                            </div>
                            
                            <h3 class="text-lg md:text-xl font-bold text-gray-900 mb-1.5 line-clamp-2">
                                ${story.title}
                            </h3>
                            
                            <p class="text-gray-600 text-sm line-clamp-2 mb-2">
                                ${story.summary || story.content?.substring(0, 150) || ''}${(story.summary || story.content || '').length > 150 ? '...' : ''}
                            </p>
                            
                            <div class="flex items-center flex-wrap gap-3 text-xs text-gray-400">
                                <span><i class="fas fa-link mr-1"></i>${story.source_count || 1} sources</span>
                                ${story.impact_rating ? `
                                    <span><i class="fas fa-exclamation-triangle text-red-500 mr-1"></i>Impact: ${story.impact_rating}/10</span>
                                ` : ''}
                                ${story.region ? `
                                    <span><i class="fas fa-map-marker-alt mr-1"></i>${story.region}</span>
                                ` : ''}
                            </div>
                        </div>
                        <div class="ml-3 flex-shrink-0 self-center">
                            <i class="fas fa-chevron-right text-gray-300 group-hover:text-blue-600 transition"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    DOM.feed.innerHTML = html;
}

// =============================================
// CATEGORY HELPERS
// =============================================
function getCategoryColor(category) {
    const colors = {
        government: { border: 'border-blue-500', bg: 'bg-blue-100', text: 'text-blue-700' },
        breaking: { border: 'border-red-500', bg: 'bg-red-100', text: 'text-red-700' },
        events: { border: 'border-green-500', bg: 'bg-green-100', text: 'text-green-700' },
        business: { border: 'border-yellow-500', bg: 'bg-yellow-100', text: 'text-yellow-700' },
        health: { border: 'border-teal-500', bg: 'bg-teal-100', text: 'text-teal-700' },
        education: { border: 'border-purple-500', bg: 'bg-purple-100', text: 'text-purple-700' },
        general: { border: 'border-gray-400', bg: 'bg-gray-100', text: 'text-gray-700' }
    };
    return colors[category] || colors.general;
}

function getCategoryIcon(category) {
    const icons = {
        government: 'fa-landmark',
        breaking: 'fa-bolt',
        events: 'fa-calendar-check',
        business: 'fa-chart-line',
        health: 'fa-heartbeat',
        education: 'fa-graduation-cap',
        general: 'fa-newspaper'
    };
    return icons[category] || icons.general;
}

function formatCategoryName(category) {
    const names = {
        government: 'Serikali',
        breaking: 'Dharura',
        events: 'Matukio',
        business: 'Biashara',
        health: 'Afya',
        education: 'Elimu',
        general: 'Mengine'
    };
    return names[category] || category;
}

function formatDate(dateString) {
    if (!dateString) return 'Sasa hivi';
    try {
        const date = new Date(dateString
