let currentUser = null;
let allPosts = [];
let displayedPosts = 5;
let currentPostId = null;

const API_BASE = '';

async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/user`, {
            credentials: 'include'
        });

        if (response.ok) {
            currentUser = await response.json();
        } else {
            currentUser = null;
        }

        updateUI();
        return response.ok;
    } catch (error) {
        console.error('Auth check error:', error);
        currentUser = null;
        updateUI();
        return false;
    }
}

function updateUI() {
    const navAuth = document.getElementById('navAuth');
    const authRequired = document.getElementById('authRequired');

    if (currentUser) {
        navAuth.innerHTML = `
            <div class="user-profile">
                <img src="${currentUser.avatar}" alt="${currentUser.username}" class="user-avatar">
                <span class="user-name">${currentUser.username}</span>
                <button class="btn btn-icon" id="settingsBtn" title="Paramètres">
                    <i class="fas fa-cog"></i>
                </button>
            </div>
        `;

        document.getElementById('settingsBtn').addEventListener('click', openSettings);
        authRequired.style.display = 'block';
    } else {
        navAuth.innerHTML = `
            <button class="btn btn-primary" id="loginBtn">
                <i class="fab fa-discord"></i> Connexion Discord
            </button>
        `;

        document.getElementById('loginBtn').addEventListener('click', login);
        authRequired.style.display = 'none';
    }
}

function login() {
    window.location.href = `${API_BASE}/auth/discord`;
}

async function logout() {
    try {
        await fetch(`${API_BASE}/api/logout`, {
            credentials: 'include'
        });
        currentUser = null;
        updateUI();
        closeModal('settingsModal');
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();
        document.getElementById('userCount').textContent = stats.users;
        document.getElementById('postCount').textContent = stats.posts;
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

async function loadCreators() {
    try {
        const response = await fetch(`${API_BASE}/api/creators`);
        const creators = await response.json();
        const grid = document.getElementById('creatorsGrid');

        grid.innerHTML = creators.map(creator => `
            <div class="creator-card">
                <div class="creator-header">
                    <img src="${creator.avatar}" alt="${creator.name}" class="creator-avatar">
                    <div class="creator-info">
                        <h3>${creator.name}</h3>
                        <span class="creator-id">ID: ${creator.discordId}</span>
                    </div>
                </div>
                <p class="creator-description">${creator.description}</p>
                <a href="https://discord.com/users/${creator.discordId}" target="_blank" class="creator-link">
                    <i class="fas fa-external-link-alt"></i> Voir le profil
                </a>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load creators error:', error);
    }
}

async function loadSupporters() {
    try {
        const response = await fetch(`${API_BASE}/api/supporters`);
        const supporters = await response.json();
        const track = document.getElementById('support-track');

        if (!supporters || supporters.length === 0) {
            track.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Aucun soutien pour le moment</p>';
            return;
        }

        const users = [...supporters, ...supporters];

        track.innerHTML = users.map(user => `
            <div class="support-card">
                <img src="${user.avatar}" alt="${user.username}">
                <span>${user.username}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load supporters error:', error);
    }
}

async function loadPosts() {
    try {
        const response = await fetch(`${API_BASE}/api/posts`);
        allPosts = await response.json();
        displayPosts();
    } catch (error) {
        console.error('Load posts error:', error);
    }
}

function displayPosts(searchTerm = '') {
    const grid = document.getElementById('publicationsGrid');
    const loadMoreContainer = document.getElementById('loadMoreContainer');

    let filteredPosts = allPosts;
    if (searchTerm) {
        filteredPosts = allPosts.filter(post =>
            post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    const postsToShow = filteredPosts.slice(0, displayedPosts);

    if (postsToShow.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Aucune publication trouvée</p>';
        loadMoreContainer.style.display = 'none';
        return;
    }

    grid.innerHTML = postsToShow.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <img src="${post.authorAvatar}" alt="${post.author}" class="post-avatar">
                <div class="post-meta">
                    <p class="post-author">${post.author}</p>
                    <p class="post-date">${formatDate(post.date)}</p>
                </div>
            </div>
            <h3 class="post-title">${post.title}</h3>
            <p class="post-preview">${post.content}</p>
        </div>
    `).join('');

    document.querySelectorAll('.post-card').forEach(card => {
        card.addEventListener('click', () => {
            openPostDetail(card.dataset.postId);
        });
    });

    loadMoreContainer.style.display = filteredPosts.length > displayedPosts ? 'block' : 'none';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;

    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function createPost(title, content) {
    try {
        const response = await fetch(`${API_BASE}/api/posts`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, content })
        });

        if (response.ok) {
            await loadPosts();
            await loadStats();
            closeModal('createPostModal');
            showMessage('Publication créée avec succès', 'success');
        } else {
            showMessage('Erreur lors de la création', 'error');
        }
    } catch (error) {
        console.error('Create post error:', error);
        showMessage('Erreur réseau', 'error');
    }
}

