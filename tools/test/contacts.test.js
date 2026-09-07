'use strict';

// The contact book (§42.16) — the reducer's promise, and the phone's half of
// the screen that rests on it.
//
// The promise is one sentence: **a correction made aboard survives the next TM
// Master export.** Everything else here is in service of it. The reducer is
// byte-identical with the Console's copy (console-derive.test.js holds that
// line), so these cases bind both surfaces; the block at the end pulls the
// PWA's own render functions out of `procurement.html` and runs them over the
// same reduced state, the way sessions.test.js does for the count sheet.

const { REPO, counter } = require('./_paths');
const fs = require('fs');
const path = require('path');
require(path.join(REPO, 'utils', 'contacts-reduce.js'));
const C = globalThis.contactsReduce;
const T = counter(), check = T.check;

// ── A small book, in the shape the seed writes ──────────────────────────────
// Columnar and dictionary-encoded, because that is what comes off OneDrive and
// the decoder is part of what is being tested.
const FIELDS = ['contact_id', 'name', 'source', 'country', 'email', 'phone', 'fax', 'web',
  'remarks', 'tags', 'currency', 'payment_terms', 'delivery_terms', 'ecommerce_id',
  'qa_year', 'qa_status', 'qa_grade', 'qa_experience', 'risk', 'criticality',
  'trade_agreement', 'trade_agreement_date', 'trade_agreement_expires', 'ncr',
  'validated', 'blocked', 'order_count', 'order_spend', 'first_order', 'last_order'];

const SOURCES = ['tm', 'orders'];
const row = o => FIELDS.map(f => (f === 'source' ? SOURCES.indexOf(o.source || 'tm')
                                                : (o[f] === undefined ? null : o[f])));

function book(overrides) {
  const people = Object.assign({
    'CON-0001': { contact_id: 'CON-0001', name: 'Alaska Ship Supply', country: 'United States',
                  email: 'sales@ass.test; ops@ass.test', phone: '(907) 555-0101',
                  currency: 'USD', validated: 1,
                  order_count: 3, order_spend: 1500.5,
                  first_order: '2019-02-01', last_order: '2026-08-25' },
    'CON-0002': { contact_id: 'CON-0002', name: 'Grainger', country: 'United States',
                  order_count: 0, order_spend: 0 },
    'CON-0003': { contact_id: 'CON-0003', name: 'Portside Fuel - Araho', source: 'orders',
                  order_count: 2, order_spend: 700,
                  first_order: '2023-01-01', last_order: '2024-05-05' },
    'CON-0004': { contact_id: 'CON-0004', name: 'Bilgewater Marine', blocked: 1,
                  phone: '555-0199', order_count: 1, order_spend: 12,
                  first_order: '2020-01-01', last_order: '2020-01-01' }
  }, overrides || {});
  return {
    schema_version: 1, generated: '2026-09-06', source: 'test',
    contact_fields: FIELDS, tables: { source: SOURCES },
    contacts: Object.keys(people).map(k => row(people[k])),
    recent: {
      'CON-0001': [
        { order_id: 'O-3', order_no: 'ARA-100-M-2026', name: 'Belting, roughtop',
          date: '2026-08-25', status: 'On Order', total: 900.5, currency: 'USD',
          department: 'Machine' },
        { order_id: 'O-2', order_no: 'ARA-044-M-2024', name: 'Gasket sheet',
          date: '2024-03-02', status: 'Finished', total: 600, currency: 'USD',
          department: 'Machine' }
      ],
      // TM does not date every order. A contact whose only order is undated has
      // to say what without when, rather than say nothing.
      'CON-0004': [
        { order_id: 'O-9', order_no: 'ARA-777-D-2020', name: 'Anchor shackle',
          date: null, status: 'Cancelled', total: 12, currency: 'USD', department: 'Deck' }
      ]
    },
    counts: { contacts: 4, from_tm: 3, from_orders: 1, with_orders: 3, blocked: 1 }
  };
}

