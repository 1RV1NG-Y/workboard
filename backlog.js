// ====== Datos y almacenamiento (LocalStorage) ============================
const LS_KEY = 'wb_tasks_v1';
const LS_CAT = 'wb_catalogs_v1';

/** @type {Array<any>} */
let tasks = [];
let catalogs = { tipos:["General"], proyectos:["Personal"], objetivos:["General"] };

function load(){
  try{ tasks = JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch{ tasks=[]; }
  try{ catalogs = JSON.parse(localStorage.getItem(LS_CAT)||'null') || catalogs; }catch{}
}
function save(){
  localStorage.setItem(LS_KEY, JSON.stringify(tasks));
  localStorage.setItem(LS_CAT, JSON.stringify(catalogs));
}

// ====== Utilidades =======================================================
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
function getTask(id){ return tasks.find(t=>t.id===id); }
function fillSelect(sel, items){ sel.innerHTML=''; items.forEach(x=>{ const o=document.createElement('option'); o.value=o.textContent=x; sel.appendChild(o); }); }
function fillSelects(){ fillSelect(mTipo, catalogs.tipos); fillSelect(mProyecto, catalogs.proyectos); fillSelect(mObjetivo, catalogs.objetivos); }

function addCatalog(kind){
  const name = prompt('Nuevo '+kind+':');
  if(!name) return;
  const list = kind==='tipo'? catalogs.tipos : (kind==='proyecto'? catalogs.proyectos : catalogs.objetivos);
  if(!list.includes(name)) list.push(name);
  save(); fillSelects();
}

// ====== UI ================================================================
const tbody = document.getElementById('tbody');
const btnNueva = document.getElementById('btnNueva');
btnNueva.addEventListener('click', ()=> openEdit());

tbody.addEventListener('click', ev=>{
  const btn = ev.target.closest('button');
  if(!btn) return;
  const id = btn.getAttribute('data-id');
  if(btn.classList.contains('programar')) openProgramar(id);
});

function render(){
  const list = tasks.filter(t=> !t.programadoPara && !t.fechaCompromiso);
  tbody.innerHTML='';
  list.forEach(t=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.titulo)}</td>
      <td>${escapeHtml(t.proyecto||'—')}</td>
      <td>${escapeHtml(t.objetivo||'—')}</td>
      <td><span class="chip">${escapeHtml(t.tipo||'General')}</span></td>
      <td><button class="btn programar" data-id="${t.id}">Programar</button></td>`;
    tbody.appendChild(tr);
  });
}

// ====== Modal crear =======================================================
let editingId = null;
const modalEditBg = document.getElementById('modalEditBg');
const mTitulo = document.getElementById('mTitulo');
const mDescripcion = document.getElementById('mDescripcion');
const mTipo = document.getElementById('mTipo');
const mProyecto = document.getElementById('mProyecto');
const mObjetivo = document.getElementById('mObjetivo');
const mTags = document.getElementById('mTags');

function openEdit(){
  editingId = null;
  mTitulo.value='';
  mDescripcion.value='';
  mTags.value='';
  fillSelects();
  modalEditBg.style.display='flex';
}
function closeEdit(){ modalEditBg.style.display='none'; editingId=null; }

function saveFromModal(){
  const data = {
    titulo: mTitulo.value.trim(),
    descripcion: mDescripcion.value.trim(),
    tipo: mTipo.value,
    proyecto: mProyecto.value,
    objetivo: mObjetivo.value,
    tags: mTags.value.split(',').map(s=>s.trim()).filter(Boolean)
  };
  if(!data.titulo) return alert('Título requerido.');
  const t = {
    id: crypto.randomUUID(),
    creadoEn: new Date().toISOString(),
    estado: 'PROGRAMADO',
    sesiones: [],
    timerStart: null,
    programadoPara: null,
    fechaCompromiso: null,
    recurrencia: 'ninguna',
    adjuntos: [],
    ...data
  };
  tasks.unshift(t); save(); closeEdit(); render();
}

// ====== Modal programar ===================================================
let progId = null;
const modalProgBg = document.getElementById('modalProgBg');
const pProgramado = document.getElementById('pProgramado');
const pCompromiso = document.getElementById('pCompromiso');

function openProgramar(id){
  const t = getTask(id); if(!t) return;
  progId = id;
  pProgramado.value = t.programadoPara||'';
  pCompromiso.value = t.fechaCompromiso||'';
  modalProgBg.style.display='flex';
}
function closeProgramar(){ modalProgBg.style.display='none'; progId=null; }
function saveProgramar(){
  const t = getTask(progId); if(!t) return;
  t.programadoPara = pProgramado.value || null;
  t.fechaCompromiso = pCompromiso.value || null;
  save(); closeProgramar(); render();
}

// ====== Boot ==============================================================
load();
fillSelects();
render();

document.getElementById('menuToggle')?.addEventListener('click', ()=>{
  document.body.classList.toggle('collapsed');
});
