import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, getRedirectResult,
         signOut, onAuthStateChanged }           from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, doc,
         setDoc, deleteDoc, onSnapshot }         from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// ── FIREBASE CONFIG ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCD1uMNkBMdbArrv4zKppc54Lgxg66xMdo",
  authDomain:        "dad-med-tracker.firebaseapp.com",
  projectId:         "dad-med-tracker",
  storageBucket:     "dad-med-tracker.firebasestorage.app",
  messagingSenderId: "1043260614123",
  appId:             "1:1043260614123:web:352f4cfa5ee621f22425ae"
};
// ────────────────────────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Handle redirect result for mobile browsers (e.g. iOS Safari) that fall back
// from signInWithPopup to a redirect flow due to storage partitioning.
getRedirectResult(auth).catch(() => {});

// ── STATE ──
let meds = [], filter = 'all', editId = null, unsubMeds = null;
let apts = [], editAptId = null, unsubApts = null;
let activeTab = 'meds', calYear, calMonth;
const $ = id => document.getElementById(id);

// ── AUTH STATE ──
onAuthStateChanged(auth, user => {
  if (user) {
    $('login-screen').style.display = 'none';
    $('app').style.display = '';
    $('user-email').textContent = user.email;
    startMedsListener();
    startAptsListener();
    initCal();
  } else {
    $('login-screen').style.display = 'flex';
    $('app').style.display = 'none';
    if (unsubMeds) { unsubMeds(); unsubMeds = null; }
    if (unsubApts) { unsubApts(); unsubApts = null; }
    meds = []; apts = [];
  }
});

// ── LOGIN / LOGOUT ──
const googleProvider = new GoogleAuthProvider();

async function login() {
  $('l-error').textContent = '';
  $('l-btn').disabled = true;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      $('l-error').textContent = 'Sign in failed. Please try again.';
    }
    $('l-btn').disabled = false;
  }
}

async function logout() {
  await signOut(auth);
}

// ── FIRESTORE REAL-TIME LISTENER ──
function startMedsListener() {
  if (unsubMeds) unsubMeds();
  unsubMeds = onSnapshot(collection(db, 'medications'), snap => {
    meds = snap.docs.map(d => d.data());
    render();
  }, err => {
    console.error('Firestore error:', err);
  });
}

