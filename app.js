// ╔══════════════════════════════════════════════════════════════╗
// ║  SUPABASE CONFIG                                             ║
// ╚══════════════════════════════════════════════════════════════╝
const SUPABASE_URL = 'https://xcczpczqaunwcxkbzbug.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y3wgtCvRTq11TnQFOb2bug_gs-yppnS';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── ÉTAT & ÉLÉMENTS ──────────────────────────────────────────────
const GROUP_COLORS = ['#0F1F45', '#536FA8', '#1B3A7A', '#274B87'];
const state = { selectedId: null, data: {}, lastCompletedId: null };
const el = {
  home:            document.getElementById('home'),
  detail:          document.getElementById('detail'),
  grid:            document.getElementById('territoryGrid'),
  search:          document.getElementById('search'),
  progress:        document.getElementById('progress'),
  back:            document.getElementById('backBtn'),
  reset:           document.getElementById('resetBtn'),
  deleteAll:       document.getElementById('deleteAllBtn'),
  readBefore:      document.getElementById('readBeforeBtn'),
  warningModal:    document.getElementById('warningModal'),
  modalOk:         document.getElementById('modalOkBtn'),
  confirmModal:    document.getElementById('confirmModal'),
  confirmText:     document.getElementById('confirmText'),
  confirmYes:      document.getElementById('confirmYesBtn'),
  confirmNo:       document.getElementById('confirmNoBtn'),
  territoryTitle:  document.getElementById('territoryTitle'),
  territoryNumber: document.getElementById('territoryNumber'),
  blok:            document.getElementById('blok'),
  proklamater:     document.getElementById('proklamater'),
  rows:            document.getElementById('rows'),
  finish:          document.getElementById('finishBtn'),
  toast:           document.getElementById('toast'),
  // Auth
  loginScreen:     document.getElementById('loginScreen'),
  loginForm:       document.getElementById('loginForm'),
  loginEmail:      document.getElementById('loginEmail'),
  loginPassword:   document.getElementById('loginPassword'),
  loginError:      document.getElementById('loginError'),
  logoutBtn:       document.getElementById('logoutBtn'),
  app:             document.querySelector('.app')
};

// ═══════════════════════════════════════════════════════════════════
// AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════
function showLoginScreen() {
  el.loginScreen.style.display = 'flex';
  el.app.hidden = true;
}
function showApp() {
  el.loginScreen.style.display = 'none';
  el.app.hidden = false;
}
async function checkAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) { showApp(); loadAllData(); }
  else { showLoginScreen(); }
}
el.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.loginError.hidden = true;
  const btn = el.loginForm.querySelector('button[type=submit]');
  btn.textContent = '…'; btn.disabled = true;
  const { error } = await db.auth.signInWithPassword({
    email:    el.loginEmail.value.trim(),
    password: el.loginPassword.value
  });
  btn.textContent = 'Se connecter'; btn.disabled = false;
  if (error) {
    el.loginError.textContent = 'Email ou mot de passe incorrect.';
    el.loginError.hidden = false;
  } else {
    showApp();
    loadAllData();
  }
});
el.logoutBtn.addEventListener('click', async () => {
  await db.auth.signOut();
  state.data = {};
  showLoginScreen();
});

// ═══════════════════════════════════════════════════════════════════
// SUPABASE — CHARGEMENT INITIAL
// ═══════════════════════════════════════════════════════════════════
async function loadAllData() {
  const { data, error } = await db.from('territories').select('*');
  if (error) { console.error('Erreur chargement Supabase :', error); return; }
  data.forEach(row => {
    state.data[row.id] = {
      blok:        row.blok || '',
      proklamater: row.proklamater || '',
      completed:   row.completed || false,
      rows:        row.rows || []
    };
  });
  renderGrid();
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE — SAUVEGARDE
// ═══════════════════════════════════════════════════════════════════
async function saveData() {
  updateProgress();
  if (!state.selectedId) return;
  const rec = state.data[state.selectedId];
  const { error } = await db.from('territories').upsert({
    id:          String(state.selectedId),
    blok:        rec.blok || '',
    proklamater: rec.proklamater || '',
    completed:   rec.completed || false,
    rows:        rec.rows || [],
    updated_at:  new Date().toISOString()
  });
  if (error) console.error('Erreur sauvegarde :', error);
}

// Sauvegarde silencieuse (pas de updateProgress) — pour saisie mobile
async function saveDataSilent() {
  if (!state.selectedId) return;
  const rec = state.data[state.selectedId];
  db.from('territories').upsert({
    id:          String(state.selectedId),
    blok:        rec.blok || '',
    proklamater: rec.proklamater || '',
    completed:   rec.completed || false,
    rows:        rec.rows || [],
    updated_at:  new Date().toISOString()
  }).then(({ error }) => { if (error) console.error('Erreur sauvegarde silencieuse :', error); });
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE — TEMPS RÉEL
// ═══════════════════════════════════════════════════════════════════
db.channel('territories-sync')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'territories' },
    (payload) => {
      const row = payload.new || payload.old;
      if (!row?.id) return;
      if (payload.eventType === 'DELETE') {
        delete state.data[row.id];
      } else {
        state.data[row.id] = {
          blok:        row.blok || '',
          proklamater: row.proklamater || '',
          completed:   row.completed || false,
          rows:        row.rows || []
        };
        if (state.selectedId === row.id) renderDetail();
      }
      updateProgress();
      renderGrid();
    }
  )
  .subscribe();

