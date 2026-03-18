require('dotenv').config();
const db = require('./database');
const bcrypt = require('bcryptjs');

console.log('🕷️  Seeding Hornsby Spiders database...\n');

// ─── Opponent Teams ────────────────────────────────────────────────────────

const TEAMS = [
  'Bankstown Bruins',
  'Byron Bay Beez',
  'Illawarra Hawks',
  'Maitland Mustangs',
  'Manly Sea Eagles',
  'Newcastle Falcons',
  'Norths Bears',
  'Penrith Panthers',
  'Shoalhaven Tigers',
  'Sydney Comets',
];

const insertTeam   = db.prepare('INSERT OR IGNORE INTO teams (name) VALUES (?)');
const insertInfo   = db.prepare('INSERT OR IGNORE INTO team_info (team_id) SELECT id FROM teams WHERE name = ?');
const insertPlayer = db.prepare('INSERT OR IGNORE INTO scout_players (team_id, position) SELECT id, ? FROM teams WHERE name = ?');

db.transaction(() => {
  for (const name of TEAMS) {
    insertTeam.run(name);
    insertInfo.run(name);
    for (const pos of [1, 2, 3]) insertPlayer.run(pos, name);
  }
})();

console.log(`✅  Seeded ${TEAMS.length} opponent teams with player scout slots\n`);

// ─── Team Users ────────────────────────────────────────────────────────────

const USERS = [
  // ── Players (11) ────────────────────────────────────────────────────────
  { username: 'lachlanbooth',      password: 'Spiders#LB7',   role: 'player',  display: 'Lachlan Booth'       },
  { username: 'danielsong',        password: 'Spiders#DS4',   role: 'player',  display: 'Daniel Song'         },
  { username: 'alexlukell',        password: 'Spiders#AL9',   role: 'player',  display: 'Alex Lukell'         },
  { username: 'samsonnathan',      password: 'Spiders#SN2',   role: 'player',  display: 'Samson Nathan'       },
  { username: 'logantupaea',       password: 'Spiders#LT6',   role: 'player',  display: 'Logan Tupaea'        },
  { username: 'jaylenmontano',     password: 'Spiders#JM8',   role: 'player',  display: 'Jaylen Montano'      },
  { username: 'jackwest',          password: 'Spiders#JW3',   role: 'player',  display: 'Jack West'           },
  { username: 'youssefnoureddine', password: 'Spiders#YN5',   role: 'player',  display: 'Youssef Noureddine'  },
  { username: 'oliverfrench',      password: 'Spiders#OF1',   role: 'player',  display: 'Oliver French'       },
  { username: 'henryoneil',        password: 'Spiders#HO0',   role: 'player',  display: "Henry O'Neil"        },
  { username: 'myleschristy',      password: 'Spiders#MC11',  role: 'player',  display: 'Myles Christy'       },
  // ── Coaches (4) ─────────────────────────────────────────────────────────
  { username: 'kenw',              password: 'Coach#Ken22',   role: 'coach',   display: 'Ken W'               },
  { username: 'seths',             password: 'Coach#Seth33',  role: 'coach',   display: 'Seth S'              },
  { username: 'willb',             password: 'Coach#Will44',  role: 'coach',   display: 'Will B'              },
  { username: 'oisind',            password: 'Coach#Ois55',   role: 'coach',   display: 'Oisin D'             },
  // ── Managers (2) ────────────────────────────────────────────────────────
  { username: 'anthonyb',          password: 'Coach#Ant66',   role: 'manager', display: 'Anthony B'           },
  { username: 'georgeo',           password: 'Coach#Geo77',   role: 'manager', display: 'George O'            },
];

const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)');

db.transaction(() => {
  for (const u of USERS) {
    const hash = bcrypt.hashSync(u.password, 10);
    const info = insertUser.run(u.username, hash, u.role);
    const tag  = info.changes > 0 ? '✅ Created' : '⏭️  Skipped';
    console.log(`${tag}  [${u.role.padEnd(7)}]  ${u.display.padEnd(22)}  → ${u.username}`);
  }
})();

console.log('\n🚀  All done! Run `npm start` to launch the server at http://localhost:3000');
