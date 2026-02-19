/* ============================================
   PRESTIGE POINTS — App Logic
   ============================================ */

(function () {
    'use strict';

    // --- Supabase Config ---
    // You will need to fill these in with your actual credentials
    const SUPABASE_URL = 'https://kxyudtpxjgqekkmgpigb.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eXVkdHB4amdxZWtrbWdwaWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NTEyODEsImV4cCI6MjA4NzAyNzI4MX0.alLyHpEXOUgAFQritkaWB6YM3O3c12yaBisgbB7UkXI';

    let supabaseClient;
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    const MEME_DISPLAY_TIME = 3000; // ms per notification card
    const RECENT_HOURS = 24;

    // --- Fingerprinting (Vouch System) ---
    async function getBrowserFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("PrestigePoints-FP", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("PrestigePoints-FP", 4, 17);
        const b64 = canvas.toDataURL().replace("data:image/png;base64,", "");
        const bin = atob(b64);
        const crc = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            return hash;
        };
        const id = `${navigator.userAgent.length}-${screen.width}x${screen.height}-${crc(bin)}`;
        return id;
    }

    // --- Tier System ---
    function getTier(score) {
        if (score >= 1000) return { name: 'Prestige Overlord', icon: '🏆', class: 'tier-overlord' };
        if (score >= 500) return { name: 'Main Character', icon: '⭐', class: 'tier-main' };
        if (score >= 0) return { name: 'NPC', icon: '🤖', class: 'tier-npc' };
        return { name: 'Literally Cooked', icon: '💀', class: 'tier-cooked' };
    }

    // --- Data Loading ---
    async function loadData() {
        if (!supabaseClient) {
            console.error('Supabase client not initialized. Check your URL/Key.');
            return { people: {}, events: [], pending: [], finger: null };
        }

        try {
            const finger = await getBrowserFingerprint();

            // Fetch people and events in parallel
            const [peopleRes, eventsRes] = await Promise.all([
                supabaseClient.from('people').select('*'),
                supabaseClient.from('events').select('*').order('created_at', { ascending: false })
            ]);

            if (peopleRes.error) throw peopleRes.error;
            if (eventsRes.error) throw eventsRes.error;

            const people = {};
            peopleRes.data.forEach(p => {
                people[p.id] = { name: p.name, avatar: p.avatar };
            });

            const allEvents = eventsRes.data;

            // Filter events: live ones go to leaderboard, pending ones to the vouch queue
            const live = allEvents.filter(e => e.status === 'live' || !e.status).map(e => ({
                id: e.person_id,
                date: e.date,
                points: e.points,
                reason: e.reason,
                db_id: e.id
            }));

            const pending = allEvents.filter(e => e.status === 'pending');

            return { people, events: live, pending, finger };
        } catch (e) {
            console.error('Failed to load data from Supabase:', e);
            return { people: {}, events: [], pending: [], finger: null };
        }
    }

    // --- Compute Leaderboard ---
    function computeLeaderboard(data) {
        const totals = {};
        for (const [id, person] of Object.entries(data.people)) {
            totals[id] = { id, ...person, score: 0, recentChange: false };
        }
        const now = Date.now();
        const recentThreshold = now - RECENT_HOURS * 60 * 60 * 1000;

        for (const event of data.events) {
            if (!totals[event.id]) continue;
            totals[event.id].score += event.points;
            const eventTime = new Date(event.date + 'T12:00:00').getTime();
            if (eventTime >= recentThreshold) {
                totals[event.id].recentChange = true;
            }
        }

        return Object.values(totals).sort((a, b) => b.score - a.score);
    }

    // --- Render Hero Stats ---
    function renderHeroStats(leaderboard, events) {
        const container = document.getElementById('hero-stats');
        const totalPeople = leaderboard.length;
        const totalEvents = events.length;
        const totalPoints = leaderboard.reduce((sum, p) => sum + Math.abs(p.score), 0);

        container.innerHTML = `
      <div class="hero-stat">
        <div class="hero-stat-value">${totalPeople}</div>
        <div class="hero-stat-label">Players</div>
      </div>
      <div class="hero-stat">
        <div class="hero-stat-value">${totalEvents}</div>
        <div class="hero-stat-label">Events</div>
      </div>
      <div class="hero-stat">
        <div class="hero-stat-value">${totalPoints.toLocaleString()}</div>
        <div class="hero-stat-label">Total Prestige</div>
      </div>
    `;
    }

    // --- Render Leaderboard ---
    function renderLeaderboard(leaderboard) {
        const container = document.getElementById('leaderboard');
        container.innerHTML = '';

        leaderboard.forEach((person, index) => {
            const rank = index + 1;
            const tier = getTier(person.score);
            const sign = person.score >= 0 ? '+' : '';
            const scoreClass = person.score >= 0 ? 'positive' : 'negative';

            let rankClass = '';
            if (rank === 1) rankClass = 'rank-1';
            else if (rank === 2) rankClass = 'rank-2';
            else if (rank === 3) rankClass = 'rank-3';
            if (person.score < 0) rankClass = 'rank-negative';

            const recentClass = person.recentChange ? 'recent' : '';

            const card = document.createElement('div');
            card.className = `lb-card ${rankClass} ${recentClass}`;
            card.style.animationDelay = `${0.3 + index * 0.08}s`;
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.innerHTML = `
        <div class="lb-rank">#${rank}</div>
        <div class="lb-avatar">${person.avatar}</div>
        <div class="lb-info">
          <div class="lb-name">${person.name}</div>
          <div class="lb-tier">${tier.icon} ${tier.name}</div>
        </div>
        <div>
          <div class="lb-score ${scoreClass}">${sign}${person.score.toLocaleString()}</div>
          <div class="lb-score-label">prestige</div>
        </div>
      `;

            // Animate entrance
            setTimeout(() => {
                card.style.transition = 'all 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, (0.3 + index * 0.08) * 1000);

            container.appendChild(card);
        });
    }

    // --- Render History Table ---
    function renderHistory(data) {
        const tbody = document.getElementById('history-body');
        tbody.innerHTML = '';

        const now = Date.now();
        const recentThreshold = now - RECENT_HOURS * 60 * 60 * 1000;

        // Sort events by date descending
        const sorted = [...data.events].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return data.events.indexOf(b) - data.events.indexOf(a);
        });

        sorted.forEach((event) => {
            const person = data.people[event.id] || { name: event.id, avatar: '👤' };
            const sign = event.points >= 0 ? '+' : '';
            const pointsClass = event.points >= 0 ? 'positive' : 'negative';
            const eventTime = new Date(event.date + 'T12:00:00').getTime();
            const isRecent = eventTime >= recentThreshold;

            const tr = document.createElement('tr');
            if (isRecent) tr.classList.add('recent-event');
            tr.innerHTML = `
                <td class="date-cell">${formatDate(event.date)}</td>
                <td><div class="person-cell">${person.avatar} ${person.name}</div></td>
                <td class="points-cell ${pointsClass}">${sign}${event.points.toLocaleString()}</td>
                <td class="reason-cell">${escapeHtml(event.reason)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Vouch System UI ---
    function renderPending(pending, data) {
        const container = document.getElementById('pending-container');
        const section = document.getElementById('pending-section');
        if (!container || !section) return;

        if (pending.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        container.innerHTML = '';

        pending.forEach(event => {
            const person = data.people[event.person_id] || { name: 'Unknown', avatar: '👤' };
            const isGain = event.points >= 0;
            const approvals = Array.isArray(event.approvals) ? event.approvals : [];
            const denials = Array.isArray(event.denials) ? event.denials : [];

            const hasVoted = approvals.includes(data.finger) || denials.includes(data.finger);
            const isCreator = event.fingerprint === data.finger;

            const card = document.createElement('div');
            card.className = 'pending-card';
            card.id = `pending-card-${event.id}`;
            card.innerHTML = `
                <div class="vouch-count">${approvals.length} / 2 VOUCHES</div>
                <div class="pending-info">
                    <div class="pending-header">
                        <span class="pending-person">${person.name} ${person.avatar}</span>
                        <span class="pending-points ${isGain ? 'positive' : 'negative'}">
                            ${isGain ? '+' : ''}${event.points}
                        </span>
                    </div>
                    <span class="pending-reason">"${event.reason}"</span>
                    <span class="pending-vouchers">
                        ${approvals.length > 0 ? `Vouched by ${approvals.length} device(s)` : 'No vouches yet'}
                    </span>
                </div>
                <div class="voting-actions">
                    <button class="btn-vouch approve" onclick="vouchEvent(${event.id}, 'approve')" 
                        ${hasVoted || isCreator ? 'disabled' : ''}>
                        ${isCreator ? 'Your Proposal' : (hasVoted ? 'Vouched ✅' : 'Vouch ✅')}
                    </button>
                    <button class="btn-vouch deny" onclick="vouchEvent(${event.id}, 'deny')"
                        ${hasVoted || isCreator ? 'disabled' : ''}>
                        Deny ❌
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }


    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Meme Overlay ---
    function getRecentEvents(data) {
        const now = Date.now();
        const recentThreshold = now - RECENT_HOURS * 60 * 60 * 1000;

        return data.events.filter((event) => {
            const eventTime = new Date(event.date + 'T12:00:00').getTime();
            return eventTime >= recentThreshold;
        }).sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
    }

    function showMemeOverlay(data) {
        const recentEvents = getRecentEvents(data);
        if (recentEvents.length === 0) return;

        // --- Session Storage Fix ---
        // We track which events have been shown in this session 
        // to avoid annoying the user on every refresh.
        const shownKey = 'prestige_shown_events';
        let shownEvents = [];
        try {
            shownEvents = JSON.parse(sessionStorage.getItem(shownKey) || '[]');
        } catch (e) { shownEvents = []; }

        // Filter out events already seen in this session
        const newEvents = recentEvents.filter(e => !shownEvents.includes(e.db_id));

        if (newEvents.length === 0) return; // Nothing new to show!

        const overlay = document.getElementById('meme-overlay');
        let currentIndex = 0;

        function showNext() {
            if (currentIndex >= newEvents.length) {
                // Done — hide overlay
                overlay.classList.remove('active');
                setTimeout(() => {
                    overlay.classList.add('hidden');
                    overlay.classList.remove('gain', 'loss');
                }, 300);

                // Save these as shown
                newEvents.forEach(e => {
                    if (!shownEvents.includes(e.db_id)) shownEvents.push(e.db_id);
                });
                sessionStorage.setItem(shownKey, JSON.stringify(shownEvents));
                return;
            }

            const event = newEvents[currentIndex];
            const person = data.people[event.id] || { name: event.id, avatar: '👤' };
            const isGain = event.points >= 0;

            // Update overlay content
            const sign = isGain ? '+' : '';
            document.getElementById('meme-icon').textContent = isGain ? '👑' : '💀';
            document.getElementById('meme-score').textContent = `${sign}${event.points.toLocaleString()}`;
            document.getElementById('meme-reason').textContent = `"${event.reason}"`;
            document.getElementById('meme-person').textContent = `— ${person.name} ${person.avatar}`;

            overlay.classList.remove('hidden', 'gain', 'loss');
            overlay.classList.add(isGain ? 'gain' : 'loss');

            // Trigger animation
            overlay.classList.remove('active');
            void overlay.offsetWidth; // force reflow
            overlay.classList.add('active');

            // Progress bar
            const bar = document.getElementById('meme-bar');
            bar.style.transition = 'none';
            bar.style.width = '0%';
            void bar.offsetWidth;
            bar.style.transition = `width ${MEME_DISPLAY_TIME}ms linear`;
            bar.style.width = '100%';

            currentIndex++;
            setTimeout(showNext, MEME_DISPLAY_TIME);
        }

        // Click to skip
        overlay.addEventListener('click', () => {
            // Mark all as shown so they don't reappear
            newEvents.forEach(e => {
                if (!shownEvents.includes(e.db_id)) shownEvents.push(e.db_id);
            });
            sessionStorage.setItem(shownKey, JSON.stringify(shownEvents));

            currentIndex = newEvents.length;
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('gain', 'loss');
            }, 300);
        });

        showNext();
    }

    // --- Particle Background ---
    function initParticles() {
        const canvas = document.getElementById('particles');
        const ctx = canvas.getContext('2d');
        let particles = [];
        const count = 50;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        function createParticle() {
            return {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2 + 0.5,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: (Math.random() - 0.5) * 0.3,
                opacity: Math.random() * 0.3 + 0.05,
                color: Math.random() > 0.7 ? '#ffd700' : '#ffffff',
            };
        }

        function init() {
            resize();
            particles = [];
            for (let i = 0; i < count; i++) {
                particles.push(createParticle());
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of particles) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.fill();

                p.x += p.speedX;
                p.y += p.speedY;

                if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
                if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
            }
            ctx.globalAlpha = 1;
            requestAnimationFrame(draw);
        }

        window.addEventListener('resize', resize);
        init();
        draw();
    }

    // --- Main ---
    // --- Global Actions ---
    let lastLoadedData = { people: {}, events: [], pending: [], finger: null };

    window.vouchEvent = async function (eventId, type) {
        const finger = await getBrowserFingerprint();

        // Use local data for logic and animation
        const event = (lastLoadedData.pending || []).find(e => e.id === eventId);
        if (!event) return;

        let approvals = Array.isArray(event.approvals) ? [...event.approvals] : [];
        let denials = Array.isArray(event.denials) ? [...event.denials] : [];

        if (type === 'approve') {
            if (!approvals.includes(finger)) approvals.push(finger);
        } else {
            if (!denials.includes(finger)) denials.push(finger);
        }

        let newStatus = 'pending';
        if (approvals.length >= 2) newStatus = 'live';
        if (denials.length >= 2) newStatus = 'denied';

        const { error: updateErr } = await supabaseClient
            .from('events')
            .update({ approvals, denials, status: newStatus })
            .eq('id', eventId);

        if (!updateErr) {
            // If it just turned live, show animations and hide card immediately
            if (newStatus === 'live' || newStatus === 'denied') {
                const card = document.getElementById(`pending-card-${eventId}`);
                if (card) card.classList.add('vanishing');

                if (newStatus === 'live') {
                    showMemeOverlay({
                        people: lastLoadedData.people,
                        events: [{ person_id: event.person_id, points: event.points, reason: event.reason, db_id: event.id }]
                    });
                }
            }
            // Re-fetch everything to update the leaderboard/queue
            setTimeout(() => main(), 400); // Slight delay so the transition finishes
        }
    };


    // --- Main ---
    async function main() {
        initParticles();

        const data = await loadData();
        if (!data.people) return;
        lastLoadedData = data;

        const leaderboard = computeLeaderboard(data);

        renderHeroStats(leaderboard, data.events);
        renderLeaderboard(leaderboard);
        renderHistory(data);
        renderPending(data.pending || [], data);

        // Show meme overlay for recent live events on initial load only
        if (!sessionStorage.getItem('prestige_vouch_triggered')) {
            setTimeout(() => showMemeOverlay(data), 1200);
            sessionStorage.setItem('prestige_vouch_triggered', 'true');
        }
    }

    // Go!
    document.addEventListener('DOMContentLoaded', main);
})();
