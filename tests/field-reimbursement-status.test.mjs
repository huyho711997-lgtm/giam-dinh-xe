import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/reimbursements/editor.js', import.meta.url), 'utf8');
const batchId = 'HT_STATUS_TEST';

function setup(options = {}) {
  const payload = {id: batchId, gdvUid: 'owner', status: 'pending', totalAmount: 7652000,
    items: [{bienSo: '47A12345', travelCost: 300000}], bankAccount: 'test-account', ...options.payload};
  let live = structuredClone(payload);
  const calls = {confirms: [], paths: [], logs: [], toasts: [], renders: [], details: []};
  const context = vm.createContext({
    Set,
    console: {error() {}},
    firebase: Object.assign({auth: () => ({currentUser: options.signedOut ? null : {uid: options.uid || 'owner'}})},
      {database: {ServerValue: {TIMESTAMP: {'.sv': 'timestamp'}}}}),
    activeUserProfile: options.profile || {role: 'Giám định viên'},
    activeDashboardTab: options.tab || 'field_reimbursements',
    cachedFieldReimbursementsPayload: options.missing ? {} : {[batchId]: structuredClone(payload)},
    document: {getElementById: () => options.closed ? null : {dataset: {batchId: options.openBatchId || batchId}}},
    showPremiumConfirmModal: async config => {
      calls.confirms.push(config);
      return options.confirm ? options.confirm() : !options.cancel;
    },
    dbNodeInstance: {ref: path => {
      calls.paths.push(path);
      return {transaction: async update => {
        if (options.fail) throw new Error('PERMISSION_DENIED');
        const next = update(Object.hasOwn(options, 'latest') ? options.latest : live);
        if (next === undefined) return {committed: false};
        live = structuredClone(next);
        return {committed: true, snapshot: {val: () => structuredClone(live)}};
      }};
    }},
    triggerToast: (...args) => calls.toasts.push(args),
    logUserActivity: (...args) => calls.logs.push(args)
  });
  vm.runInContext(source, context);
  context.renderFieldReimbursementsPage = () => calls.renders.push(true);
  context.viewFieldReimbursementDetail = id => calls.details.push(id);
  return {context, calls, options, payload, getLive: () => live, run: status => context.actionFieldReimbursement(batchId, status)};
}

test('owner marks paid, persists only the status change, and refreshes list and open detail', async () => {
  const h = setup();
  await h.run('paid');
  assert.equal(h.getLive().status, 'paid');
  assert.equal(h.getLive().totalAmount, h.payload.totalAmount);
  assert.equal(h.getLive().items[0].bienSo, h.payload.items[0].bienSo);
  assert.equal(h.getLive().bankAccount, h.payload.bankAccount);
  assert.equal(h.getLive().updatedAt['.sv'], 'timestamp');
  assert.equal(h.context.cachedFieldReimbursementsPayload[batchId].status, 'paid');
  assert.deepEqual(h.calls.paths, ['field_reimbursements/' + batchId]);
  assert.deepEqual(h.calls.details, [batchId]);
  assert.equal(h.calls.renders.length, 1);
  assert.equal(h.calls.logs.length, 1);
  assert.equal(h.calls.toasts.at(-1)[1], 'success');
});

test('owner can restore either paid status spelling to new', async () => {
  for (const status of ['paid', 'approved']) {
    const h = setup({payload: {status}});
    await h.run('new');
    assert.equal(h.getLive().status, 'new');
    assert.equal(h.calls.toasts.at(-1)[1], 'success');
  }
});

test('existing creator and administrator permissions apply to both transitions', async () => {
  for (const profile of [{role: ' Admin '}, {isAdmin: true}]) {
    const h = setup({uid: 'admin', profile});
    await h.run('paid');
    await h.run('new');
    assert.equal(h.calls.paths.length, 2);
    assert.equal(h.getLive().status, 'new');
  }
  for (const status of ['pending', 'new', 'rejected']) {
    const h = setup({payload: {status}});
    await h.run('paid');
    assert.equal(h.getLive().status, 'paid');
  }
});

test('signed-out users, other creators, invalid transitions and missing records cannot write', async () => {
  for (const options of [{signedOut: true}, {uid: 'other'}, {missing: true}, {payload: {status: 'paid'}}]) {
    const h = setup(options);
    await h.run('paid');
    assert.equal(h.calls.confirms.length, 0);
    assert.equal(h.calls.paths.length, 0);
    assert.equal(h.calls.toasts.at(-1)[1], 'warning');
  }
  for (const status of ['new', 'rejected', 'invalid']) {
    const h = setup();
    await h.run(status);
    assert.equal(h.calls.paths.length, 0);
  }
});

test('cancelling leaves the record, cache, list and detail unchanged', async () => {
  const h = setup({cancel: true});
  await h.run('paid');
  assert.equal(h.getLive().status, 'pending');
  assert.equal(h.context.cachedFieldReimbursementsPayload[batchId].status, 'pending');
  assert.equal(h.calls.paths.length, 0);
  assert.equal(h.calls.logs.length, 0);
  assert.equal(h.calls.renders.length, 0);
  assert.equal(h.calls.details.length, 0);
});

test('failed writes leave the displayed status unchanged and allow retry', async () => {
  const h = setup({fail: true});
  await h.run('paid');
  assert.equal(h.context.cachedFieldReimbursementsPayload[batchId].status, 'pending');
  assert.equal(h.calls.renders.length, 0);
  assert.equal(h.calls.details.length, 0);
  assert.equal(h.calls.logs.length, 0);
  assert.equal(h.calls.toasts.at(-1)[1], 'error');
  h.options.fail = false;
  await h.run('paid');
  assert.equal(h.getLive().status, 'paid');
});

test('transaction rejects deleted, already paid or reassigned records and preserves concurrent edits', async () => {
  for (const latest of [null, {gdvUid: 'owner', status: 'paid'}, {gdvUid: 'other', status: 'pending'}]) {
    const h = setup({latest});
    await h.run('paid');
    assert.equal(h.calls.toasts.at(-1)[1], 'warning');
    assert.equal(h.calls.logs.length, 0);
    assert.equal(h.context.cachedFieldReimbursementsPayload[batchId].status, 'pending');
  }
  const h = setup({latest: {id: batchId, gdvUid: 'owner', status: 'pending', totalAmount: 9000000, items: ['updated'], bankAccount: 'updated'}});
  await h.run('paid');
  assert.equal(h.getLive().totalAmount, 9000000);
  assert.deepEqual(h.getLive().items, ['updated']);
  assert.equal(h.getLive().bankAccount, 'updated');
});

test('repeated clicks share one confirmation and one write', async () => {
  let confirm;
  const h = setup({confirm: () => new Promise(resolve => {confirm = resolve;})});
  const first = h.run('paid');
  await h.run('paid');
  assert.equal(h.calls.confirms.length, 1);
  confirm(true);
  await first;
  assert.equal(h.calls.paths.length, 1);
});

test('completion does not reopen a closed detail or replace another record or page', async () => {
  for (const options of [{closed: true}, {openBatchId: 'HT_OTHER'}]) {
    const h = setup({...options, tab: 'home'});
    await h.run('paid');
    assert.equal(h.getLive().status, 'paid');
    assert.equal(h.calls.details.length, 0);
    assert.equal(h.calls.renders.length, 0);
  }
});
