'use strict';

const State = { user:null, currentView:null, teams:[], currentTeam:null, scoutEditing:false, games:[] };

const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const show   = id => $(id)?.classList.remove('hidden');
const hide   = id => $(id)?.classList.add('hidden');
const toggle = (id, v) => v ? show(id) : hide(id);
const setText  = (id, t)  => { const e=$(id); if(e) e.textContent=t; };
const setHTML  = (id, h)  => { const e=$(id); if(e) e.innerHTML=h; };
const escapeHTML = s => String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function toast(msg, type='success') {
  const icons={success:'✅',error:'❌',info:'ℹ️'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
  $('toast-container').appendChild(el);
  setTimeout(()=>el.remove(), 4000);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function doLogin(e) {
  e.preventDefault();
  const btn=$('login-btn'), errEl=$('login-error');
  errEl.classList.add('hidden');
  btn.disabled=true; btn.textContent='Signing in…';
  try {
    const data = await API.login($('username').value.trim(), $('password').value);
    API.setToken(data.token); API.setUser(data.user); State.user=data.user;
    initApp();
  } catch(err) {
    errEl.textContent=err.message||'Login failed'; errEl.classList.remove('hidden');
  } finally { btn.disabled=false; btn.textContent='Sign In'; }
}

function doLogout() {
  API.setToken(null); API.setUser(null); State.user=null; State.currentView=null;
  hide('app'); show('login-page'); $('login-form').reset(); $('login-error').classList.add('hidden');
}

async function boot() {
  const token=API.getToken(), user=API.getUser();
  if(token && user) {
    try { const me=await API.me(); State.user=me; API.setUser(me); initApp(); }
    catch { doLogout(); }
  }
}

function initApp() {
  const u=State.user; if(!u) return;
  setText('nav-username', u.username);
  const badge=$('nav-role-badge'); badge.textContent=u.role; badge.className=`role-badge ${u.role}`;
  const isEditor=u.role==='coach'||u.role==='manager';
  if(isEditor && !$('manage-users-nav-btn')) {
    const navLinks=$('nav-links');
    const sep=document.createElement('div');
    sep.style='width:1px;height:28px;background:var(--black-border);margin:0 4px';
    const btn=document.createElement('button');
    btn.className='nav-btn'; btn.id='manage-users-nav-btn'; btn.textContent='Manage Users';
    btn.onclick=openUsersModal;
    navLinks.insertBefore(sep, navLinks.children[navLinks.children.length-2]);
    navLinks.insertBefore(btn, navLinks.children[navLinks.children.length-2]);
  }
  hide('login-page'); show('app'); navigateTo('home');
}

// ── Router ────────────────────────────────────────────────────────────────────
function navigateTo(view) {
  ['home','scout','games'].forEach(v => {
    hide(`view-${v}`);
    $$(`[data-view="${v}"]`).forEach(b=>b.classList.remove('active'));
  });
  show(`view-${view}`);
  $$(`[data-view="${view}"]`).forEach(b=>b.classList.add('active'));
  State.currentView=view;
  if(view==='home')  renderHome();
  if(view==='scout') renderScout();
  if(view==='games') renderGames();
}

// ── Home ──────────────────────────────────────────────────────────────────────
function renderHome() {
  setText('home-welcome', `Welcome back, ${State.user.username} 👋`);
}

// ── Scout ─────────────────────────────────────────────────────────────────────
async function renderScout() {
  const isEditor=State.user.role==='coach'||State.user.role==='manager';
  toggle('scout-edit-btn', isEditor);
  if(State.teams.length===0) {
    try { State.teams=await API.getTeams(); }
    catch(err) { toast('Could not load teams: '+err.message,'error'); return; }
  }
  const sel=$('scout-team-select');
  if(sel.options.length<=1) {
    State.teams.forEach(t=>sel.add(new Option(t.name, t.id)));
  }
  sel.value=''; hide('scout-content'); show('scout-empty');
}

async function loadTeamScout(teamId) {
  if(!teamId) { hide('scout-content'); show('scout-empty'); State.currentTeam=null; return; }
  hide('scout-empty'); show('scout-content');
  try { const data=await API.getTeam(teamId); State.currentTeam=data; renderScoutContent(data); }
  catch(err) { toast('Failed to load team: '+err.message,'error'); }
}

function renderScoutContent({team, info, players}) {
  setText('scout-team-name', team.name);
  exitScoutEditMode();
  const set=(id,val)=>{ const el=$(id); el.textContent=val||''; el.classList.toggle('empty',!val); if(!val) el.textContent='No information added yet.'; };
  set('info-playstyle-text', info?.playstyle||'');
  set('info-strategy-text',  info?.strategy||'');
  set('info-wincon-text',    info?.win_condition||'');
  $('info-playstyle-edit').value=info?.playstyle||'';
  $('info-strategy-edit').value=info?.strategy||'';
  $('info-wincon-edit').value=info?.win_condition||'';
  renderPlayerCards(players);
}

function enterScoutEditMode() {
  State.scoutEditing=true;
  $$('.scout-info-section').forEach(s=>s.classList.add('edit-mode'));
  $('scout-save-bar').style.display='flex';
  $('scout-edit-btn').textContent='✏️ Editing…'; $('scout-edit-btn').disabled=true;
}

function exitScoutEditMode() {
  State.scoutEditing=false;
  $$('.scout-info-section').forEach(s=>s.classList.remove('edit-mode'));
  $('scout-save-bar').style.display='none';
  $('scout-edit-btn').textContent='✏️ Edit Team Info'; $('scout-edit-btn').disabled=false;
}

async function saveScoutInfo() {
  const teamId=State.currentTeam?.team?.id; if(!teamId) return;
  const btn=$('scout-save-btn'); btn.disabled=true; btn.textContent='Saving…';
  try {
    const updated=await API.saveTeamInfo(teamId,{
      playstyle:$('info-playstyle-edit').value,
      strategy:$('info-strategy-edit').value,
      win_condition:$('info-wincon-edit').value
    });
    State.currentTeam.info=updated; renderScoutContent(State.currentTeam); toast('Team info saved!');
  } catch(err){ toast('Save failed: '+err.message,'error'); }
  finally { btn.disabled=false; btn.textContent='💾 Save Changes'; }
}

function renderPlayerCards(players) {
  const isEditor=State.user.role==='coach'||State.user.role==='manager';
  const grid=$('player-cards-grid'); grid.innerHTML='';
  const labels=['Player 1','Player 2','Player 3'];
  players.forEach((p,i)=>{
    const numEl=p.player_number?`<div class="player-number-circle">#${escapeHTML(p.player_number)}</div>`:`<div class="player-number-circle empty">?</div>`;
    const field=(label,val)=>`<div class="player-field"><div class="player-field-label">${label}</div><div class="player-field-value ${!val?'empty':''}">${val?escapeHTML(val):'Not filled in yet.'}</div></div>`;
    const card=document.createElement('div'); card.className='player-card';
    card.innerHTML=`
      <div class="player-card-header">${numEl}<div><div class="player-card-label">${labels[i]}</div></div><div class="player-card-pos">Scout #${i+1}</div></div>
      <div class="player-card-body">${field('Strengths',p.strengths)}${field('Weaknesses',p.weaknesses)}${field('Our Team Matchup',p.matchup)}</div>
      ${isEditor?`<div class="player-card-actions"><button class="btn btn-ghost btn-sm w-full" data-player-id="${p.id}" data-player-pos="${i+1}">✏️ Edit Player ${i+1}</button></div>`:''}
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('[data-player-id]').forEach(btn=>{
    btn.addEventListener('click',()=>openPlayerModal(parseInt(btn.dataset.playerId),parseInt(btn.dataset.playerPos)));
  });
}

function openPlayerModal(playerId, pos) {
  const player=State.currentTeam.players.find(p=>p.id===playerId); if(!player) return;
  $('edit-player-id').value=playerId; $('modal-player-pos').textContent=pos;
  $('edit-player-number').value=player.player_number||'';
  $('edit-player-strengths').value=player.strengths||'';
  $('edit-player-weaknesses').value=player.weaknesses||'';
  $('edit-player-matchup').value=player.matchup||'';
  show('modal-player');
}

async function savePlayer() {
  const id=parseInt($('edit-player-id').value), btn=$('save-player-btn');
  btn.disabled=true; btn.textContent='Saving…';
  try {
    const updated=await API.savePlayer(id,{
      player_number:$('edit-player-number').value, strengths:$('edit-player-strengths').value,
      weaknesses:$('edit-player-weaknesses').value, matchup:$('edit-player-matchup').value
    });
    const idx=State.currentTeam.players.findIndex(p=>p.id===id);
    if(idx!==-1) State.currentTeam.players[idx]=updated;
    renderPlayerCards(State.currentTeam.players); closeModal('modal-player'); toast('Player updated!');
  } catch(err){ toast('Save failed: '+err.message,'error'); }
  finally { btn.disabled=false; btn.textContent='Save Player'; }
}

// ── Games ─────────────────────────────────────────────────────────────────────
async function renderGames() {
  const isEditor=State.user.role==='coach'||State.user.role==='manager';
  toggle('add-game-btn', isEditor);
  setHTML('games-list','<div class="loading-overlay"><div class="spinner"></div> Loading games…</div>');
  try { State.games=await API.getGames(); renderGamesList(); }
  catch(err){ setHTML('games-list',`<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Error</div><div class="empty-state-desc">${err.message}</div></div>`); }
}

async function renderGamesList() {
  const isEditor=State.user.role==='coach'||State.user.role==='manager';
  const container=$('games-list');
  if(State.games.length===0){
    container.innerHTML=`<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">No Games Yet</div><div class="empty-state-desc">${isEditor?'Add the first game using the button above.':'No games published yet.'}</div></div>`;
    return;
  }
  container.innerHTML='';
  for(const game of State.games){ container.appendChild(await buildGameCard(game, isEditor)); }
}

async function buildGameCard(game, isEditor) {
  const card=document.createElement('div'); card.className='game-card'; card.id=`game-card-${game.id}`;
  const dateStr=game.game_date?new Date(game.game_date+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'}):'—';
  const hasScore=game.our_score!=null&&game.opp_score!=null;
  const scoreStr=hasScore?`${game.our_score} – ${game.opp_score}`:'TBD';
  const isPublished=!!game.published;
  const canVote=State.user.role!=='coach'&&State.user.role!=='manager';
  let resultsHTML=''; let hasVoted=game.has_voted;
  try {
    const {results,has_voted}=await API.getResults(game.id); hasVoted=has_voted;
    if(results.total_votes>0) resultsHTML=buildResultsHTML(results);
    else if(isPublished) resultsHTML<`<div class="empty-state" style="padding:24px"><div class="empty-state-icon">🗳️</div><div class="empty-state-title">No votes yet</div><div class="empty-state-desc">Be the first to rate this game.</div></div>`;
  } catch{}
  const voteBtn=isPublished&&canVote?(hasVoted?`<button class="btn btn-secondary btn-sm" disabled>✓ Voted</button>`:`<button class="btn btn-primary btn-sm vote-trigger" data-game-id="${game.id}" data-game-title="vs ${escapeHTML(game.opponent_name)}">🗳️ Rate this Game</button>`):'';
  card.innerHTML=`
    <div class="game-card-header">
      <div class="game-vs">
        <div class="game-team">Hornsby Spiders</div>
        <div class="game-score">${scoreStr}</div>
        <div class="game-divider">vs</div>
        <div class="game-team">${escapeHTML(game.opponent_name)}</div>
      </div>
      <div class="game-meta">
        <div class="game-date">📅 ${dateStr}</div>
        <span class="status-badge ${isPublished?'published':'draft'}">${isPublished?'Published':'Draft'}</span>
        ${isEditor?`<button class="btn btn-secondary btn-sm edit-game-trigger" data-game-id="${game.id}">✏️ Edit</button><button class="btn btn-danger btn-sm delete-game-trigger" data-game-id="${game.id}">🗑️</button>`:''}
      </div>
    </div>
    <div class="game-card-body">
      ${!isPublished&&isEditor?`<div style="color:var(--warning);font-size:.875rem;margin-bottom:16px">⚠️ Draft — players cannot see this yet.</div>`:''}
      ${isPublished?`<div class="vote-section"><div class="flex-between mb-16" style="flex-wrap:wrap;gap:8px"><div style="font-family:var(--font-display);font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--white-dim)">Performance Ratings ${game.vote_count>0?`<span style="color:var(--green)">(${game.vote_count} vote${game.vote_count!==1?'s':''})</span>`:''}</div>${voteBtn}</div><div id="results-${game.id}">${resultsHTML}</div></div>`:(isEditor?`<div style="color:#444;font-size:.875rem;font-style:italic">Publish this game to enable voting.</div>`:'')}
    </div>`;
  card.querySelectorAll('.vote-trigger').forEach(b=>b.addEventListener('click',()=>openVoteModal(parseInt(b.dataset.gameId),b.dataset.gameTitle,card)));
  card.querySelectorAll('.edit-game-trigger').forEach(b=>b.addEventListener('click',()=>openGameModal(State.games.find(g=>g.id===parseInt(b.dataset.gameId)))));
  card.querySelectorAll('.delete-game-trigger').forEach(b=>b.addEventListener('click',()=>confirmDeleteGame(parseInt(b.dataset.gameId))));
  return card;
}

function buildResultsHTML(results) {
  if(!results||!results.total_votes) return '';
  const cats=[
    {key:'avg_execution',label:'Execution of Gameplan'},{key:'avg_containment',label:'Containment of Key Players'},
    {key:'avg_shot_selection',label:'Shot Selection'},{key:'avg_offensive_flow',label:'Offensive Flow'},
    {key:'avg_defensive_intensity',label:'Defensive Intensity'},{key:'avg_overall',label:'Overall'}
  ];
  return`<div class="results-grid">${cats.map(c=>{
    const score=results[c.key]??0, pct=(score/10*100).toFixed(1);
    return`<div class="result-item"><div class="result-label">${c.label}</div><div class="result-bar-wrap"><div class="result-bar"><div class="result-bar-fill" style="width:${pct}%"></div></div><div class="result-score">${score}</div></div></div>`;
  }).join('')}</div>`;
}

const VOTEECATS=[
  {key:'execution',label:'Execution of Gameplan'},{key:'containment',label:'Containment of Key Players'},
  {key:'shot_selection',label:'Shot Selection'},{key:'offensive_flow',label:'Offensive Flow'},
  {key:'defensive_intensity',label:'Defensive Intensity'},{key:'overall',label:'Overall'}
];

function openVoteModal(gameId, title, gameCard) {
  $('vote-game-id').value=gameId; $('vote-game-title').textContent=title;
  $('vote-grid').innerHTML=VOTE_CATS.map(c=>`
    <div class="vote-item"><div class="vote-label">${c.label}</div>
    <div class="vote-slider-wrap">
      <input type="range" class="vote-slider" id="vote-${c.key}" min="1" max="10" value="5"/>
      <div class="vote-value" id="vote-val-${c.key}">5</div>
    </div></div>`).join('');
  VOTE_CATS.forEach(c=>{
    const s=$(`vote-${c.key}`), v=$(`vote-val-${c.key}`);
    s.addEventListener('input',()=>{ v.textContent=s.value; const n=parseInt(s.value); v.style.color=n>=8?'#39FF14':n>=5?'#ffaa00':'#ff4444'; });
  });
  $('submit-vote-btn')._gameCard=gameCard; $('submit-vote-btn')._gameId=gameId;
  show('modal-vote');
}

async function submitVote() {
  const gameId=parseInt($('vote-game-id').value), btn=$('submit-vote-btn'), gameCard=btn._gameCard;
  const payload={}; VOTEECATS.forEach(c=>{ payload[c.key]=parseInt($(`vote-${c.key}`).value); });
  btn.disabled=true; btn.textContent='Submitting…';
  try {
    await API.vote(gameId, payload); closeModal('modal-vote'); toast('Vote submitted anonymously! ✅');
    if(gameCard){
      try {
        const {results}=await API.getResults(gameId);
        const resEl=gameCard.querySelector(`#results-${gameId}`);
        if(resEl) resEl.innerHTML=buildResultsHTML(results);
        const voteBtn=gameCard.querySelector('.vote-trigger');
        if(voteBtn){ const nb=document.createElement('button'); nb.className='btn btn-secondary btn-sm'; nb.disabled=true; nb.textContent='✓ Voted'; voteBtn.replaceWith(nb); }
        const game=State.games.find(g=>g.id===gameId); if(game) game.vote_count=(game.vote_count||0)+1;
      } catch{}
    }
  } catch(err){ toast(err.message,'error'); }
  finally { btn.disabled=false; btn.textContent='Submit Vote'; }
}

function openGameModal(game) {
  if(game){
    setText('modal-game-title','Edit Game'); $('edit-game-id').value=game.id;
    $('edit-game-opponent').value=game.opponent_name; $('edit-game-our-score').value=game.our_score??'';
    $('edit-game-opp-score').value=game.opp_score??''; $('edit-game-date').value=game.game_date;
    $('edit-game-published').value=game.published?'1':'0';
  } else {
    setText('modal-game-title','Add Game'); $('edit-game-id').value=''; $('edit-game-opponent').value='';
    $('edit-game-our-score').value=''; $('edit-game-opp-score').value='';
    $('edit-game-date').value=new Date().toISOString().slice(0,10); $('edit-game-published').value='0';
  }
  show('modal-game');
}

async function saveGame() {
  const id=$('edit-game-id').value, btn=$('save-game-btn');
  btn.disabled=true; btn.textContent='Saving…';
  const payload={ opponent_name:$('edit-game-opponent').value.trim(), our_score:$('edit-game-our-score').value||null, opp_score:$('edit-game-opp-score').value||null, game_date:$('edit-game-date').value, published:$('edit-game-published').value==='1' };
  if(!payload.opponent_name||!payload.game_date){ toast('Opponent and date required.','error'); btn.disabled=false; btn.textContent='Save Game'; return; }
  try {
    if(id){ await API.updateGame(id,payload); toast('Game updated!'); }
    else   { await API.createGame(payload);    toast('Game added!'); }
    closeModal('modal-game'); renderGames();
  } catch(err){ toast('Save failed: '+err.message,'error'); }
  finally { btn.disabled=false; btn.textContent='Save Game'; }
}

async function confirmDeleteGame(gameId) {
  if(!confirm('Delete this game and all its votes? This cannot be undone.')) return;
  try {
    await API.deleteGame(gameId); State.games=State.games.filter(g=>g.id!==gameId);
    const card=$(`game-card-${gameId}`); if(card) card.remove();
    toast('Game deleted.'); if(State.games.length===0) renderGamesList();
  } catch(err){ toast('Delete failed: '+err.message,'error'); }
}

async function openUsersModal() { show('modal-users'); await refreshUsersList(); }

async function refreshUsersList() {
  const wrap=$('users-list-wrap');
  wrap.innerHTML='<div class="loading-overlay"><div class="spinner"></div></div>';
  try {
    const users=await API.listUsers();
    if(users.length===0){ wrap.innerHTML='<div class="empty-state"><div class="empty-state-desc">No users found.</div></div>'; return; }
    wrap.innerHTML=`<table class="users-table"><thead><tr><th>Username</th><th>Role</th><th>Created</th><th></th></tr></thead><tbody>
      ${users.map(u=>`<tr><td style="font-weight:600">${escapeHTML(u.username)}</td><td><span class="role-badge ${u.role}">${u.role}</span></td><td style="color:var(--white-dim);font-size:.8rem">${u.created_at?.slice(0,10)||'—'}</td>
      <td>${u.id!==State.user.id?`<button class="btn btn-danger btn-sm" data-uid="${u.id}">Remove</button>`:'<span style="color:#444;font-size:.8rem">You</span>'}</td></tr>`).join('')}
    </tbody></table>`;
    wrap.querySelectorAll('[data-uid]').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        if(!confirm(`Remove user "${btn.closest('tr').querySelector('td').textContent}"?`)) return;
        try{ await API.deleteUser(btn.dataset.uid); toast('User removed.'); refreshUsersList(); }
        catch(err){ toast(err.message,'error'); }
      });
    });
  } catch(err){ wrap.innerHTML=`<div class="empty-state"><div class="empty-state-desc">${err.message}</div></div>`; }
}