async function updatePost(id, title, content) {
    try {
        const response = await fetch(`${API_BASE}/api/posts/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, content })
        });

        if (response.ok) {
            await loadPosts();
            closeModal('editPostModal');
            closeModal('postDetailModal');
            showMessage('Publication modifiée avec succès', 'success');
        } else {
            showMessage('Erreur lors de la modification', 'error');
        }
    } catch (error) {
        console.error('Update post error:', error);
        showMessage('Erreur réseau', 'error');
    }
}

async function deletePost(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette publication ?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/posts/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            await loadPosts();
            await loadStats();
            closeModal('postDetailModal');
            showMessage('Publication supprimée avec succès', 'success');
        } else {
            showMessage('Erreur lors de la suppression', 'error');
        }
    } catch (error) {
        console.error('Delete post error:', error);
        showMessage('Erreur réseau', 'error');
    }
}

async function openPostDetail(postId) {
    currentPostId = postId;
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;

    document.getElementById('detailTitle').textContent = post.title;
    document.getElementById('detailAvatar').src = post.authorAvatar;
    document.getElementById('detailAuthor').textContent = post.author;
    document.getElementById('detailDate').textContent = formatDate(post.date);
    document.getElementById('detailContent').textContent = post.content;

    const postActions = document.getElementById('postActions');
    if (currentUser && currentUser.id === post.authorId) {
        postActions.innerHTML = `
            <button class="btn btn-secondary btn-icon" id="editPostBtn">
                <i class="fas fa-edit"></i> Modifier
            </button>
            <button class="btn btn-danger btn-icon" id="deletePostBtn">
                <i class="fas fa-trash"></i> Supprimer
            </button>
        `;

        document.getElementById('editPostBtn').addEventListener('click', () => openEditModal(post));
        document.getElementById('deletePostBtn').addEventListener('click', () => deletePost(postId));
    } else {
        postActions.innerHTML = '';
    }

    await loadComments(postId);
    openModal('postDetailModal');
}

async function loadComments(postId) {
    try {
        const response = await fetch(`${API_BASE}/api/comments/${postId}`);
        const comments = await response.json();
        const commentsList = document.getElementById('commentsList');

        if (comments.length === 0) {
            commentsList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Aucun commentaire pour le moment</p>';
            return;
        }

        commentsList.innerHTML = comments.map(comment => `
            <div class="comment-card">
                <div class="comment-header">
                    <img src="${comment.authorAvatar}" alt="${comment.author}" class="comment-avatar">
                    <div>
                        <span class="comment-author">${comment.author}</span>
                        <span class="comment-date">${formatDate(comment.date)}</span>
                    </div>
                </div>
                <p class="comment-content">${comment.content}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load comments error:', error);
    }
}

async function addComment(postId, content) {
    try {
        const response = await fetch(`${API_BASE}/api/comments`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ postId, content })
        });

        if (response.ok) {
            await loadComments(postId);
            document.getElementById('commentContent').value = '';
            showMessage('Commentaire ajouté', 'success');
        } else {
            showMessage('Erreur lors de l\'ajout du commentaire', 'error');
        }
    } catch (error) {
        console.error('Add comment error:', error);
        showMessage('Erreur réseau', 'error');
    }
}

