import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/drive/drive-manager-page.js', import.meta.url), 'utf8');
function setup() {
  const opened = [], actions = [], menus = [];
  const files = ['a', 'b', 'c'].map(id => ({id, name:id + '.jpg', mimeType:'image/jpeg', can:{}}));
  const context = vm.createContext({
    localStorage:{getItem() {}},
    testFiles:files, opened, actions, menus
  });
  vm.runInContext(fs.readFileSync(new URL('../js/features/drive/drive-manager-api.js', import.meta.url), 'utf8'), context);
  // Thực thi các bộ xử lý thật, chỉ thay tác vụ mở tệp và vẽ DOM bằng bộ ghi nhận.
  vm.runInContext(source.replace('return {mount, leave};', `
    files = testFiles;
    host = {contains:() => true, querySelectorAll:() => files.map(file => ({dataset:{drvItem:file.id}}))};
    paintSelection = () => {}; paintDetails = () => {};
    openItem = file => opened.push(file.id);
    runAction = (key, chosen) => actions.push({key, ids:chosen.map(file => file.id)});
    showMenu = items => menus.push(items);
    return {onClick, onContextMenu, onKey, listMarkup, gridMarkup,
      selected:() => [...selected]};`) + '\nthis.manager = DriveManager;', context);
  const target = (dataset, button = false) => ({dataset,
    matches:() => false,
    closest:selector => selector === 'input,textarea,select,dialog' ? null
      : selector === 'button,a' ? button ? {} : null : {dataset, matches:() => false}
  });
  const event = (dataset, options = {}) => ({target:target(dataset, options.button), detail:1,
    stopPropagation() {}, preventDefault() {}, ...options});
  const click = (dataset, options) => context.manager.onClick(event(dataset, options));
  return {manager:context.manager, opened, actions, menus, files, event, click,
    selected:() => Array.from(context.manager.selected())};
}

test('clicking a file card or its name opens it without selecting it', () => {
  const h = setup();
  h.click({drvItem:'a'});
  h.click({drvOpen:'b'}, {button:true});
  assert.deepEqual(h.opened, ['a', 'b']);
  assert.deepEqual(h.selected(), []);
  h.click({drvItem:'b'}, {detail:2});
  assert.equal(h.opened.length, 2, 'the second click must not reopen the viewer');
});

test('only selection buttons toggle items, and opening another file preserves checked items', () => {
  const h = setup();
  h.click({drvCheck:'a'}, {button:true}); h.click({drvCheck:'b'}, {button:true});
  assert.deepEqual(h.selected(), ['a', 'b']);
  assert.deepEqual(h.opened, []);
  h.click({drvItem:'c'});
  assert.deepEqual(h.selected(), ['a', 'b']);
  h.click({drvCheck:'a'}, {button:true});
  assert.deepEqual(h.selected(), ['b']);
});

test('Shift selects a range through the selection buttons', () => {
  const h = setup();
  h.click({drvCheck:'a'}, {button:true}); h.click({drvCheck:'c'}, {button:true, shiftKey:true});
  assert.deepEqual(h.selected(), ['a', 'b', 'c']);
  assert.deepEqual(h.opened, []);
});

test('menu buttons and right-click target unchecked files without changing selection', () => {
  const h = setup();
  h.click({drvCheck:'a'}, {button:true});
  h.click({drvMenu:'b'}, {button:true});
  h.menus.at(-1).find(item => item.key === 'details').run();
  assert.deepEqual(Array.from(h.actions.at(-1).ids), ['b']);
  h.manager.onContextMenu(h.event({drvItem:'c'}, {clientX:10, clientY:10}));
  h.menus.at(-1).find(item => item.key === 'details').run();
  assert.deepEqual(Array.from(h.actions.at(-1).ids), ['c']);
  assert.deepEqual(h.selected(), ['a']);
});

test('opening a menu for a checked item retains the explicitly selected group', () => {
  const h = setup();
  h.click({drvCheck:'a'}, {button:true}); h.click({drvCheck:'b'}, {button:true});
  h.click({drvMenu:'a'}, {button:true});
  h.menus.at(-1).find(item => item.key === 'download').run();
  assert.deepEqual(Array.from(h.actions.at(-1).ids), ['a', 'b']);
});

test('Enter opens the focused card while selection buttons keep their native keyboard behavior', () => {
  const h = setup();
  h.click({drvCheck:'a'}, {button:true});
  h.manager.onKey(h.event({drvItem:'b'}, {key:'Enter'}));
  h.manager.onKey(h.event({drvCheck:'c'}, {key:'Enter', button:true}));
  assert.deepEqual(h.opened, ['b']);
  assert.deepEqual(h.selected(), ['a']);
});

test('folder and file grid tiles expose focusable selection buttons', () => {
  const h = setup();
  const markup = h.manager.gridMarkup([{...h.files[0], mimeType:'folder'}, h.files[1]]);
  assert.match(markup, /data-drv-check="a"[^>]*aria-pressed="false"/);
  assert.match(markup, /data-drv-check="b"[^>]*aria-pressed="false"/);
  assert.doesNotMatch(markup, /data-drv-check="[ab]"[^>]*tabindex="-1"/);
});
