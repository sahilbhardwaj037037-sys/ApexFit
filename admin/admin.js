'use strict';

// Only the public Worker URL belongs here. Airtable access and credential checks
// stay on the Worker. The only persisted value is its short-lived session token.
const API_BASE = 'https://apexfit-admin-api.bysahilworks.workers.dev';
const SESSION_KEY = 'apexfit.admin.token';
let sessionEnded = false;
function sessionToken() {
  try { return sessionStorage.getItem(SESSION_KEY) || ''; }
  catch { return ''; }
}
function endSession() {
  sessionEnded = true;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage may be blocked. */ }
  if (document.querySelector('.dashboard-page')) document.body.hidden = true;
  window.location.replace('index.html');
}
class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}
async function apiRequest(path, {method = 'GET', body, protectedRequest = true} = {}) {
  const token = protectedRequest ? sessionToken() : '';
  if (protectedRequest && (!token || sessionEnded)) {
    endSession();
    throw new ApiError('Please sign in again.', 401);
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const headers = {Accept: 'application/json'};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (protectedRequest) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${path}`, {
      method, headers, body, signal: controller.signal,
      credentials: 'omit', cache: 'no-store', redirect: 'error'
    });
    if (protectedRequest && response.status === 401) {
      endSession();
      throw new ApiError('Your session expired. Please sign in again.', 401);
    }
    if (!response.ok) {
      const message = !protectedRequest && (response.status === 401 || response.status === 403)
        ? 'Invalid password. Please try again.'
        : response.status === 429 ? 'Too many requests. Please try again shortly.'
        : 'The service could not complete the request. Please try again.';
      throw new ApiError(message, response.status);
    }
    let data;
    try { data = await response.json(); }
    catch { throw new ApiError('The service returned an invalid response. Please try again.'); }
    if (data?.success === false) throw new ApiError('The service could not complete the request. Please try again.');
    if (protectedRequest && (sessionEnded || sessionToken() !== token)) throw new ApiError('Please sign in again.', 401);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError'
      ? 'The request timed out. Please try again.'
      : 'Unable to reach the service. Check your connection and try again.');
  } finally { window.clearTimeout(timeout); }
}
// Handles a direct array, Airtable's {records}, and common Worker data wrappers.
// A malformed response is an error, never silently treated as an empty table.
async function fetchRecords(section) {
  const records = [];
  const offsets = new Set();
  let offset = '';
  do {
    const payload = await apiRequest(`/api/${section}${offset ? `?offset=${encodeURIComponent(offset)}` : ''}`);
    const page = Array.isArray(payload) ? payload
      : payload?.records ?? payload?.data?.records ?? payload?.data ?? payload?.[section];
    if (!Array.isArray(page) || page.some(record => !record || typeof record !== 'object' || Array.isArray(record))) {
      throw new ApiError('The service returned an unexpected record format.');
    }
    records.push(...page);
    const next = payload?.offset ?? payload?.data?.offset;
    if (next != null && next !== '' && typeof next !== 'string') throw new ApiError('The service returned an invalid page cursor.');
    offset = next || '';
    if (offsets.has(offset) && offset) throw new ApiError('The service returned a repeated page cursor.');
    if (offset) offsets.add(offset);
  } while (offset);
  return records.map((record, index) => normalizeRecord(section, record, index));
}
const backend = Object.freeze({
  login: password => apiRequest('/api/login', {method:'POST', body:JSON.stringify({password}), protectedRequest:false}),
  getLeads: () => fetchRecords('leads'),
  getBookings: () => fetchRecords('bookings'),
  getPayments: () => fetchRecords('payments')
});

const loginForm = document.querySelector('#login-form');
if (loginForm) {
  const password = document.querySelector('#login-password');
  const toggle = document.querySelector('#password-toggle');
  const feedback = document.querySelector('#login-feedback');
  const submit = loginForm.querySelector('[type="submit"]');
  const loginHelp = feedback.textContent;
  let submitting = false;
  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  });
  function resetPassword() {
    password.value = '';
    password.type = 'password';
    toggle.textContent = 'Show';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', 'Show password');
  }
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    if (!password.value) { feedback.textContent = 'Enter your admin password.'; password.focus(); return; }
    submitting = true;
    submit.disabled = true;
    loginForm.setAttribute('aria-busy', 'true');
    feedback.textContent = 'Signing in…';
    try {
      // The password is sent once, cleared immediately, and never persisted.
      sessionStorage.removeItem(SESSION_KEY);
      const request = backend.login(password.value);
      resetPassword();
      const result = await request;
      if (result?.success !== true || typeof result.token !== 'string' || !result.token.trim()
        || /[\r\n]/.test(result.token) || !Number.isFinite(result.expiresIn) || result.expiresIn <= 0) {
        throw new ApiError('The service returned an invalid login response. Please try again.');
      }
      // Expiration is enforced by the Worker; every protected 401 ends this session.
      sessionStorage.setItem(SESSION_KEY, result.token);
      loginForm.reset();
      window.location.replace('dashboard.html');
    } catch (error) {
      resetPassword();
      feedback.textContent = error instanceof ApiError ? error.message : 'Session storage is unavailable. Allow session storage and try again.';
    } finally {
      submitting = false;
      submit.disabled = false;
      loginForm.removeAttribute('aria-busy');
    }
  });
  window.addEventListener('pageshow', () => {
    loginForm.reset(); resetPassword(); feedback.textContent = loginHelp;
  });
}

// Records live in memory only. Enquiries deliberately remain unconnected.
const dashboardData = {leads:[], bookings:[], payments:[], enquiries:[]};
const loadState = {leads:'loading', bookings:'loading', payments:'loading', enquiries:'unconnected'};
const loadErrors = {};

const sections = {
  leads: { title:'Leads', eyebrow:'THE START OF SOMETHING STRONG', description:'Get to know the people ready for their next chapter.', statuses:['New','Contacted','Qualified','Converted','Lost'], columns:[['name','Full Name'],['email','Email'],['phone','Phone'],['goal','Primary Goal'],['level','Fitness Level'],['training','Preferred Training'],['budget','Budget Range'],['status','Status'],['created','Created At']] },
  bookings: { title:'Bookings', eyebrow:'MAKE TIME FOR PROGRESS', description:'A clear view of every conversation and coaching session.', statuses:['Upcoming','Completed','Cancelled','Rescheduled'], columns:[['name','Customer Name'],['email','Email'],['phone','Phone'],['date','Booking Date'],['time','Booking Time'],['event','Event Type'],['status','Status'],['bookingId','Cal Booking ID']] },
  payments: { title:'Payments', eyebrow:'THE BUSINESS BEHIND THE PROGRESS', description:'Keep a clear view of payments and their status.', statuses:['Paid','Pending','Failed','Refunded'], columns:[['name','Customer Name'],['email','Email'],['phone','Phone'],['amount','Amount'],['purpose','Payment For'],['status','Payment Status'],['paymentId','Razorpay Payment ID'],['date','Payment Date']] },
  enquiries: { title:'Enquiries', eyebrow:'EVERY CONVERSATION COUNTS', description:'A thoughtful first response can make all the difference.', statuses:['New','Replied','Closed'], columns:[['name','Full Name'],['email','Email'],['phone','Phone'],['goal','Primary Goal'],['message','Message'],['status','Status'],['received','Received At']] }
};
// Management shortcuts only: these URLs carry no credentials and make no API calls.
// Sync notes describe the external Airtable workflows, independently of the dashboard API requests.
const managementLinks = {
  leads: {
    status: 'Airtable sync active · Records loaded through the Worker.',
    links: [
      ['Open in Airtable', 'https://airtable.com/appCE7p7iBWbUwimI/tblfe5QPdMo7xx9Kt/viwl1uWIrgzKEVXLf?blocks=hide'],
      ['Open Tally', 'https://tally.so/forms/b50qGZ']
    ]
  },
  bookings: {
    status: 'Airtable sync active · Records loaded through the Worker.',
    links: [
      ['Open in Airtable', 'https://airtable.com/appCE7p7iBWbUwimI/tblti6eQODbZ7H50X/viw2Jq9vkcu9AFiYi?blocks=hide'],
      ['Open Cal.com', 'https://app.cal.com/event-types'],
      ['Open Gmail', 'https://mail.google.com/mail/']
    ]
  },
  payments: {
    status: 'Airtable automation inactive · Payment sync is not confirmed.',
    links: [
      ['Open in Airtable', 'https://airtable.com/appCE7p7iBWbUwimI/tblL6akJ8ulD5ibhF/viwSKWuNe3RmXZ6eh?blocks=hide'],
      ['Open Razorpay', 'https://dashboard.razorpay.com/app/dashboard']
    ]
  },
  enquiries: {
    status: 'Airtable sync is not active yet.',
    links: [
      ['Open in Airtable', 'https://airtable.com/appCE7p7iBWbUwimI/tblaqlbTOMQy3pyfk/viwhznn8jvXHaqJxh?blocks=hide'],
      ['Open Formspree', 'https://formspree.io/forms'],
      ['Open Gmail', 'https://mail.google.com/mail/']
    ]
  }
};
// Map the existing dashboard column labels to Airtable fields. Flat Worker
// records and Airtable {id, fields, createdTime} records are both accepted.
function displayText(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map(displayText).filter(item => item !== '—').join(', ') || '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return typeof value.name === 'string' ? value.name : '—';
}
function dateValue(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function formatDate(value) {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat('en-GB', {day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Kolkata'}).format(date) : displayText(value);
}
function normalizeRecord(section, record, index) {
  const fields = record.fields && typeof record.fields === 'object' && !Array.isArray(record.fields) ? record.fields : record;
  const keyOf = key => key.toLowerCase().replace(/[^a-z0-9]/g, '');
  const lookup = new Map(Object.entries(fields).map(([key, value]) => [keyOf(key), value]));
  const aliases = {name:['Full Name','Customer Name','Name'], phone:['Phone','Phone Number'], created:['Created At','Created Time'], status:['Status','Payment Status'], bookingId:['Cal Booking ID'], paymentId:['Razorpay Payment ID']};
  const result = {id: displayText(record.id ?? fields.id ?? `${section}-${index}`)};
  for (const [key, label] of sections[section].columns) {
    const candidates = [label, key, ...(aliases[key] || [])];
    let value;
    for (const candidate of candidates) {
      const found = lookup.get(keyOf(candidate));
      if (found != null && found !== '') { value = found; break; }
    }
    if (key === 'created') value ??= record.createdTime;
    if (key === 'amount') {
      const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value.replace(/[₹,\s]/g, '')) : NaN;
      result.amount = Number.isFinite(numeric) ? numeric : null;
    } else if (key === 'status') {
      const status = displayText(value);
      result.status = sections[section].statuses.find(item => item.toLowerCase() === status.toLowerCase()) || status;
    } else if (key === 'created' || key === 'date') {
      result[key] = formatDate(value);
      result[`${key}Timestamp`] = dateValue(value)?.getTime() ?? null;
    } else result[key] = displayText(value);
  }
  return result;
}
function updateLeadChart() {
  // Use the current week in India, not the browser's local timezone.
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const monday = new Date(`${today}T00:00:00+05:30`);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (weekday + 6) % 7);
  const counts = Array(7).fill(0);
  dashboardData.leads.forEach(record => {
    if (record.createdTimestamp === null) return;
    const day = Math.floor((record.createdTimestamp - monday.getTime()) / 86400000);
    if (day >= 0 && day < 7) counts[day] += 1;
  });
  const ready = loadState.leads === 'ready';
  const total = counts.reduce((sum, count) => sum + count, 0);
  const ceiling = Math.max(3, Math.ceil(Math.max(...counts) / 3) * 3);
  document.querySelectorAll('.chart-bars > div > span').forEach((bar, index) => {
    bar.style.setProperty('--bar-height', `${counts[index] / ceiling * 100}%`);
    bar.querySelector('b').textContent = ready ? String(counts[index]) : '—';
  });
  document.querySelectorAll('.chart-y span').forEach((label, index) => { label.textContent = String(ceiling * (3 - index) / 3); });
  document.querySelector('.chart-summary > strong').textContent = ready ? String(total) : '—';
  document.querySelector('.activity-panel .subtle-label').textContent = ready ? 'THIS WEEK · IST' : loadState.leads === 'loading' ? 'LOADING' : 'UNAVAILABLE';
  document.querySelector('.chart-caption > span:last-child').textContent = ready ? 'From dated lead records' : 'No data available';
  document.querySelector('.bar-chart').setAttribute('aria-label', ready ? `Leads this week, Monday through Sunday: ${counts.join(', ')}. Total ${total}.` : 'Lead activity is unavailable.');
}
const currency = new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0});
function getRecords(section) { return dashboardData[section] || []; }
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function statusBadge(status) { return element('span', `badge badge-${status.toLowerCase().replace(/[^a-z0-9-]/g, '')}`, status); }
function personName(name) {
  const person = element('span', 'person');
  const avatar = element('span', 'avatar', name.split(' ').map(part => part[0]).join(''));
  avatar.setAttribute('aria-hidden', 'true');
  person.append(avatar, element('span', '', name));
  return person;
}
function recordButton(label, section, record, action = 'view') {
  const button = element('button', 'row-action', label);
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.record = record.id;
  button.dataset.recordSection = section;
  button.setAttribute('aria-label', `${label} ${record.name}`);
  return button;
}
function renderTable(section, records, columns = sections[section].columns) {
  const scroll = element('div', 'table-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', `${sections[section].title} table, scroll horizontally for more columns`);
  const table = element('table');
  table.append(element('caption', '', `${sections[section].title} records`));
  const head = element('thead');
  const header = element('tr');
  [...columns, ['actions','Actions']].forEach(([, label]) => {
    const th = element('th', '', label); th.scope = 'col'; header.append(th);
  });
  head.append(header);
  const body = element('tbody');
  records.forEach(record => {
    const row = element('tr');
    columns.forEach(([key]) => {
      const cell = element('td');
      if (key === 'name') cell.append(personName(record.name));
      else if (key === 'status') cell.append(statusBadge(record.status));
      else if (key === 'amount') { cell.className = 'money'; cell.textContent = record.amount === null ? '—' : currency.format(record.amount); }
      else { cell.textContent = record[key]; }
      if (key === 'message') cell.className = 'message-cell';
      row.append(cell);
    });
    const cell = element('td');
    const actions = element('div', 'row-actions');
    actions.append(recordButton('View', section, record));
    if (section === 'enquiries') actions.append(recordButton('Reply', section, record, 'reply'));
    cell.append(actions); row.append(cell); body.append(row);
  });
  table.append(head, body); scroll.append(table); return scroll;
}

if (document.querySelector('.dashboard-page') && !sessionToken()) endSession();

if (document.querySelector('.dashboard-page') && sessionToken()) {
  document.querySelector('.logout-link').addEventListener('click', event => { event.preventDefault(); endSession(); });
  window.addEventListener('pageshow', event => {
    if (!sessionToken()) endSession();
    else if (event.persisted) window.location.reload();
  });
  // Prevent cached authenticated content from flashing after logout/back navigation.
  window.addEventListener('pagehide', () => { document.body.hidden = true; });
  const filters = Object.fromEntries(Object.keys(sections).map(key => [key, {query:'', status:''}]));
  const sidebar = document.querySelector('#sidebar');
  const menuToggle = document.querySelector('.menu-toggle');
  const backdrop = document.querySelector('.drawer-backdrop');
  const mobile = window.matchMedia('(max-width: 900px)');
  let drawerOpen = false;
  function setDrawer(open, restoreFocus = true) {
    drawerOpen = open && mobile.matches;
    sidebar.classList.toggle('is-open', drawerOpen);
    sidebar.inert = mobile.matches && !drawerOpen;
    document.querySelector('.app-shell').inert = drawerOpen;
    document.body.classList.toggle('drawer-open', drawerOpen);
    backdrop.hidden = !drawerOpen;
    menuToggle.setAttribute('aria-expanded', String(drawerOpen));
    if (drawerOpen) sidebar.querySelector('.drawer-close').focus();
    else if (restoreFocus && mobile.matches) menuToggle.focus();
  }
  menuToggle.addEventListener('click', () => setDrawer(!drawerOpen));
  document.querySelector('.drawer-close').addEventListener('click', () => setDrawer(false));
  backdrop.addEventListener('click', () => setDrawer(false));
  mobile.addEventListener('change', () => setDrawer(false, false));
  setDrawer(false, false);
  document.addEventListener('keydown', event => {
    if (!drawerOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); setDrawer(false); }
    if (event.key === 'Tab') {
      const focusable = [...sidebar.querySelectorAll('a,button')].filter(node => node.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  function updateTable(section) {
    const { query, status } = filters[section];
    const all = getRecords(section);
    const records = all.filter(record => (!status || record.status === status) && Object.values(record).join(' ').toLowerCase().includes(query.trim().toLowerCase()));
    const target = document.querySelector(`#${section}-table`);
    target.replaceChildren();
    target.setAttribute('aria-busy', String(loadState[section] === 'loading'));
    if (loadState[section] === 'loading' || loadState[section] === 'error') {
      const empty = element('div', 'empty-state');
      empty.append(element('h3', '', loadState[section] === 'loading' ? `Loading ${section}…` : `Unable to load ${section}`));
      if (loadErrors[section]) empty.append(element('p', '', loadErrors[section]));
      target.append(empty);
    } else if (records.length) target.append(renderTable(section, records));
    else {
      const empty = element('div', 'empty-state');
      empty.append(element('h3', '', all.length ? 'No matching records' : `No ${section} yet`), element('p', '', all.length ? 'Try another search or clear your filters.' : 'No records loaded.'));
      const reset = element('button', 'secondary-button', 'Clear filters');
      reset.type = 'button';
      reset.addEventListener('click', () => {
        filters[section] = {query:'', status:''};
        document.querySelector(`#${section}-search`).value = '';
        document.querySelector(`#${section}-filter`).value = '';
        updateTable(section);
        document.querySelector(`#${section}-search`).focus();
      });
      empty.append(reset); target.append(empty);
    }
    const ready = loadState[section] === 'ready' || section === 'enquiries';
    document.querySelector(`#${section}-count`).textContent = ready ? `${records.length} of ${all.length} records` : loadState[section] === 'error' ? 'Unavailable' : 'Loading…';
    document.querySelector(`#section-${section} .section-heading-count`).textContent = ready ? `${all.length} records` : loadState[section] === 'error' ? 'Unavailable' : 'Loading…';
    document.querySelector(`#section-${section} .table-footer span`).textContent = section === 'enquiries' ? 'Enquiries are not connected yet' : loadState[section] === 'ready' ? 'Records loaded through the Worker' : loadState[section] === 'error' ? 'Unable to load records · Reload to retry' : 'Loading records…';
  }
  Object.entries(sections).forEach(([key, config]) => {
    const section = document.querySelector(`#section-${key}`);
    // Only constant interface labels are inserted as HTML. All record and user text
    // is rendered with textContent or form values, never interpolated into markup.
    section.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${config.eyebrow}</p><h1 id="${key}-title">${config.title}</h1><p>${config.description}</p></div><span class="section-heading-count">${getRecords(key).length} records</span></div><div class="panel"><div class="table-toolbar"><div class="search-control"><label for="${key}-search">Search ${key}</label><input id="${key}-search" type="search" placeholder="Search by name, email, or details…" autocomplete="off"></div><div class="filter-control"><label for="${key}-filter">Status</label><select id="${key}-filter"><option value="">All statuses</option></select></div><span id="${key}-count" class="table-count" role="status" aria-live="polite"></span></div><div id="${key}-table"></div><div class="table-footer"><span>Loading records…</span><span>Scroll the table to see all details ↔</span></div></div>`;
    const heading = section.querySelector('.page-heading');
    heading.classList.add('management-heading');
    const management = element('div', 'section-management');
    const links = element('nav', 'management-links');
    links.setAttribute('aria-label', `${config.title} management links`);
    managementLinks[key].links.forEach(([label, url]) => {
      const link = element('a', 'management-link', label);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = label === 'Open in Airtable'
        ? 'Advanced and manual record management in Airtable (opens in a new tab)'
        : `${label} (opens in a new tab)`;
      const arrow = element('span', '', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      link.append(arrow);
      links.append(link);
    });
    management.append(links, element('p', 'management-status', managementLinks[key].status));
    heading.append(management);
    const select = document.querySelector(`#${key}-filter`);
    config.statuses.forEach(status => { const option = element('option', '', status); option.value = status; select.append(option); });
    document.querySelector(`#${key}-search`).addEventListener('input', event => { filters[key].query = event.target.value; updateTable(key); });
    select.addEventListener('change', event => { filters[key].status = event.target.value; updateTable(key); });
    updateTable(key);
  });

  function updateOverview() {
    const cards = document.querySelectorAll('.metric-card');
    const values = [dashboardData.leads.length, dashboardData.bookings.length,
      dashboardData.payments.reduce((sum, record) => sum + (['paid', 'captured', 'success', 'successful', 'completed'].includes(record.status.toLowerCase()) && record.amount !== null ? record.amount : 0), 0), 0];
    ['leads', 'bookings', 'payments', 'enquiries'].forEach((section, index) => {
      const text = loadState[section] === 'loading' ? '…' : loadState[section] === 'error' ? '—' : index === 2 ? currency.format(values[index]) : String(values[index]);
      const value = cards[index].querySelector(':scope > strong');
      value.firstChild.textContent = text;
    });
    cards[0].querySelector('.metric-trend').textContent = loadState.leads === 'ready' ? 'From available records' : loadState.leads === 'error' ? 'Unable to load data' : 'Loading…';
    cards[2].querySelector('.metric-trend').textContent = loadState.payments === 'ready' ? 'Paid payments only' : loadState.payments === 'error' ? 'Unable to load data' : 'Loading…';
    updateLeadChart();
    const upcoming = document.querySelector('#upcoming-list');
    upcoming.replaceChildren();
    getRecords('bookings').filter(record => record.status === 'Upcoming').slice(0,3).forEach(record => {
      const card = element('div', 'session-card');
      const date = element('div', 'date-tile');
      const [day = '—', month = ''] = record.date.split(' ');
      date.append(element('small', '', month.toUpperCase()), element('strong', '', day));
      const info = element('div', 'session-info');
      info.append(element('strong', '', record.name), element('p', '', record.event));
      card.append(date, info, element('span', 'session-time', record.time.replace(' IST', ''))); upcoming.append(card);
    });
    if (!upcoming.children.length) {
      const empty = element('div', 'empty-state');
      empty.append(element('h3', '', loadState.bookings === 'loading' ? 'Loading bookings…' : loadState.bookings === 'error' ? 'Unable to load bookings' : 'No upcoming bookings'));
      upcoming.append(empty);
    }
    const recentLeads = document.querySelector('#recent-leads');
    recentLeads.replaceChildren();
    if (getRecords('leads').length) {
      recentLeads.append(renderTable('leads', getRecords('leads').slice(0,3), [['name','Full Name'],['goal','Primary Goal'],['status','Status'],['created','Created At']]));
    } else {
      const empty = element('div', 'empty-state');
      empty.append(element('h3', '', loadState.leads === 'loading' ? 'Loading leads…' : loadState.leads === 'error' ? 'Unable to load leads' : 'No leads yet'));
      recentLeads.append(empty);
    }

  }
  updateOverview();
  async function loadSection(section, fetcher) {
    try {
      const records = await fetcher();
      if (sessionEnded) return;
      dashboardData[section] = records;
      loadState[section] = 'ready';
    } catch (error) {
      if (sessionEnded) return;
      loadState[section] = 'error';
      loadErrors[section] = error instanceof ApiError ? error.message : 'Unable to display records. Please reload to try again.';
    }
    updateTable(section);
    updateOverview();
    const failed = Object.values(loadState).includes('error');
    const loading = Object.values(loadState).includes('loading');
    document.querySelector('#data-status').textContent = loading ? 'Loading records securely…' : failed ? 'Some records could not be loaded. Reload to retry.' : 'Records loaded. Enquiries are not connected yet.';
  }
  // Independent failures do not hide successful data; any 401 ends the entire session.
  void Promise.allSettled([
    loadSection('leads', backend.getLeads),
    loadSection('bookings', backend.getBookings),
    loadSection('payments', backend.getPayments)
  ]);

  function showSection(key, focus = false) {
    if (key !== 'dashboard' && !Object.hasOwn(sections, key)) key = 'dashboard';
    document.querySelectorAll('.content-section').forEach(section => { section.hidden = section.id !== `section-${key}`; });
    document.querySelectorAll('.main-nav button').forEach(button => {
      if (button.dataset.section === key) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const title = key === 'dashboard' ? 'Dashboard' : sections[key].title;
    document.querySelector('#breadcrumb-title').textContent = title;
    document.title = `${title} · ApexFit Admin`;
    setDrawer(false, false);
    if (focus) {
      const heading = document.querySelector(`#${key}-title`);
      heading.tabIndex = -1;
      heading.focus({preventScroll:true});
      window.scrollTo({top:0, behavior:'instant'});
    }
  }
  document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.section;
    if (location.hash === `#${key}`) showSection(key, true);
    else location.hash = key;
  }));
  window.addEventListener('hashchange', () => showSection(location.hash.slice(1), true));
  showSection(location.hash.slice(1));

  const detailDialog = document.querySelector('#detail-dialog');
  const replyDialog = document.querySelector('#reply-dialog');
  function openDetails(section, record) {
    document.querySelector('#detail-title').textContent = record.name;
    const list = element('dl', 'detail-list');
    sections[section].columns.forEach(([key, label]) => {
      const item = element('div', `detail-item${key === 'message' ? ' wide' : ''}`);
      const value = element('dd');
      if (key === 'status') value.append(statusBadge(record.status));
      else value.textContent = key === 'amount' ? (record.amount === null ? '—' : currency.format(record.amount)) : record[key];
      item.append(element('dt', '', label), value); list.append(item);
    });
    document.querySelector('#detail-content').replaceChildren(list);
    detailDialog.showModal();
  }
  function openReply(record) {
    document.querySelector('#reply-form').reset();
    document.querySelector('#reply-to').value = record.email;
    document.querySelector('#reply-subject').value = 'Re: Your ApexFit enquiry';
    document.querySelector('#reply-feedback').textContent = '';
    replyDialog.showModal();
    document.querySelector('#reply-message').focus();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const section = button.dataset.recordSection;
    const record = getRecords(section).find(item => item.id === button.dataset.record);
    if (!record) return;
    if (button.dataset.action === 'reply') openReply(record);
    else openDetails(section, record);
  });
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  [detailDialog, replyDialog].forEach(dialog => dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  }));
  // UI demonstration only: no email provider, network request, persistence, or fake success.
  document.querySelector('#reply-form').addEventListener('submit', event => {
    event.preventDefault();
    document.querySelector('#reply-feedback').textContent = 'Preview only — no reply was sent or saved. Email delivery will be connected through the backend later.';
  });
  replyDialog.addEventListener('close', () => {
    document.querySelector('#reply-form').reset();
    document.querySelector('#reply-feedback').textContent = '';
  });
}