const ev = (type, ts, payload, actor) =>
  ({ schema_version: 1, event_id: type + ts, event_type: type, timestamp: ts,
     actor: actor || 'wostara', payload });

// ── The baseline, decoded ───────────────────────────────────────────────────
T.head('the seed decodes');
let base = C.hydrateContacts(book());
check('everybody is there', Object.keys(base.contacts).length, 4);
check('the dictionary column comes back as a word', base.contacts['CON-0003'].source, 'orders');
check('a plain column comes back as it went in', base.contacts['CON-0001'].country, 'United States');
check('order history is folded onto the contact', base.contacts['CON-0001'].order_count, 3);
check('and its tail comes with it', base.contacts['CON-0001'].recent.length, 2);
check('a contact with no orders gets an empty tail', base.contacts['CON-0002'].recent.length, 0);

// ── The promise ─────────────────────────────────────────────────────────────
// This is the case the whole lane exists for. Anything else here can be wrong
// and be a bug; this being wrong means an officer's correction was silently
// thrown away by a routine re-export, and nobody would find out.
T.head('a correction made aboard survives the next export');
const edit = ev('contact_updated', '2026-09-07T09:00:00.000Z', {
  contact_id: 'CON-0001', phone: '(907) 555-0199', remarks: 'Ask for Dave, not the desk.'
});

let st = C.reduce([edit], C.hydrateContacts(book()));
check('the edit applies', st.contacts['CON-0001'].phone, '(907) 555-0199');
check('and is attributed', st.contacts['CON-0001'].updated_by, 'wostara');

// TM re-exports: it has learned an e-mail, still has the old phone number, and
// has renamed nothing.
const reexport = book({
  'CON-0001': { contact_id: 'CON-0001', name: 'Alaska Ship Supply', country: 'United States',
                email: 'sales@ass.test; ops@ass.test; newguy@ass.test',
                phone: '(907) 555-0101', currency: 'USD', validated: 1,
                order_count: 4, order_spend: 2400.5,
                first_order: '2019-02-01', last_order: '2026-09-06' }
});
st = C.reduce([edit], C.hydrateContacts(reexport));
check('the correction still wins over the stale export',
  st.contacts['CON-0001'].phone, '(907) 555-0199');
check('a field nobody aboard touched follows the export',
  st.contacts['CON-0001'].email, 'sales@ass.test; ops@ass.test; newguy@ass.test');
check('and so does the order history, which is TM\'s to own',
  st.contacts['CON-0001'].order_count, 4);

// The other half of the same rule: an event that does not mention a field must
// not blank it. A client that knows fewer fields than the one before it is the
// normal case across two apps on two release cycles.
T.head('an event only touches the fields it carries');
st = C.reduce([
  ev('contact_updated', '2026-09-07T09:00:00.000Z',
     { contact_id: 'CON-0001', phone: '(907) 555-0199' }),
  ev('contact_updated', '2026-09-07T10:00:00.000Z',
     { contact_id: 'CON-0001', remarks: 'Ask for Dave.' })
], C.hydrateContacts(book()));
check('the earlier field stands', st.contacts['CON-0001'].phone, '(907) 555-0199');
check('the later one is applied too', st.contacts['CON-0001'].remarks, 'Ask for Dave.');
check('and the untouched one is untouched', st.contacts['CON-0001'].currency, 'USD');
check('clearing is still possible, by sending the field empty',
  C.reduce([ev('contact_updated', '2026-09-07T11:00:00.000Z',
    { contact_id: 'CON-0001', currency: '' })], C.hydrateContacts(book()))
    .contacts['CON-0001'].currency, null);

T.head('what an event may not touch');
st = C.reduce([ev('contact_updated', '2026-09-07T09:00:00.000Z',
  { contact_id: 'CON-0001', order_count: 999, order_spend: 999, source: 'idms' })
], C.hydrateContacts(book()));
check('a stale client cannot write an order count', st.contacts['CON-0001'].order_count, 3);
check('nor the spend', st.contacts['CON-0001'].order_spend, 1500.5);
check('nor claim TM\'s contact as its own', st.contacts['CON-0001'].source, 'tm');