async function createUser() {
  const username=$('new-user-name').value.trim(), password=$('new-user-pass').value, role=$('new-user-role').value;
  if(!username||!password){ toast('Username and password required.','error'); return; }
  const btn=$('create-user-btn'); btn.disabled=true; btn.textContent='Creating…';
  try { await API.createUser({username,password,role}); $('new-user-name').value=''; $('new-user-pass').value=''; toast(`Account "${username}" created!`); refreshUsersList(); }
  catch(err){ toast(err.message,'error'); }
  finally { btn.disabled=false; btn.textContent='Create Account'; }
}

function closeModal(id){ hide(id); }

document.addEventListener('DOMContentLoaded', () => {
  $('login-form').addEventListener('submit', doLogin);
  $('logout-btn').addEventListener('click', doLogout);
  $('nav-home-btn').addEventListener('click', ()=>navigateTo('home'));
  $$('[data-view]').forEach(btn=>btn.addEventListener('click',()=>navigateTo(btn.dataset.view)));
  $('hamburger').addEventListener('click', ()=>$('nav-links').classList.toggle('open'));
  $('home-scout-card').addEventListener('click', ()=>navigateTo('scout'));
  $('home-games-card').addEventListener('click', ()=>navigateTo('games'));
  $('scout-team-select').addEventListener('change', e=>loadTeamScout(e.target.value));
  $('scout-edit-btn').addEventListener('click', enterScoutEditMode);
  $('scout-save-btn').addEventListener('click', saveScoutInfo);
  $('scout-cancel-btn').addEventListener('click', ()=>{ if(State.currentTeam) renderScoutContent(State.currentTeam); else exitScoutEditMode(); });
  $('save-player-btn').addEventListener('click', savePlayer);
  $('add-game-btn').addEventListener('click', ()=>openGameModal(null));
  $('save-game-btn').addEventListener('click', saveGame);
  $('submit-vote-btn').addEventListener('click', submitVote);
  $('create-user-btn').addEventListener('click', createUser);
  $$('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.dataset.close)));
  $$('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o) closeModal(o.id); }));
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') $$('.modal-overlay:not(.hidden)').forEach(m=>closeModal(m.id)); });
  boot();
});