// ── HELPERS ──
function today(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function daysBetween(a,b){ return Math.round((b-a)/86400000); }

function pillsNow(m){
  const freq = parseFloat(m.frequency)||1;
  const supply = parseInt(m.supply)||30;
  const filledDate = m.filledDate ? new Date(m.filledDate+'T00:00:00') : null;
  if(!filledDate) return { rem: supply, tot: supply, runOutDate: null };
  const elapsed = Math.max(0, daysBetween(filledDate, today()));
  const consumed = Math.min(Math.round(elapsed * freq), supply);
  const rem = supply - consumed;
  const daysToZero = freq > 0 ? Math.ceil((supply - consumed) / freq) : 999;
  const runOutDate = new Date(today());
  runOutDate.setDate(today().getDate() + daysToZero);
  return { rem, tot: supply, runOutDate, daysToZero };
}

function getRefillDate(m){
  if(m.refillDate) return new Date(m.refillDate+'T00:00:00');
  return pillsNow(m).runOutDate;
}

const REFILL_LEAD = 7;

function st(m){
  const p = pillsNow(m);
  if(p.rem <= 0) return 'urgent';
  const d = p.daysToZero;
  if(d <= 3) return 'urgent';
  if(d <= REFILL_LEAD) return 'soon';
  return 'ok';
}

function stLabel(m){
  const p = pillsNow(m);
  if(p.rem <= 0) return 'Out of pills';
  const d = p.daysToZero;
  if(d <= 0) return 'Out of pills';
  if(d <= 3) return d === 1 ? 'Refill today' : 'Refill in '+d+'d';
  if(d <= REFILL_LEAD) return 'Refill in '+d+'d';
  return 'OK — '+d+'d left';
}

function pillStatusClass(rem, tot){
  const pct = tot > 0 ? rem/tot : 0;
  if(rem <= 0) return 'zero';
  if(pct < 0.25) return 'low';
  return 'ok';
}

function fmt(d){
  if(!d) return '—';
  if(typeof d === 'string') d = new Date(d+'T00:00:00');
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── FILTER & RENDER ──
function setFilter(f){
  filter=f;
  ['all','urgent','soon','ok'].forEach(x=>$('ft-'+x).classList.toggle('active',x===f));
  const labels={all:'All medications',urgent:'Urgent — refill within 3 days',soon:'Refill this week (4–7 days)',ok:'Stocked up'};
  $('tbl-title').textContent=labels[f];
  render();
}

function render(){
  const q=($('search')?.value||'').toLowerCase();
  const urg=meds.filter(m=>st(m)==='urgent').length;
  const soon=meds.filter(m=>st(m)==='soon').length;
  const ok=meds.filter(m=>st(m)==='ok').length;

  $('kpi-total').textContent=meds.length;
  $('kpi-urgent').textContent=urg;
  $('kpi-soon').textContent=soon;
  $('kpi-ok').textContent=ok;

  const urgNames=meds.filter(m=>st(m)==='urgent').map(m=>m.name).join(', ');
  $('kpi-urgent-names').textContent=urgNames||'';

  $('today-lbl').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});

  let rows=[...meds].sort((a,b)=>{
    const pa=pillsNow(a), pb=pillsNow(b);
    return pa.daysToZero - pb.daysToZero;
  });

  if(filter!=='all') rows=rows.filter(m=>st(m)===filter);
  if(q) rows=rows.filter(m=>
    m.name.toLowerCase().includes(q)||
    (m.pharmacy||'').toLowerCase().includes(q)||
    (m.doctor||'').toLowerCase().includes(q)
  );

  const tb=$('tbody');
  if(!rows.length){
    tb.innerHTML=`<tr class="empty-row"><td colspan="6">${meds.length===0?'No medications yet. Click "+ Add medication" to get started.':'No medications match this filter.'}</td></tr>`;
    return;
  }

  tb.innerHTML=rows.map(m=>{
    const s=st(m), lbl=stLabel(m);
    const p=pillsNow(m);
    const pct=p.tot>0?Math.round((p.rem/p.tot)*100):0;
    const pc=pillStatusClass(p.rem,p.tot);
    const bc=pc==='zero'||pc==='low'?'var(--red)':s==='soon'?'var(--amber)':'var(--green)';
    const pillSt=p.rem<=0?'empty':s;
    const subParts=[m.dose, m.rxNum?'Rx '+m.rxNum:''].filter(Boolean);
    const sub=subParts.join(' · ');
    const rdDisplay=m.refillDate?fmt(m.refillDate):(p.runOutDate?fmt(p.runOutDate)+' *':'—');

    return `<tr>
      <td>
        <div class="td-name">${esc(m.name)}</div>
        ${sub?`<div class="td-sub">${esc(sub)}</div>`:''}
      </td>
      <td><span class="spill sp-${pillSt}">${lbl}</span></td>
      <td class="pills-cell">
        <div class="pills-top">
          <span class="pill-count ${pc}">${p.rem}</span>
          <span class="pill-of">/ ${p.tot}</span>
        </div>
        <div class="bar-row">
          <div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${bc}"></div></div>
          <span class="bar-pct">${pct}%</span>
        </div>
      </td>
      <td class="td-dt">${rdDisplay}</td>
      <td class="td-ph">${esc(m.pharmacy||'—')}</td>
      <td class="td-act">
        <button class="act" title="Edit" onclick="openModal('${m.id}')">✏️</button>
        <button class="act green" title="Mark refilled" onclick="markRefilled('${m.id}')">✓</button>
        <button class="act red" title="Remove" onclick="delMed('${m.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

// ── MODAL ──
function openModal(id){
  editId=id||null;
  const m=editId?meds.find(x=>x.id===editId):{};
  $('modal-h').textContent=editId?'Edit medication':'Add medication';
  $('f-name').value        =m.name||'';
  $('f-dose').value        =m.dose||'';
  $('f-freq').value        =m.frequency||'';
  $('f-filled').value      =m.filledDate||'';
  $('f-supply').value      =m.supply||'';
  $('f-refill').value      =m.refillDate||'';
  $('f-pharmacy').value    =m.pharmacy||'';
  $('f-rxnum').value       =m.rxNum||'';
  $('f-doctor').value      =m.doctor||'';
  $('f-instructions').value=m.instructions||'';
  $('f-notes').value       =m.notes||'';
  $('modal').style.display='flex';
  setTimeout(()=>$('f-name').focus(),50);
}
function closeModal(){ $('modal').style.display='none'; editId=null; }
function bgClick(e){ if(e.target===$('modal')) closeModal(); }
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeModal(); closeAptModal(); } });

// ── CRUD → FIRESTORE ──
async function saveMed(){
  const name=$('f-name').value.trim();
  const freq=$('f-freq').value;
  const filled=$('f-filled').value;
  const supply=$('f-supply').value;
  if(!name){alert('Please enter the medication name.');return;}
  if(!freq){alert('Please enter pills per day.');return;}
  if(!filled){alert('Please enter the date the bottle was last filled.');return;}
  if(!supply){alert('Please enter how many pills were in the bottle.');return;}

  const med={
    id:       editId||Date.now().toString(36)+Math.random().toString(36).slice(2),
    name,
    dose:         $('f-dose').value.trim(),
    frequency:    freq,
    filledDate:   filled,
    supply,
    refillDate:   $('f-refill').value||'',
    pharmacy:     $('f-pharmacy').value.trim(),
    rxNum:        $('f-rxnum').value.trim(),
    doctor:       $('f-doctor').value.trim(),
    instructions: $('f-instructions').value.trim(),
    notes:        $('f-notes').value.trim(),
    updatedAt:    new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'medications', med.id), med);
    closeModal();
  } catch(e) {
    alert('Failed to save. Please check your connection and try again.');
    console.error(e);
  }
}

async function delMed(id){
  const m=meds.find(x=>x.id===id); if(!m)return;
  if(!confirm(`Remove ${m.name}?`))return;
  try {
    await deleteDoc(doc(db, 'medications', id));
  } catch(e) {
    alert('Failed to delete. Please check your connection and try again.');
    console.error(e);
  }
}

async function markRefilled(id){
  const m=meds.find(x=>x.id===id); if(!m)return;
  const updated={
    ...m,
    filledDate: today().toISOString().slice(0,10),
    refillDate: '',
    updatedAt:  new Date().toISOString()
  };
  try {
    await setDoc(doc(db, 'medications', id), updated);
  } catch(e) {
    alert('Failed to update. Please check your connection and try again.');
    console.error(e);
  }
}

// ── EXPORT / IMPORT ──
function exportCSV(){
  const rows=[['Name','Dose','Freq/day','Last Filled','Supply','Refill Date','Pharmacy','Rx #','Doctor','Instructions','Notes']];
  meds.forEach(m=>rows.push([m.name,m.dose,m.frequency,m.filledDate,m.supply,m.refillDate,m.pharmacy,m.rxNum,m.doctor,m.instructions,m.notes]));
  dl('dad-medications.csv',rows.map(r=>r.map(c=>'"'+(c||'').replace(/"/g,'""')+'"').join(',')).join('\n'),'text/csv');
}
function exportJSON(){ dl('dad-meds-backup.json',JSON.stringify(meds,null,2),'application/json'); }
function importJSON(){ $('file-in').click(); }

async function handleImport(e){
  const file=e.target.files[0]; if(!file)return;
  const r=new FileReader();
  r.onload=async ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(!Array.isArray(data))throw 0;
      if(!confirm(`Import ${data.length} medications? Will merge with existing.`))return;
      const have=new Set(meds.map(m=>m.id));
      const toAdd=data.filter(m=>!have.has(m.id));
      await Promise.all(toAdd.map(m=>setDoc(doc(db,'medications',m.id),m)));
      alert(`Imported ${toAdd.length} new medication(s).`);
    }catch{ alert('Invalid backup file.'); }
  };
  r.readAsText(file); e.target.value='';
}

function dl(name,content,type){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type}));
  a.download=name; a.click(); URL.revokeObjectURL(a.href);
}

// ── APPOINTMENTS: FIRESTORE LISTENER ──
function startAptsListener() {
  if (unsubApts) unsubApts();
  unsubApts = onSnapshot(collection(db, 'appointments'), snap => {
    apts = snap.docs.map(d => d.data());
    renderApts();
  }, err => { console.error('Appointments Firestore error:', err); });
}

// ── APPOINTMENTS: TAB SWITCHING ──
function switchTab(tab) {
  activeTab = tab;
  $('tab-meds').classList.toggle('active', tab === 'meds');
  $('tab-apts').classList.toggle('active', tab === 'apts');
  $('view-meds').style.display = tab === 'meds' ? '' : 'none';
  $('view-apts').style.display = tab === 'apts' ? 'block' : 'none';
  $('add-btn').textContent = tab === 'meds' ? '＋ Add medication' : '＋ Add appointment';
}

function handleAddBtn() {
  if (activeTab === 'apts') openAptModal();
  else openModal();
}

// ── APPOINTMENTS: HELPERS ──
function aptStatus(a) {
  const dt = new Date(a.dateTime);
  const t = today();
  const todayEnd = new Date(t); todayEnd.setHours(23,59,59,999);
  const weekEnd  = new Date(t); weekEnd.setDate(t.getDate() + 7);
  if (dt < t) return 'past';
  if (dt <= todayEnd) return 'today';
  if (dt <= weekEnd)  return 'soon';
  return 'upcoming';
}

function fmtAptDateTime(str) {
  if (!str) return '';
  const d = new Date(str);
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const dayPart  = d.toLocaleDateString('en-US', { weekday: 'long' });
  return `${timePart} · ${dayPart}`;
}

function fmtAptDateBlock(str) {
  if (!str) return { month: '—', day: '—' };
  const d = new Date(str);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    day:   d.getDate()
  };
}

function fmtAptTime(str) {
  if (!str) return '';
  const d = new Date(str);
  // If time is midnight (00:00), treat as all-day — show no time
  if (d.getHours() === 0 && d.getMinutes() === 0) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function coveringLabel(c) {
  return { fanuel: 'Fanuel', saron: 'Saron', both: 'Both', tbd: 'TBD' }[c] || 'TBD';
}

function typeLabel(t) {
  return { checkup: 'Checkup', specialist: 'Specialist', lab: 'Lab', imaging: 'Imaging', other: 'Other' }[t] || '';
}

// ── APPOINTMENTS: RENDER ──
function renderApts() {
  const q = ($('apt-search')?.value || '').toLowerCase();
  const now2 = new Date();

  let rows = [...apts].filter(a =>
    !q ||
    (a.title||'').toLowerCase().includes(q) ||
    (a.doctor||'').toLowerCase().includes(q) ||
    (a.location||'').toLowerCase().includes(q)
  ).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  const grouped = { today: [], soon: [], upcoming: [], past: [] };
  rows.forEach(a => grouped[aptStatus(a)].push(a));

  // Hero card — first non-past appointment
  const nextApt = grouped.today[0] || grouped.soon[0] || grouped.upcoming[0] || null;
  const heroEl = $('apt-hero');
  if (nextApt) {
    const s = aptStatus(nextApt);
    const db2 = fmtAptDateBlock(nextApt.dateTime);
    const time = fmtAptTime(nextApt.dateTime);
    const timeLine = [time, new Date(nextApt.dateTime).toLocaleDateString('en-US',{weekday:'long'})].filter(Boolean).join(' · ');
    const meta = [nextApt.doctor, nextApt.location].filter(Boolean).join(' · ');
    const cov  = nextApt.covering;
    const covHtml = cov ? `<span class="covering-pill ${esc(cov)}">${esc(coveringLabel(cov))}</span>` : '';
    heroEl.innerHTML = `
      <div class="hero-card ${s}" onclick="toggleHeroCard()" style="cursor:pointer;flex-wrap:wrap" id="hero-card-el">
        <div style="display:flex;align-items:center;gap:20px;width:100%">
          <div class="hero-date-block">
            <div class="hero-date-month">${esc(db2.month)}</div>
            <div class="hero-date-day">${db2.day}</div>
          </div>
          <div class="hero-body">
            <div class="hero-card-label">Next appointment</div>
            <div class="hero-card-title">${esc(nextApt.title)}</div>
            ${timeLine ? `<div class="hero-card-time">${esc(timeLine)}</div>` : ''}
            ${meta ? `<div class="hero-card-meta">${esc(meta)}</div>` : ''}
            ${covHtml ? `<div style="margin-top:8px">${covHtml}</div>` : ''}
          </div>
          <span class="apt-chevron" id="hero-chevron">▼</span>
        </div>
        <div class="apt-expand" id="hero-expand">
          <div class="apt-expand-grid">
            <div>
              <div class="expand-section-label">Prep &amp; questions</div>
              ${nextApt.prep ? `<div class="expand-text">${esc(nextApt.prep)}</div>` : '<div class="expand-empty">None added</div>'}
            </div>
            <div>
              <div class="expand-section-label">Post appointment notes</div>
              ${nextApt.postNotes ? `<div class="expand-text">${esc(nextApt.postNotes)}</div>` : '<div class="expand-empty">None added</div>'}
            </div>
          </div>
        </div>
      </div>`;
  } else {
    heroEl.innerHTML = '';
  }

  // Agenda
  const agendaEl = $('apt-agenda');
  let html = '';

  function aptCardHtml(a, statusClass) {
    const db3 = fmtAptDateBlock(a.dateTime);
    const time = fmtAptTime(a.dateTime);
    const cov  = a.covering;
    const covHtml = cov ? `<span class="covering-pill ${esc(cov)}">${esc(coveringLabel(cov))}</span>` : '';
    const tl = typeLabel(a.type);
    const metaParts = [
      a.doctor   ? `<span class="apt-doctor">${esc(a.doctor)}</span>` : '',
      a.doctor && a.location ? '<span class="apt-sep">·</span>' : '',
      a.location ? `<span class="apt-location">${esc(a.location)}</span>` : '',
      tl ? `<span class="type-chip">${esc(tl)}</span>` : '',
    ].filter(Boolean).join('');

    return `<div class="apt-card ${statusClass}" data-apt-id="${esc(a.id)}" onclick="toggleAptCard(this)">
      <div class="apt-card-top">
        <div class="apt-date">
          <div class="apt-date-month">${esc(db3.month)}</div>
          <div class="apt-date-day">${db3.day}</div>
        </div>
        <div class="apt-divider"></div>
        <div class="apt-body">
          <div class="apt-title">${esc(a.title)}</div>
          ${time ? `<div class="apt-time">${esc(time)}</div>` : ''}
          ${metaParts ? `<div class="apt-meta">${metaParts}</div>` : ''}
        </div>
        ${covHtml}
        <div class="apt-actions" onclick="event.stopPropagation()">
          <button class="act-icon" title="Edit" onclick="openAptModal('${esc(a.id)}')">✏</button>
          <button class="act-icon del" title="Delete" onclick="delApt('${esc(a.id)}')">🗑</button>
        </div>
        <span class="apt-chevron">▼</span>
      </div>
      <div class="apt-expand">
        <div class="apt-expand-grid">
          <div>
            <div class="expand-section-label">Prep &amp; questions</div>
            ${a.prep ? `<div class="expand-text">${esc(a.prep)}</div>` : '<div class="expand-empty">None added</div>'}
          </div>
          <div>
            <div class="expand-section-label">Post appointment notes</div>
            ${a.postNotes ? `<div class="expand-text">${esc(a.postNotes)}</div>` : '<div class="expand-empty">None added</div>'}
          </div>
        </div>
      </div>
    </div>`;
  }

  // Today
  if (grouped.today.length) {
    const d = new Date(); const dateStr = d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    html += `<div class="agenda-group"><div class="group-hdr">
      <span class="group-label today-lbl">Today — ${dateStr}</span>
      <div class="group-line"></div><span class="group-count">${grouped.today.length}</span>
    </div>${grouped.today.map(a => aptCardHtml(a, 'today')).join('')}</div>`;
  }

  // This week
  if (grouped.soon.length) {
    const t2 = today();
    const start = new Date(t2); start.setDate(t2.getDate() + 1);
    const end   = new Date(t2); end.setDate(t2.getDate() + 7);
    const range = `${start.toLocaleDateString('en-US',{month:'short',day:'numeric'})}–${end.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
    html += `<div class="agenda-group"><div class="group-hdr">
      <span class="group-label">This week — ${range}</span>
      <div class="group-line"></div><span class="group-count">${grouped.soon.length}</span>
    </div>${grouped.soon.map(a => aptCardHtml(a, 'soon')).join('')}</div>`;
  }

  // Upcoming
  if (grouped.upcoming.length) {
    html += `<div class="agenda-group"><div class="group-hdr">
      <span class="group-label">Upcoming</span>
      <div class="group-line"></div><span class="group-count">${grouped.upcoming.length}</span>
    </div>${grouped.upcoming.map(a => aptCardHtml(a, 'upcoming')).join('')}</div>`;
  }

  // Past (collapsed)
  if (grouped.past.length) {
    const pastCards = [...grouped.past].reverse().map(a => aptCardHtml(a, 'past')).join('');
    html += `<div class="agenda-group">
      <button class="past-toggle" onclick="togglePastGroup(this)">
        <span class="past-toggle-icon" id="past-toggle-icon">▼</span>
        Show ${grouped.past.length} past appointment${grouped.past.length !== 1 ? 's' : ''}
      </button>
      <div class="past-content" id="past-content">
        <div class="group-hdr" style="margin-top:10px">
          <span class="group-label">Past</span>
          <div class="group-line"></div><span class="group-count">${grouped.past.length}</span>
        </div>
        <div class="past-group-wrap">${pastCards}</div>
      </div>
    </div>`;
  }

  if (!html && apts.length === 0) {
    html = `<div style="text-align:center;padding:3rem;color:var(--text2)">No appointments yet. Click "+ Add appointment" to get started.</div>`;
  } else if (!html) {
    html = `<div style="text-align:center;padding:3rem;color:var(--text2)">No appointments match your search.</div>`;
  }

  agendaEl.innerHTML = html;
  renderCal();
}

// ── APPOINTMENTS: CARD EXPAND ──
function toggleAptCard(card) {
  const expand  = card.querySelector('.apt-expand');
  const chevron = card.querySelector('.apt-chevron');
  expand.classList.toggle('open');
  chevron.classList.toggle('open');
}

function toggleHeroCard() {
  $('hero-expand')?.classList.toggle('open');
  $('hero-chevron')?.classList.toggle('open');
}

function togglePastGroup(btn) {
  const content = btn.nextElementSibling;
  const icon    = btn.querySelector('.past-toggle-icon');
  const open    = content.classList.toggle('open');
  icon.classList.toggle('open', open);
  const n = content.querySelectorAll('.apt-card').length;
  btn.childNodes[2].textContent = open
    ? ' Hide past appointments'
    : ` Show ${n} past appointment${n !== 1 ? 's' : ''}`;
}

// ── APPOINTMENTS: MINI CALENDAR ──
function initCal() {
  const now2 = new Date();
  calYear  = now2.getFullYear();
  calMonth = now2.getMonth();
  renderCal();
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCal();
}

function renderCal() {
  const labelEl = $('cal-month-label');
  const gridEl  = $('cal-days');
  if (!labelEl || !gridEl) return;

  labelEl.textContent = new Date(calYear, calMonth, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  gridEl.innerHTML = '';
  const now2       = new Date();
  const firstDow   = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  // Build a map: "YYYY-M-D" → assignee[]
  const dotMap = {};
  apts.forEach(a => {
    if (!a.dateTime) return;
    const d = new Date(a.dateTime);
    const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    if (!dotMap[key]) dotMap[key] = new Set();
    const c = a.covering || 'tbd';
    if (c === 'both') { dotMap[key].add('fanuel'); dotMap[key].add('saron'); }
    else dotMap[key].add(c);
  });

  for (let i = 0; i < firstDow; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    gridEl.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${calYear}-${calMonth+1}-${d}`;
    const isToday = d === now2.getDate() && calMonth === now2.getMonth() && calYear === now2.getFullYear();
    const assignees = dotMap[key];

    const cell = document.createElement('div');
    cell.className = 'cal-day' +
      (isToday   ? ' today'   : '') +
      (assignees ? ' has-apt' : '') +
      (!isToday && calMonth < now2.getMonth() && calYear <= now2.getFullYear() ? ' faded' : '');

    const num = document.createElement('div');
    num.className = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    if (assignees) {
      const dots = document.createElement('div');
      dots.className = 'cal-dots';
      assignees.forEach(a => {
        const dot = document.createElement('div');
        dot.className = `cal-dot ${a}`;
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
      cell.onclick = () => calDayClick(calYear, calMonth + 1, d);
    }

    gridEl.appendChild(cell);
  }
}

function calDayClick(year, month, day) {
  // Find appointments on this date
  const matches = apts.filter(a => {
    if (!a.dateTime) return false;
    const d = new Date(a.dateTime);
    return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
  });
  if (!matches.length) return;

  // If any are past, expand the past group first
  const hasPast = matches.some(a => aptStatus(a) === 'past');
  if (hasPast) {
    const pastContent = $('past-content');
    const pastIcon    = document.querySelector('.past-toggle-icon');
    const pastBtn     = document.querySelector('.past-toggle');
    if (pastContent && !pastContent.classList.contains('open')) {
      pastContent.classList.add('open');
      if (pastIcon) pastIcon.classList.add('open');
      if (pastBtn) {
        const n = pastContent.querySelectorAll('.apt-card').length;
        const textNode = pastBtn.childNodes[2];
        if (textNode) textNode.textContent = ' Hide past appointments';
      }
    }
  }

  // Scroll to first matching card
  const firstId = matches[0].id;
  const card = document.querySelector(`[data-apt-id="${firstId}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── APPOINTMENTS: MODAL ──
function openAptModal(id) {
  editAptId = id || null;
  const a = editAptId ? apts.find(x => x.id === editAptId) : {};
  $('apt-modal-h').textContent = editAptId ? 'Edit appointment' : 'Add appointment';
  $('apt-f-title').value     = a.title    || '';
  $('apt-f-datetime').value  = a.dateTime || '';
  $('apt-f-type').value      = a.type     || '';
  $('apt-f-doctor').value    = a.doctor   || '';
  $('apt-f-location').value  = a.location || '';
  $('apt-f-covering').value  = a.covering || '';
  $('apt-f-prep').value      = a.prep     || '';
  $('apt-f-postnotes').value = a.postNotes|| '';
  $('apt-modal').style.display = 'flex';
  setTimeout(() => $('apt-f-title').focus(), 50);
}

function closeAptModal() {
  $('apt-modal').style.display = 'none';
  editAptId = null;
}

function aptBgClick(e) {
  if (e.target === $('apt-modal')) closeAptModal();
}


// ── APPOINTMENTS: CRUD ──
async function saveApt() {
  const title    = $('apt-f-title').value.trim();
  const dateTime = $('apt-f-datetime').value;
  if (!title)    { alert('Please enter the appointment title.'); return; }
  if (!dateTime) { alert('Please enter the date and time.'); return; }

  const apt = {
    id:        editAptId || Date.now().toString(36) + Math.random().toString(36).slice(2),
    title,
    dateTime,
    type:      $('apt-f-type').value,
    doctor:    $('apt-f-doctor').value.trim(),
    location:  $('apt-f-location').value.trim(),
    covering:  $('apt-f-covering').value,
    prep:      $('apt-f-prep').value.trim(),
    postNotes: $('apt-f-postnotes').value.trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'appointments', apt.id), apt);
    closeAptModal();
  } catch(e) {
    alert('Failed to save. Please check your connection and try again.');
    console.error(e);
  }
}

async function delApt(id) {
  const a = apts.find(x => x.id === id); if (!a) return;
  if (!confirm(`Remove "${a.title}"?`)) return;
  try {
    await deleteDoc(doc(db, 'appointments', id));
  } catch(e) {
    alert('Failed to delete. Please check your connection and try again.');
    console.error(e);
  }
}

// ── EXPOSE TO HTML ONCLICK HANDLERS ──
Object.assign(window, {
  login, logout, openModal, closeModal, bgClick, saveMed,
  delMed, markRefilled, exportCSV, exportJSON, importJSON,
  handleImport, setFilter, render,
  switchTab, handleAddBtn, openAptModal, closeAptModal, aptBgClick,
  saveApt, delApt, changeMonth, toggleAptCard, toggleHeroCard, togglePastGroup, calDayClick
});