// ── Retiring ────────────────────────────────────────────────────────────────
T.head('retiring keeps the card');
st = C.reduce([
  ev('contact_archived', '2026-09-07T09:00:00.000Z',
     { contact_id: 'CON-0001', reason: 'Duplicate of CON-0002' })
], C.hydrateContacts(book()));
check('it is flagged', st.contacts['CON-0001'].archived, 1);
check('with the reason', st.contacts['CON-0001'].archive_reason, 'Duplicate of CON-0002');
check('but not removed — the orders still point here',
  st.contacts['CON-0001'].order_count, 3);
st = C.reduce([
  ev('contact_archived', '2026-09-07T09:00:00.000Z', { contact_id: 'CON-0001', reason: 'oops' }),
  ev('contact_restored', '2026-09-07T09:30:00.000Z', { contact_id: 'CON-0001' })
], C.hydrateContacts(book()));
check('and bringing it back clears both', st.contacts['CON-0001'].archived, 0);
check('reason included', st.contacts['CON-0001'].archive_reason, null);

// ── Adding one aboard ───────────────────────────────────────────────────────
T.head('a contact added aboard');
st = C.reduce([
  ev('contact_created', '2026-09-07T09:00:00.000Z',
     { contact_id: 'CONX-ABC-01', name: 'Dutch Harbor Welding', phone: '907-555-0300' })
], C.hydrateContacts(book()));
check('joins the book', !!st.contacts['CONX-ABC-01'], true);
check('marked as ours', st.contacts['CONX-ABC-01'].source, 'idms');
check('with no order history it has not earned', st.contacts['CONX-ABC-01'].order_count, 0);
check('its id cannot collide with the seed\'s numbering',
  /^CONX-/.test(C.newContactId()), true);
// A create replaying onto a fresh export that now knows this contact must not
// blank what TM has learned about it.
st = C.reduce([
  ev('contact_created', '2026-09-07T09:00:00.000Z', { contact_id: 'CON-0002', name: 'Wrong' })
], C.hydrateContacts(book()));
check('and a stale create never overwrites a baseline contact',
  st.contacts['CON-0002'].name, 'Grainger');

// ── The PWA's half ──────────────────────────────────────────────────────────
// procurement.html is one inline script, so the Contacts block is pulled out by
// name and run against the same reduced state — the drift this catches is the
// phone answering a question about the book differently from the Console.
T.head('the PWA renders that book');
const html = fs.readFileSync(path.join(REPO, 'procurement.html'), 'utf8');
const start = html.indexOf('// ── View: Contacts (§42.16)');
const end = html.indexOf('// ── View: Exceptions');
check('the Contacts block is where it was left', start !== -1 && end > start, true);

