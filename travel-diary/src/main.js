import './style.css';
import { auth, db } from './firebase.js';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, onSnapshot } from "firebase/firestore";

document.addEventListener('DOMContentLoaded', () => {
    // --- Cloudinary Configuration ---
    const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
    const API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET;
    const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
    const UPLOAD_PRESET = "traveldiary";

    const loginScreen = document.getElementById('loginScreen');
    const guestBtn = document.getElementById('guestBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
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

    // Memories will be loaded from Firestore when auth state validates

    // Determine whether we are currently in detail-view
    function isDetailViewOpen() {
        return viewModal && viewModal.style.display === 'block';
    }

    // Load initial theme even before login
    applyGlobalTheme();

    // --- Auth Logic ---
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            const errorDiv = document.getElementById('loginError');
            function showError(msg) {
                if (errorDiv) {
                    errorDiv.textContent = msg;
                    errorDiv.style.display = 'block';
                } else {
                    alert(msg);
                }
            }

            if (errorDiv) errorDiv.style.display = 'none';

            googleLoginBtn.disabled = true;
            const originalContent = googleLoginBtn.innerHTML;
            googleLoginBtn.innerHTML = 'Signing in...';

            try {
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error("Google Auth error:", error);
                if (error.code === 'auth/operation-not-allowed') {
                    showError("Please enable Google Authentication in the Firebase Console!");
                } else if (error.message.includes('Need to provide options')) {
                    showError("Firebase config error! Please restart your Vite server in the terminal.");
                } else {
                    showError("Sign in error: " + error.message);
                }
            } finally {
                googleLoginBtn.disabled = false;
                googleLoginBtn.innerHTML = originalContent;
            }
        });
    }

    function showApp() {
        loginScreen.style.display = 'none';
        appScreen.style.display = 'block';
        userPic.src = currentUser.picture;
        userNameDisplay.textContent = currentUser.name;
        applyGlobalTheme();
    }

    function showLogin() {
        loginScreen.style.display = 'flex';
        appScreen.style.display = 'none';
    }

    signOutBtn.addEventListener('click', async () => {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error("Sign out error", error);
        }
    });

    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            alert("Guest mode relies on Firebase Auth anonymous login or is unsupported. Disabling local guest for now.");
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = {
                id: user.uid,
                name: user.email.split('@')[0],
                email: user.email,
                picture: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
            };
            showApp();
            listenToMemories();
        } else {
            currentUser = null;
            showLogin();
        }
    });

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

            if (!thumbnailFile) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Memory';
                return;
            }

            // Generate a local preview URL to instantly extract palette without waiting for Cloudinary
            const localObjURL = URL.createObjectURL(thumbnailFile);

            // Run Cloudinary upload and Palette extraction in parallel for max speed
            const [thumbnailURL, palette] = await Promise.all([
                uploadToCloudinary(thumbnailFile),
                extractPalette(localObjURL)
            ]);
            URL.revokeObjectURL(localObjURL);

            if (!thumbnailURL) throw new Error("Upload failed");

            const newEntry = {
                userId: currentUser.id,
                title,
                memory: memoryText,
                thumbnail: thumbnailURL,
                palette,
                media: [],
                date: new Date().toLocaleDateString(),
                timestamp: Date.now()
            };

            // Wait for Firestore to confirm the document has been added
            const addPromise = addDoc(collection(db, "memories"), newEntry);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore timeout! Did you click 'Create Database' in Firestore?")), 12000));
            await Promise.race([addPromise, timeoutPromise]);

            // Only close and reset if the upload was successful
            entryForm.reset();
            entryModal.style.display = 'none';

        } catch (error) {
            console.error("Upload Error:", error);
            if (error.message && error.message.includes('Firestore timeout')) {
                alert("Upload failed because your Firestore Database isn't created yet!\n\nPlease go to Firebase Console -> 'Firestore Database' -> Click 'Create database' to enable storage.");
            } else {
                alert("Upload failed: " + error.message);
            }
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

        const memoryDocRef = doc(db, "memories", currentViewingId);
        await updateDoc(memoryDocRef, { media: memories[memoryIndex].media });

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

            const memoryDocRef = doc(db, "memories", m.id);
            await updateDoc(memoryDocRef, {
                memory: m.memory,
                title: m.title,
                thumbnail: m.thumbnail,
                palette: m.palette
            });

            editBtn.textContent = "Edit Memory";
            editBtn.style.background = "rgba(255,255,255,0.2)";
            editBtn.style.color = "inherit";
            changeCoverBtn.style.display = "none";
            headerTitle.contentEditable = "false";

            renderDetailView(m);
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

    let unsubscribeMemories = null;

    function listenToMemories() {
        if (!currentUser) return;
        const q = query(collection(db, "memories"), where("userId", "==", currentUser.id));

        if (unsubscribeMemories) unsubscribeMemories();

        unsubscribeMemories = onSnapshot(q, (snapshot) => {
            memories = snapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }));
            memories.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            renderMemories();

            if (isDetailViewOpen() && currentViewingId) {
                const openMemory = memories.find(m => m.id === currentViewingId);
                if (openMemory && !isEditing) renderDetailView(openMemory);
            }
        });
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
                <div class="entry-card" ${style} onclick="viewMemory('${m.id}')">
                    <img src="${m.thumbnail}" alt="${m.title}" class="entry-media">
                    <div class="entry-content">
                        <h3 class="entry-title">${m.title}</h3>
                        <p class="entry-memory">${m.memory}</p>
                        <div style="margin-top: 1rem; font-size: 0.8rem; opacity: 0.7; display: flex; justify-content: space-between; align-items: center;">
                            <span>${m.date}</span>
                            <button onclick="event.stopPropagation(); deleteMemory('${m.id}')" style="background: none; border: none; color: inherit; cursor: pointer; font-weight: 600; text-decoration: underline;">Remove</button>
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

    window.removeGalleryItem = async (index) => {
        const m = memories.find(item => item.id === currentViewingId);
        if (m) {
            m.media.splice(index, 1);
            const memoryDocRef = doc(db, "memories", m.id);
            await updateDoc(memoryDocRef, { media: m.media });
            renderDetailView(m);
        }
    };

    window.deleteMemory = async (id) => {
        if (confirm('Permanently delete this memory?')) {
            await deleteDoc(doc(db, "memories", id));
            if (currentViewingId === id) {
                viewModal.style.display = 'none';
                currentViewingId = null;
                applyGlobalTheme();
            }
        }
    };

    function extractPalette(imgSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            // Don't apply crossOrigin to local object URLs or it trips canvas tainted checks
            if (!imgSrc.startsWith('blob:')) {
                img.crossOrigin = "anonymous";
            }

            img.onload = () => {
                try {
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
                } catch (e) {
                    console.warn("Canvas palette extraction failed:", e);
                    resolve({ bg: `rgba(0, 0, 0, 0.05)`, text: '#2d3436' });
                }
            };

            img.onerror = () => {
                console.warn("Image load failed for palette extraction.");
                resolve({ bg: `rgba(0, 0, 0, 0.05)`, text: '#2d3436' });
            };

            img.src = imgSrc;
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
