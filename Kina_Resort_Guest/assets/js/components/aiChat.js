// AI Chatbot functionality
// This file handles the AI chat popup and API integration

import { AI_CONFIG, isAPIConfigured, getMockResponse } from '../config/aiConfig.js';
import { fetchWeatherSummary } from '../utils/api.js';

// =============================================================================
// AI CHAT STATE MANAGEMENT
// =============================================================================
let isAIChatOpen = false;
let chatHistory = []; // For display purposes
let apiHistory = []; // Separate history for API context to avoid format conflicts
let isGeneratingResponse = false; // Track if AI is currently generating a response

// Character limits
const MAX_USER_MESSAGE_LENGTH = 500; // Maximum characters for user messages

// =============================================================================
// AI CHAT UI FUNCTIONS
// =============================================================================

// Open AI chat popup
function openAIChat() {
  console.log('Opening AI chat...');
  const chatPopup = document.getElementById('ai-chat-popup');
  const aiButton = document.getElementById('resort-ai');
  const notification = document.getElementById('ai-notification');
  const messagesContainer = document.getElementById('ai-chat-messages');
  
  if (chatPopup) {
    console.log('Chat popup found, showing...');
    chatPopup.style.display = 'flex';
    setTimeout(() => {
      chatPopup.classList.add('show');
      console.log('Chat popup should be visible now');
    }, 10);
    isAIChatOpen = true;
    
    // Hide FAB when chat is open
    if (aiButton) {
      aiButton.classList.add('hidden');
    }
    
    // Hide notification when chat is open
    if (notification) {
      notification.style.display = 'none';
    }

    // Show suggested questions if user hasn't sent any messages yet
    const hasUserMessages = messagesContainer ?
      Array.from(messagesContainer.children).some(child => child.classList.contains('user-message-group')) : false;
    setTimeout(() => {
      if (messagesContainer && !hasUserMessages) {
        showSuggestedQuestions();
      }
    }, 300);
  } else {
    console.error('Chat popup element not found!');
  }
}

// Close AI chat popup
function closeAIChat() {
  console.log('Closing AI chat...');
  const chatPopup = document.getElementById('ai-chat-popup');
  const aiButton = document.getElementById('resort-ai');
  
  if (chatPopup) {
    chatPopup.classList.remove('show');
    setTimeout(() => {
      chatPopup.style.display = 'none';
      console.log('Chat popup hidden');
    }, 300);
    isAIChatOpen = false;
    
    // Show FAB when chat is closed
    if (aiButton) {
      aiButton.classList.remove('hidden');
    }
  } else {
    console.error('Chat popup element not found for closing!');
  }
}

// Handle Enter key press in chat input
function handleAIChatKeypress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendAIMessage();
  }
}

// Auto-resize textarea based on content
function autoResizeTextarea() {
  const input = document.getElementById('ai-chat-input');
  if (input && input.tagName === 'TEXTAREA') {
    input.style.height = 'auto';
    const maxHeight = 120; // ~5 lines
    const newHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = newHeight + 'px';
    input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }
}

// Update character counter and enforce limit
function updateCharacterCounter() {
  const input = document.getElementById('ai-chat-input');
  const counter = document.getElementById('ai-char-counter');
  if (!input || !counter) return;
  const currentLength = input.value.length;
  const remaining = MAX_USER_MESSAGE_LENGTH - currentLength;
  counter.textContent = `${currentLength}/${MAX_USER_MESSAGE_LENGTH}`;
  if (remaining < 50) {
    counter.classList.add('warning');
    counter.classList.remove('error');
  } else if (remaining < 0) {
    counter.classList.add('error');
    counter.classList.remove('warning');
  } else {
    counter.classList.remove('warning', 'error');
  }
  if (currentLength > MAX_USER_MESSAGE_LENGTH) {
    input.value = input.value.substring(0, MAX_USER_MESSAGE_LENGTH);
    autoResizeTextarea();
    updateCharacterCounter();
  }
}

