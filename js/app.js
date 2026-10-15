/* CRM Pro frontend. All data goes through api() -> Google Apps Script -> Google Sheets. */
(() => {
const CFG = window.CRM_CONFIG, $ = s => document.querySelector(s);
const S = { token: sessionStorage.getItem('crm_token'), user: null, lk: {users: [], customers: []}, W: null, charts: [], data: [], q: '' };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const money = n => CFG.CURRENCY + Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits: 0});
const uname = id => (S.lk.users.find(u => u.id === id) || {}).name || '—';
const plur = w => /y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's', L = () => S.W.labels, P = i => plur(L()[i]);
const cname = id => (S.lk.customers.find(c => c.id === id) || {}).name || '—';

/* ---------- API service (single place for URL + error handling) ---------- */
async function api(action, data = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), CFG.TIMEOUT_MS);
  try {
    // text/plain body avoids a CORS preflight, which Apps Script cannot answer.
    const r = await fetch(CFG.API_URL, {method: 'POST', body: JSON.stringify({action, token: S.token, ...data}), signal: ctl.signal});
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.error); e.code = j.code; if (j.code === 'AUTH' || j.code === 'SUBSCRIPTION') signOut(true, j.error); throw e; }
    return j.data;
  } catch (e) { if (e.name === 'AbortError') throw new Error('The server took too long to respond.'); if (e instanceof TypeError) throw new Error('Cannot reach the backend. Check API_URL and your connection.'); throw e; }
  finally { clearTimeout(t); }
}
function toast(msg, bad) { const d = document.createElement('div'); d.className = 'toast' + (bad ? ' bad' : ''); d.textContent = msg; $('#toasts').append(d); setTimeout(() => d.remove(), 3500); }
async function busy(btn, fn) { const old = btn.textContent; btn.disabled = true; btn.textContent = 'Working…'; try { return await fn(); } finally { btn.disabled = false; btn.textContent = old; } }

