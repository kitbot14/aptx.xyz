const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const fetch = (...args) =>
     import('node-fetch').then(({default: fetch}) => fetch(...args));
const PORT = process.env.PORT || 3000;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1456750598950224088';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'nOjDB59PEg5njdPWfVXuWmakiDb5uC0u';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://aptx.xyz/auth/callback';

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const usersFile = path.join(dataDir, 'users.json');
const postsFile = path.join(dataDir, 'posts.json');
const creatorsFile = path.join(dataDir, 'creators.json');
const commentsFile = path.join(dataDir, 'comments.json');
const badgesFile = path.join(dataDir, 'badges.json');
const supportersFile = path.join(dataDir, 'supporters.json');

function getSessionId(req) {
    const cookie = req.headers.cookie;
    if (!cookie) return null;

    const match = cookie.match(/session=([^;]+)/);
    return match ? match[1] : null;
}

function initDataFiles() {
    if (!fs.existsSync(usersFile)) {
        fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(postsFile)) {
        fs.writeFileSync(postsFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(creatorsFile)) {
        fs.writeFileSync(creatorsFile, JSON.stringify([
            {
                id: "1",
                name: "Ã‰quipe APTx",
                description: "CrÃ©ateurs officiels de la plateforme APTx",
                discordId: "1453078381099876515",
                avatar: "https://i.imgur.com/E6EOPMN.png"
            }
        ], null, 2));
    }
    if (!fs.existsSync(commentsFile)) {
        fs.writeFileSync(commentsFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(badgesFile)) {
        fs.writeFileSync(badgesFile, JSON.stringify({}, null, 2));
    }
    if (!fs.existsSync(supportersFile)) {
        fs.writeFileSync(supportersFile, JSON.stringify([], null, 2));
    }
}

initDataFiles();

const sessions = {};

function readJSON(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

async function fetchDiscordUser(accessToken) {
    const response = await fetch('https://discord.com/api/users/@me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return await response.json();
}

async function exchangeCode(code) {
    const data = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: data,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    return await response.json();
}

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const sessionId = getSessionId(req);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (pathname === '/') {
        const filePath = path.join(__dirname, 'public', 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('404 Not Found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (pathname.startsWith('/public/')) {
        const filePath = path.join(__dirname, pathname);
        const extname = path.extname(filePath);
        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('404 Not Found');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    } else if (pathname === '/auth/discord') {
        const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`;
        res.writeHead(302, { 'Location': discordAuthUrl });
        res.end();
    } else if (pathname === '/auth/callback') {
        const code = query.code;
        if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Erreur: Code manquant</h1>');
            return;
        }

        try {
            const tokenData = await exchangeCode(code);
            if (tokenData.error) {
                throw new Error(tokenData.error_description);
            }

            const discordUser = await fetchDiscordUser(tokenData.access_token);
            const sessionId = generateSessionId();
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

            const user = {
                id: discordUser.id,
                username: discordUser.username,
                avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : 'https://via.placeholder.com/128/1a1a2e/ffffff?text=User',
                ip: ip,
                date: new Date().toISOString()
            };

            sessions[sessionId] = user;

            const users = readJSON(usersFile);
            const existingUserIndex = users.findIndex(u => u.id === user.id);
            if (existingUserIndex >= 0) {
                users[existingUserIndex] = user;
            } else {
                users.push(user);
            }
            writeJSON(usersFile, users);

            res.writeHead(302, {
                'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Secure`,
                'Location': '/'
            });
            res.end();
        } catch (error) {
            console.error('Auth error:', error);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`<h1>Erreur d'authentification: ${error.message}</h1>`);
        }
    } else if (pathname === '/api/user') {
        if (!sessionId || !sessions[sessionId]) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Non authentifiÃ©' }));
            return;
        }

        const badges = readJSON(badgesFile);
        const userBadges = badges[sessions[sessionId].id] || [];

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...sessions[sessionId], badges: userBadges }));
    } else if (pathname === '/api/logout') {
        if (sessionId && sessions[sessionId]) {
            delete sessions[sessionId];
        }
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': 'session=; Path=/; HttpOnly; Max-Age=0; Secure'
        });
        res.end(JSON.stringify({ success: true }));
    } else if (pathname === '/api/stats') {
        const users = readJSON(usersFile);
        const posts = readJSON(postsFile);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            users: users.length,
            posts: posts.length
        }));
    } else if (pathname === '/api/creators') {
        const creators = readJSON(creatorsFile);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(creators));
    } else if (pathname === '/api/supporters') {
        const supporters = readJSON(supportersFile);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(supporters));
    } else if (pathname === '/api/posts') {
        if (req.method === 'GET') {
            const posts = readJSON(postsFile);
            const sortedPosts = posts.sort((a, b) => a.title.localeCompare(b.title));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(sortedPosts));
        } else if (req.method === 'POST') {
            if (!sessionId || !sessions[sessionId]) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Non authentifiÃ©' }));
                return;
            }

            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const postData = JSON.parse(body);
                    const posts = readJSON(postsFile);
                    const newPost = {
                        id: Date.now().toString(),
                        title: postData.title,
                        content: postData.content,
                        author: sessions[sessionId].username,
                        authorId: sessions[sessionId].id,
                        authorAvatar: sessions[sessionId].avatar,
                        date: new Date().toISOString()
                    };

                    posts.push(newPost);
                    writeJSON(postsFile, posts);

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(newPost));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'DonnÃ©es invalides' }));
                }
            });
        }
    } else if (pathname.startsWith('/api/posts/')) {
        const postId = pathname.split('/')[3];

        if (req.method === 'GET') {
            const posts = readJSON(postsFile);
            const post = posts.find(p => p.id === postId);
            if (!post) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Publication non trouvÃ©e' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(post));
        } else if (req.method === 'PUT') {
            if (!sessionId || !sessions[sessionId]) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Non authentifiÃ©' }));
                return;
            }

            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const updateData = JSON.parse(body);
                    const posts = readJSON(postsFile);
                    const postIndex = posts.findIndex(p => p.id === postId);

                    if (postIndex === -1) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Publication non trouvÃ©e' }));
                        return;
                    }

                    if (posts[postIndex].authorId !== sessions[sessionId].id) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Non autorisÃ©' }));
                        return;
                    }

                    posts[postIndex].title = updateData.title;
                    posts[postIndex].content = updateData.content;
                    writeJSON(postsFile, posts);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(posts[postIndex]));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'DonnÃ©es invalides' }));
                }
            });
        } else if (req.method === 'DELETE') {
            if (!sessionId || !sessions[sessionId]) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Non authentifiÃ©' }));
                return;
            }

            const posts = readJSON(postsFile);
            const postIndex = posts.findIndex(p => p.id === postId);

            if (postIndex === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Publication non trouvÃ©e' }));
                return;
            }

            if (posts[postIndex].authorId !== sessions[sessionId].id) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Non autorisÃ©' }));
                return;
            }

            posts.splice(postIndex, 1);
            writeJSON(postsFile, posts);

            const comments = readJSON(commentsFile);
            const filteredComments = comments.filter(c => c.postId !== postId);
            writeJSON(commentsFile, filteredComments);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        }
    } else if (pathname === '/api/comments') {
        if (req.method === 'POST') {
            if (!sessionId || !sessions[sessionId]) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Non authentifiÃ©' }));
                return;
            }

            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const commentData = JSON.parse(body);
                    const comments = readJSON(commentsFile);
                    const newComment = {
                        id: Date.now().toString(),
                        postId: commentData.postId,
                        content: commentData.content,
                        author: sessions[sessionId].username,
                        authorId: sessions[sessionId].id,
                        authorAvatar: sessions[sessionId].avatar,
                        date: new Date().toISOString()
                    };

                    comments.push(newComment);
                    writeJSON(commentsFile, comments);

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(newComment));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'DonnÃ©es invalides' }));
                }
            });
        }
    } else if (pathname.startsWith('/api/comments/')) {
        const postId = pathname.split('/')[3];
        const comments = readJSON(commentsFile);
        const postComments = comments.filter(c => c.postId === postId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(postComments));
    } else {
        const filePath = path.join(__dirname, 'public', '404.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
                return;
            }
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    }
});

server.listen(PORT, () => {
    console.log(`Serveur APTx dÃ©marrÃ© sur le port ${PORT}`);
});
