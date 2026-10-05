'use strict';

// FRONTEND PREVIEW ONLY. There is no authentication or access control here.
// FUTURE: Implement POST /api/login and POST /api/logout through a secure backend.
// FUTURE: Fetch authenticated records via GET /api/leads, /api/bookings,
// /api/payments, /api/enquiries, and send replies via POST /api/reply.
// Never call Airtable directly with a secret token from frontend JavaScript.
// Replace this adapter after backend authentication and authorization are implemented.
// These placeholders deliberately make no requests and never accept/store credentials.
const backend = Object.freeze({
  login: async () => { throw new Error('Backend authentication is not connected.'); },
  logout: async () => { throw new Error('Backend sessions are not connected.'); },
  getLeads: async () => { throw new Error('Backend leads are not connected.'); },
  getBookings: async () => { throw new Error('Backend bookings are not connected.'); },
  getPayments: async () => { throw new Error('Backend payments are not connected.'); },
  getEnquiries: async () => { throw new Error('Backend enquiries are not connected.'); },
  sendReply: async () => { throw new Error('Backend email delivery is not connected.'); }
});

const loginForm = document.querySelector('#login-form');
if (loginForm) {
  const password = document.querySelector('#login-password');
  const toggle = document.querySelector('#password-toggle');
  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  });
  // Preview navigation only; this does not verify identity or create a session.
  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    loginForm.reset();
    window.location.assign('dashboard.html');
  });
  // Clear fields when returning through the browser's back/forward cache as well.
  window.addEventListener('pageshow', () => {
    loginForm.reset();
    password.type = 'password';
    toggle.textContent = 'Show';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', 'Show password');
  });
}

