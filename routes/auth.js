const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.post('/create-user', requireAuth, (req, res) => {
  if (req.user.role !== 'coach' && req.user.role !== 'manager') return res.status(403).json({ error: 'Not authorized' });
  const { username, password, role } = req.body;
  if (!username || !password || !['player','coach','manager'].includes(role)) {
    return res.status(400).json({ error: 'username, password, and valid role required' });
  }
  try {
    const info = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
      .run(username, bcrypt.hashSync(password, 10), role);
    res.status(201).json({ id: info.lastInsertRowid, username, role });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
    throw e;
  }
});

router.get('/users', requireAuth, (req, res) => {
  if (req.user.role !== 'coach' && req.user.role !== 'manager') return res.status(403).json({ error: 'Not authorized' });
  res.json(db.prepare('SELECT id, username, role, created_at FROM users ORDER BY role, username').all());
});

router.delete('/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'coach' && req.user.role !== 'manager') return res.status(403).json({ error: 'Not authorized' });
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