// ═══════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════════
function debounce(fn, delay = 250) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}
const saveDataDebounced = debounce(saveOpenFieldsSilent, 500);

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function newRow() {
  return { absan: false, prezan: false, nepli: false, detail: '', date: '' };
}
function currentRecord() {
  if (!state.data[state.selectedId]) {
    state.data[state.selectedId] = { blok: '', proklamater: '', completed: false, rows: [newRow()] };
  }
  if (!Array.isArray(state.data[state.selectedId].rows) || state.data[state.selectedId].rows.length === 0) {
    state.data[state.selectedId].rows = [newRow()];
  }
  return state.data[state.selectedId];
}

function syncOpenTextFields() {
  if (!state.selectedId) return;
  const rec = currentRecord();
  if (el.blok) rec.blok = el.blok.value;
  if (el.proklamater) rec.proklamater = el.proklamater.value;
  el.rows?.querySelectorAll('.lakaz-row').forEach((wrap, idx) => {
    const row = rec.rows[idx];
    if (!row) return;
    const detail = wrap.querySelector('textarea[data-field="detail"]');
    const date   = wrap.querySelector('[data-field="date"]');
    if (detail) row.detail = detail.value;
    if (date)   row.date   = date.value;
  });
}
function saveOpenFieldsSilent() { syncOpenTextFields(); saveDataSilent(); }
function saveOpenFields()       { syncOpenTextFields(); saveData(); }