if (start !== -1 && end > start) {
  let body = '';
  const els = {};
  const el = id => (els[id] = els[id] || { id, value: '', checked: false, innerHTML: '',
                                           focus() {}, setSelectionRange() {} });
  const filed = [];
  const sandbox = {
    contactsReduce: C,
    PC: { events: [], contactsDoc: book(), contacts: null, contactStatus: 'fresh',
          cfg: { suppliers: [] }, ctc: null },
    pcEsc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                 .replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    pcDate: s => (s ? String(s).slice(0, 10) : '—'),
    pcHead: (t, s2) => { sandbox.head = [t, s2]; },
    pcRenderAll: () => {},
    pcToast: () => {},
    pcCanApprove: () => true,
    pcVal: id => String(el(id).value || '').trim(),
    pcErrText: e => String((e && e.message) || e),
    pcAppendEvent: async (type, payload) => { filed.push({ type, payload }); },
    prompt: () => 'no longer used',
    document: {
      getElementById: id => (id === 'body'
        ? { set innerHTML(v) { body = v; } }
        : el(id))
    },
    window: { scrollTo: () => {} },
    setTimeout, clearTimeout
  };
  sandbox.PC.contacts = C.reduce([], C.hydrateContacts(sandbox.PC.contactsDoc));

  const names = Object.keys(sandbox);
  // eslint-disable-next-line no-new-func
  const load = new Function(...names, html.slice(start, end) +
    '\nreturn { ctcState, ctcRows, ctcRow, ctcRenderList, ctcRenderCard, ctcLastOrder,' +
    ' ctcMatches, ctcSorted, ctcAll, ctcStartEdit, ctcSave, ctcRenderForm,' +
    ' ctcEmailLinks, ctcPhoneLinks, pcAgo, pcMoneyRough, CTC_FIELDS, CTC_FLAGS };');
  const api = load(...names.map(k => sandbox[k]));
  sandbox.PC.ctc = api.ctcState();

  // The slices, which are a filter here and SQL in the Console. A book that
  // answers differently by device is two books.
  const all = api.ctcAll();
  const slice = flag => all.filter(c => api.ctcMatches(c, flag)).map(c => c.contact_id);
  check('everyone, minus the retired', slice('').length, 4);
  check('orders only', slice('stub'), ['CON-0003']);
  check('never used', slice('noorders'), ['CON-0002']);
  check('blocked', slice('blocked'), ['CON-0004']);
  // Fax and web are not how anybody reaches a supplier from a boat. A name that
  // only ever appeared on an order has neither, which is the point of the
  // slice — those 82 stubs are exactly the cards with nothing behind them.
  check('no way to reach', slice('unreachable'), ['CON-0002', 'CON-0003']);
  check('retired, when nobody is', slice('archived').length, 0);

  const ids = s => api.ctcSorted(all, s).map(c => c.contact_id);
  check('by name', ids('name')[0], 'CON-0001');
  check('by last used', ids('recent')[0], 'CON-0001');
  check('by most orders', ids('orders')[0], 'CON-0001');
  check('by most spent', ids('spend')[0], 'CON-0001');
  // Dormant is a supplier that went quiet, not one that was never used.
  const dormant = ids('dormant');
  check('the longest dormant leads', dormant[0], 'CON-0004');
  check('and one never used sorts behind all of them',
    dormant[dormant.length - 1], 'CON-0002');

  T.head('a contact card');
  sandbox.PC.ctc.sel = 'CON-0001';
  api.ctcRenderCard();
  check('leads with when they were last used',
    body.indexOf('Last referenced') !== -1, true);
  check('and which order that was', body.indexOf('ARA-100-M-2026') !== -1, true);
  check('and what it was for', body.indexOf('Belting, roughtop') !== -1, true);
  check('the whole tail is listed', (body.match(/ARA-0?44-M-2024/g) || []).length, 1);
  // The phone's own half. A number on a card should dial.
  check('the number dials', body.indexOf('href="tel:9075550101"') !== -1, true);
  check('each address composes on its own',
    (body.match(/href="mailto:/g) || []).length, 2);
  check('spend is whole dollars, not a false precision',
    body.indexOf('$1,501') !== -1, true);

  sandbox.PC.ctc.sel = 'CON-0003';
  api.ctcRenderCard();
  check('a name seen only on orders says so',
    body.indexOf('Seen on orders only') !== -1, true);

  // TM does not date every order, and a card that says nothing is worse than
  // one that says what without when.
  check('an undated order still names itself',
    api.ctcLastOrder(api.ctcAll().find(c => c.contact_id === 'CON-0004')).order_no,
    'ARA-777-D-2020');
  check('but a dated one is preferred when there is a choice',
    api.ctcLastOrder(api.ctcAll().find(c => c.contact_id === 'CON-0001')).order_no,
    'ARA-100-M-2026');

  // ── Reaching them ───────────────────────────────────────────────────────
  // Both of these were written from the Console's version and both were wrong
  // the first time the real 1,745-contact book was put through them. The cases
  // are the real strings, because the shapes are not ones anybody would invent.
  T.head('a number that dials, and one that must not');
  const tel = s => (api.ctcPhoneLinks(s).match(/href="tel:([^"]*)"/g) || [])
    .map(m => m.replace(/.*tel:([^"]*)".*/, '$1'));

  // TM sets off the area code with a slash on 93 of the 1,008 numbers. Reading
  // that as two numbers dials 594-4500 — a wrong number rather than no number,
  // which is the worse of the two failures.
  check('a slash is part of the number, not a separator', tel('207/594-4500'), ['2075944500']);
  check('and so is a comma', tel('907-555-0101, ask for Dave'), ['9075550101']);
  check('a semicolon does separate two numbers',
    tel('907-581-1350; 206-431-7091'), ['9075811350', '2064317091']);
  check('an international number keeps its plus', tel('+47 70 10 80 00'), ['+4770108000']);
  // Six fields hold only a fragment, and one holds a number with an extension
  // on the end where nobody can say which digits are the number.
  check('a fragment is printed, not dialled', tel('-6491'), []);
  check('and so is a number with an extension stuck to it',
    tel('+1 206-708-8364 Ext. 76364'), []);
  check('but the fragment is still shown', api.ctcPhoneLinks('-6491').indexOf('-6491') !== -1, true);
  check('nothing at all reads as nothing', api.ctcPhoneLinks(''), '—');

  T.head('an address that composes, and one that must not');
  const mail = s => (api.ctcEmailLinks(s).match(/href="mailto:([^"]*)"/g) || [])
    .map(m => m.replace(/.*mailto:([^"]*)".*/, '$1'));

  check('two addresses are two links',
    mail('sales@ass.test; ops@ass.test'), ['sales@ass.test', 'ops@ass.test']);
  // 54 contacts are written this way. Splitting on the comma made a link out of
  // the surname, addressed to nothing.
  check('a display name with a comma in it is one address',
    mail('De Guzman, Joselito <jdeguzman@petrostar.com>'), ['jdeguzman@petrostar.com']);
  check('and the whole thing is still what is shown',
    api.ctcEmailLinks('De Guzman, Joselito <jdeguzman@petrostar.com>')
      .indexOf('De Guzman, Joselito') !== -1, true);
  // 14 fragments in the real book are not addresses — somebody typed a website
  // into the e-mail field. A mailto: with nothing behind it opens an empty
  // compose window and reads as the app having lost the address.
  check('something that is not an address is not linked',
    mail('www.ballardlockandkey.com'), []);
  check('but it is still shown',
    api.ctcEmailLinks('www.ballardlockandkey.com').indexOf('ballardlockandkey') !== -1, true);
  check('nothing at all reads as nothing', api.ctcEmailLinks(null), '—');

  T.head('editing one');
  sandbox.PC.ctc.sel = 'CON-0001';
  api.ctcStartEdit();
  api.ctcRenderForm();
  check('the form is filled from the contact',
    body.indexOf('value="Alaska Ship Supply"') !== -1, true);
  check('remarks get a box you can write a sentence in',
    body.indexOf('<textarea class="field" id="ctc-f-remarks"') !== -1, true);
  check('a flag that is set comes up ticked',
    /id="ctc-f-validated" checked/.test(body), true);
  check('and one that is not, does not',
    /id="ctc-f-blocked" checked/.test(body), false);

  el('ctc-f-phone').value = '(907) 555-0199';
  el('ctc-f-name').value = 'Alaska Ship Supply';
  api.ctcSave();
  check('saving files one event', filed.length, 1);
  check('as an update, not a create', filed[0].type, 'contact_updated');
  check('naming the contact', filed[0].payload.contact_id, 'CON-0001');
  check('carrying the correction', filed[0].payload.phone, '(907) 555-0199');
  // Every field, not a diff: the reducer applies what the event holds, so
  // sending the whole form is what makes clearing a field possible at all.
  const missing = api.CTC_FIELDS.concat(api.CTC_FLAGS)
    .map(f => f.k).filter(k => !(k in filed[0].payload));
  check('and every editable field, so a field can be cleared', missing.join(', '), '');

  filed.length = 0;
  el('ctc-f-name').value = '';
  api.ctcSave();
  check('a contact with no name is not filed', filed.length, 0);
}

process.exit(T.done() ? 0 : 1);
