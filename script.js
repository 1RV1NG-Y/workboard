  // ====== Datos y almacenamiento (LocalStorage) ============================
  const LS_KEY = 'wb_tasks_v1';
  const LS_CAT = 'wb_catalogs_v1';

  /** @type {Array<Task>} */
  let tasks = [];
  let catalogs = { tipos:["General"], proyectos:["Personal"], objetivos:["General"] };

function load(){
  try{
    tasks = JSON.parse(localStorage.getItem(LS_KEY)||'[]');
  }catch{ tasks=[] }
  // convertir cadenas de fecha en números (ms)
  tasks.forEach(t=>{
    t.timerStart = t.timerStart ? +new Date(t.timerStart) : null;
    t.sesiones = (t.sesiones||[]).map(s=>({
      start:+new Date(s.start),
      end: s.end? +new Date(s.end): null
    }));
  });
  try{ catalogs = JSON.parse(localStorage.getItem(LS_CAT)||'null') || catalogs }catch{}
}
  function save(){
    localStorage.setItem(LS_KEY, JSON.stringify(tasks));
    localStorage.setItem(LS_CAT, JSON.stringify(catalogs));
  }

  // ====== Utilidades de tiempo ============================================
  const dayStart = (d)=> new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayEnd   = (d)=> new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);
  const fmtHM = (ms)=>{
    if(!ms||ms<0) return '00:00';
    const m = Math.floor(ms/60000), h = Math.floor(m/60), mm = (m%60).toString().padStart(2,'0');
    return `${h.toString().padStart(2,'0')}:${mm}`
  }
  const localDateISO = (d=new Date())=>{
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  const overlapMs = (aStart, aEnd, bStart, bEnd)=>{
    const s = Math.max(aStart, bStart), e = Math.min(aEnd, bEnd);
    return Math.max(0, e - s);
  }

  // ====== Estado derivado ==================================================
  function deriveState(t, refDate=new Date()){
    if(t.estado === 'CERRADO') return 'CERRADO';
    const running = !!t.timerStart;
    if(running) return 'TRABAJANDO';
    const spent = getTotalMs(t);
    if(spent>0) return 'EMPEZADO';
    if(t.fechaCompromiso){
      const today = dayStart(refDate);
      const comp = dayStart(new Date(t.fechaCompromiso + 'T00:00:00'));
      if(today > comp) return 'REZAGADO';
    }
    return 'PROGRAMADO';
  }

  function getTotalMs(t){
    let sum = 0;
    (t.sesiones||[]).forEach(s=>{
      const end = s.end ?? Date.now();
      sum += Math.max(0, end - s.start);
    });
    // si hay timerStart sin sesión abierta
    if(t.timerStart && !(t.sesiones||[]).some(s=>!s.end)){
      sum += Date.now() - t.timerStart;
    }
    return sum;
  }

  function getDayMs(t, day){
    const S = +(dayStart(day));
    const E = +(dayEnd(day));
    let sum = 0;
    (t.sesiones||[]).forEach(s=>{
      const sEnd = s.end ?? Date.now();
      sum += overlapMs(+s.start, +sEnd, S, E);
    });
    if(t.timerStart){
      sum += overlapMs(+t.timerStart, Date.now(), S, E);
    }
    return sum;
  }

  // ====== UI / Filtros =====================================================
  const tbody = document.getElementById('tbody');
  const fProyecto = document.getElementById('fProyecto');
  const fObjetivo = document.getElementById('fObjetivo');
  const fTipo = document.getElementById('fTipo');
  const fFecha = document.getElementById('fFecha');
  const q = document.getElementById('q');

  function setToday(){
    const today = new Date();
    fFecha.valueAsDate = today;
  }

  function fillSelect(sel, items, withAll=true){
    sel.innerHTML = '';
    if(withAll){ const opt = document.createElement('option'); opt.value=''; opt.textContent='(Todos)'; sel.appendChild(opt); }
    items.forEach(x=>{ const o=document.createElement('option'); o.value=o.textContent=x; sel.appendChild(o); });
  }

  function refreshFilters(){
    fillSelect(fProyecto, catalogs.proyectos);
    fillSelect(fObjetivo, catalogs.objetivos);
    fillSelect(fTipo, catalogs.tipos);
  }

  function render(){
    const boardDate = fFecha.value ? new Date(fFecha.value + 'T00:00:00') : new Date();
    const today = dayStart(new Date());
    const boardDay = dayStart(boardDate);
    const text = q.value.trim().toLowerCase();
    const fp = fProyecto.value, fo = fObjetivo.value, ft = fTipo.value;

    const filtered = tasks.filter(t=>{
      if(!t.programadoPara && !t.fechaCompromiso) return false; // omit tasks sin fecha (backlog)
      if(fp && t.proyecto!==fp) return false;
      if(fo && t.objetivo!==fo) return false;
      if(ft && t.tipo!==ft) return false;
      if(text){
        const blob = `${t.titulo} ${t.descripcion||''} ${(t.tags||[]).join(',')}`.toLowerCase();
        if(!blob.includes(text)) return false;
      }
      const st = deriveState(t, boardDay);
      const prog = t.programadoPara ? dayStart(new Date(t.programadoPara + 'T00:00:00')) : null;
      const fin = t.fechaTerminada ? dayStart(new Date(t.fechaTerminada + 'T00:00:00')) : null;
      if(boardDay < today){
        return st==='CERRADO' && fin && +fin===+boardDay;
      }
      if(boardDay > today){
        return st!=='CERRADO' && prog && +prog===+boardDay;
      }
      if(st==='CERRADO'){
        return fin && +fin===+boardDay;
      }
      return prog && +prog <= +boardDay;
    });

    tbody.innerHTML = '';

    let kProg=0,kTrab=0,kRez=0,kCer=0;

    filtered
      .sort((a,b)=>{
        // Orden: rezagado > trabajando > programado > empezado > otros, luego compromiso
        const rank = s=>({REZAGADO:0, TRABAJANDO:1, PROGRAMADO:2, EMPEZADO:3, CERRADO:9})[s] ?? 4;
        const da = rank(deriveState(a, boardDay)), db = rank(deriveState(b, boardDay));
        if(da!==db) return da-db;
        const ca = a.fechaCompromiso? +new Date(a.fechaCompromiso): Number.MAX_SAFE_INTEGER;
        const cb = b.fechaCompromiso? +new Date(b.fechaCompromiso): Number.MAX_SAFE_INTEGER;
        return ca-cb;
      })
      .forEach((t,i)=>{
        const st = deriveState(t, boardDay);
        if(st==='PROGRAMADO') kProg++;
        if(st==='TRABAJANDO') kTrab++;
        if(st==='REZAGADO') kRez++;
        if(st==='CERRADO') kCer++;

        const tr = document.createElement('tr');
        tr.className = 'row--'+st.toLowerCase();
        const title = st==='REZAGADO'? t.titulo+'-rezagado' : t.titulo;
        tr.innerHTML = `
          <td class="control">${controlsHtml(t, boardDay)}</td>
          <td class="right">${i+1}</td>
          <td>
            <div style=\"display:flex;align-items:center;gap:8px\">
              <span class=\"status-dot st-${st.toLowerCase()}\"></span>
              <div>
                <div style=\"font-weight:600\">${escapeHtml(title)}</div>
                <div class=\"muted small\">${escapeHtml(t.proyecto||'—')} · ${escapeHtml(t.objetivo||'—')} · <span class=\"chip\">${escapeHtml(t.tipo||'General')}</span></div>
              </div>
            </div>
          </td>
          <td><span class=\"badge ${st.toLowerCase()}\">${st}</span></td>
          <td>${t.fechaCompromiso? new Date(t.fechaCompromiso).toLocaleDateString(): '—'}</td>
          <td>${fmtHM(getTotalMs(t))}</td>
          <td>${fmtHM(getDayMs(t, boardDay))}</td>
          <td>
            <div style=\"position:relative\">
              <button class=\"menu-btn\" onclick=\"openMenu(event, '${t.id}')\">⋮</button>
            </div>
          </td>
        `;
        // abrir detalles al hacer click en la fila (excepto botón menú)
        tr.addEventListener('click', (ev)=>{
          if(ev.target.closest('button')) return; // no abrir desde botón
          openEdit(t.id);
        });
        tbody.appendChild(tr);
      });

    document.getElementById('kProg').textContent = kProg;
    document.getElementById('kTrab').textContent = kTrab;
    document.getElementById('kRez').textContent = kRez;
    document.getElementById('kCer').textContent = kCer;
  }

  function escapeHtml(s){return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}

  // ====== Botones por fila (izquierda) =====================================
  function controlsHtml(t, refDate=new Date()){
    const st = deriveState(t, refDate);
    if(st==='TRABAJANDO'){
      // Pausa + Cerrar
      return `<button class=\"icon-btn pause\" title=\"Pausar\" onclick=\"rowAction('pause','${t.id}',event)\">⏸</button>
              <button class=\"icon-btn check\" title=\"Cerrar\" onclick=\"rowAction('close','${t.id}',event)\">✓</button>`;
    }
    if(st==='CERRADO'){
      return `<button class=\"icon-btn disabled\" title=\"Cerrado\" disabled>✓</button>`;
    }
    // default: play
    return `<button class=\"icon-btn play\" title=\"Iniciar\" onclick=\"rowAction('play','${t.id}',event)\">▶</button>`;
  }

  function rowAction(kind, id, ev){
    ev.stopPropagation();
    const t = getTask(id); if(!t) return;
    if(kind==='play'){
      if(!t.timerStart){ t.timerStart = Date.now(); save(); render(); }
      return;
    }
    if(kind==='pause'){
      if(t.timerStart){ toggleTimer(t); save(); render(); }
      return;
    }
    if(kind==='close'){
      openClose(id);
    }
  }

  // ====== Menú por fila ====================================================
  const rowMenu = document.getElementById('rowMenu');
  let currentMenuTaskId = null;

  function openMenu(ev, id){
    ev.stopPropagation();
    currentMenuTaskId = id;
    const btn = ev.currentTarget;
    const rect = btn.getBoundingClientRect();
    rowMenu.style.top = (window.scrollY + rect.bottom + 6) + 'px';
    rowMenu.style.left = (window.scrollX + rect.left - 120) + 'px';
    rowMenu.classList.add('open');
  }
  document.addEventListener('click', ()=> rowMenu.classList.remove('open'));

  const actions = {
    detalles(){ openEdit(currentMenuTaskId); },
    playPause(){ const t = getTask(currentMenuTaskId); if(!t) return; toggleTimer(t); save(); render(); },
    programarHoy(){ const t=getTask(currentMenuTaskId); if(!t) return; t.programadoPara = localDateISO(); save(); render(); },
    cerrar(){ const t=getTask(currentMenuTaskId); if(!t) return; openClose(t.id); },
    eliminar(){ if(!editingId) return; const idx = tasks.findIndex(x=>x.id===editingId); if(idx>=0){ tasks.splice(idx,1); save(); closeEdit(); render(); } },
    guardar(){ saveFromModal(); }
  }

  function getTask(id){ return tasks.find(t=>t.id===id); }

  // ====== Timer ============================================================
  function toggleTimer(t){
    if(t.estado==='CERRADO') return alert('La tarea está cerrada.');
    if(t.timerStart){
      // Pausar: cierra sesión activa
      t.sesiones = t.sesiones||[];
      t.sesiones.push({ start: t.timerStart, end: Date.now() });
      t.timerStart = null;
    }else{
      t.timerStart = Date.now();
    }
  }

  // ====== Cerrar con adjunto + recurrencia ================================
  function closeTask(t){
    if(!t.adjuntos || t.adjuntos.length===0){
      return alert('Para cerrar necesitas al menos un archivo adjunto.');
    }
    if(t.timerStart){ toggleTimer(t); }
    t.estado = 'CERRADO';
    t.fechaTerminada = localDateISO();
    // recurrencia -> crear siguiente
    if(t.recurrencia && t.recurrencia!=='ninguna'){
      const next = JSON.parse(JSON.stringify(t));
      next.id = crypto.randomUUID();
      next.estado = 'PROGRAMADO';
      next.sesiones = [];
      next.timerStart = null;
      next.adjuntos = [];
      next.fechaTerminada = null;
      // calcular próxima fecha programado/compromiso
      const base = t.programadoPara ? new Date(t.programadoPara) : new Date();
      if(t.recurrencia==='sabados'){
        const d = new Date(base);
        d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); // próximo sábado
        next.programadoPara = localDateISO(d);
        if(t.fechaCompromiso) next.fechaCompromiso = next.programadoPara;
      }else if(t.recurrencia==='fin_mes'){
        const nextMonthEnd = new Date(base.getFullYear(), base.getMonth()+2, 0);
        next.programadoPara = localDateISO(nextMonthEnd);
        if(t.fechaCompromiso) next.fechaCompromiso = next.programadoPara;
      }
      tasks.push(next);
    }
    save(); render();
  }

  // ====== Modal de edición ================================================
  const modalBg = document.getElementById('modalEditBg');
  const mTitulo = document.getElementById('mTitulo');
  const mDescripcion = document.getElementById('mDescripcion');
  const mTipo = document.getElementById('mTipo');
  const mProyecto = document.getElementById('mProyecto');
  const mObjetivo = document.getElementById('mObjetivo');
  const mProgramado = document.getElementById('mProgramado');
  const mCompromiso = document.getElementById('mCompromiso');
  const mTags = document.getElementById('mTags');
  const mRecurrencia = document.getElementById('mRecurrencia');
  const mFile = document.getElementById('mFile');
  const mAdjuntos = document.getElementById('mAdjuntos');
  const btnEliminar = document.getElementById('btnEliminar');
  const modalTitle = document.getElementById('modalTitle');

  let editingId = null;

  function openEdit(id){
    refreshFilters(); // también repuebla selects del modal
    // llenar selects del modal
    fillSelect(mTipo, catalogs.tipos, false);
    fillSelect(mProyecto, catalogs.proyectos, false);
    fillSelect(mObjetivo, catalogs.objetivos, false);

    if(id){
      const t = getTask(id); if(!t) return;
      editingId = id;
      modalTitle.textContent = 'Editar tarea';
      btnEliminar.style.display = 'inline-flex';
      mTitulo.value = t.titulo||'';
      mDescripcion.value = t.descripcion||'';
      mTipo.value = t.tipo||'General';
      mProyecto.value = t.proyecto||'Personal';
      mObjetivo.value = t.objetivo||'General';
      mProgramado.value = t.programadoPara||'';
      mCompromiso.value = t.fechaCompromiso||'';
      mTags.value = (t.tags||[]).join(', ');
      mRecurrencia.value = t.recurrencia||'ninguna';
      renderAdjuntos(t);
    }else{
      editingId = null;
      modalTitle.textContent = 'Nueva tarea';
      btnEliminar.style.display = 'none';
      mTitulo.value = mDescripcion.value = mTags.value = '';
      mTipo.value = catalogs.tipos[0]||'General';
      mProyecto.value = catalogs.proyectos[0]||'Personal';
      mObjetivo.value = catalogs.objetivos[0]||'General';
      mProgramado.value = mCompromiso.value = '';
      mRecurrencia.value = 'ninguna';
      mAdjuntos.innerHTML = '';
    }
    modalBg.style.display = 'flex';
  }
  function closeEdit(){ modalBg.style.display='none'; }

  function renderAdjuntos(t){
    mAdjuntos.innerHTML = '';
    (t.adjuntos||[]).forEach((a,idx)=>{
      const row = document.createElement('div');
      row.style.display='flex'; row.style.alignItems='center'; row.style.justifyContent='space-between'; row.style.gap='12px'; row.style.padding='6px 0';
      row.innerHTML = `<div>📎 ${escapeHtml(a.name)} <span class="muted">(${Math.round((a.size||0)/1024)} KB)</span></div>`;
      const del = document.createElement('button'); del.className='btn'; del.textContent='Quitar'; del.onclick=()=>{ t.adjuntos.splice(idx,1); save(); renderAdjuntos(t); render(); };
      row.appendChild(del);
      mAdjuntos.appendChild(row);
    });
  }

  const ui = {
    addCatalog(kind){
      const name = prompt('Nuevo '+kind+':');
      if(!name) return;
      const list = kind==='tipo'? catalogs.tipos : (kind==='proyecto'? catalogs.proyectos : catalogs.objetivos);
      if(!list.includes(name)) list.push(name);
      save(); refreshFilters();
      if(kind==='tipo') fillSelect(mTipo, catalogs.tipos, false);
      if(kind==='proyecto') fillSelect(mProyecto, catalogs.proyectos, false);
      if(kind==='objetivo') fillSelect(mObjetivo, catalogs.objetivos, false);
    },
    attachSelected(){
      const file = mFile.files[0];
      if(!file){ alert('Elige un archivo primero.'); return; }
      if(file.size > 1024*1024*2){ // 2MB límite prudente
        if(!confirm('El archivo pesa más de 2 MB. Guardarlo puede fallar en localStorage. ¿Continuar?')) return;
      }
      const reader = new FileReader();
      reader.onload = ()=>{
        const t = editingId? getTask(editingId) : (editingId=null, null);
        if(!t){ alert('Guarda primero la tarea para adjuntar.'); return; }
        t.adjuntos = t.adjuntos||[];
        t.adjuntos.push({ name:file.name, type:file.type, size:file.size, dataUrl:reader.result });
        save(); renderAdjuntos(t); render(); mFile.value='';
      };
      reader.readAsDataURL(file);
    }
  }

  function saveFromModal(){
    const data = {
      titulo: mTitulo.value.trim(),
      descripcion: mDescripcion.value.trim(),
      tipo: mTipo.value,
      proyecto: mProyecto.value,
      objetivo: mObjetivo.value,
      programadoPara: mProgramado.value || null,
      fechaCompromiso: mCompromiso.value || null,
      tags: mTags.value.split(',').map(s=>s.trim()).filter(Boolean),
      recurrencia: mRecurrencia.value
    };
    if(!data.titulo) return alert('Título requerido.');

    if(editingId){
      const t = getTask(editingId); Object.assign(t, data); save();
    }else{
      const t = {
        id: crypto.randomUUID(),
        creadoEn: new Date().toISOString(),
        estado: 'PROGRAMADO',
        sesiones: [],
        timerStart: null,
        adjuntos: [],
        ...data
      };
      tasks.unshift(t); save();
    }
    closeEdit(); render();
  }

  // ====== Cierre (modal) ====================================================
  let closingId = null;
  const modalCloseBg = document.getElementById('modalCloseBg');
  const cFile = document.getElementById('cFile');
  const cAdjuntos = document.getElementById('cAdjuntos');
  const cInfo = document.getElementById('cInfo');

  function openClose(id){
    const t = getTask(id); if(!t) return;
    if(!t.timerStart){ alert('Solo puedes cerrar una tarea que esté TRABAJANDO.'); return; }
    closingId = id;
    cFile.value='';
    renderCloseAdj();
    cInfo.textContent = `Tarea: ${t.titulo}`;
    modalCloseBg.style.display='flex';
  }
  function closeClose(){ modalCloseBg.style.display='none'; closingId=null; }
  function renderCloseAdj(){
    const t = getTask(closingId); if(!t) return; cAdjuntos.innerHTML='';
    (t.adjuntos||[]).forEach((a,idx)=>{
      const row = document.createElement('div');
      row.style.display='flex'; row.style.alignItems='center'; row.style.justifyContent='space-between'; row.style.gap='12px'; row.style.padding='6px 0';
      row.innerHTML = `<div>📎 ${escapeHtml(a.name)} <span class=\"muted\">(${Math.round((a.size||0)/1024)} KB)</span></div>`;
      const del = document.createElement('button'); del.className='btn'; del.textContent='Quitar'; del.onclick=()=>{ t.adjuntos.splice(idx,1); save(); renderCloseAdj(); };
      row.appendChild(del); cAdjuntos.appendChild(row);
    });
  }
  function attachSelectedClose(){
    const file = cFile.files[0]; if(!file){ alert('Elige un archivo.'); return; }
    const reader = new FileReader();
    reader.onload = ()=>{ const t=getTask(closingId); t.adjuntos=t.adjuntos||[]; t.adjuntos.push({name:file.name,type:file.type,size:file.size,dataUrl:reader.result}); save(); renderCloseAdj(); };
    reader.readAsDataURL(file);
  }
  function confirmClose(){ const t=getTask(closingId); if(!t) return; closeTask(t); closeClose(); }

  // ====== Export ===========================================================
  document.getElementById('btnExport').addEventListener('click', ()=>{
    const payload = { tasks, catalogs, exportedAt:new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tablero_personal.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ====== Eventos de UI ====================================================
  document.getElementById('btnNueva').addEventListener('click', ()=> openEdit(null));
  document.getElementById('btnHoy').addEventListener('click', ()=> { setToday(); render(); });
  [q,fProyecto,fObjetivo,fTipo,fFecha].forEach(el=> el.addEventListener('input', render));

  // ====== Boot =============================================================
  load();
  setToday();
  refreshFilters();
  render();
  // refrescar cada 5 minutos para mostrar tiempo transcurrido
  setInterval(render, 5*60*1000);

  // ====== Tip: arrastra JSON al tablero para importar ======================
  window.addEventListener('dragover', e=>{e.preventDefault();});
  window.addEventListener('drop', e=>{
    e.preventDefault();
    const f = e.dataTransfer.files?.[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const obj = JSON.parse(reader.result);
        if(obj.tasks && obj.catalogs){ tasks=obj.tasks; catalogs=obj.catalogs; save(); render(); alert('Importado OK'); }
        else{ alert('JSON no reconocido.'); }
      }catch{ alert('JSON inválido.'); }
    };
    reader.readAsText(f);
  });

  // ====== Tip: click en badge para alternar play/pausa =====================
  tbody.addEventListener('click', (e)=>{
    const row = e.target.closest('tr');
    if(!row) return;
  });

  // ====== Tip: click fuera cierra menú ====================================
  document.getElementById('menuToggle')?.addEventListener('click', ()=>{
    document.body.classList.toggle('collapsed');
  });
