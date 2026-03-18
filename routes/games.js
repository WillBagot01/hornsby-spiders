const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { requireAuth, requireEditor } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  const isEditor = req.user.role === 'coach' || req.user.role === 'manager';
  const games = isEditor
    ? db.prepare('SELECT * FROM games ORDER BY game_date DESC').all()
    : db.prepare('SELECT * FROM games WHERE published = 1 ORDER BY game_date DESC').all();
  const result = games.map(g => {
    const vote_count = db.prepare('SELECT COUNT(*) AS cnt FROM votes WHERE game_id = ?').get(g.id).cnt;
    const has_voted  = req.user.role === 'player'
      ? !!db.prepare('SELECT 1 FROM votes WHERE game_id = ? AND user_id = ?').get(g.id, req.user.id)
      : null;
    return { ...g, vote_count, has_voted };
  });
  res.json(result);
});

router.post('/', requireAuth, requireEditor, (req, res) => {
  const { opponent_name, our_score, opp_score, game_date, published } = req.body;
  if (!opponent_name || !game_date) return res.status(400).json({ error: 'opponent_name and game_date required' });
  const info = db.prepare(
    'INSERT INTO games (opponent_name, our_score, opp_score, game_date, published, created_by) VALUES (?,?,?,?,?,?)'
  ).run(opponent_name, our_score != null ? parseInt(our_score) : null, opp_score != null ? parseInt(opp_score) : null,
        game_date, published ? 1 : 0, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM games WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requireAuth, requireEditor, (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const { opponent_name, our_score, opp_score, game_date, published } = req.body;
  db.prepare('UPDATE games SET opponent_name=?, our_score=?, opp_score=?, game_date=?, published=? WHERE id=?')
    .run(opponent_name ?? game.opponent_name,
         our_score  != null ? parseInt(our_score)  : game.our_score,
         opp_score  != null ? parseInt(opp_score)  : game.opp_score,
         game_date  ?? game.game_date,
         published  != null ? (published ? 1 : 0)  : game.published,
         req.params.id);
  res.json(db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireAuth, requireEditor, (req, res) => {
  db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/results', requireAuth, (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (!game.published && req.user.role === 'player') return res.status(404).json({ error: 'Game not found' });
  const agg = db.prepare(`
    SELECT COUNT(*) AS total_votes,
      ROUND(AVG(execution),1)           AS avg_execution,
      ROUND(AVG(containment),1)         AS avg_containment,
      ROUND(AVG(shot_selection),1)      AS avg_shot_selection,
      ROUND(AVG(offensive_flow),1)      AS avg_offensive_flow,
      ROUND(AVG(defensive_intensity),1) AS avg_defensive_intensity,
      ROUND(AVG(overall),1)             AS avg_overall
    FROM votes WHERE game_id = ?
  `).get(req.params.id);
  const has_voted = req.user.role === 'player'
    ? !!db.prepare('SELECT 1 FROM votes WHERE game_id = ? AND user_id = ?').get(req.params.id, req.user.id)
    : null;
  res.json({ game, results: agg, has_voted });
});

router.post('/:id/vote', requireAuth, (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (!game.published) return res.status(400).json({ error: 'Game is not yet published' });
  if (db.prepare('SELECT 1 FROM votes WHERE game_id = ? AND user_id = ?').get(req.params.id, req.user.id)) {
    return res.status(409).json({ error: 'You have already voted for this game' });
  }
  const fields = ['execution','containment','shot_selection','offensive_flow','defensive_intensity','overall'];
  const scores = {};
  for (const f of fields) {
    const n = parseInt(req.body[f]);
    if (isNaN(n) || n < 1 || n > 10) return res.status(400).json({ error: `${f} must be 1–10` });
    scores[f] = n;
  }
  db.prepare(`INSERT INTO votes (game_id, user_id, execution, containment, shot_selection, offensive_flow, defensive_intensity, overall)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(req.params.id, req.user.id, scores.execution, scores.containment,
         scores.shot_selection, scores.offensive_flow, scores.defensive_intensity, scores.overall);
  res.status(201).json({ success: true, message: 'Vote submitted anonymously' });
});

module.exports = router;
