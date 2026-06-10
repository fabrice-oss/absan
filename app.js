const STORAGE_KEY = 'fey-not-absan-flacq-v9';
const GROUP_COLORS = ['#0F1F45', '#536FA8', '#1B3A7A', '#274B87'];
const state = { selectedId: null, data: loadData() };
const el = {
  home: document.getElementById('home'),
  detail: document.getElementById('detail'),
  grid: document.getElementById('territoryGrid'),
  search: document.getElementById('search'),
  progress: document.getElementById('progress'),
  back: document.getElementById('backBtn'),
  territoryTitle: document.getElementById('territoryTitle'),
  territoryNumber: document.getElementById('territoryNumber'),
  blok: document.getElementById('blok'),
  proklamater: document.getElementById('proklamater'),
  rows: document.getElementById('rows'),
  addRow: document.getElementById('addRowBtn')
};

function loadData(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  updateProgress();
}
function normalize(s){
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function newRow(n){
  return { absan:false, prezan:false, nepli:false, detail:'', date:'' };
}
function currentRecord(){
  if(!state.data[state.selectedId]) state.data[state.selectedId] = { blok:'', proklamater:'', rows:[newRow(1)] };
  if(!Array.isArray(state.data[state.selectedId].rows) || state.data[state.selectedId].rows.length === 0){
    state.data[state.selectedId].rows = [newRow(1)];
  }
  return state.data[state.selectedId];
}
function hasUsefulData(rec){
  return !!(rec && ((rec.blok || '').trim() || (rec.proklamater || '').trim() || (rec.rows || []).some(r => r.absan || r.prezan || r.nepli || (r.detail || '').trim() || (r.date || '').trim())));
}
function updateProgress(){
  const count = Object.values(state.data).filter(hasUsefulData).length;
  el.progress.textContent = `${count} teritwar renseigné${count > 1 ? 's' : ''}`;
}
function showHome(){
  state.selectedId = null;
  el.detail.classList.remove('active');
  el.home.classList.add('active');
  renderGrid();
  window.scrollTo(0,0);
}
function openTerritory(id){
  state.selectedId = String(id);
  const t = POLYGONS.find(p => String(p.id) === String(id));
  el.territoryTitle.textContent = t?.name || 'Teritwar';
  el.territoryNumber.value = t?.name || '';
  el.home.classList.remove('active');
  el.detail.classList.add('active');
  renderDetail();
  window.scrollTo(0,0);
}
function territoryGroupName(name){
  return String(name || '').replace(/\s*[-–—]?\s*\d+\s*$/,'').trim();
}
function groupIndexFor(name){
  const group = territoryGroupName(name);
  return SORTED_GROUPS.indexOf(group);
}
const SORTED_GROUPS = [...new Set(POLYGONS.filter(p => p.name && p.name.trim()).map(p => territoryGroupName(p.name)))];

function renderGrid(){
  const q = normalize(el.search.value);
  el.grid.innerHTML = '';
  POLYGONS.filter(p => p.name && p.name.trim() && normalize(p.name).includes(q)).forEach(p => {
    const b = document.createElement('button');
    b.className = 'territory-btn';
    if(hasUsefulData(state.data[p.id])) b.classList.add('has-data');
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
function makeStatus(label, field, checked){
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
function updateRowColor(wrap, row){
  wrap.classList.remove('status-absan','status-prezan','status-nepli');
  if(row.nepli) wrap.classList.add('status-nepli');
  else if(row.absan) wrap.classList.add('status-absan');
  else if(row.prezan) wrap.classList.add('status-prezan');
}

function renderDetail(){
  const rec = currentRecord();
  el.blok.value = rec.blok || '';
  el.proklamater.value = rec.proklamater || '';
  el.rows.innerHTML = '';

  rec.rows.forEach((row, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'lakaz-row';
    updateRowColor(wrap, row);

    const lakaz = document.createElement('div');
    lakaz.className = 'lakaz-name';
    lakaz.textContent = `Lakaz ${idx + 1}`;

    const absan = makeStatus('Absan', 'absan', row.absan);
    const prezan = makeStatus('Prezan', 'prezan', row.prezan);
    const nepli = makeStatus('Nepli Vizite', 'nepli', row.nepli);

    const detail = document.createElement('textarea');
    detail.className = 'detail-field';
    detail.dataset.field = 'detail';
    detail.placeholder = 'Bann Detay';
    detail.value = row.detail || '';

    const date = document.createElement('input');
    date.type = 'date';
    date.dataset.field = 'date';
    date.value = row.date || '';

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.type = 'button';
    del.title = 'Supprimer';
    del.textContent = '×';

    [absan, prezan, nepli].forEach(label => {
      const input = label.querySelector('input');
      input.addEventListener('change', () => {
        row[input.dataset.field] = input.checked;
        updateRowColor(wrap, row);
        saveData();
      });
    });
    detail.addEventListener('input', () => { row.detail = detail.value; saveData(); });
    date.addEventListener('change', () => { row.date = date.value; saveData(); });
    del.addEventListener('click', () => {
      if(rec.rows.length === 1){ rec.rows = [newRow(1)]; }
      else { rec.rows.splice(idx, 1); }
      saveData();
      renderDetail();
    });

    wrap.append(lakaz, absan, prezan, nepli, detail, date, del);
    el.rows.appendChild(wrap);
  });
  saveData();
}

el.search.addEventListener('input', renderGrid);
el.back.addEventListener('click', showHome);
el.blok.addEventListener('input', () => { currentRecord().blok = el.blok.value; saveData(); });
el.proklamater.addEventListener('input', () => { currentRecord().proklamater = el.proklamater.value; saveData(); });
el.addRow.addEventListener('click', () => {
  const rec = currentRecord();
  rec.rows.push(newRow(rec.rows.length + 1));
  saveData();
  renderDetail();
});
renderGrid();