// Entirely fictional fixtures. Reserved example.com emails, masked phones,
// and demo IDs are intentional. Never replace fixtures with real customer data.
const sampleData = {
  leads: [
    { id:'lead_demo_001', name:'Rahul Sharma', email:'rahul@example.com', phone:'+91 XXXXX 00001', goal:'Build muscle', level:'Intermediate', training:'Online', budget:'₹2,000–₹3,000', status:'New', created:'11 Oct 2026' },
    { id:'lead_demo_002', name:'Priya Mehta', email:'priya@example.com', phone:'+91 XXXXX 00002', goal:'Improve overall fitness', level:'Beginner', training:'In-person', budget:'₹3,000–₹6,000', status:'Contacted', created:'10 Oct 2026' },
    { id:'lead_demo_003', name:'Aman Verma', email:'aman@example.com', phone:'+91 XXXXX 00003', goal:'Lose body fat', level:'Beginner', training:'Online', budget:'₹2,000–₹3,000', status:'Qualified', created:'09 Oct 2026' },
    { id:'lead_demo_004', name:'Neha Kapoor', email:'neha@example.com', phone:'+91 XXXXX 00004', goal:'Build strength', level:'Advanced', training:'Hybrid', budget:'₹3,000–₹6,000', status:'Converted', created:'08 Oct 2026' },
    { id:'lead_demo_005', name:'Arjun Rao', email:'arjun@example.com', phone:'+91 XXXXX 00005', goal:'Improve mobility', level:'Beginner', training:'Online', budget:'Under ₹2,000', status:'Lost', created:'07 Oct 2026' },
    { id:'lead_demo_006', name:'Isha Nair', email:'isha@example.com', phone:'+91 XXXXX 00006', goal:'Build muscle', level:'Intermediate', training:'In-person', budget:'₹3,000–₹6,000', status:'New', created:'06 Oct 2026' }
  ],
  bookings: [
    { id:'cal_demo_001', name:'Rahul Sharma', email:'rahul@example.com', phone:'+91 XXXXX 00001', date:'12 Oct 2026', time:'09:00 AM IST', event:'Fitness Assessment', status:'Upcoming', bookingId:'cal_demo_001' },
    { id:'cal_demo_002', name:'Priya Mehta', email:'priya@example.com', phone:'+91 XXXXX 00002', date:'12 Oct 2026', time:'11:30 AM IST', event:'Free Consultation', status:'Upcoming', bookingId:'cal_demo_002' },
    { id:'cal_demo_003', name:'Isha Nair', email:'isha@example.com', phone:'+91 XXXXX 00006', date:'13 Oct 2026', time:'04:00 PM IST', event:'Coaching Check-in', status:'Upcoming', bookingId:'cal_demo_003' },
    { id:'cal_demo_004', name:'Aman Verma', email:'aman@example.com', phone:'+91 XXXXX 00003', date:'10 Oct 2026', time:'10:00 AM IST', event:'Fitness Assessment', status:'Completed', bookingId:'cal_demo_004' },
    { id:'cal_demo_005', name:'Neha Kapoor', email:'neha@example.com', phone:'+91 XXXXX 00004', date:'14 Oct 2026', time:'05:30 PM IST', event:'Coaching Check-in', status:'Rescheduled', bookingId:'cal_demo_005' },
    { id:'cal_demo_006', name:'Arjun Rao', email:'arjun@example.com', phone:'+91 XXXXX 00005', date:'09 Oct 2026', time:'02:00 PM IST', event:'Free Consultation', status:'Cancelled', bookingId:'cal_demo_006' }
  ],
  payments: [
    { id:'pay_demo_001', name:'Rahul Sharma', email:'rahul@example.com', phone:'+91 XXXXX 00001', amount:499, purpose:'Fitness Assessment', status:'Paid', paymentId:'pay_demo_001', date:'11 Oct 2026' },
    { id:'pay_demo_002', name:'Neha Kapoor', email:'neha@example.com', phone:'+91 XXXXX 00004', amount:5999, purpose:'Premium 1-on-1', status:'Paid', paymentId:'pay_demo_002', date:'10 Oct 2026' },
    { id:'pay_demo_003', name:'Priya Mehta', email:'priya@example.com', phone:'+91 XXXXX 00002', amount:2999, purpose:'Monthly Coaching', status:'Pending', paymentId:'pay_demo_003', date:'10 Oct 2026' },
    { id:'pay_demo_004', name:'Aman Verma', email:'aman@example.com', phone:'+91 XXXXX 00003', amount:499, purpose:'Fitness Assessment', status:'Failed', paymentId:'pay_demo_004', date:'09 Oct 2026' },
    { id:'pay_demo_005', name:'Arjun Rao', email:'arjun@example.com', phone:'+91 XXXXX 00005', amount:499, purpose:'Fitness Assessment', status:'Refunded', paymentId:'pay_demo_005', date:'08 Oct 2026' }
  ],
  enquiries: [
    { id:'enquiry_demo_001', name:'Priya Mehta', email:'priya@example.com', phone:'+91 XXXXX 00002', goal:'Improve overall fitness', message:'I’m getting back into fitness and would love to learn about your beginner-friendly coaching plans. Are evening sessions available?', status:'New', received:'11 Oct 2026, 10:15 AM IST' },
    { id:'enquiry_demo_002', name:'Rahul Sharma', email:'rahul@example.com', phone:'+91 XXXXX 00001', goal:'Build muscle', message:'Could you tell me more about the monthly coaching plan? I train at home and have a set of dumbbells.', status:'New', received:'11 Oct 2026, 09:30 AM IST' },
    { id:'enquiry_demo_003', name:'Aman Verma', email:'aman@example.com', phone:'+91 XXXXX 00003', goal:'Lose body fat', message:'Thanks for explaining the assessment. I would like to know what to prepare before our session.', status:'Replied', received:'10 Oct 2026, 02:45 PM IST' },
    { id:'enquiry_demo_004', name:'Neha Kapoor', email:'neha@example.com', phone:'+91 XXXXX 00004', goal:'Build strength', message:'I found the plan details I needed. Thank you for your help!', status:'Closed', received:'09 Oct 2026, 04:20 PM IST' }
  ]
};

