// ====== Datos y almacenamiento (LocalStorage) ============================
const LS_KEY = 'wb_tasks_v1';
const LS_CAT = 'wb_catalogs_v1';

/** @type {Array<any>} */
let tasks = [];
let catalogs = { tipos:["General"], proyectos:["Personal"], objetivos:["General"] };

function load(){
  try{ tasks = JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch{ tasks=[] }
  try{ catalogs = JSON.parse(localStorage.getItem(LS_CAT)||'null') || catalogs }catch{}
}
function save(){
  localStorage.setItem(LS_KEY, JSON.stringify(tasks));
  localStorage.setItem(LS_CAT, JSON.stringify(catalogs));
}

// ====== Utilidades =======================================================
function escapeHtml(s){return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function getTask(id){ return tasks.find(t=>t.id===id); }

function fillSelect(sel, items){
  sel.innerHTML='';
  items.forEach(x=>{ const o=document.createElement('option'); o.value=o.textContent=x; sel.appendChild(o); });
}
function refreshFilters(){
  fillSelect(mTipo, catalogs.tipos);
  fillSelect(mProyecto, catalogs.proyectos);
  fillSelect(mObjetivo, catalogs.objetivos);
}

// ====== Render ===========================================================
const tbody = document.getElementById('tbody');
function render(){
  const list = tasks.filter(t=>!t.programadoPara && !t.fechaCompromiso);
  tbody.innerHTML='';
  list.forEach((t,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td class="right">${i+1}</td>
      <td>${escapeHtml(t.titulo)}</td>
      <td><button class="btn" onclick="openProgram('${t.id}')">Programar</button></td>
    `;
    tr.addEventListener('click', ev=>{ if(ev.target.closest('button')) return; openEdit(t.id); });
    tbody.appendChild(tr);
  });
}

// ====== Modal de edición =================================================
const modalBg = document.getElementById('modalEditBg');
const mTitulo = document.getElementById('mTitulo');
const mDescripcion = document.getElementById('mDescripcion');
const mTipo = document.getElementById('mTipo');
const mProyecto = document.getElementById('mProyecto');
const mObjetivo = document.getElementById('mObjetivo');
const mTags = document.getElementById('mTags');
const btnEliminar = document.getElementById('btnEliminar');
const modalTitle = document.getElementById('modalTitle');
let editingId = null;

function openEdit(id){
  refreshFilters();
  if(id){
    const t=getTask(id); if(!t) return;
    editingId=id;
    modalTitle.textContent='Editar tarea';
    btnEliminar.style.display='inline-flex';
    mTitulo.value=t.titulo||'';
    mDescripcion.value=t.descripcion||'';
    mTipo.value=t.tipo||catalogs.tipos[0];
    mProyecto.value=t.proyecto||catalogs.proyectos[0];
    mObjetivo.value=t.objetivo||catalogs.objetivos[0];
    mTags.value=(t.tags||[]).join(', ');
  }else{
    editingId=null;
    modalTitle.textContent='Nueva tarea';
    btnEliminar.style.display='none';
    mTitulo.value=mDescripcion.value=mTags.value='';
    mTipo.value=catalogs.tipos[0]||'General';
    mProyecto.value=catalogs.proyectos[0]||'Personal';
    mObjetivo.value=catalogs.objetivos[0]||'General';
  }
  modalBg.style.display='flex';
}
function closeEdit(){ modalBg.style.display='none'; }

function saveFromModal(){
  const data={
    titulo:mTitulo.value.trim(),
    descripcion:mDescripcion.value.trim(),
    tipo:mTipo.value,
    proyecto:mProyecto.value,
    objetivo:mObjetivo.value,
    tags:mTags.value.split(',').map(s=>s.trim()).filter(Boolean)
  };
  if(!data.titulo) return alert('Título requerido.');
  if(editingId){
    const t=getTask(editingId); Object.assign(t,data); save();
  }else{
    const t={
      id:crypto.randomUUID(),
      creadoEn:new Date().toISOString(),
      estado:'PROGRAMADO',
      sesiones:[],
      timerStart:null,
      adjuntos:[],
      programadoPara:null,
      fechaCompromiso:null,
      ...data
    };
    tasks.unshift(t); save();
  }
  closeEdit(); render();
}
function deleteCurrent(){
  if(!editingId) return;
  const idx=tasks.findIndex(x=>x.id===editingId);
  if(idx>=0){ tasks.splice(idx,1); save(); }
  closeEdit(); render();
}

// ====== Modal Programar ==================================================
const modalProgBg = document.getElementById('modalProgBg');
const pProgramado = document.getElementById('pProgramado');
const pCompromiso = document.getElementById('pCompromiso');
let progId=null;
function openProgram(id){ const t=getTask(id); if(!t) return; progId=id; pProgramado.value=t.programadoPara||''; pCompromiso.value=t.fechaCompromiso||''; modalProgBg.style.display='flex'; }
function closeProgram(){ modalProgBg.style.display='none'; progId=null; }
function saveProgram(){ const t=getTask(progId); if(!t) return; t.programadoPara=pProgramado.value||null; t.fechaCompromiso=pCompromiso.value||null; save(); closeProgram(); render(); }

// ====== Catálogos ========================================================
const ui={
  addCatalog(kind){
    const name=prompt('Nuevo '+kind+':');
    if(!name) return;
    const list=kind==='tipo'?catalogs.tipos:(kind==='proyecto'?catalogs.proyectos:catalogs.objetivos);
    if(!list.includes(name)) list.push(name);
    save(); refreshFilters();
  }
};

// ====== Eventos ==========================================================
document.getElementById('btnNueva').addEventListener('click',()=>openEdit(null));
document.getElementById('menuToggle')?.addEventListener('click',()=>{ document.body.classList.toggle('collapsed'); });

// Expose globals for inline handlers
window.openProgram=openProgram;
window.closeProgram=closeProgram;
window.saveProgram=saveProgram;
window.openEdit=openEdit;
window.closeEdit=closeEdit;
window.saveFromModal=saveFromModal;
window.deleteCurrent=deleteCurrent;
window.ui=ui;

// ====== Boot =============================================================
load();
render();
