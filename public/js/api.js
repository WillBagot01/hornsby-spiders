const API = (() => {
  const BASE = '/api';
  const getToken = () => localStorage.getItem('spiders_token');
  const setToken = t => t ? localStorage.setItem('spiders_token', t) : localStorage.removeItem('spiders_token');
  const setUser  = u => u ? localStorage.setItem('spiders_user', JSON.stringify(u)) : localStorage.removeItem('spiders_user');
  const getUser  = () => { try { return JSON.parse(localStorage.getItem('spiders_user')); } catch { return null; } };

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res  = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
    return data;
  }

  return {
    getToken, setToken, setUser, getUser,
    login:       (u, p) => request('POST', '/auth/login', { username: u, password: p }),
    me:          ()     => request('GET',  '/auth/me'),
    createUser:  d      => request('POST', '/auth/create-user', d),
    listUsers:   ()     => request('GET',  '/auth/users'),
    deleteUser:  id     => request('DELETE', `/auth/users/${id}`),
    getTeams:    ()     => request('GET',  '/scout/teams'),
    getTeam:     id     => request('GET',  `/scout/team/${id}`),
    saveTeamInfo:(id,d) => request('PUT',  `/scout/team/${id}/info`, d),
    savePlayer:  (id,d) => request('PUT',  `/scout/player/${id}`, d),
    getGames:    ()     => request('GET',  '/games'),
    createGame:  d      => request('POST', '/games', d),
    updateGame:  (id,d) => request('PUT',  `/games/${id}`, d),
    deleteGame:  id     => request('DELETE', `/games/${id}`),
    getResults:  id     => request('GET',  `/games/${id}/results`),
    vote:        (id,d) => request('POST', `/games/${id}/vote`, d),
  };
+})();