// Enable/disable chat input and send button
function setChatInputEnabled(enabled) {
  const input = document.getElementById('ai-chat-input');
  const sendButton = document.querySelector('.ai-chat-send');
  if (input) {
    input.disabled = !enabled;
    if (input.tagName === 'TEXTAREA') {
      input.style.opacity = enabled ? '1' : '0.6';
      input.style.cursor = enabled ? 'text' : 'not-allowed';
    }
  }
  if (sendButton) {
    sendButton.disabled = !enabled;
    sendButton.style.opacity = enabled ? '1' : '0.6';
    sendButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }
}

// Send message to AI
async function sendAIMessage() {
  console.log('sendAIMessage called');
  if (isGeneratingResponse) {
    console.log('AI is already generating a response, ignoring new message');
    return;
  }
  const input = document.getElementById('ai-chat-input');
  const messagesContainer = document.getElementById('ai-chat-messages');
  
  if (!input || !messagesContainer) {
    console.error('Input or messages container not found');
    return;
  }
  
  const message = input.value.trim();
  if (!message) {
    console.log('No message to send');
    return;
  }
  
  console.log('Sending message:', message);
  
  // Set generating state and disable input
  isGeneratingResponse = true;
  setChatInputEnabled(false);

  // Clear input and reset height
  input.value = '';
  if (input.tagName === 'TEXTAREA') {
    autoResizeTextarea();
  }
  
  // Add user message to chat
  addMessageToChat(message, 'user');
  
  // Show typing indicator
  const typingId = addTypingIndicator();
  
  try {
    console.log('Calling getAIResponse...');
    // Get AI response
    const response = await getAIResponse(message);
    console.log('AI Response received:', response);
    
    // Remove typing indicator
    removeTypingIndicator(typingId);
    
    // Add AI response to chat
    addMessageToChat(response, 'ai');
    
  } catch (error) {
    console.error('AI Chat Error:', error);
    
    // Remove typing indicator
    removeTypingIndicator(typingId);
    
    // Add error message
    addMessageToChat('Sorry, there was an error. Please try again.', 'ai');
  } finally {
    isGeneratingResponse = false;
    setChatInputEnabled(true);
    const input = document.getElementById('ai-chat-input');
    if (input && !input.disabled) input.focus();
  }
}

// Add message to chat interface
function addMessageToChat(message, sender) {
  const messagesContainer = document.getElementById('ai-chat-messages');
  if (!messagesContainer) return;
  
  const messageGroup = document.createElement('div');
  messageGroup.className = `message-group ${sender === 'user' ? 'user-message-group' : 'ai-message-group'}`;
  const avatar = sender === 'user' ? '👤' : '🤖';
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const avatarHTML = sender === 'user' ? '' : `
    <div class="message-avatar">
      <div class="avatar-img">${avatar}</div>
    </div>`;
  const formattedMessage = sender === 'ai' ? formatMessageText(message) : message.replace(/\n/g, '<br>');
  messageGroup.innerHTML = `
    ${avatarHTML}
    <div class="message-bubble ${sender === 'user' ? 'user-message-bubble' : 'ai-message-bubble'}">
      <div class="message-text">
        ${formattedMessage}
      </div>
      <div class="message-time">${currentTime}</div>
    </div>`;
  
  messagesContainer.appendChild(messageGroup);
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Add to display chat history
  chatHistory.push({ message, sender, timestamp: new Date() });
}

