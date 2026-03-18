const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { requireAuth, requireEditor } = require('../middleware/auth');

router.get('/teams', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM teams ORDER BY name').all());
});

router.get('/team/:id', requireAuth, (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const info    = db.prepare('SELECT * FROM team_info WHERE team_id = ?').get(req.params.id);
  const players = db.prepare('SELECT * FROM scout_players WHERE team_id = ? ORDER BY position').all(req.params.id);
  res.json({ team, info: info || null, players });
});

router.put('/team/:id/info', requireAuth, requireEditor, (req, res) => {
  const { playstyle, strategy, win_condition } = req.body;
  if (!db.prepare('SELECT id FROM teams WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Team not found' });
  }
  db.prepare(`
    INSERT INTO team_info (team_id, playstyle, strategy, win_condition, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(team_id) DO UPDATE SET
      playstyle     = excluded.playstyle,
      strategy      = excluded.strategy,
      win_condition = excluded.win_condition,
      updated_at    = excluded.updated_at
  `).run(req.params.id, playstyle || '', strategy || '', win_condition || '');
  res.json(db.prepare('SELECT * FROM team_info WHERE team_id = ?').get(req.params.id));
});

router.put('/player/:id', requireAuth, requireEditor, (req, res) => {
  const player = db.prepare('SELECT * FROM scout_players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  db.prepare(`UPDATE scout_players SET player_number=?, strengths=?, weaknesses=?, matchup=? WHERE id=?`)
    .run(req.body.player_number || '', req.body.strengths || '', req.body.weaknesses || '', req.body.matchup || '', req.params.id);
  res.json(db.prepare('SELECT * FROM scout_players WHERE id = ?').get(req.params.id));
});

module.exports = router;
