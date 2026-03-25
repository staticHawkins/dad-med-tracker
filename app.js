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
const $ = id => document.getElementById(id);

// ── AUTH STATE ──
onAuthStateChanged(auth, user => {
  if (user) {
    $('login-screen').style.display = 'none';
    $('app').style.display = '';
    $('user-email').textContent = user.email;
    startMedsListener();
  } else {
    $('login-screen').style.display = 'flex';
    $('app').style.display = 'none';
    if (unsubMeds) { unsubMeds(); unsubMeds = null; }
    meds = [];
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
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });

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

// ── EXPOSE TO HTML ONCLICK HANDLERS ──
Object.assign(window, {
  login, logout, openModal, closeModal, bgClick, saveMed,
  delMed, markRefilled, exportCSV, exportJSON, importJSON,
  handleImport, setFilter, render
});