function hasUsefulData(rec) {
  return !!(rec && (
    rec.completed ||
    (rec.blok || '').trim() ||
    (rec.proklamater || '').trim() ||
    (rec.rows || []).some(r => r.absan || r.prezan || r.nepli || (r.detail || '').trim() || (r.date || '').trim())
  ));
}
function updateProgress() {
  const count = Object.values(state.data).filter(hasUsefulData).length;
  el.progress.textContent = `${count} teritwar renseigné${count > 1 ? 's' : ''}`;
}
function showToast(message) {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove('show'), 1900);
}
function askConfirm(message) {
  return new Promise(resolve => {
    el.confirmText.textContent = message;
    el.confirmModal.hidden = false;
    const cleanup = (value) => {
      el.confirmModal.hidden = true;
      el.confirmYes.removeEventListener('click', yes);
      el.confirmNo.removeEventListener('click', no);
      el.confirmModal.removeEventListener('click', outside);
      resolve(value);
    };
    const yes     = () => cleanup(true);
    const no      = () => cleanup(false);
    const outside = (e) => { if (e.target === el.confirmModal) cleanup(false); };
    el.confirmYes.addEventListener('click', yes);
    el.confirmNo.addEventListener('click', no);
    el.confirmModal.addEventListener('click', outside);
  });
}
function pulse(node) {
  if (!node) return;
  node.classList.remove('reset-visual', 'changed');
  void node.offsetWidth;
  node.classList.add(node.classList.contains('lakaz-row') ? 'changed' : 'reset-visual');
}
function addRipple(e) {
  const target = e.currentTarget;
  const r = target.getBoundingClientRect();
  target.style.setProperty('--x', `${e.clientX - r.left}px`);
  target.style.setProperty('--y', `${e.clientY - r.top}px`);
  target.classList.remove('rippling');
  void target.offsetWidth;
  target.classList.add('rippling');
  setTimeout(() => target.classList.remove('rippling'), 600);
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════
const SORTED_GROUPS = [...new Set(
  POLYGONS.filter(p => p.name && p.name.trim())
    .map(p => String(p.name || '').replace(/\s*[-–—]?\s*\d+\s*$/, '').trim())
)];
function territoryGroupName(name) {
  return String(name || '').replace(/\s*[-–—]?\s*\d+\s*$/, '').trim();
}
function groupIndexFor(name) {
  return SORTED_GROUPS.indexOf(territoryGroupName(name));
}
function showHome() {
  state.selectedId = null;
  el.detail.classList.remove('active');
  el.home.classList.add('active');
  renderGrid();
  window.scrollTo(0, 0);
}
function openTerritory(id) {
  state.selectedId = String(id);
  const t = POLYGONS.find(p => String(p.id) === String(id));
  el.territoryTitle.textContent = t?.name || 'Teritwar';
  el.territoryNumber.value = t?.name || '';
  el.home.classList.remove('active');
  el.detail.classList.add('active');
  renderDetail();
  window.scrollTo(0, 0);
}
function updateTopActionVisibility(rec) {
  const isCompleted = !!rec.completed;
  el.reset.hidden    = !isCompleted;
  el.deleteAll.hidden = false;
  el.readBefore.hidden = false;
}

// ═══════════════════════════════════════════════════════════════════
// RENDU GRILLE
// ═══════════════════════════════════════════════════════════════════
function renderGrid() {
  const q = normalize(el.search.value);
  el.grid.innerHTML = '';
  POLYGONS.filter(p => p.name && p.name.trim() && normalize(p.name).includes(q)).forEach(p => {
    const b = document.createElement('button');
    b.className = 'territory-btn';
    if (hasUsefulData(state.data[p.id])) b.classList.add('has-data');
    if (state.data[p.id]?.completed) b.classList.add('completed');
    b.type = 'button';
    const gi = groupIndexFor(p.name);
    b.style.backgroundColor = GROUP_COLORS[Math.max(0, gi) % GROUP_COLORS.length];
    b.textContent = p.name;
    b.setAttribute('aria-label', `Ouvrir ${p.name}`);
    b.addEventListener('click', () => openTerritory(p.id));
    el.grid.appendChild(b);
  });
  updateProgress();
}

// ═══════════════════════════════════════════════════════════════════
// RENDU DÉTAIL
// ═══════════════════════════════════════════════════════════════════
function makeStatus(label, field, checked) {
  const wrap = document.createElement('label');
  wrap.className = 'check-label';
  wrap.title = label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.dataset.field = field;
  input.checked = !!checked;
  const span = document.createElement('span');
  span.textContent = label;
  wrap.append(input, span);
  return wrap;
}
function updateRowColor(wrap, row) {
  wrap.classList.remove('status-absan', 'status-prezan', 'status-nepli');
  if (row.nepli)       wrap.classList.add('status-nepli');
  else if (row.absan)  wrap.classList.add('status-absan');
  else if (row.prezan) wrap.classList.add('status-prezan');
}
function renderDetail() {
  const rec = currentRecord();
  updateTopActionVisibility(rec);
  el.blok.value        = rec.blok || '';
  el.proklamater.value = rec.proklamater || '';
  el.rows.innerHTML    = '';

  rec.rows.forEach((row, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'lakaz-row';
    updateRowColor(wrap, row);

    const lakaz = document.createElement('div');
    lakaz.className = 'lakaz-name';
    lakaz.textContent = `Lakaz ${idx + 1}`;

    const absan  = makeStatus('Absan',       'absan',  row.absan);
    const prezan = makeStatus('Prezan',       'prezan', row.prezan);
    const nepli  = makeStatus('Nepli Vizite', 'nepli',  row.nepli);

    const detail = document.createElement('textarea');
    detail.className = 'detail-field';
    detail.dataset.field = 'detail';
    detail.placeholder = 'Bann Detay';
    detail.value = row.detail || '';

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const date = document.createElement('input');
    date.className = 'date-field';
    date.type = row.date ? 'date' : 'text';
    date.placeholder = 'Dat';
    date.dataset.field = 'date';
    date.value = row.date || '';
    date.addEventListener('focus', () => { date.type = 'date'; });
    date.addEventListener('blur',  () => { if (!date.value) date.type = 'text'; });

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.type = 'button';
    del.title = 'Supprimer';
    del.textContent = 'Delete';

    const next = document.createElement('button');
    next.className = 'next-btn';
    next.type = 'button';
    next.textContent = 'Prosin Lakaz';

    // Checkboxes radio-like : une seule peut être cochée à la fois
    [absan, prezan, nepli].forEach(label => {
      const input = label.querySelector('input');
      input.addEventListener('change', () => {
        if (input.checked) {
          row.absan = false; row.prezan = false; row.nepli = false;
          [absan, prezan, nepli].forEach(l => { l.querySelector('input').checked = false; });
          row[input.dataset.field] = true;
          input.checked = true;
        } else {
          row[input.dataset.field] = false;
        }
        updateRowColor(wrap, row);
        pulse(wrap);
        saveData();
      });
    });

    detail.addEventListener('input', () => {
      row.detail = detail.value;
      saveDataDebounced(); // pas de re-rendu pendant la frappe mobile
    });
    detail.addEventListener('blur', () => { row.detail = detail.value; saveData(); });
    date.addEventListener('change', () => { row.date = date.value; saveData(); });

    del.addEventListener('click', async () => {
      const ok = await askConfirm(`Eski to vremem anvi efas Lakaz ${idx + 1} ?`);
      if (!ok) return;
      if (rec.rows.length === 1) { rec.rows = [newRow()]; }
      else { rec.rows.splice(idx, 1); }
      saveData();
      renderDetail();
      showToast('Lakaz inn efase');
    });
    next.addEventListener('click', () => {
      rec.rows.push(newRow());
      saveData();
      renderDetail();
      setTimeout(() => {
        const allRows = el.rows.querySelectorAll('.lakaz-row');
        allRows[allRows.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    });

    actions.append(del, next);
    wrap.append(lakaz, absan, prezan, nepli, detail, actions, date);
    el.rows.appendChild(wrap);
  });

  el.finish.classList.toggle('done', !!rec.completed);
  el.finish.textContent = rec.completed ? 'Termine ✓' : 'Termine';
}

// ═══════════════════════════════════════════════════════════════════
// ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════════
el.search.addEventListener('input', renderGrid);
el.back.addEventListener('click', showHome);

el.reset.addEventListener('click', () => {
  const rec = currentRecord();
  rec.completed   = false;
  rec.proklamater = '';
  (rec.rows || []).forEach(row => {
    row.absan = false; row.prezan = false; row.nepli = false; row.date = '';
  });
  saveData();
  renderDetail();
  pulse(document.querySelector('.detail-header'));
  pulse(document.querySelector('.meta-card'));
  document.querySelectorAll('.lakaz-row').forEach(pulse);
  showToast('Teritwar reouvert : statuts et dates effacés');
});

el.deleteAll.addEventListener('click', async () => {
  const ok = await askConfirm('Eski to vremem anvi efas tou bann Lakaz ek remet sa teritwar-la kouma nouvo ?');
  if (!ok) return;
  const rec = currentRecord();
  rec.completed   = false;
  rec.blok        = '';
  rec.proklamater = '';
  rec.rows        = [newRow()];
  saveData();
  renderDetail();
  pulse(document.querySelector('.detail-header'));
  pulse(document.querySelector('.table-card'));
  showToast('Tou inn efase : Lakaz 1 inn remet vid');
});

el.readBefore.addEventListener('click', () => { el.warningModal.hidden = false; });
el.modalOk.addEventListener('click',    () => { el.warningModal.hidden = true;  });
el.warningModal.addEventListener('click', (e) => { if (e.target === el.warningModal) el.warningModal.hidden = true; });

el.blok.addEventListener('input', () => {
  currentRecord().blok = el.blok.value;
  saveDataDebounced();
});
el.blok.addEventListener('blur', () => { currentRecord().blok = el.blok.value; saveData(); });

el.proklamater.addEventListener('input', () => {
  currentRecord().proklamater = el.proklamater.value;
  saveDataDebounced();
});
el.proklamater.addEventListener('blur', () => { currentRecord().proklamater = el.proklamater.value; saveData(); });

el.finish.addEventListener('click', () => {
  const rec = currentRecord();
  rec.completed = true;
  state.lastCompletedId = state.selectedId;
  saveData();
  el.finish.classList.add('done');
  el.finish.textContent = 'Termine ✓';
  showHome();
  showToast('Teritwar termine');
  setTimeout(() => {
    const btn = [...document.querySelectorAll('.territory-btn')]
      .find(b => b.textContent === (POLYGONS.find(p => String(p.id) === String(state.lastCompletedId))?.name));
    btn?.classList.add('reset-flash');
  }, 30);
});

// Sécurité mobile : sauvegarde avant de quitter la page
document.addEventListener('visibilitychange', () => { if (document.hidden) saveOpenFieldsSilent(); });
window.addEventListener('pagehide', saveOpenFieldsSilent);

document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('button');
  if (btn) addRipple({ currentTarget: btn, clientX: e.clientX, clientY: e.clientY });
});

// ═══════════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════════
checkAuth();
