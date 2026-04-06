const authLink = document.getElementById('authLink');
authLink.href = "https://enter.pollinations.ai/authorize?redirect_uri=" + encodeURIComponent(window.location.href);

async function loadImageModels() {
    try {
        const res = await fetch('https://enter.pollinations.ai/api/generate/image/models');
        const models = await res.json();
        
        const select = document.getElementById('modelSelect');
        select.innerHTML = '';
        
        const imageModels = models.filter(m => m.output_modalities.includes('image'));
        
        imageModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = `${model.description}`;
            select.appendChild(option);
        });
        
        const fluxOption = Array.from(select.options).find(opt => opt.value === 'flux');
        if (fluxOption) select.value = 'flux';
        
    } catch (e) {
        console.error('Failed to load image models:', e);
    }
}

function initAuth() {
    if(window.location.hash.includes('key=plln_sk_')) {
        const key = window.location.hash.split('key=')[1].split('&')[0];
        localStorage.setItem('plln_key', key);
        window.history.replaceState(null, null, window.location.pathname);
    }
    const saved = localStorage.getItem('plln_key');
    if(saved) document.getElementById('apiKeyInput').value = saved;
}

document.getElementById('apiKeyInput').addEventListener('change', (e) => {
    localStorage.setItem('plln_key', e.target.value);
});

initAuth();
loadImageModels();

async function generateQuote() {
    const key = localStorage.getItem('plln_key');
    if(!key) { alert('You need an API Key. Click "Get Key".'); return; }

    const textModel = document.getElementById('textModelSelect').value;
    const imgModel = document.getElementById('modelSelect').value;
    const style = document.getElementById('styleSelect').value;
    const authorQuery = document.getElementById('authorInput').value.trim();
    const btn = document.getElementById('mainBtn');
    const randomSeed = Math.floor(Math.random() * 1000000);

    btn.disabled = true;
    
    const recentAuthors = JSON.parse(localStorage.getItem('recentAuthors') || '[]');
    
    const userMsg = authorQuery ? `Searching for a quote from "${authorQuery}"...` : "Searching for a random thought...";
    addMsg(userMsg, 'user-msg');
    
    const loadingTextId = addMsg(`🧠 Consulting with ${textModel.toUpperCase()}...`, 'ai-msg loading-status');

    const systemPrompt = `You are an expert historian and graphic designer.
TASK: 
1. Select a famous quote in ENGLISH. If the user specifies an author, it MUST be from that author.
2. Identify the correct author name.
3. Reply with the Quote and the Author in English text.
4. DIVERSITY REQUIREMENT: Choose authors from a rotating pool. Examples include:
   - Philosophy: Aristotle, Plato, Socrates, Seneca, Marcus Aurelius, Confucius, Lao Tzu
   - Literature: Shakespeare, Oscar Wilde, Mark Twain, Jane Austen, Ernest Hemingway, Leo Tolstoy, Fyodor Dostoevsky, Gabriel García Márquez, Jorge Luis Borges, Pablo Neruda
   - Science: Albert Einstein, Isaac Newton, Stephen Hawking, Marie Curie, Nikola Tesla, Charles Darwin
   - Art & Music: Vincent van Gogh, Frida Kahlo, Pablo Picasso, Beethoven, Mozart
   - Politics & Leadership: Nelson Mandela, Martin Luther King Jr., Winston Churchill, Abraham Lincoln, Mahatma Gandhi
   - Business & Motivation: Steve Jobs, Warren Buffett, Elon Musk, Jack Ma, Oprah Winfrey
   - Sports: Muhammad Ali, Michael Jordan, Serena Williams, Lionel Messi
   - General Wisdom: Anonymous proverbs, traditional sayings from various cultures
   ${recentAuthors.length > 0 ? `5. RECENT AUTHORS TO AVOID: Do NOT use any of these authors (used recently): ${recentAuthors.join(', ')}` : ''}
5. Include a Markdown image link using this EXACT structure:
![image](https://enter.pollinations.ai/api/generate/image/{description}?width=1024&height=1024&model=${imgModel}&seed=${randomSeed}&key=${key})

IMPORTANT FOR THE DESCRIPTION (in English):
- The image MUST be a portrait of the specific author.
- Description: "A ${style} portrait of the author [AUTHOR NAME]. Overlay the English text '${'{QUOTE}'}' and the name '${'{AUTHOR}'}' in artistic typography integrated into the scene."`;

    try {
        const req = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + key 
            },
            body: JSON.stringify({ 
                model: textModel,
                messages: [
                    { role: "system", content: systemPrompt }, 
                    { role: "user", content: authorQuery ? `Give me a quote from: ${authorQuery}` : "Generate a quote from a random famous author." }
                ],
                temperature: 1.0
            })
        });
        
        const res = await req.json();
        document.getElementById(loadingTextId).remove();
        
        if(res.error) throw new Error(res.error.message);

        const reply = res.choices[0].message.content;
        
        const authorMatch = reply.match(/(?:—|by|from|attributed to)\s+([A-Za-zÀ-ÿ\s\.]+?)(?:\n|$|\.)/i);
        if (authorMatch) {
            const authorName = authorMatch[1].trim();
            let recent = JSON.parse(localStorage.getItem('recentAuthors') || '[]');
            recent = recent.filter(a => a !== authorName);
            recent.unshift(authorName);
            recent = recent.slice(0, 10);
            localStorage.setItem('recentAuthors', JSON.stringify(recent));
        }
        
        addMsg(reply, 'ai-msg');

        const loadingImgId = addMsg(`🎨 Designing the poster... please wait.`, 'ai-msg loading-status');
        
        setTimeout(() => {
            const el = document.getElementById(loadingImgId);
            if(el) el.remove();
            btn.disabled = false;
        }, 6000);

    } catch(e) {
        const errEl = document.getElementById(loadingTextId);
        if(errEl) errEl.innerText = "Error: " + e.message;
        btn.disabled = false;
    }
}

async function downloadImage(url, filename, btn) {
    if (!btn) btn = event.currentTarget;
    const originalText = btn.innerText;
    btn.innerText = "⏳ Processing...";
    btn.disabled = true;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        btn.innerText = "✅ Saved!";
    } catch (error) {
        console.warn('Download failed:', error);
        
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        btn.innerText = "⬇️ Open in New Tab";
    } finally {
        btn.disabled = false;
        setTimeout(() => { btn.innerText = originalText; }, 3000);
    }
}

function addMsg(txt, cls) {
    const d = document.createElement('div');
    const id = 'msg-' + Math.random().toString(16).slice(2);
    d.id = id;
    d.className = 'msg ' + cls;
    
    const imgRegex = /!\[(.*?)\]\((.*?)\)/;
    const match = txt.match(imgRegex);

    if(match) {
        const parts = txt.split(match[0]);
        const imgSrc = match[2];
        const fileName = `poster-ai-${Date.now()}.png`;

        d.innerHTML = `
            ${parts[0] ? `<div>${parts[0].replace(/\n/g, '<br>')}</div>` : ''}
            <div class="image-container">
                <img src="${imgSrc}" alt="AI Poster" crossorigin="anonymous">
                <button class="download-btn" id="dl-btn-${Date.now()}">⬇ Save Poster</button>
            </div>
            ${parts[1] ? `<div>${parts[1].replace(/\n/g, '<br>')}</div>` : ''}
        `;
        
        d.querySelector('.download-btn').addEventListener('click', function() {
            downloadImage(imgSrc, fileName, this);
        });
    } else {
        d.innerHTML = txt.replace(/\n/g, '<br>');
    }
    
    const box = document.getElementById('msgs');
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return id; 
}