// Format message text (markdown-lite to HTML)
function formatMessageText(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const output = [];
  let inList = false;
  let listType = null;
  let listItems = [];
  let inCodeBlock = false;
  let codeBlockContent = [];
  function closeList() {
    if (listItems.length > 0) {
      output.push(`<ul>${listItems.join('')}</ul>`);
      listItems = [];
      inList = false;
      listType = null;
    }
  }
  function closeCodeBlock() {
    if (codeBlockContent.length > 0) {
      output.push(`<pre><code>${codeBlockContent.join('\n')}</code></pre>`);
      codeBlockContent = [];
      inCodeBlock = false;
    }
  }
  function formatInline(s) {
    if (!s || typeof s !== 'string') return '';
    let formatted = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const codeBlocks = [];
    formatted = formatted.replace(/`([^`]+)`/g, (m, c) => {
      const id = `__CODE_${codeBlocks.length}__`;
      codeBlocks.push(`<code>${c}</code>`);
      return id;
    });
    formatted = formatted.replace(/\*\*\*([^*]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    formatted = formatted.replace(/___([^_]+?)___/g, '<strong><em>$1</em></strong>');
    formatted = formatted.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
    formatted = formatted.replace(/~~([^~]+?)~~/g, '<del>$1</del>');
    formatted = formatted.replace(/\+\+([^+]+?)\+\+/g, '<u>$1</u>');
    formatted = formatted.replace(/\*([^*\n<]+?)\*/g, (m, c) => {
      if (m.includes('**') || m.includes('<strong>') || m.includes('<em>') || m.includes('<code>') || m.includes('<del>') || m.includes('<u>')) return m;
      return '<em>' + c + '</em>';
    });
    formatted = formatted.replace(/_([^_\n<]+?)_/g, (m, c) => {
      if (m.includes('__') || m.includes('<strong>') || m.includes('<em>') || m.includes('<code>') || m.includes('<del>') || m.includes('<u>')) return m;
      return '<em>' + c + '</em>';
    });
    codeBlocks.forEach((code, i) => { formatted = formatted.replace(`__CODE_${i}__`, code); });
    return formatted;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) { if (inCodeBlock) { closeCodeBlock(); } else { closeList(); inCodeBlock = true; } continue; }
    if (inCodeBlock) { codeBlockContent.push(line); continue; }
    const trimmed = line.trim();
    if (trimmed === '') { closeList(); closeCodeBlock(); continue; }
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (!inList || listType !== 'ul') { closeList(); inList = true; listType = 'ul'; }
      const content = formatInline(numberedMatch[2]);
      listItems.push(`<li>${content}</li>`);
      continue;
    }
    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList || listType !== 'ul') { closeList(); inList = true; listType = 'ul'; }
      const content = formatInline(bulletMatch[1]);
      listItems.push(`<li>${content}</li>`);
      continue;
    }
    closeList();
    const formattedLine = formatInline(trimmed);
    output.push(`<p>${formattedLine}</p>`);
  }
  closeList();
  closeCodeBlock();
  if (output.length === 0) return '<p></p>';
  let result = output.join('');
  result = result.replace(/(<\/p>)(<[uo]l>)/g, '$1$2');
  result = result.replace(/(<\/[uo]l>)(<p>)/g, '$1$2');
  result = result.replace(/([^<])\*\*\s*$/gm, '$1');
  result = result.replace(/([^<])__\s*$/gm, '$1');
  result = result.replace(/([^<*])\*\s*$/gm, '$1');
  result = result.replace(/([^<_])_\s*$/gm, '$1');
  return result;
}

// Add typing indicator
function addTypingIndicator() {
  const messagesContainer = document.getElementById('ai-chat-messages');
  if (!messagesContainer) return null;
  
  const typingId = 'typing-' + Date.now();
  const typingDiv = document.createElement('div');
  typingDiv.id = typingId;
  typingDiv.className = 'message-group ai-message-group typing-indicator';
  
  typingDiv.innerHTML = `
    <div class="message-avatar">
      <div class="avatar-img">🤖</div>
    </div>
    <div class="message-bubble ai-message-bubble">
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>`;
  
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  return typingId;
}

// Remove typing indicator
function removeTypingIndicator(typingId) {
  if (!typingId) return;
  
  const typingElement = document.getElementById(typingId);
  if (typingElement) {
    typingElement.remove();
  }
}

// Suggested Questions UI
function showSuggestedQuestions() {
  const messagesContainer = document.getElementById('ai-chat-messages');
  if (!messagesContainer) return;
  hideSuggestedQuestions();
  const suggestedContainer = document.createElement('div');
  suggestedContainer.id = 'ai-suggested-questions';
  suggestedContainer.className = 'ai-suggested-questions';
  const questions = [
    'What rooms are available and how much?',
    'Can you recommend the best days to visit this week?',
    'What are the pool hours and entrance fees?',
    'Do you have function halls and rates?',
    'How do I book cottages for a specific date?'
  ];
  suggestedContainer.innerHTML = `
    <div class="suggested-questions-list">
      ${questions.map(q => `
        <button class="suggested-question-button" data-question="${q.replace(/"/g, '&quot;')}">${q}</button>
      `).join('')}
    </div>
  `;
  const buttons = suggestedContainer.querySelectorAll('.suggested-question-button');
  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      const question = this.getAttribute('data-question');
      const input = document.getElementById('ai-chat-input');
      if (input) {
        input.value = question;
        if (input.tagName === 'TEXTAREA') autoResizeTextarea();
        sendAIMessage();
      }
    });
  });
  messagesContainer.appendChild(suggestedContainer);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideSuggestedQuestions() {
  const container = document.getElementById('ai-suggested-questions');
  if (container) container.remove();
}

// =============================================================================
// AI API INTEGRATION
// =============================================================================

// Get AI response from API
async function getAIResponse(userMessage) {
  console.log('Getting AI response for:', userMessage);
  
  // Check if API is configured
  if (!isAPIConfigured()) {
    console.log('API not configured, using mock response');
    return getMockResponse(userMessage);
  }
  
  // Add user message to API history
  apiHistory.push({ role: 'user', content: userMessage });
  
  // Limit history to prevent token overflow
  if (apiHistory.length > AI_CONFIG.MAX_HISTORY * 2) {
    apiHistory = apiHistory.slice(-(AI_CONFIG.MAX_HISTORY * 2));
  }
  
  try {
    console.log('Sending request to OpenRouter API...');
    
    // Build live weather context (Philippines timezone, UTC+8)
    let weatherContext = '';
    try {
      const w = await fetchWeatherSummary();
      if (w && Array.isArray(w.nextDays) && w.nextDays.length) {
        const PH_TZ_OFFSET = 8;
        const now = new Date();
        const phNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + PH_TZ_OFFSET * 3600000);
        const currentDate = phNow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        const lines = w.nextDays.slice(0, 5).map((d, i) => {
          let phDate;
          if (d.fullDate) {
            const [Y, M, D] = d.fullDate.split('-').map(Number);
            phDate = new Date(Date.UTC(Y, M - 1, D) + PH_TZ_OFFSET * 3600000);
          } else {
            phDate = new Date(phNow.getTime() + i * 86400000);
            phDate.setHours(0, 0, 0, 0);
          }
          const dateLabel = i === 0
            ? `Today, ${phDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
            : i === 1
              ? `Tomorrow, ${phDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
              : phDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
          const condition = d.condition || d.c || 'Clear';
          const temp = d.t ?? d.temp ?? '--';
          const hum = (d.humidity != null) ? `, humidity ${d.humidity}%` : '';
          const icon = d.icon ? ` ${d.icon}` : '';
          return `- ${dateLabel}: ${condition}, ${temp}°C${hum}${icon}`;
        }).join('\n');

        weatherContext = `\n\nCURRENT DATE AND WEATHER FORECAST (UTC+8)\nCurrent Date: ${currentDate}\n\n5-Day Forecast:\n${lines}\n\nUse ONLY these dates when recommending best days to visit. Do not invent or calculate dates.`;
      }
    } catch (_) {
      // Continue without weather context on failure
    }

    // Construct full messages array with system prompt and history
    const systemPrompt = AI_CONFIG.SYSTEM_PROMPT + weatherContext;
    const messages = [
      { role: 'system', content: systemPrompt },
      ...apiHistory
    ];
    
    const response = await fetchWithTimeoutAndRetry(
      AI_CONFIG.API_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_CONFIG.API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Kina Resort AI Assistant'
        },
        body: JSON.stringify({
          model: AI_CONFIG.MODEL,
          messages: messages,
          max_tokens: AI_CONFIG.MAX_TOKENS,
          temperature: AI_CONFIG.TEMPERATURE
        })
      },
      { timeoutMs: 15000, retries: 2, backoffMs: 800 }
    );
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('API response data:', data);
    
    const aiResponse = data.choices?.[0]?.message?.content?.trim() || 'No response received.';
    
    // Add assistant response to API history
    apiHistory.push({ role: 'assistant', content: aiResponse });
    
    return aiResponse;
    
  } catch (error) {
    console.error('AI API Error:', error);
    
    // Remove failed user message from history
    apiHistory.pop();
    
    // Graceful fallback for 401 or auth-related errors
    const msg = (error && error.message) ? String(error.message) : '';
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('user not found')) {
      try { return getMockResponse(userMessage); } catch (_) {}
    }
    return `Sorry, there was an error processing your request: ${error.message}. Please try again.`;
  }
}

// Network helper with timeout and retries
async function fetchWithTimeoutAndRetry(url, options, { timeoutMs = 15000, retries = 2, backoffMs = 800 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return resp;
    } catch (err) {
      clearTimeout(timer);
      const isLast = attempt === retries;
      const isAbort = err && err.name === 'AbortError';
      const isNetwork = err && (err.message === 'Failed to fetch' || err.name === 'TypeError');
      if (isLast || (!isAbort && !isNetwork)) throw err;
      await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
    }
  }
}


// =============================================================================
// INITIALIZATION
// =============================================================================

// Initialize AI chat when DOM is loaded
function initializeAIChat() {
  // Only log in debug mode
  if (localStorage.getItem('DEBUG_AI') === 'true') {
    console.log('Initializing AI chat...');
    console.log('AI_CONFIG:', AI_CONFIG);
    console.log('isAPIConfigured():', isAPIConfigured());
  }
  
  // Add click event to AI button
  const aiButton = document.getElementById('resort-ai');
  if (aiButton) {
    if (localStorage.getItem('DEBUG_AI') === 'true') {
      console.log('AI button found, adding click handler');
    }
    // Remove any existing onclick handlers
    aiButton.removeAttribute('onclick');
    aiButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('AI button clicked, isAIChatOpen:', isAIChatOpen);
      if (isAIChatOpen) {
        closeAIChat();
      } else {
        openAIChat();
      }
    });
  } else {
    console.error('AI button not found!');
  }
  
  // Prevent chat popup from closing when clicking inside it
  const chatPopup = document.getElementById('ai-chat-popup');
  if (chatPopup) {
    chatPopup.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }
  
  // Close chat when clicking outside of it
  document.addEventListener('click', function(e) {
    if (isAIChatOpen && chatPopup && !chatPopup.contains(e.target) && !aiButton.contains(e.target)) {
      closeAIChat();
    }
  });
  
  // Enable middle mouse scrolling for chat messages anywhere in the modal
  const messagesContainer = document.getElementById('ai-chat-messages');
  if (messagesContainer && chatPopup) {
    let lastY = 0;
    let isScrolling = false;
    
    const mousedownHandler = (e) => {
      if (e.button === 1) {
        e.preventDefault();
        isScrolling = true;
        lastY = e.clientY;
      }
    };
    
    const mousemoveHandler = (e) => {
      if (isScrolling && e.buttons === 4) {
        e.preventDefault();
        const deltaY = lastY - e.clientY;
        messagesContainer.scrollTop += deltaY * 2;
        lastY = e.clientY;
      }
    };
    
    const mouseupHandler = (e) => {
      if (e.button === 1) {
        isScrolling = false;
      }
    };
    
    // Attach to both the messages container and the entire popup
    messagesContainer.addEventListener('mousedown', mousedownHandler);
    chatPopup.addEventListener('mousedown', mousedownHandler);
    document.addEventListener('mousemove', mousemoveHandler);
    document.addEventListener('mouseup', mouseupHandler);
  }
  
  // CSS is now handled in the main stylesheet
}

// Test API connection function
async function testAPIConnection() {
  if (!isAPIConfigured()) {
    console.log('API not configured, skipping test');
    return;
  }
  
  try {
    console.log('Testing API connection...');
    const response = await fetch(AI_CONFIG.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: AI_CONFIG.SYSTEM_PROMPT },
          { role: 'user', content: 'Hello, this is a test.' }
        ]
      })
    });
    
    console.log('Test response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API connection successful!', data);
    } else {
      const errorText = await response.text();
      console.log('❌ API connection failed:', response.status, errorText);
    }
  } catch (error) {
    console.log('❌ API connection error:', error.message);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeAIChat);

// Also try to initialize after a short delay in case DOMContentLoaded already fired
setTimeout(initializeAIChat, 100);

// Test API connection after a delay
setTimeout(testAPIConnection, 500);

// Minimize AI chat
function minimizeAIChat() {
  console.log('Minimizing AI chat...');
  closeAIChat();
}

// Export functions for global access
window.openAIChat = openAIChat;
window.closeAIChat = closeAIChat;
window.minimizeAIChat = minimizeAIChat;
window.handleAIChatKeypress = handleAIChatKeypress;
window.sendAIMessage = sendAIMessage;