/* ---------- Module definitions: drive tables + forms ---------- */
const PRI = ['Low', 'Medium', 'High'];
const MODS = {
  leads: {title: 'Leads', fields: [['name', 'Name*', 'text'], ['company', 'Company'], ['email', 'Email', 'email'], ['phone', 'Phone'], ['city', 'City'], ['source', 'Source', 'select', ['Website', 'Referral', 'Social', 'Email', 'Cold call', 'Event', 'Other']], ['status', 'Status', 'select', ['New', 'Contacted', 'Qualified', 'Converted', 'Lost']], ['priority', 'Priority', 'select', PRI], ['value', 'Potential value', 'number'], ['assigned_to', 'Assigned to', 'user'], ['next_followup', 'Next follow-up', 'date'], ['notes', 'Notes', 'textarea']], cols: ['name', 'company', 'email', 'status', 'priority', 'value', 'next_followup', 'assigned_to'], filter: 'status', def: {status: 'New', priority: 'Medium'}},
  customers: {title: 'Customers', fields: [['name', 'Name*'], ['company', 'Company'], ['email', 'Email', 'email'], ['phone', 'Phone'], ['city', 'City'], ['status', 'Status', 'select', ['Active', 'Pending', 'Inactive']], ['manager', 'Account manager', 'user'], ['notes', 'Notes', 'textarea']], cols: ['name', 'company', 'email', 'phone', 'city', 'status', 'manager'], filter: 'status', def: {status: 'Active'}},
  deals: {title: 'Deals', fields: [['title', 'Title*'], ['customer_id', 'Customer', 'cust'], ['stage', 'Stage', 'select', ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']], ['value', 'Value', 'number'], ['probability', 'Probability %', 'number'], ['expected_close', 'Expected close', 'date'], ['owner', 'Owner', 'user'], ['loss_reason', 'Loss reason']], cols: ['title', 'customer_id', 'stage', 'value', 'probability', 'expected_close', 'owner'], filter: 'stage', def: {stage: 'New', probability: 10}},
  tasks: {title: 'Tasks', fields: [['title', 'Title*'], ['due_date', 'Due date', 'date'], ['priority', 'Priority', 'select', PRI], ['status', 'Status', 'select', ['Open', 'Done']], ['assigned_to', 'Assigned to', 'user'], ['description', 'Description', 'textarea']], cols: ['title', 'due_date', 'priority', 'status', 'assigned_to'], filter: 'status', def: {status: 'Open', priority: 'Medium'}},
  activities: {title: 'Activities', fields: [['type', 'Type', 'select', ['Call', 'Meeting', 'Note', 'Email', 'Follow-up']], ['title', 'Title*'], ['notes', 'Notes', 'textarea']], cols: ['type', 'title', 'notes', 'created_at'], filter: 'type', def: {type: 'Call'}}
};
const PORT = window.CRM_PORTAL || '', PORTALS = {owner: ['super'], admin: ['admin', 'manager'], employee: ['sales']}, HOME = {super: 'owner.html', admin: 'admin.html', manager: 'admin.html', sales: 'employee.html'};
const A = ['admin', 'manager', 'sales'], MG = ['admin', 'manager'], AD = ['admin'], ROLE = {super: 'Platform owner', admin: 'Admin', manager: 'Manager', sales: 'Employee'};
const NAV = [['dashboard', '⌂', () => 'Dashboard', '#5b54e8', A], ['leads', '◎', () => P(0), '#4387ef', A], ['customers', '♙', () => P(1), '#16a673', A], ['deals', '◇', () => P(2), '#e9982f', A], ['tasks', '✓', () => 'Tasks', '#e25353', A], ['activities', '✎', () => 'Activities', '#8b5cf6', A], ['team', '◈', () => 'Team', '#f59e0b', MG], ['settings', '⚙', () => 'Settings', '#0ea5a4', AD], ['users', '♧', () => 'Users', '#64748b', AD], ['audit', '☰', () => 'Audit log', '#475569', AD], ['profile', '☺', () => 'My profile', '#ec4899', ['admin', 'manager', 'sales', 'super']], ['workspaces', '▣', () => 'Businesses', '#5b54e8', ['super']]];
const IND = [['general', 'General Business'], ['realestate', 'Real Estate'], ['agency', 'Agency / Services'], ['retail', 'Retail / E-commerce'], ['clinic', 'Clinic / Healthcare'], ['education', 'Education / Coaching']];

/* ---------- Rendering helpers ---------- */
function cell(m, k, r) {
  const v = r[k];
  if (['assigned_to', 'manager', 'owner'].includes(k)) return esc(uname(v));
  if (k === 'customer_id') return esc(cname(v));
  if (k === 'value') return money(v);
  if (k === 'probability') return v === '' ? '—' : esc(v) + '%';
  if (['status', 'stage', 'priority', 'type'].includes(k)) return v ? `<span class="pill ${esc(v)}">${esc(v)}</span>` : '—';
  if (k === 'created_at') return esc(String(v).slice(0, 10));
  if (k === 'notes') return esc(String(v).slice(0, 50));
  return v === '' ? '—' : esc(v);
}
const skeleton = () => '<div class="card">' + '<div class="sk"></div>'.repeat(6) + '</div>';
function failure(e, retry) { $('#view').innerHTML = `<div class="card empty"><p>⚠ ${esc(e.message)}</p><button class="btn" id="re">Retry</button></div>`; $('#re').onclick = retry; }
function destroyCharts() { S.charts.forEach(c => c.destroy()); S.charts = []; }
function chart(id, type, labels, data, label) {
  const el = document.getElementById(id); if (!el || !window.Chart) return;
  if (!data.length) { el.parentElement.innerHTML = '<div class="empty">No data yet</div>'; return; }
  S.charts.push(new Chart(el, {type, data: {labels, datasets: [{label, data, backgroundColor: ['#5b54e8', '#7c6cf5', '#16a673', '#e9982f', '#e25353', '#4387ef', '#9aa4b6'], borderRadius: 6}]}, options: {maintainAspectRatio: false, plugins: {legend: {display: type === 'doughnut'}}}}));
}
function countUp(el, to, fmt) {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now(); (function f(t) { const p = Math.min((t - t0) / 700, 1); el.textContent = fmt(to * p); if (p < 1) requestAnimationFrame(f); })(t0);
}

/* ---------- Views ---------- */
async function dashboard() {
  $('#view').innerHTML = skeleton();
  let d; try { d = await api('dashboard'); } catch (e) { return failure(e, dashboard); }
  let ki = 0; const PAL = ['#5b54e8', '#4387ef', '#8b5cf6', '#0ea5a4', '#e9982f', '#16a673', '#4387ef', '#8b5cf6', '#16a673', '#e9982f', '#0ea5a4', '#64748b', '#e25353'], KI = ['♙', '◎', '✦', '✔', '◇', '⚑', '$', '⚖', '★', '%', '♛', '✓', '⚠'];
  const k = (l, v, fmt = x => Math.round(x), cls = '') => { const i = ki++; return `<div class="card kpi ${cls}" style="--k:${PAL[i % 13]};animation-delay:${i * 40}ms"><i class="ic">${KI[i % 13]}</i><span>${l}</span><b data-to="${v ?? ''}" data-f="${fmt === money ? 'm' : 'n'}">${v == null ? '—' : ''}</b></div>`; };
  const pct = x => x == null ? null : x;
  $('#view').innerHTML = `<div class="head"><div><h1>${S.user.role === 'sales' ? 'My workspace' : 'Dashboard'}</h1><span class="muted">${S.user.role === 'sales' ? 'Only your own records are shown · ' + esc(S.user.name) : esc(S.W.name) + ' · ' + esc(S.W.industryName)}</span></div><button class="btn" id="rf">↻ Refresh</button></div>
  <div class="kpis">${k(P(1), d.customers)}${k(P(0), d.leads)}${k('New ' + P(0).toLowerCase(), d.newLeads)}${k('Qualified', d.qualified)}${k('Open ' + P(2).toLowerCase(), d.openDeals)}${k('Won / Lost', d.won + ' / ' + d.lost)}
  ${k('Pipeline value', d.pipelineValue, money)}${k('Weighted pipeline', Math.round(d.weightedPipeline), money)}${k('Won revenue', d.wonValue, money)}${k('Lead conversion %', pct(d.conversionRate))}${k('Win rate %', pct(d.winRate))}${k('Pending tasks', d.pendingTasks)}${k('Overdue tasks', d.overdueTasks, undefined, d.overdueTasks ? 'alert' : '')}</div>
  <div class="grid2"><div class="card"><h3>Pipeline by stage (value)</h3><div class="chart"><canvas id="c1"></canvas></div></div><div class="card"><h3>Lead sources</h3><div class="chart"><canvas id="c2"></canvas></div></div></div>
  <div class="grid2"><div class="card"><h3>Won revenue by month</h3><div class="chart"><canvas id="c3"></canvas></div></div><div class="card"><h3>Lead status</h3><div class="chart"><canvas id="c4"></canvas></div></div></div>
  <div class="grid2"><div class="card"><h3>Tasks due today</h3>${d.dueToday.map(t => `<p>${esc(t.title)} <span class="pill ${esc(t.priority)}">${esc(t.priority)}</span></p>`).join('') || '<p class="muted">Nothing due today.</p>'}
  <h3>Upcoming follow-ups</h3>${d.upcomingFollowups.map(l => `<p>${esc(l.name)} <span class="muted">· ${esc(l.next_followup)}</span></p>`).join('') || '<p class="muted">None scheduled.</p>'}</div>
  <div class="card"><h3>Recent activity</h3>${d.recentActivities.map(a => `<p><span class="pill">${esc(a.type)}</span> ${esc(a.title)}</p>`).join('') || '<p class="muted">No activity logged yet.</p>'}</div></div>`;
  document.querySelectorAll('.kpi b[data-to]').forEach(b => { if (b.dataset.to !== '') { const m = b.dataset.f === 'm', v = b.dataset.to; isNaN(v) ? b.textContent = v : countUp(b, +v, x => m ? money(x) : Math.round(x)); } });
  const mo = Object.keys(d.monthlyRevenue).sort();
  chart('c1', 'bar', d.pipeline.map(p => p.stage), d.pipeline.every(p => !p.value) ? [] : d.pipeline.map(p => p.value), 'Value');
  chart('c2', 'doughnut', Object.keys(d.leadsBySource), Object.values(d.leadsBySource), 'Leads');
  chart('c3', 'bar', mo, mo.map(m => d.monthlyRevenue[m]), 'Won');
  chart('c4', 'doughnut', Object.keys(d.leadsByStatus), Object.values(d.leadsByStatus), 'Leads');
  $('#rf').onclick = dashboard;
}

async function listView(name, opts = {}) {
  const M = MODS[name], archived = !!opts.archived; let page = 0, sort = null, dir = 1, filt = '';
  $('#view').innerHTML = skeleton();
  try { S.data = await api('list', {entity: name, archived}); } catch (e) { return failure(e, () => listView(name, opts)); }
  const draw = () => {
    let rows = S.data.filter(r => (!filt || r[M.filter] === filt) && (!S.q || JSON.stringify(r).toLowerCase().includes(S.q)));
    if (sort) rows = [...rows].sort((a, b) => (a[sort] > b[sort] ? 1 : -1) * dir);
    const per = 15, pages = Math.max(1, Math.ceil(rows.length / per)); page = Math.min(page, pages - 1);
    const fo = M.fields.find(f => f[0] === M.filter)[3];
    $('#view').innerHTML = `<div class="head"><h1>${M.title}${archived ? ' (archived)' : ''}</h1><div><button class="btn" id="arc">${archived ? '← Active' : 'Archived'}</button> <button class="btn" id="csv">⇩ CSV</button> ${archived ? '' : `<button class="btn primary" id="add">＋ New</button>`}</div></div>
    <div class="tools"><select id="flt" aria-label="Filter"><option value="">All ${M.filter}</option>${fo.map(o => `<option ${o === filt ? 'selected' : ''}>${o}</option>`).join('')}</select>${filt || S.q ? '<button class="btn" id="clr">Clear filters</button>' : ''}</div>
    <div class="card"><div class="tw"><table><thead><tr>${M.cols.map(c => `<th data-s="${c}">${c.replace('_', ' ')}${sort === c ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th></th></tr></thead><tbody>
    ${rows.slice(page * per, page * per + per).map(r => `<tr>${M.cols.map(c => `<td>${cell(name, c, r)}</td>`).join('')}<td>${archived ? `<button class="btn sm" data-a="restore" data-id="${esc(r.id)}">Restore</button>` : `${name === 'leads' && r.status !== 'Converted' ? `<button class="btn sm" data-a="conv" data-id="${esc(r.id)}">Convert</button> ` : ''}${name === 'tasks' && r.status !== 'Done' ? `<button class="btn sm" data-a="done" data-id="${esc(r.id)}">✓ Done</button> ` : ''}<button class="btn sm" data-a="edit" data-id="${esc(r.id)}">Edit</button> <button class="btn sm danger" data-a="arch" data-id="${esc(r.id)}">Archive</button>`}</td></tr>`).join('') || `<tr><td colspan="${M.cols.length + 1}" class="empty">No records found.</td></tr>`}
    </tbody></table></div><div class="pager"><span class="muted">${rows.length} records</span><span><button class="btn sm" id="pv" ${page ? '' : 'disabled'}>‹</button> ${page + 1}/${pages} <button class="btn sm" id="nx" ${page < pages - 1 ? '' : 'disabled'}>›</button></span></div></div>`;
    $('#flt').onchange = e => { filt = e.target.value; page = 0; draw(); };
    $('#pv').onclick = () => { page--; draw(); }; $('#nx').onclick = () => { page++; draw(); };
    $('#arc').onclick = () => listView(name, {archived: !archived});
    $('#csv').onclick = () => exportCSV(name, rows);
    if ($('#add')) $('#add').onclick = () => form(name, {...M.def}, () => listView(name, opts));
    if ($('#clr')) $('#clr').onclick = () => { filt = ''; S.q = ''; $('#gsearch').value = ''; draw(); };
    document.querySelectorAll('th[data-s]').forEach(th => th.onclick = () => { dir = sort === th.dataset.s ? -dir : 1; sort = th.dataset.s; draw(); });
    document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => rowAction(name, b, () => listView(name, opts)));
  };
  S.redraw = draw; draw();
}
async function rowAction(name, b, reload) {
  const id = b.dataset.id, a = b.dataset.a, rec = S.data.find(r => r.id === id);
  try {
    if (a === 'edit') return form(name, rec, reload);
    if (a === 'arch' && !confirm('Archive this record? You can restore it from the Archived view.')) return;
    if (a === 'conv' && !confirm('Convert this lead into a customer?')) return;
    await busy(b, async () => {
      if (a === 'arch' || a === 'restore') await api('archive', {entity: name, id, restore: a === 'restore'});
      if (a === 'done') await api('save', {entity: 'tasks', record: {id, title: rec.title, status: 'Done'}});
      if (a === 'conv') { await api('convertLead', {id}); await loadLookups(); }
    });
    toast('Done'); reload();
  } catch (e) { toast(e.message, true); }
}

function exportCSV(name, rows) {
  const cols = MODS[name].fields.map(f => f[0]), q = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
  const blob = new Blob([[cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n')], {type: 'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.csv'; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- Generic modal form with validation ---------- */
function form(name, rec, done, fields = MODS[name].fields, entity = name, action = 'save') {
  fields = fields.filter(f => !(S.user.role === 'sales' && f[2] === 'user'));   // employees cannot reassign records
  const input = ([k, l, t = 'text', o]) => {
    const v = rec[k] ?? '', id = 'f_' + k;
    if (t === 'select') return `<label>${l}<select id="${id}">${o.map(x => { const [a, b] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(a)}" ${a === v ? 'selected' : ''}>${esc(b)}</option>`; }).join('')}</select></label>`;
    if (t === 'user') return `<label>${l}<select id="${id}"><option value="">—</option>${S.lk.users.map(u => `<option value="${esc(u.id)}" ${u.id === v ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>`;
    if (t === 'cust') return `<label>${l}<select id="${id}"><option value="">—</option>${S.lk.customers.map(u => `<option value="${esc(u.id)}" ${u.id === v ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>`;
    if (t === 'textarea') return `<label class="w">${l}<textarea id="${id}" rows="3">${esc(v)}</textarea></label>`;
    return `<label>${l}<input id="${id}" type="${t}" value="${esc(v)}" ${t === 'number' ? 'min="0" step="any"' : ''} ${t === 'password' ? 'autocomplete="new-password"' : ''}></label>`;
  };
  $('#modalBody').innerHTML = `<h2>${rec.id ? 'Edit' : 'New'} ${esc(MODS[name]?.one || (name === 'ws' ? 'business' : 'user'))}</h2><div class="fg">${fields.map(input).join('')}</div><p class="err" id="ferr" role="alert"></p><div class="row"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button></div>`;
  $('#modal').hidden = false; document.querySelector('#modalBody input,#modalBody select').focus();
  $('#cx').onclick = () => $('#modal').hidden = true;
  $('#sv').onclick = async e => {
    const out = {...(rec.id ? {id: rec.id} : {})}; let bad = false;
    fields.forEach(([k, l]) => { const el = $('#f_' + k); out[k] = el.value.trim(); el.classList.remove('invalid'); if (l.endsWith('*') && !out[k]) { el.classList.add('invalid'); bad = true; } });
    if (bad) { $('#ferr').textContent = 'Please fill the required fields.'; return; }
    const send = async force => {
      try { await busy(e.target, () => api(action, {entity, record: out, force})); $('#modal').hidden = true; toast('Saved'); done(); }
      catch (x) { if (x.code === 'DUPLICATE' && confirm(x.message + '\nSave anyway?')) return send(true); $('#ferr').textContent = x.message; }
    };
    send(false);
  };
}

/* ---------- Deals: table + pipeline board ---------- */
async function deals() {
  await listView('deals');
  const bar = document.createElement('div'); bar.className = 'tools'; bar.innerHTML = '<button class="btn" id="bd">▦ Pipeline board</button>';
  $('.head').after(bar); $('#bd').onclick = board;
}
async function board() {
  $('#view').innerHTML = skeleton(); let rows;
  try { rows = await api('list', {entity: 'deals'}); } catch (e) { return failure(e, board); }
  const st = MODS.deals.fields[2][3];
  $('#view').innerHTML = `<div class="head"><h1>Pipeline</h1><button class="btn" id="bk">← Table</button></div><div class="board">${st.map(s => { const c = rows.filter(r => r.stage === s); return `<div class="col"><h3>${s} · ${c.length} · ${money(c.reduce((a, r) => a + (+r.value || 0), 0))}</h3>${c.map(r => `<div class="dc"><b>${esc(r.title)}</b><div class="muted">${esc(cname(r.customer_id))} · ${money(r.value)} · ${esc(r.probability || 0)}%</div><select data-id="${esc(r.id)}" aria-label="Move deal">${st.map(o => `<option ${o === s ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`).join('') || '<div class="muted">Empty</div>'}</div>`; }).join('')}</div>`;
  $('#bk').onclick = deals;
  document.querySelectorAll('.dc select').forEach(sel => sel.onchange = async () => {
    let reason = ''; if (sel.value === 'Lost') reason = prompt('Loss reason?') || '';
    try { await api('moveDeal', {id: sel.dataset.id, stage: sel.value, loss_reason: reason}); toast('Deal moved'); board(); } catch (e) { toast(e.message, true); board(); }
  });
}

/* ---------- Admin ---------- */
async function users() {
  $('#view').innerHTML = skeleton(); let rows;
  try { rows = await api('userList'); } catch (e) { return failure(e, users); }
  const F = [['name', 'Name*'], ['email', 'Email*', 'email'], ['role', 'Role', 'select', [['sales', 'Employee — own records only'], ['manager', 'Manager — sees whole team'], ['admin', 'Admin — full access']]], ['status', 'Status', 'select', ['Active', 'Disabled']], ['password', 'Password (min 10; blank = unchanged)', 'password']];
  $('#view').innerHTML = `<div class="head"><h1>Users</h1><button class="btn primary" id="nu">＋ New user</button></div><div class="card tw"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><span class="pill">${esc(u.role)}</span></td><td><span class="pill ${esc(u.status)}">${esc(u.status)}</span></td><td><button class="btn sm" data-u="${esc(u.id)}">Edit</button></td></tr>`).join('')}</tbody></table></div>`;
  $('#nu').onclick = () => form('users', {role: 'sales', status: 'Active'}, async () => { await loadLookups(); users(); }, F, 'users', 'userSave');
  document.querySelectorAll('[data-u]').forEach(b => b.onclick = () => form('users', {...rows.find(u => u.id === b.dataset.u), password: ''}, async () => { await loadLookups(); users(); }, F, 'users', 'userSave'));
}
async function audit() {
  $('#view').innerHTML = skeleton(); let rows;
  try { rows = await api('auditList'); } catch (e) { return failure(e, audit); }
  $('#view').innerHTML = `<div class="head"><h1>Audit log</h1></div><div class="card tw"><table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(String(r.at).replace('T', ' ').slice(0, 19))}</td><td>${esc(r.user)}</td><td>${esc(r.action)}</td><td>${esc(r.entity)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No entries.</td></tr>'}</tbody></table></div>`;
}

async function team() {
  $('#view').innerHTML = skeleton(); let rows; try { rows = await api('team'); } catch (e) { return failure(e, team); }
  $('#view').innerHTML = `<div class="head"><h1>Team performance</h1></div><div class="card"><h3>Won revenue by employee</h3><div class="chart"><canvas id="c1"></canvas></div></div><br><div class="card tw"><table><thead><tr><th>Employee</th><th>Role</th><th>${esc(P(0))}</th><th>Converted</th><th>Open ${esc(P(2).toLowerCase())}</th><th>Won revenue</th><th>Open tasks</th><th>Overdue</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.name)}</td><td><span class="pill">${esc(ROLE[r.role] || r.role)}</span></td><td>${r.leads}</td><td>${r.converted}</td><td>${r.openDeals}</td><td>${money(r.wonValue)}</td><td>${r.pendingTasks}</td><td>${r.overdue ? `<span class="pill High">${r.overdue}</span>` : 0}</td></tr>`).join('')}</tbody></table></div>`;
  chart('c1', 'bar', rows.map(r => r.name), rows.every(r => !r.wonValue) ? [] : rows.map(r => r.wonValue), 'Won revenue');
}
function profile() {
  const u = S.user;
  $('#view').innerHTML = `<div class="head"><h1>My profile</h1></div><div class="grid2"><div class="card"><h3>${esc(u.name)}</h3><p class="muted">${esc(u.email)}</p><p><span class="pill">${esc(ROLE[u.role])}</span></p><p class="muted">${u.role === 'sales' ? 'You can see and edit only the records you own.' : u.role === 'manager' ? 'You can see the whole team, but cannot change settings or users.' : 'You have full access to this workspace.'}</p></div>
  <div class="card"><h3>Change password</h3><label>Current password<input id="pc" type="password" autocomplete="current-password"></label><label>New password (min 10)<input id="pn" type="password" autocomplete="new-password"></label><label>Confirm new password<input id="pf" type="password" autocomplete="new-password"></label><p class="err" id="perr" role="alert"></p><div class="row"><button class="btn primary" id="psv">Update password</button></div></div></div>`;
  $('#psv').onclick = e => { if ($('#pn').value !== $('#pf').value) { $('#perr').textContent = 'New passwords do not match.'; return; } busy(e.target, async () => { try { await api('passwordChange', {current: $('#pc').value, next: $('#pn').value}); toast('Password updated'); profile(); } catch (x) { $('#perr').textContent = x.message; } }); };
}
/* ---------- Per-business customisation ---------- */
function applyWorkspace() {
  const W = S.W, rs = document.documentElement.style;
  rs.setProperty('--pri', W.accent); rs.setProperty('--pri2', `color-mix(in srgb, ${W.accent} 65%, #fff)`);
  CFG.CURRENCY = W.currency; document.title = W.name + ' · CRM';
  $('.brand').innerHTML = `<span class="logo sm">${esc(W.name[0].toUpperCase())}</span> ${esc(W.name)}`;
  ['leads', 'customers', 'deals'].forEach((m, i) => { MODS[m].title = plur(W.labels[i]); MODS[m].one = W.labels[i]; });
  MODS.tasks.one = 'Task'; MODS.activities.one = 'Activity';
  MODS.deals.fields[2][3] = W.stages; MODS.deals.def.stage = W.stages[0]; MODS.leads.fields[5][3] = W.sources;
}
function buildNav() {
  applyWorkspace(); buildNav();
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === (location.hash.slice(1) || 'dashboard')));
}
async function settings() {
  const W = S.W;
  $('#view').innerHTML = `<div class="head"><h1>Settings</h1></div><div class="grid2"><div class="card"><h3>Branding</h3><label>Business name<input id="sn" value="${esc(W.name)}"></label><label>Brand colour<input id="sc" type="color" value="${esc(W.accent)}"></label><label>Currency symbol<input id="sy" maxlength="4" value="${esc(W.currency)}"></label><p class="err" id="serr"></p><div class="row"><button class="btn primary" id="ssv">Save</button></div></div>
  <div class="card"><h3>Plan</h3><p><span class="pill">${esc(W.plan)}</span> <span class="pill ${esc(W.status)}">${esc(W.status)}</span></p><p class="muted">Industry: ${esc(W.industryName)}<br>Subscription ends: ${esc(W.expires || 'No expiry')}</p><h3>Sample data</h3><p class="muted">Fill this empty workspace with demo ${esc(P(0).toLowerCase())}, ${esc(P(1).toLowerCase())}, deals, tasks and activities so you can explore. Remove them later by archiving.</p><button class="btn" id="sd">Load sample data</button></div></div>`;
  $('#ssv').onclick = e => busy(e.target, async () => { try { S.W = await api('brand', {record: {name: $('#sn').value, accent: $('#sc').value, currency: $('#sy').value}}); applyWorkspace(); buildNav(); toast('Saved'); settings(); } catch (x) { $('#serr').textContent = x.message; } });
  $('#sd').onclick = e => confirm('Load sample data into this workspace?') && busy(e.target, async () => { try { await api('sampleData'); await loadLookups(); toast('Sample data loaded'); } catch (x) { toast(x.message, true); } });
}
async function workspaces() {
  $('#view').innerHTML = skeleton(); let rows; try { rows = await api('wsList'); } catch (e) { return failure(e, workspaces); }
  const base = [['name', 'Business name*'], ['plan', 'Plan', 'select', ['Trial', 'Starter', 'Pro', 'Business']], ['status', 'Status', 'select', ['Active', 'Suspended']], ['expires', 'Subscription ends', 'date']];
  const NEW = [base[0], ['industry', 'Industry', 'select', IND], ...base.slice(1), ['adminName', 'Admin name*'], ['adminEmail', 'Admin email*', 'email'], ['adminPassword', 'Admin password* (min 10)', 'password']];
  const trial = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  $('#view').innerHTML = `<div class="head"><h1>Businesses</h1><button class="btn primary" id="nb">＋ New business</button></div><div class="card tw"><table><thead><tr><th>Business</th><th>Industry</th><th>Plan</th><th>Status</th><th>Ends</th><th>Users</th><th></th></tr></thead><tbody>${rows.map(w => `<tr><td>${esc(w.name)}</td><td>${esc((IND.find(i => i[0] === w.industry) || [])[1] || w.industry)}</td><td><span class="pill">${esc(w.plan)}</span></td><td><span class="pill ${esc(w.status)}">${esc(w.status)}</span></td><td>${esc(w.expires || '—')}</td><td>${esc(w.users)}</td><td><button class="btn sm" data-w="${esc(w.id)}">Edit</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No businesses yet. Create your first customer account.</td></tr>'}</tbody></table></div>`;
  $('#nb').onclick = () => form('ws', {plan: 'Trial', status: 'Active', industry: 'general', expires: trial}, workspaces, NEW, 'ws', 'wsSave');
  document.querySelectorAll('[data-w]').forEach(b => b.onclick = () => form('ws', rows.find(w => w.id === b.dataset.w), workspaces, base, 'ws', 'wsSave'));
}

/* ---------- Shell, routing, auth ---------- */
const ROUTES = {team, profile, settings, workspaces, dashboard, leads: () => listView('leads'), customers: () => listView('customers'), deals, tasks: () => listView('tasks'), activities: () => listView('activities'), users, audit};
function route() {
  const r = location.hash.slice(1) || (S.user.role === 'super' ? 'workspaces' : 'dashboard'); destroyCharts(); S.q = ''; $('#gsearch').value = '';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  closeMenu(); (ROUTES[r] || dashboard)();
}
function closeMenu() { $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); }
async function loadLookups() { S.lk = await api('lookups'); }
function showApp() {
  $('#login').hidden = true; $('#app').hidden = false; $('#who').innerHTML = `<span class="av">${esc(S.user.name[0].toUpperCase())}</span><span>${esc(S.user.name)}<small>${ROLE[S.user.role]}</small></span>`;
  $('#nav').innerHTML = NAV.filter(n => n[4].includes(S.user.role)).map(n => `<a href="#${n[0]}" data-r="${n[0]}" style="--nav-accent:${n[3]}"><i aria-hidden="true">${n[1]}</i><span class="nav-label">${esc(n[2]())}</span><span class="nav-arrow" aria-hidden="true">›</span></a>`).join('');
  route();
}
function signOut(expired, msg) {
  if (S.token && !expired) api('logout').catch(() => {});
  S.token = null; S.user = null; sessionStorage.clear(); $('#app').hidden = true; $('#login').hidden = false;
  if (expired) $('#loginErr').textContent = msg || 'Session expired. Please sign in again.';
  document.documentElement.style.removeProperty('--pri'); document.documentElement.style.removeProperty('--pri2');
}
async function boot() {
  const msg = $('#splashMsg'); $('#retry').hidden = true; msg.textContent = 'Initializing workspace…';
  if (!CFG.API_URL || CFG.API_URL.startsWith('PASTE')) { msg.textContent = 'Set API_URL in js/config.js (see DEPLOYMENT in README).'; return; }
  try {
    const h = await api('health'); if (!h.sheets) throw new Error('Spreadsheet not initialised. Run setup() in Apps Script.');
    msg.textContent = 'Synchronizing data…';
    if (S.token) { try { S.user = JSON.parse(sessionStorage.getItem('crm_user')); if (PORT && !PORTALS[PORT].includes(S.user.role)) throw new Error('wrong portal'); S.W = await api('config'); await loadLookups(); msg.textContent = 'Preparing your dashboard…'; showApp(); } catch (e) { signOut(false); } }
    else $('#login').hidden = false;
    $('#splash').classList.add('out'); setTimeout(() => $('#splash').remove(), 450);
  } catch (e) { msg.textContent = e.message; $('#retry').hidden = false; }
}
$('#retry').onclick = boot;
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); const f = new FormData(e.target), b = e.submitter; $('#loginErr').textContent = '';
  try {
    const r = await busy(b, () => api('login', {email: f.get('email'), password: f.get('password')}));
    if (PORT && !PORTALS[PORT].includes(r.user.role)) { S.token = r.token; api('logout').catch(() => {}); S.token = null; throw new Error(`This is ${ROLE[r.user.role]} account. Please sign in at ${HOME[r.user.role]}.`); }
    S.token = r.token; S.user = r.user; S.W = r.config; sessionStorage.setItem('crm_token', r.token); sessionStorage.setItem('crm_user', JSON.stringify(r.user));
    e.target.reset(); await loadLookups(); showApp();
  } catch (x) { $('#loginErr').textContent = x.message; }
};
$('#logoutBtn').onclick = () => signOut(false);
$('#menuBtn').onclick = () => { $('#side').classList.add('open'); $('#scrim').classList.add('on'); };
$('#scrim').onclick = closeMenu;
$('#themeBtn').onclick = () => { const d = document.documentElement.dataset.theme === 'dark'; document.documentElement.dataset.theme = d ? '' : 'dark'; localStorage.setItem('crm_theme', d ? '' : 'dark'); };
document.documentElement.dataset.theme = localStorage.getItem('crm_theme') || '';
let tm; $('#gsearch').oninput = e => { clearTimeout(tm); tm = setTimeout(() => { S.q = e.target.value.trim().toLowerCase(); if (S.redraw && MODS[location.hash.slice(1)]) S.redraw(); }, 250); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').hidden = true; });
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };
window.addEventListener('hashchange', () => { if (S.user) route(); });
boot();
})();
