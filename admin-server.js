#!/usr/bin/env node

/**
 * PRESTIGE POINTS — Admin Server
 * Run locally: node admin-server.js
 * Opens admin panel at http://localhost:3457
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3457;
const DATA_FILE = path.join(__dirname, 'data', 'points.json');
const PROJECT_DIR = __dirname;

// --- Helpers ---
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const initial = { people: {}, events: [] };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
}

function readBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => resolve(body));
    });
}

function jsonResponse(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
}

function serveFile(res, filePath, contentType) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
}

function runGit(cmd) {
    try {
        const output = execSync(cmd, { cwd: PROJECT_DIR, encoding: 'utf-8', timeout: 15000 });
        return { success: true, output: output.trim() };
    } catch (e) {
        return { success: false, output: e.stderr || e.message };
    }
}

// --- Server ---
const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // --- Serve static files ---
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/admin.html')) {
        serveFile(res, path.join(__dirname, 'admin.html'), 'text/html');
        return;
    }
    if (req.method === 'GET' && url.pathname === '/admin-styles.css') {
        serveFile(res, path.join(__dirname, 'admin-styles.css'), 'text/css');
        return;
    }

    // --- API: Get all data ---
    if (req.method === 'GET' && url.pathname === '/api/data') {
        jsonResponse(res, 200, loadData());
        return;
    }

    // --- API: Add person ---
    if (req.method === 'POST' && url.pathname === '/api/person') {
        const body = JSON.parse(await readBody(req));
        const data = loadData();
        const id = body.id.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!id) return jsonResponse(res, 400, { error: 'Invalid ID' });
        data.people[id] = { name: body.name, avatar: body.avatar || '👤' };
        saveData(data);
        jsonResponse(res, 200, { success: true, message: `Added ${body.name}` });
        return;
    }

    // --- API: Add event ---
    if (req.method === 'POST' && url.pathname === '/api/event') {
        const body = JSON.parse(await readBody(req));
        const data = loadData();
        if (!data.people[body.id]) {
            return jsonResponse(res, 400, { error: `Person "${body.id}" not found. Add them first.` });
        }
        const date = body.date || new Date().toISOString().split('T')[0];
        data.events.push({ id: body.id, date, points: parseInt(body.points), reason: body.reason });
        saveData(data);
        const sign = body.points >= 0 ? '+' : '';
        jsonResponse(res, 200, { success: true, message: `${data.people[body.id].name}: ${sign}${body.points} — "${body.reason}"` });
        return;
    }

    // --- API: Delete event ---
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/event/')) {
        const index = parseInt(url.pathname.split('/').pop());
        const data = loadData();
        if (index < 0 || index >= data.events.length) {
            return jsonResponse(res, 400, { error: 'Invalid event index' });
        }
        const removed = data.events.splice(index, 1)[0];
        saveData(data);
        jsonResponse(res, 200, { success: true, message: `Deleted event: ${removed.reason}` });
        return;
    }

    // --- API: Delete person ---
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/person/')) {
        const id = url.pathname.split('/').pop();
        const data = loadData();
        if (!data.people[id]) {
            return jsonResponse(res, 400, { error: `Person "${id}" not found` });
        }
        const name = data.people[id].name;
        delete data.people[id];
        data.events = data.events.filter((e) => e.id !== id);
        saveData(data);
        jsonResponse(res, 200, { success: true, message: `Deleted ${name} and their events` });
        return;
    }

    // --- API: Edit event ---
    if (req.method === 'PUT' && url.pathname.startsWith('/api/event/')) {
        const index = parseInt(url.pathname.split('/').pop());
        const body = JSON.parse(await readBody(req));
        const data = loadData();
        if (index < 0 || index >= data.events.length) {
            return jsonResponse(res, 400, { error: 'Invalid event index' });
        }
        data.events[index] = {
            id: body.id || data.events[index].id,
            date: body.date || data.events[index].date,
            points: body.points !== undefined ? parseInt(body.points) : data.events[index].points,
            reason: body.reason || data.events[index].reason,
        };
        saveData(data);
        jsonResponse(res, 200, { success: true, message: 'Event updated' });
        return;
    }

    // --- API: Git status ---
    if (req.method === 'GET' && url.pathname === '/api/git/status') {
        const status = runGit('git status --porcelain data/points.json');
        const hasChanges = status.success && status.output.length > 0;
        jsonResponse(res, 200, { hasChanges, output: status.output, success: status.success });
        return;
    }

    // --- API: Git push ---
    if (req.method === 'POST' && url.pathname === '/api/git/push') {
        const body = JSON.parse(await readBody(req));
        const message = body.message || 'Update prestige points';

        const add = runGit('git add data/points.json');
        if (!add.success) return jsonResponse(res, 500, { error: 'git add failed', details: add.output });

        const commit = runGit(`git commit -m "${message.replace(/"/g, '\\"')}"`);
        if (!commit.success && !commit.output.includes('nothing to commit')) {
            return jsonResponse(res, 500, { error: 'git commit failed', details: commit.output });
        }

        const push = runGit('git push');
        if (!push.success) return jsonResponse(res, 500, { error: 'git push failed', details: push.output });

        jsonResponse(res, 200, { success: true, message: 'Pushed to GitHub! 🚀', details: push.output });
        return;
    }

    // 404
    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║       PRESTIGE POINTS — Admin Panel              ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║   🌐 Open: http://localhost:${PORT}               ║
║                                                  ║
║   Add people, add events, review, & push         ║
║   to GitHub — all from the browser.              ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);
});