function openEditModal(post) {
    document.getElementById('editPostId').value = post.id;
    document.getElementById('editPostTitle').value = post.title;
    document.getElementById('editPostContent').value = post.content;
    openModal('editPostModal');
}

function openSettings() {
    document.getElementById('settingsAvatar').src = currentUser.avatar;
    document.getElementById('settingsUsername').textContent = currentUser.username;
    document.getElementById('settingsId').textContent = currentUser.id;
    document.getElementById('settingsDate').textContent = formatDate(currentUser.date);

    const badgesList = document.getElementById('badgesList');
    if (currentUser.badges && currentUser.badges.length > 0) {
        badgesList.innerHTML = currentUser.badges.map(badge => `
            <div class="badge-item">
                <span class="badge-icon">${badge.icon}</span>
                <span class="badge-label">${badge.label}</span>
            </div>
        `).join('');
    } else {
        badgesList.innerHTML = '<p class="no-badges">Aucun badge pour le moment</p>';
    }

    openModal('settingsModal');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showMessage(text, type) {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${text}</span>
    `;

    document.body.appendChild(message);
    message.style.position = 'fixed';
    message.style.top = '20px';
    message.style.right = '20px';
    message.style.zIndex = '3000';

    setTimeout(() => {
        message.remove();
    }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadStats();
    await loadCreators();
    await loadSupporters();
    await loadPosts();

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('href');
            document.querySelector(target).scrollIntoView({ behavior: 'smooth' });

            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    const createPostBtn = document.getElementById('createPostBtn');
    if (createPostBtn) {
        createPostBtn.addEventListener('click', () => openModal('createPostModal'));
    }

    document.getElementById('closeCreateModal').addEventListener('click', () => closeModal('createPostModal'));
    document.getElementById('cancelCreateBtn').addEventListener('click', () => closeModal('createPostModal'));

    document.getElementById('createPostForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        createPost(title, content);
        e.target.reset();
    });

    document.getElementById('closeDetailModal').addEventListener('click', () => closeModal('postDetailModal'));

    document.getElementById('closeEditModal').addEventListener('click', () => closeModal('editPostModal'));
    document.getElementById('cancelEditBtn').addEventListener('click', () => closeModal('editPostModal'));

    document.getElementById('editPostForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('editPostId').value;
        const title = document.getElementById('editPostTitle').value;
        const content = document.getElementById('editPostContent').value;
        updatePost(id, title, content);
    });

    document.getElementById('closeSettingsModal').addEventListener('click', () => closeModal('settingsModal'));

    document.getElementById('logoutSettingsBtn').addEventListener('click', logout);

    document.getElementById('commentForm').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) {
            showMessage('Vous devez être connecté pour commenter', 'error');
            return;
        }
        const content = document.getElementById('commentContent').value;
        addComment(currentPostId, content);
    });

    document.getElementById('shareBtn').addEventListener('click', () => {
        if (navigator.share) {
            navigator.share({
                title: document.getElementById('detailTitle').textContent,
                text: 'Découvrez cette publication sur APTx',
                url: window.location.href
            });
        } else {
            showMessage('Le partage n\'est pas supporté sur ce navigateur', 'error');
        }
    });

    document.getElementById('copyLinkBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href);
        showMessage('Lien copié dans le presse-papier', 'success');
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            displayedPosts = 5;
            displayPosts(e.target.value);
        });
    }

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            displayedPosts += 5;
            displayPosts();
        });
    }

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
});
