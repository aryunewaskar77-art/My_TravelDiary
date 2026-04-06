document.addEventListener('DOMContentLoaded', () => {
    // --- Cloudinary Configuration ---
    const CLOUD_NAME = "de2fnmuru";
    const API_KEY = "161441488381925";
    const API_SECRET = "78vczjITlrj6M957mJlMcMyHtQ8";
    const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
    const UPLOAD_PRESET = "your_upload_preset";

    const loginScreen = document.getElementById('loginScreen');
    const guestBtn = document.getElementById('guestBtn');
    const customLoginForm = document.getElementById('customLoginForm');
    const appScreen = document.getElementById('appScreen');
    const addEntryBtn = document.getElementById('addEntryBtn');
    const entryModal = document.getElementById('entryModal');
    const closeBtn = document.querySelector('.close');
    const entryForm = document.getElementById('entryForm');
    const diaryEntries = document.getElementById('diaryEntries');

    // Auth Elements
    const userProfile = document.getElementById('userProfile');
    const userPic = document.getElementById('userPic');
    const userNameDisplay = document.getElementById('userName');
    const signOutBtn = document.getElementById('signOutBtn');

    // Detail Page Elements
    const viewModal = document.getElementById('viewModal');
    const backBtn = document.querySelector('.back-btn');
    const detailContent = document.getElementById('detailContent');
    const inlineMediaInput = document.getElementById('inlineMedia');
    const editBtn = document.getElementById('editBtn');
    const changeCoverBtn = document.getElementById('changeCoverBtn');
    const changeCoverInput = document.getElementById('changeCoverInput');

    // Theme Elements
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeMenu = document.getElementById('themeMenu');
    const themeOptions = document.querySelectorAll('.theme-option');

    let memories = [];
    let currentViewingId = null;
    let currentUser = null;
    let isEditing = false;
    let pendingThumbnail = null;

    try {
        memories = JSON.parse(localStorage.getItem('travelMemories')) || [];
    } catch (e) {
        memories = [];
    }

    // Determine whether we are currently in detail-view
    function isDetailViewOpen() {
        return viewModal && viewModal.style.display === 'block';
    }

    // Load initial theme even before login
    applyGlobalTheme();

    // --- Auth Logic ---
    if (customLoginForm) {
        customLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPassword').value.trim();

            if (!email.endsWith('@gmail.com')) {
                alert("Email must end with @gmail.com");
                return;
            }

            if (pass !== email) {
                alert("Password must be exactly the same as your Email ID.");
                return;
            }

            // Successful custom "auth"
            currentUser = {
                id: email,
                name: email.split('@')[0],
                email: email,
                picture: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
        });
    }

    function showApp() {
        loginScreen.style.display = 'none';
        appScreen.style.display = 'block';
        userPic.src = currentUser.picture;
        userNameDisplay.textContent = currentUser.name;
        applyGlobalTheme(); // Ensure user-specific theme is applied
        renderMemories();
    }

    function showLogin() {
        loginScreen.style.display = 'flex';
        appScreen.style.display = 'none';
        // We keep the last theme on the login screen for consistency
    }

    signOutBtn.addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem('currentUser');
        showLogin();
    });

    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            currentUser = {
                id: 'guest_user',
                name: 'Guest Explorer',
                email: 'guest@example.com',
                picture: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
        });
    }

    // Check existing session
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showApp();
    } else {
        showLogin();
    }

    // --- Theme Logic ---
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isVisible = themeMenu.style.display === 'flex';
            themeMenu.style.display = isVisible ? 'none' : 'flex';
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!themeToggleBtn.contains(e.target) && !themeMenu.contains(e.target)) {
                themeMenu.style.display = 'none';
            }
        });

        themeOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                const theme = opt.dataset.theme;
                // If detail view is open, apply theme per-card; otherwise apply globally
                if (isDetailViewOpen() && currentViewingId) {
                    setTheme(theme, currentViewingId);
                } else {
                    setTheme(theme);
                }
                themeMenu.style.display = 'none';
            });
        });
    }

    function setTheme(themeName, cardId) {
        // Remove all theme classes first
        document.body.className = '';
        if (themeName !== 'default') {
            document.body.classList.add(`theme-${themeName}`);
        }

        if (cardId) {
            // Per-card theme — save keyed by card id
            localStorage.setItem(`card_theme_${cardId}`, themeName);
        } else {
            // Global theme
            localStorage.setItem('global_last_theme', themeName);
            // Also save to user-specific if logged in
            if (currentUser) {
                localStorage.setItem(`theme_${currentUser.email}`, themeName);
            }
        }
    }

    function applyGlobalTheme() {
        let themeToApply = 'default';

        if (currentUser) {
            themeToApply = localStorage.getItem(`theme_${currentUser.email}`) || localStorage.getItem('global_last_theme') || 'default';
        } else {
            themeToApply = localStorage.getItem('global_last_theme') || 'default';
        }

        setTheme(themeToApply);
    }

    // --- Core Diary Logic ---
    addEntryBtn.addEventListener('click', () => entryModal.style.display = 'block');
    closeBtn.addEventListener('click', () => entryModal.style.display = 'none');

    backBtn.addEventListener('click', () => {
        viewModal.style.display = 'none';
        currentViewingId = null;
        isEditing = false;
        pendingThumbnail = null;
        // Restore the global theme when leaving detail view
        applyGlobalTheme();
    });

    entryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = entryForm.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading to Cloud...';

        try {
            const title = document.getElementById('title').value;
            const memoryText = document.getElementById('memory').value;
            const thumbnailFile = document.getElementById('media').files[0];

            if (!thumbnailFile) return;

            // Upload to Cloudinary
            const thumbnailURL = await uploadToCloudinary(thumbnailFile);
            if (!thumbnailURL) throw new Error("Upload failed");

            const palette = await extractPalette(thumbnailURL);

            const newEntry = {
                id: Date.now(),
                userId: currentUser.id,
                title,
                memory: memoryText,
                thumbnail: thumbnailURL,
                palette,
                media: [],
                date: new Date().toLocaleDateString()
            };

            memories.unshift(newEntry);
            saveMemories();
            renderMemories();

            entryForm.reset();
            entryModal.style.display = 'none';
        } catch (error) {
            console.error(error);
            alert("Upload failed. Please check your Cloudinary configuration.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Memory';
        }
    });

    // Inline Media Addition
    inlineMediaInput.addEventListener('change', async (e) => {
        if (!currentViewingId) return;
        const files = e.target.files;
        const memoryIndex = memories.findIndex(m => m.id === currentViewingId);

        for (let file of files) {
            const url = await uploadToCloudinary(file);
            if (!url) continue;
            const type = file.type.startsWith('video') ? 'video' : 'image';
            memories[memoryIndex].media.push({ data: url, type });
        }

        saveMemories();
        renderDetailView(memories[memoryIndex]);
        inlineMediaInput.value = '';
    });

    // --- EDIT LOGIC ---
    editBtn.addEventListener('click', async () => {
        isEditing = !isEditing;
        const m = memories.find(item => item.id === currentViewingId);
        if (!m) return;

        const headerTitle = document.querySelector('.detail-header h1');

        if (isEditing) {
            editBtn.textContent = "Save Changes";
            editBtn.style.background = "var(--accent)";
            editBtn.style.color = "white";
            changeCoverBtn.style.display = "block";
            headerTitle.contentEditable = "true";
            renderEditMode(m);
        } else {
            const textarea = document.getElementById('editArea');
            m.memory = textarea.value;
            m.title = headerTitle.textContent;

            if (pendingThumbnail) {
                m.thumbnail = pendingThumbnail.data;
                m.palette = pendingThumbnail.palette;
                pendingThumbnail = null;
            }

            saveMemories();
            editBtn.textContent = "Edit Memory";
            editBtn.style.background = "rgba(255,255,255,0.2)";
            editBtn.style.color = "inherit";
            changeCoverBtn.style.display = "none";
            headerTitle.contentEditable = "false";

            renderDetailView(m);
            renderMemories();
        }
    });

    changeCoverBtn.addEventListener('click', () => changeCoverInput.click());

    changeCoverInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        changeCoverBtn.textContent = "Uploading...";
        const url = await uploadToCloudinary(file);
        if (!url) {
            changeCoverBtn.textContent = "Change Cover";
            return;
        }

        const palette = await extractPalette(url);
        pendingThumbnail = { data: url, palette };

        // Update visual preview immediately
        const header = document.querySelector('.detail-header');
        header.style.backgroundImage = `url('${url}')`;

        // Update temporary theme
        const modalContent = viewModal.querySelector('.modal-content');
        modalContent.style.setProperty('--card-bg', palette.bg.replace('0.12', '0.05'));
        modalContent.style.setProperty('--card-text', palette.text);

        changeCoverBtn.textContent = "Change Cover";
    });

    async function uploadToCloudinary(file) {
        if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
            console.warn("Cloudinary not configured. Falling back to local Base64.");
            return await toBase64(file);
        }

        const timestamp = Math.round((new Date).getTime() / 1000);
        const folder = `travelDiary/${currentUser.email}`;

        // Generate signature for secure upload
        const strToSign = `folder=${folder}&timestamp=${timestamp}&upload_preset=${UPLOAD_PRESET}${API_SECRET}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(strToSign);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', API_KEY);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);
        formData.append('folder', folder);
        formData.append('upload_preset', UPLOAD_PRESET);

        try {
            const response = await fetch(CLOUDINARY_URL, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (!response.ok) {
                console.warn("Cloudinary upload failed:", data.error?.message);
                console.warn("Falling back to local Base64 storage...");
                return await toBase64(file);
            }

            return data.secure_url;
        } catch (error) {
            console.error("Cloudinary request error:", error);
            console.warn("Falling back to local Base64 storage due to network error...");
            return await toBase64(file);
        }
    }

    function renderEditMode(m) {
        const textElement = document.getElementById('memoryText');
        textElement.innerHTML = `<textarea id="editArea" class="edit-textarea">${m.memory}</textarea>`;
    }

    function saveMemories() {
        localStorage.setItem('travelMemories', JSON.stringify(memories));
    }

    function renderMemories() {
        // Maps per-card theme names to card background/text colors
        const CARD_THEME_STYLES = {
            'tropical': { bg: '#E6FFFB', text: '#023047' },
            'mountain': { bg: '#EAF4F4', text: '#081C15' },
            'city': { bg: '#0F172A', text: '#E5E7EB' },
            'beach-sunset': { bg: '#FFF1E6', text: '#3A2E2A' },
        };

        const userMemories = memories.filter(m => m.userId === currentUser.id);

        if (userMemories.length === 0) {
            diaryEntries.innerHTML = `<div class="empty-state"><p>Welcome ${currentUser.name}! Start by recording your first adventure.</p></div>`;
            return;
        }

        diaryEntries.innerHTML = userMemories.map(m => {
            const savedTheme = localStorage.getItem(`card_theme_${m.id}`);
            const themed = savedTheme && savedTheme !== 'default' ? CARD_THEME_STYLES[savedTheme] : null;
            const bg = themed ? themed.bg : m.palette.bg;
            const text = themed ? themed.text : m.palette.text;
            const style = `style="--card-bg: ${bg}; --card-text: ${text};"`;
            return `
                <div class="entry-card" ${style} onclick="viewMemory(${m.id})">
                    <img src="${m.thumbnail}" alt="${m.title}" class="entry-media">
                    <div class="entry-content">
                        <h3 class="entry-title">${m.title}</h3>
                        <p class="entry-memory">${m.memory}</p>
                        <div style="margin-top: 1rem; font-size: 0.8rem; opacity: 0.7; display: flex; justify-content: space-between; align-items: center;">
                            <span>${m.date}</span>
                            <button onclick="event.stopPropagation(); deleteMemory(${m.id})" style="background: none; border: none; color: inherit; cursor: pointer; font-weight: 600; text-decoration: underline;">Remove</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.viewMemory = (id) => {
        const m = memories.find(item => item.id === id);
        if (!m) return;
        currentViewingId = id;
        isEditing = false;
        pendingThumbnail = null;
        editBtn.textContent = "Edit Memory";
        changeCoverBtn.style.display = "none";
        renderDetailView(m);
        viewModal.style.display = 'block';

        // Apply this card's saved theme (falls back to default)
        const cardTheme = localStorage.getItem(`card_theme_${id}`) || 'default';
        setTheme(cardTheme, id);
    };

    function renderDetailView(m) {
        const modalContent = viewModal.querySelector('.modal-content');
        modalContent.style.setProperty('--card-bg', m.palette.bg.replace('0.12', '0.05'));
        modalContent.style.setProperty('--card-text', m.palette.text);

        detailContent.innerHTML = `
            <div class="detail-header" style="background-image: url('${m.thumbnail}')">
                <h1>${m.title}</h1>
            </div>
            <div class="detail-body">
                <div id="memoryText" class="detail-memory-text">${m.memory}</div>
                <div class="media-gallery">
                    ${m.media.map((file, idx) => `
                        <div style="position: relative;">
                            ${file.type === 'video'
                ? `<video src="${file.data}" controls class="gallery-item"></video>`
                : `<img src="${file.data}" class="gallery-item" alt="memory">`
            }
                            <button onclick="removeGalleryItem(${idx})" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer;">&times;</button>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 3rem; opacity: 0.6; font-size: 0.9rem;">Recorded on ${m.date}</div>
            </div>
        `;
    }

    window.removeGalleryItem = (index) => {
        const m = memories.find(item => item.id === currentViewingId);
        if (m) {
            m.media.splice(index, 1);
            saveMemories();
            renderDetailView(m);
        }
    };

    window.deleteMemory = (id) => {
        if (confirm('Permanently delete this memory?')) {
            memories = memories.filter(m => m.id !== id);
            saveMemories();
            renderMemories();
        }
    };

    function extractPalette(imgSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // Important for external Cloudinary images
            img.src = imgSrc;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 10; canvas.height = 10;
                ctx.drawImage(img, 0, 0, 10, 10);
                const pixels = ctx.getImageData(0, 0, 10, 10).data;
                let r = 0, g = 0, b = 0;
                for (let i = 0; i < pixels.length; i += 4) {
                    r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2];
                }
                const count = pixels.length / 4;
                r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
                resolve({ bg: `rgba(${r}, ${g}, ${b}, 0.12)`, text: '#2d3436' });
            };
        });
    }

    function toBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
});
