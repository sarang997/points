#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'points.json');

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

function getTier(score) {
  if (score >= 1000) return '🏆 Prestige Overlord';
  if (score >= 500) return '⭐ Main Character';
  if (score >= 0) return '🤖 NPC';
  return '💀 Literally Cooked';
}

function addPerson(id, name, avatar) {
  const data = loadData();
  if (data.people[id]) {
    console.log(`⚠️  Person "${id}" already exists. Updating info.`);
  }
  data.people[id] = { name, avatar };
  saveData(data);
  console.log(`✅ Added person: ${name} ${avatar} (id: ${id})`);
}

function addEvent(id, points, reason) {
  const data = loadData();

  // Auto-create person if they don't exist
  if (!data.people[id]) {
    const name = id.charAt(0).toUpperCase() + id.slice(1);
    data.people[id] = { name, avatar: '👤' };
    console.log(`📝 Auto-created person: ${name} (id: ${id}). Use "add-person" to set name/avatar.`);
  }

  const today = new Date().toISOString().split('T')[0];
  data.events.push({ id, date: today, points: parseInt(points), reason });
  saveData(data);

  const sign = points >= 0 ? '+' : '';
  console.log(`✅ ${data.people[id].name}: ${sign}${points} prestige — "${reason}"`);
}

function listLeaderboard() {
  const data = loadData();
  const totals = {};

  for (const [id, person] of Object.entries(data.people)) {
    totals[id] = { ...person, score: 0 };
  }

  for (const event of data.events) {
    if (totals[event.id]) {
      totals[event.id].score += event.points;
    }
  }

  const sorted = Object.entries(totals).sort((a, b) => b[1].score - a[1].score);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║         🏅 PRESTIGE LEADERBOARD 🏅           ║');
  console.log('╠══════════════════════════════════════════════╣');

  sorted.forEach(([id, person], i) => {
    const rank = i + 1;
    const sign = person.score >= 0 ? '+' : '';
    const tier = getTier(person.score);
    const line = `║ #${rank} ${person.avatar} ${person.name.padEnd(12)} ${(sign + person.score).padStart(7)}  ${tier.padEnd(20)}║`;
    console.log(line);
  });

  console.log('╚══════════════════════════════════════════════╝\n');
}

function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║            PRESTIGE POINTS — CLI                     ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  COMMANDS:                                           ║
║                                                      ║
║  add <id> <points> "<reason>"                        ║
║    Add points to a person (negative to deduct)       ║
║    Auto-creates person if they don't exist            ║
║                                                      ║
║  add-person <id> "<name>" "<emoji>"                  ║
║    Register a new person with name and avatar         ║
║                                                      ║
║  list                                                ║
║    Show the current leaderboard                       ║
║                                                      ║
║  EXAMPLES:                                           ║
║    node cli.js add alice 500 "Aced the exam"         ║
║    node cli.js add bob -200 "Forgot my birthday"     ║
║    node cli.js add-person alice "Alice" "🐱"          ║
║    node cli.js list                                  ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
`);
}

// --- Main ---
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'add':
    if (args.length < 4) {
      console.error('❌ Usage: node cli.js add <id> <points> "<reason>"');
      process.exit(1);
    }
    addEvent(args[1], args[2], args.slice(3).join(' '));
    break;

  case 'add-person':
    if (args.length < 4) {
      console.error('❌ Usage: node cli.js add-person <id> "<name>" "<emoji>"');
      process.exit(1);
    }
    addPerson(args[1], args[2], args[3]);
    break;

  case 'list':
    listLeaderboard();
    break;

  default:
    showHelp();
    break;
}
