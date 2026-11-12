const state = { data: null, page: 'overview', market: 'All markets', range: 30, listingMarket: 'All markets', listingHealth: 'all', search: '', flagged: new Set() };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const marketProfiles = new Map();
const fmt = (n, digits = 0) => new Intl.NumberFormat('en', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
const compact = n => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const pct = n => `${(n * 100).toFixed(1)}%`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function boot() {
  try {
    const response = await fetch('./data/markets.json');
    if (!response.ok) throw new Error(`Could not load demo data (${response.status})`);
    state.data = await response.json();
    state.data.markets.forEach(m => marketProfiles.set(m.market, m));
    bindEvents();
    renderAll();
    await initAuth();
  } catch (error) {
    document.querySelector('.main-content').innerHTML = `<div class="panel" style="margin:40px auto;max-width:650px"><h2>Demo data could not be loaded</h2><p class="panel-subtitle">Run this project through a local web server instead of opening index.html directly. For example: <code>python -m http.server 8000</code> and visit <code>http://localhost:8000</code>.</p><p class="panel-subtitle">${esc(error.message)}</p></div>`;
  }
}

function bindEvents() {
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => setPage(btn.dataset.page)));
  $$('[data-go]').forEach(btn => btn.addEventListener('click', () => setPage(btn.dataset.go)));
  $$('.range-btn').forEach(btn => btn.addEventListener('click', () => {
    state.range = Number(btn.dataset.range);
    $$('.range-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderOverview();
  }));
  $('#market-filter').addEventListener('change', e => { state.market = e.target.value; renderOverview(); });
  $('#markets-range').addEventListener('change', renderMarkets);
  $('#listing-market').addEventListener('change', e => { state.listingMarket = e.target.value; renderListings(); });
  $('#listing-health-filter').addEventListener('change', e => { state.listingHealth = e.target.value; renderListings(); });
  $('#listing-search').addEventListener('input', e => { state.search = e.target.value.toLowerCase().trim(); renderListings(); });
  $('#experiment-market').addEventListener('change', renderSimulation);
  $('#lift-slider').addEventListener('input', renderSimulation);
  $('#about-button').addEventListener('click', openAbout);
  $('#close-modal').addEventListener('click', closeAbout);
  $('#modal-done').addEventListener('click', closeAbout);
  $('#about-modal').addEventListener('click', e => { if (e.target.id === 'about-modal') closeAbout(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAbout(); });
}

function setPage(page) {
  state.page = page;
  $$('.page').forEach(el => el.classList.toggle('page-active', el.id === `page-${page}`));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const labels = { overview: 'Overview', markets: 'Market breakdown', listings: 'Listing health', experiments: 'Experiment lab' };
  $('#breadcrumb-current').textContent = labels[page] || 'Overview';
  if (page === 'markets') renderMarkets();
  if (page === 'listings') renderListings();
  if (page === 'experiments') renderSimulation();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectedWeekly(range = state.range, market = state.market) {
  const all = [...state.data.weekly].sort((a,b) => a.week_start.localeCompare(b.week_start));
  const numberOfWeeks = range === 7 ? 1 : range === 30 ? 4 : 12;
  const tail = all.slice(-numberOfWeeks * state.data.markets.length);
  return tail.filter(row => market === 'All markets' || row.market === market);
}

function aggregate(rows) {
  const totals = rows.reduce((a, r) => {
    a.impressions += r.impressions; a.views += r.listing_views; a.leads += r.leads; a.qualified += r.qualified_leads;
    a.responseWeighted += r.median_response_min * Math.max(r.leads, 1); a.responseWeight += Math.max(r.leads, 1);
    return a;
  }, { impressions:0, views:0, leads:0, qualified:0, responseWeighted:0, responseWeight:0 });
  const markets = [...new Set(rows.map(r => r.market))];
  totals.active = markets.reduce((sum, name) => sum + (marketProfiles.get(name)?.active_listings || 0), 0);
  totals.response = totals.responseWeight ? totals.responseWeighted / totals.responseWeight : 0;
  totals.viewToLead = totals.views ? totals.leads / totals.views : 0;
  totals.qualifiedRate = totals.leads ? totals.qualified / totals.leads : 0;
  totals.searchToView = totals.impressions ? totals.views / totals.impressions : 0;
  return totals;
}

function marketAggregate(name, range = state.range) {
  return aggregate(selectedWeekly(range, name));
}

function metricCard(label, value, detail, icon, tone, delta = '') {
  return `<div class="metric-card"><div class="metric-top"><span class="metric-label">${label}</span><span class="metric-icon ${tone}">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-bottom">${delta ? `<span class="metric-delta ${delta.startsWith('~') ? 'neutral' : ''}">${delta}</span>` : ''}<span>${detail}</span></div></div>`;
}

function renderOverview() {
  if (!state.data) return;
  const rows = selectedWeekly();
  const a = aggregate(rows);
  $('#metric-grid').innerHTML = [
    metricCard('VIEW → LEAD CONVERSION', pct(a.viewToLead), 'Listing views becoming enquiries', '↗', 'teal', 'PRIMARY'),
    metricCard('QUALIFIED LEADS', compact(a.qualified), `${pct(a.qualifiedRate)} of submitted leads`, '◎', 'blue', 'OUTCOME'),
    metricCard('ACTIVE LISTINGS', compact(a.active), 'Current inventory snapshot', '▤', 'amber', 'SUPPLY'),
    metricCard('AVG. FIRST RESPONSE', `${a.response.toFixed(0)}<small style="font:500 11px 'DM Sans';color:#8a98a7"> min</small>`, 'Lead-weighted across selected markets', '◷', 'coral', 'SERVICE')
  ].join('');
  renderTrend(rows);
  renderFunnel(a);
  renderMarketPerformance();
  renderSignals();
}

function renderTrend(rows) {
  const byWeek = new Map();
  rows.forEach(r => {
    if (!byWeek.has(r.week_start)) byWeek.set(r.week_start, { week:r.week_start, leads:0, qualified:0 });
    const item = byWeek.get(r.week_start); item.leads += r.leads; item.qualified += r.qualified_leads;
  });
  const data = [...byWeek.values()].sort((a,b) => a.week.localeCompare(b.week));
  const sumL = data.reduce((s,x) => s+x.leads,0), sumQ = data.reduce((s,x) => s+x.qualified,0);
  $('#trend-summary').innerHTML = `<div class="chart-summary-item"><strong>${compact(sumL)}</strong><span>leads</span></div><div class="chart-summary-item"><strong>${compact(sumQ)}</strong><span>qualified</span></div>`;
  const w = 720, h = 180, pad = {l:8,r:12,t:12,b:25};
  const max = Math.max(...data.map(d => d.leads), 1) * 1.18;
  const x = i => pad.l + i * (w-pad.l-pad.r) / Math.max(1, data.length-1);
  const y = v => h-pad.b - (v/max)*(h-pad.t-pad.b);
  const path = key => data.map((d,i) => `${i?'L':'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const dateLabel = s => new Date(`${s}T00:00:00`).toLocaleDateString('en',{month:'short',day:'numeric'});
  const guides = [0,.33,.66,1].map(v => {const yy=y(max*v);return `<line x1="0" x2="${w}" y1="${yy}" y2="${yy}" stroke="#edf1f4" stroke-width="1"/>`;}).join('');
  const labels = data.map((d,i) => `<text x="${x(i)}" y="${h-5}" text-anchor="middle" font-size="9" fill="#a2acb6">${dateLabel(d.week)}</text>`).join('');
  const dots = data.map((d,i) => `<circle cx="${x(i)}" cy="${y(d.leads)}" r="3" fill="#6c89e8" stroke="#fff" stroke-width="1.5"/><circle cx="${x(i)}" cy="${y(d.qualified)}" r="2.6" fill="#35b39d" stroke="#fff" stroke-width="1.3"/>`).join('');
  $('#lead-chart').innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Weekly leads and qualified leads trend">${guides}<path d="${path('leads')}" fill="none" stroke="#6c89e8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${path('qualified')}" fill="none" stroke="#35b39d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}

function renderFunnel(a) {
  const stages = [
    { name:'Search impressions', value:a.impressions, color:'#9eabc0', rate:null },
    { name:'Listing views', value:a.views, color:'#7e96c9', rate:a.impressions ? a.views/a.impressions : 0 },
    { name:'Enquiries / leads', value:a.leads, color:'#6f88e7', rate:a.views ? a.leads/a.views : 0 },
    { name:'Qualified leads', value:a.qualified, color:'#37b39e', rate:a.leads ? a.qualified/a.leads : 0 }
  ];
  const max = Math.max(stages[0].value,1);
  $('#funnel-view').innerHTML = stages.map((s,i) => `<div class="funnel-stage"><div class="funnel-stage-top"><span class="funnel-stage-name">${s.name}</span><span class="funnel-stage-value">${compact(s.value)}</span></div><div class="funnel-track"><div class="funnel-fill" style="width:${Math.max(2,s.value/max*100)}%;background:${s.color}"></div></div><div class="funnel-rate"><span>${i===0?'100% of search impressions':`Step conversion: ${pct(s.rate)}`}</span><span>${i===0?'':`${pct(s.value/a.impressions)} of top`}</span></div></div>`).join('');
  $('#funnel-note-text').textContent = `Only ${pct(a.qualified / Math.max(a.impressions,1))} of search impressions become qualified leads. Optimise for downstream quality, not just more forms.`;
}

function renderMarketPerformance() {
  const names = state.market === 'All markets' ? state.data.markets.map(m=>m.market) : [state.market];
  const rows = names.map(name => ({ name, ...marketAggregate(name) })).sort((a,b)=>b.viewToLead-a.viewToLead);
  const max = Math.max(...rows.map(x=>x.viewToLead), .01);
  $('#market-performance').innerHTML = rows.map(r => `<div class="market-row"><span class="market-name">${r.name}</span><div class="market-bar-wrap"><div class="market-bar" style="width:${r.viewToLead/max*100}%"></div></div><span class="market-rate">${pct(r.viewToLead)}</span><div class="market-meta"><span>${compact(r.qualified)} qualified leads</span><span>${pct(r.qualifiedRate)} lead quality</span></div></div>`).join('');
}

function renderSignals() {
  let items;
  if (state.market === 'All markets') {
    items = [
      {tone:'orange',icon:'◷',title:'Cairo · Response time is the bottleneck',copy:'~38 min average first response and only 40% of leads qualifying. Investigate routing and agent SLA before buying more demand.',action:'Test response-time intervention',page:'experiments'},
      {tone:'blue',icon:'⌕',title:'Riyadh · High discovery, weaker intent capture',copy:'30% search-to-view, but 8% view-to-lead. Review price context, contact visibility and listing-detail friction.',action:'Inspect market breakdown',page:'markets'},
      {tone:'green',icon:'▤',title:'Dubai · Small stale rate, large absolute volume',copy:'8% of 32.4k listings is about 2.6k stale records. Prioritise refresh and expiry controls by traffic, not rate alone.',action:'Open listing health queue',page:'listings'}
    ];
  } else {
    const p = marketProfiles.get(state.market), a = marketAggregate(state.market);
    items = [];
    if (a.response > 25 || a.qualifiedRate < .5) items.push({tone:'orange',icon:'◷',title:`${state.market} · Fix lead fulfilment`,copy:`${a.response.toFixed(0)} min average response and ${pct(a.qualifiedRate)} lead qualification suggest a post-submit experience issue.`,action:'Design a fulfilment test',page:'experiments'});
    if (a.viewToLead < .09) items.push({tone:'blue',icon:'⌕',title:`${state.market} · Audit intent capture`,copy:`Only ${pct(a.viewToLead)} of listing views become leads. Review price context, detail completeness and contact friction.`,action:'Compare market metrics',page:'markets'});
    if (p.stale_pct >= 10 || p.quality_score < 75) items.push({tone:'green',icon:'▤',title:`${state.market} · Improve supply trust`,copy:`Quality score is ${p.quality_score}/100, ${p.stale_pct}% of inventory is marked stale. Focus on freshness and verification.`,action:'Open listing health queue',page:'listings'});
    if (!items.length) items.push({tone:'green',icon:'✳',title:`${state.market} · Protect what is working`,copy:`${pct(a.viewToLead)} view-to-lead conversion and ${pct(a.qualifiedRate)} lead qualification are comparatively strong. Validate which experience choices are driving it.`,action:'Model an experiment',page:'experiments'});
    items = items.slice(0,3);
  }
  $('#signal-list').innerHTML = items.map((item,i)=>`<div class="signal-item"><div class="signal-icon ${item.tone}">${item.icon}</div><div><div class="signal-title">${item.title}</div><div class="signal-copy">${item.copy}</div><div class="signal-action" data-signal-go="${item.page}">${item.action} ↗</div></div></div>`).join('');
  $$('[data-signal-go]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.signalGo)));
}

function renderMarkets() {
  if (!state.data) return;
  const range = Number($('#markets-range').value || 30);
  const names = state.data.markets.map(m=>m.market);
  const totals = aggregate(names.flatMap(name=>selectedWeekly(range,name)));
  $('#market-metric-grid').innerHTML = [
    metricCard('TOTAL LISTING VIEWS',compact(totals.views),'Across five demo markets','⌕','blue','DEMAND'),
    metricCard('SUBMITTED LEADS',compact(totals.leads),'Across selected window','↗','teal','ACTIVITY'),
    metricCard('QUALIFIED LEAD RATE',pct(totals.qualifiedRate),'Qualified / submitted leads','◎','amber','QUALITY'),
    metricCard('AVG. FIRST RESPONSE',`${totals.response.toFixed(0)}<small style="font:500 11px 'DM Sans';color:#8a98a7"> min</small>`,'Lead-weighted average','◷','coral','FULFILMENT')
  ].join('');
  const aggs = names.map(name=>({name,...marketAggregate(name,range)}));
  $('#market-comparison').innerHTML = aggs.map(a=>`<div class="compare-row"><div class="compare-name">${a.name}</div><div class="compare-track"><div class="compare-fill conv" style="width:${Math.max(4,a.viewToLead/.14*100)}%">${pct(a.viewToLead)}</div></div><div class="compare-track"><div class="compare-fill qualified" style="width:${Math.max(4,a.qualifiedRate/.8*100)}%">${pct(a.qualifiedRate)}</div></div></div>`).join('');
  $('#market-scorecard').innerHTML = state.data.markets.map(m=>`<tr><td><div class="market-cell"><span class="market-flag">${m.code}</span><strong>${m.market}</strong></div></td><td>${compact(m.active_listings)}</td><td><div class="quality-mini"><b>${m.quality_score}</b><span><i style="width:${m.quality_score}%"></i></span></div></td><td>${m.verified_pct}%</td><td><span style="color:${m.stale_pct>=12?'#d9826b':'#697a8e'};font-weight:700">${m.stale_pct}%</span></td><td>${m.response_min.toFixed(0)} min</td></tr>`).join('');
}

function healthLevel(score) { return score >= 80 ? 'good' : score >= 60 ? 'watch' : 'risk'; }
function formatPrice(l) { return `${l.currency.startsWith('EGP')?'EGP':l.currency.startsWith('SAR')?'SAR':l.currency.startsWith('QAR')?'QAR':'AED'} ${fmt(l.price)}${l.currency.includes('/ yr')?' / yr':l.currency.includes('/ mo')?' / mo':''}`; }
function renderListings() {
  if (!state.data) return;
  const listings = state.data.listings;
  const atRisk = listings.filter(l=>l.quality_score<60).length;
  $('#at-risk-count').textContent = fmt(atRisk);
  const filtered = listings.filter(l => {
    const level=healthLevel(l.quality_score);
    const matchMarket=state.listingMarket==='All markets'||l.market===state.listingMarket;
    const matchHealth=state.listingHealth==='all'||(state.listingHealth==='risk'?level!=='good':level==='good');
    const haystack=`${l.id} ${l.market} ${l.title} ${l.issue}`.toLowerCase();
    return matchMarket&&matchHealth&&(!state.search||haystack.includes(state.search));
  }).sort((a,b)=>a.quality_score-b.quality_score);
  $('#listing-rows').innerHTML = filtered.map(l=>{
    const level=healthLevel(l.quality_score), label=level==='good'?'Healthy':level==='watch'?'Watch':'At risk';
    const isFlagged=state.flagged.has(l.id);
    return `<tr><td><div class="listing-title"><strong>${esc(l.title)}</strong><small>${l.id} · ${l.purpose} · ${l.beds} bed${l.beds===1?'':'s'} · ${fmt(l.area_sqft)} sqft</small></div></td><td>${l.market}</td><td class="price-cell">${formatPrice(l)}</td><td><span class="health-chip ${level}">${l.quality_score} / 100 · ${label}</span></td><td>${l.leads_30d}</td><td>${l.qualified_30d}</td><td><span class="issue-text ${l.issue==='Healthy'?'healthy':''}">${esc(l.issue)}</span></td><td><button class="row-action ${isFlagged?'flagged':''}" data-flag="${l.id}">${isFlagged?'Flagged ✓':'Flag'}</button></td></tr>`;
  }).join('') || `<tr><td colspan="8" style="text-align:center;padding:30px;color:#98a4b1">No listings match these filters.</td></tr>`;
  $('#listing-count-label').textContent = `Showing ${filtered.length} of ${listings.length} sample listings`;
  $$('[data-flag]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.flag;
    if(state.flagged.has(id)) state.flagged.delete(id); else state.flagged.add(id);
    renderListings();
    showToast(state.flagged.has(id)?`${id} added to your review queue`:`${id} removed from your review queue`);
  }));
}

function renderSimulation() {
  if (!state.data) return;
  const market=$('#experiment-market').value;
  const lift=Number($('#lift-slider').value);
  $('#lift-value').textContent=`+${lift}%`;
  const rows=selectedWeekly(30,market);
  const agg=aggregate(rows);
  const weeks=Math.max(1,new Set(rows.map(r=>r.week_start)).size);
  const monthlyViews=agg.views/weeks*4.345;
  const monthlyLeads=agg.leads/weeks*4.345;
  const monthlyQualified=agg.qualified/weeks*4.345;
  const extraLeads=monthlyLeads*lift/100;
  const extraQualified=extraLeads*agg.qualifiedRate;
  const qualifiedPerThousand=monthlyViews?monthlyQualified/monthlyViews*1000:0;
  const profiles=market==='All markets'?state.data.markets:[marketProfiles.get(market)];
  let hypothesis='If we make the contact action clearer and reduce avoidable form friction, more high-intent listing viewers will become qualified leads.';
  let testName='Listing detail contact-flow test';
  let treatmentTitle='Intent-first contact flow';
  let treatmentCopy='Prominent call / message choice, fewer required fields and context pre-filled from the listing.';
  if(market==='Cairo') {
    hypothesis='If we surface a clear response expectation and route enquiries to available agents, more submitted leads will progress to qualified conversations.';
    testName='Response-confidence and routing test'; treatmentTitle='Availability-aware lead routing';
    treatmentCopy='Show an expected reply window, route new enquiries to an available broker and prompt the assigned agent before the response SLA expires.';
  }
  if(market==='Riyadh') {
    hypothesis='If we add useful price context beside the contact action and preserve listing details in the enquiry, more listing viewers will submit high-intent leads.';
    testName='Price-context contact-flow test'; treatmentTitle='Price-context contact module';
    treatmentCopy='Add a price-per-area / rent-context cue beside the CTA and pre-fill the enquiry with the listing and seeker intent.';
  }
  if(market==='Dubai') {
    hypothesis='If we make listing freshness and verification more visible at the moment of contact, seekers will send fewer low-value enquiries and more useful leads.';
    testName='Listing-confidence contact test'; treatmentTitle='Freshness-aware contact module';
    treatmentCopy='Surface verified status and last-confirmed availability beside the CTA; suppress or redirect contact on listings that fail a freshness check.';
  }
  if(market==='Abu Dhabi'||market==='Doha') {
    hypothesis='If we preserve strong listing trust while reducing contact friction, qualified leads per listing view can improve without sacrificing lead quality.';
  }
  $('#experiment-name').textContent=testName;
  $('#treatment-title').textContent=treatmentTitle;
  $('#treatment-copy').textContent=treatmentCopy;
  $('#experiment-hypothesis').textContent=hypothesis;
  $('#simulation-results').innerHTML = `
    <div class="result-card"><span class="mini-label">CURRENT MONTHLY QUALIFIED</span><strong>${compact(monthlyQualified)}</strong><small>Baseline scenario</small></div>
    <div class="result-card"><span class="mini-label">ADDITIONAL LEADS</span><strong>+${fmt(extraLeads)}</strong><small>Assumed ${lift}% relative lift</small></div>
    <div class="result-card highlight"><span class="mini-label">ADDITIONAL QUALIFIED</span><strong>+${fmt(extraQualified)}</strong><small>At current ${pct(agg.qualifiedRate)} qualification rate</small></div>`;
  // The selected profile set is intentionally kept available for future localised guardrails.
  void profiles; void qualifiedPerThousand;
}


let authMode = 'login';
let activeUser = null;

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === 'signup';
  $('#auth-name-wrap').hidden = !isSignup;
  $('#auth-title').textContent = isSignup ? 'Create your workspace.' : 'Welcome back.';
  $('#auth-description').textContent = isSignup
    ? 'Set up a local MarketLens account to save your own workspace session.'
    : 'Sign in to continue exploring marketplace performance.';
  $('#auth-submit-label').textContent = isSignup ? 'Create account' : 'Sign in to MarketLens';
  $('#auth-password').autocomplete = isSignup ? 'new-password' : 'current-password';
  $('#password-help').textContent = isSignup ? 'Use at least 8 characters. Your password is stored as a secure hash.' : 'Use your workspace password.';
  $('#auth-mode-switch').innerHTML = isSignup
    ? 'Already have an account? <button type="button" id="auth-mode-toggle">Sign in</button>'
    : 'New to MarketLens? <button type="button" id="auth-mode-toggle">Create an account</button>';
  $('#auth-mode-toggle').addEventListener('click', () => setAuthMode(isSignup ? 'login' : 'signup'));
  $('#auth-error').textContent = '';
  $('#auth-password').value = '';
}

function showAuthError(message) {
  $('#auth-error').textContent = message;
}

async function requestAuth(path, payload = undefined) {
  const response = await fetch(path, {
    method: payload ? 'POST' : 'GET',
    headers: payload ? { 'Content-Type': 'application/json' } : {},
    body: payload ? JSON.stringify(payload) : undefined,
    credentials: 'same-origin'
  });
  let result = {};
  try { result = await response.json(); } catch { /* A static host may return an HTML 404 page. */ }
  if (!response.ok) throw new Error(result.error || 'Account access is unavailable here. Use the demo button to explore the workspace.');
  return result;
}

function enterWorkspace(user, mode = 'account') {
  activeUser = { ...user, mode };
  const name = user.name || (mode === 'demo' ? 'Demo Workspace' : 'Product Lab');
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'ML';
  $('#profile-name').textContent = name;
  $('#profile-subtitle').textContent = mode === 'demo' ? 'Demo workspace · no account' : 'Personal workspace';
  $('#profile-avatar').textContent = initials;
  $('#top-avatar').textContent = initials;
  $('#account-label').textContent = mode === 'demo' ? 'Demo' : name.split(/\s+/)[0];
  $('#auth-screen').classList.add('is-hidden');
  $('.app-shell').classList.add('is-visible');
  if (mode === 'demo') showToast('Demo workspace loaded · all data is synthetic');
}

async function leaveWorkspace() {
  if (activeUser?.mode === 'account') {
    try { await requestAuth('/api/auth/logout', {}); } catch { /* Clear the local view even if the server is unavailable. */ }
  }
  activeUser = null;
  sessionStorage.removeItem('marketlens-demo-session');
  $('.app-shell').classList.remove('is-visible');
  $('#auth-screen').classList.remove('is-hidden');
  $('#auth-email').value = '';
  $('#auth-password').value = '';
  setAuthMode('login');
}

async function initAuth() {
  $('#demo-button').addEventListener('click', () => {
    const demoUser = { name: 'Demo Workspace', email: 'demo@marketlens.local' };
    sessionStorage.setItem('marketlens-demo-session', JSON.stringify(demoUser));
    enterWorkspace(demoUser, 'demo');
  });
  $('#auth-top-signin').addEventListener('click', () => {
    setAuthMode('login');
    $('#auth-email').focus();
  });
  $('#auth-mode-toggle').addEventListener('click', () => setAuthMode('signup'));
  $('#forgot-password').addEventListener('click', () => {
    showAuthError('Password reset email is not configured in this portfolio prototype. Use Explore the live demo for instant access.');
  });
  $('#password-toggle').addEventListener('click', () => {
    const input = $('#auth-password');
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    $('#password-toggle').textContent = visible ? 'Hide' : 'Show';
    $('#password-toggle').setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  });
  $('#signout-button').addEventListener('click', leaveWorkspace);
  $('#top-signout').addEventListener('click', leaveWorkspace);
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('#auth-email').value.trim().toLowerCase();
    const password = $('#auth-password').value;
    const name = $('#auth-name').value.trim();
    $('#auth-error').textContent = '';
    if (!/^\S+@\S+\.\S+$/.test(email)) return showAuthError('Enter a valid email address.');
    if (password.length < 8) return showAuthError('Your password must be at least 8 characters.');
    if (authMode === 'signup' && name.length < 2) return showAuthError('Enter your name to create an account.');
    const button = $('#auth-submit');
    button.disabled = true;
    $('#auth-submit-label').textContent = authMode === 'signup' ? 'Creating workspace…' : 'Signing you in…';
    try {
      const path = authMode === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const payload = authMode === 'signup' ? { name, email, password } : { email, password };
      const result = await requestAuth(path, payload);
      enterWorkspace(result.user, 'account');
    } catch (error) {
      showAuthError(error.message || 'Unable to sign in. Please try again.');
    } finally {
      button.disabled = false;
      $('#auth-submit-label').textContent = authMode === 'signup' ? 'Create account' : 'Sign in to MarketLens';
    }
  });

  const demoSession = sessionStorage.getItem('marketlens-demo-session');
  if (demoSession) {
    try {
      enterWorkspace(JSON.parse(demoSession), 'demo');
      return;
    } catch { sessionStorage.removeItem('marketlens-demo-session'); }
  }
  try {
    const result = await requestAuth('/api/auth/me');
    if (result.user) enterWorkspace(result.user, 'account');
  } catch {
    // No active account cookie: show the sign-in page. Demo access always remains available.
  }
}

function openAbout(){ $('#about-modal').classList.add('open'); $('#about-modal').setAttribute('aria-hidden','false'); }
function closeAbout(){ $('#about-modal').classList.remove('open'); $('#about-modal').setAttribute('aria-hidden','true'); }
let toastTimer;
function showToast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2300);}

function renderAll(){renderOverview();renderMarkets();renderListings();renderSimulation();}
boot();