const sections = {
  leads: { title:'Leads', eyebrow:'THE START OF SOMETHING STRONG', description:'Get to know the people ready for their next chapter.', statuses:['New','Contacted','Qualified','Converted','Lost'], columns:[['name','Full Name'],['email','Email'],['phone','Phone'],['goal','Primary Goal'],['level','Fitness Level'],['training','Preferred Training'],['budget','Budget Range'],['status','Status'],['created','Created At']] },
  bookings: { title:'Bookings', eyebrow:'MAKE TIME FOR PROGRESS', description:'A clear view of every conversation and coaching session.', statuses:['Upcoming','Completed','Cancelled','Rescheduled'], columns:[['name','Customer Name'],['email','Email'],['phone','Phone'],['date','Booking Date'],['time','Booking Time'],['event','Event Type'],['status','Status'],['bookingId','Cal Booking ID']] },
  payments: { title:'Payments', eyebrow:'THE BUSINESS BEHIND THE PROGRESS', description:'Keep a clear view of sample payments and their status.', statuses:['Paid','Pending','Failed','Refunded'], columns:[['name','Customer Name'],['email','Email'],['phone','Phone'],['amount','Amount'],['purpose','Payment For'],['status','Payment Status'],['paymentId','Razorpay Payment ID'],['date','Payment Date']] },
  enquiries: { title:'Enquiries', eyebrow:'EVERY CONVERSATION COUNTS', description:'A thoughtful first response can make all the difference.', statuses:['New','Replied','Closed'], columns:[['name','Full Name'],['email','Email'],['phone','Phone'],['goal','Primary Goal'],['message','Message'],['status','Status'],['received','Received At']] }
};
const currency = new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0});
// Every view uses this provider. Swap the appropriate method for backend.getLeads(),
// etc. only after a secure backend is connected; never embed credentials here.
function getPreviewRecords(section) { return sampleData[section] || []; }
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function statusBadge(status) { return element('span', `badge badge-${status.toLowerCase()}`, status); }
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
  table.append(element('caption', '', `Fictional sample ${section}`));
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
      else if (key === 'amount') { cell.className = 'money'; cell.textContent = currency.format(record.amount); }
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

if (document.querySelector('.dashboard-page')) {
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
    const all = getPreviewRecords(section);
    const records = all.filter(record => (!status || record.status === status) && Object.values(record).join(' ').toLowerCase().includes(query.trim().toLowerCase()));
    const target = document.querySelector(`#${section}-table`);
    target.replaceChildren();
    if (records.length) target.append(renderTable(section, records));
    else {
      const empty = element('div', 'empty-state');
      empty.append(element('h3', '', 'No matching records'), element('p', '', 'Try another search or clear your filters.'));
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
    document.querySelector(`#${section}-count`).textContent = `${records.length} of ${all.length} records`;
  }
  Object.entries(sections).forEach(([key, config]) => {
    const section = document.querySelector(`#section-${key}`);
    // Only constant interface labels are inserted as HTML. All record and user text
    // is rendered with textContent or form values, never interpolated into markup.
    section.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${config.eyebrow}</p><h1 id="${key}-title">${config.title}</h1><p>${config.description}</p></div><span class="section-heading-count">${getPreviewRecords(key).length} sample records</span></div><div class="panel"><div class="table-toolbar"><div class="search-control"><label for="${key}-search">Search ${key}</label><input id="${key}-search" type="search" placeholder="Search by name, email, or details…" autocomplete="off"></div><div class="filter-control"><label for="${key}-filter">Status</label><select id="${key}-filter"><option value="">All statuses</option></select></div><span id="${key}-count" class="table-count" role="status" aria-live="polite"></span></div><div id="${key}-table"></div><div class="table-footer"><span>Sample data only · No live records</span><span>Scroll the table to see all details ↔</span></div></div>`;
    const select = document.querySelector(`#${key}-filter`);
    config.statuses.forEach(status => { const option = element('option', '', status); option.value = status; select.append(option); });
    document.querySelector(`#${key}-search`).addEventListener('input', event => { filters[key].query = event.target.value; updateTable(key); });
    select.addEventListener('change', event => { filters[key].status = event.target.value; updateTable(key); });
    updateTable(key);
  });

  const upcoming = document.querySelector('#upcoming-list');
  getPreviewRecords('bookings').filter(record => record.status === 'Upcoming').slice(0,3).forEach(record => {
    const card = element('div', 'session-card');
    const date = element('div', 'date-tile');
    const [day, month] = record.date.split(' ');
    date.append(element('small', '', month.toUpperCase()), element('strong', '', day));
    const info = element('div', 'session-info');
    info.append(element('strong', '', record.name), element('p', '', record.event));
    card.append(date, info, element('span', 'session-time', record.time.replace(' IST', ''))); upcoming.append(card);
  });
  document.querySelector('#recent-leads').append(renderTable('leads', getPreviewRecords('leads').slice(0,3), [['name','Full Name'],['goal','Primary Goal'],['status','Status'],['created','Created At']]));

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
      else value.textContent = key === 'amount' ? currency.format(record.amount) : record[key];
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
    const record = getPreviewRecords(section).find(item => item.id === button.dataset.record);
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
