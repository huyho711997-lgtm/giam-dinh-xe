import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const runtime = read('js/features/scene/runtime.js');

function loadConfig() {
  const iconsAt = runtime.indexOf('const TOOL_ICONS_MAP');
  const groupsEnd = runtime.indexOf('let activeSubmenuGroup');
  const shortcutsAt = runtime.indexOf('const SCENE_TOOL_SHORTCUTS');
  const shortcutsEnd = runtime.indexOf('});', shortcutsAt) + 3;
  const code = runtime.slice(iconsAt, groupsEnd) + '\n' + runtime.slice(shortcutsAt, shortcutsEnd) +
    '\n;({ TOOL_ICONS_MAP, TOOL_GROUPS_CONFIG, groupActiveTools, SCENE_TOOL_SHORTCUTS })';
  return vm.runInNewContext(code);
}

const cfg = loadConfig();
const groups = Object.values(cfg.TOOL_GROUPS_CONFIG);

// 43 công cụ có sẵn trước khi chia lại nhóm (không được mất công cụ nào vì bản vẽ đã lưu dùng các id này) + công cụ thêm sau đó.
const LEGACY_TOOLS = [
  'road_line', 'road_dashed', 'road_edge', 'road_intersection', 'curve', 'curve_dashed',
  'line', 'dashed_line', 'direction_label',
  'geo_circle', 'geo_rect', 'geo_triangle', 'geo_round_triangle', 'sign_circle_post', 'sign_triangle_post',
  'car', 'truck', 'container', 'bike', 'fallen_bike', 'person', 'xmark', 'rect', 'house', 'goods_display', 'goods_damaged',
  'crosswalk', 'tire_track', 'guardrail', 'traffic_light', 'median', 'median_blocks', 'toll_station', 'bridge',
  'utility_pole', 'road_boundary_marker', 'pothole', 'tree', 'median_tree', 'rice_field', 'forest', 'rock_field', 'hill',
  // Thêm sau đợt chia nhóm:
  'bus', 'pickup', 'ambulance', 'tow_truck', 'bicycle',
  'sign_square_post', 'sign_rect_post', 'sign_octagon_post'
];

test('mỗi công cụ thuộc đúng một nhóm và không mất công cụ nào sau khi chia lại', () => {
  const seen = new Map();
  for (const g of groups) {
    for (const t of g.tools) {
      assert.ok(!seen.has(t.id), `${t.id} bị lặp ở ${seen.get(t.id)} và ${g.id}`);
      seen.set(t.id, g.id);
    }
  }
  for (const id of LEGACY_TOOLS) assert.ok(seen.has(id), `thiếu công cụ ${id}`);
  assert.equal(seen.size, LEGACY_TOOLS.length, 'có công cụ lạ ngoài danh sách cũ: cập nhật LEGACY_TOOLS nếu chủ ý thêm mới');
});

test('mỗi công cụ có biểu tượng; mỗi nhóm có công cụ mặc định hợp lệ và gọn (≤ 8 mục)', () => {
  for (const g of groups) {
    assert.ok(g.tools.length >= 2 && g.tools.length <= 8, `${g.id}: ${g.tools.length} mục`);
    assert.ok(g.tools.some(t => t.id === g.defaultTool), `${g.id}: defaultTool không thuộc nhóm`);
    assert.equal(cfg.groupActiveTools[g.id], g.defaultTool, `${g.id}: groupActiveTools lệch defaultTool`);
    for (const t of g.tools) assert.ok(cfg.TOOL_ICONS_MAP[t.id], `${t.id}: thiếu icon`);
  }
  assert.deepEqual(Object.keys(cfg.groupActiveTools), Object.keys(cfg.TOOL_GROUPS_CONFIG));
});

test('các nhóm theo chức năng: đúng nơi đặt của những công cụ hay bị đặt nhầm', () => {
  const where = id => groups.find(g => g.tools.some(t => t.id === id)).id;
  assert.equal(where('crosswalk'), 'road_line');
  assert.equal(where('traffic_light'), 'traffic_signs');
  assert.equal(where('sign_octagon_post'), 'traffic_signs');
  assert.equal(where('sign_rect_post'), 'traffic_signs');
  assert.equal(where('sign_square_post'), 'traffic_signs');
  assert.equal(where('sign_circle_post'), 'traffic_signs');
  assert.equal(where('geo_rect'), 'shape_symbols');
  assert.equal(where('bus'), 'scene_object');
  assert.equal(where('bike'), 'two_wheel');
  assert.equal(where('bicycle'), 'two_wheel');
  assert.equal(where('person'), 'two_wheel');
  assert.equal(where('xmark'), 'evidence');
  assert.equal(where('tire_track'), 'evidence');
  assert.equal(where('pothole'), 'evidence');
  assert.equal(where('house'), 'structures');
  assert.equal(where('rect'), 'structures');
  assert.equal(where('bridge'), 'road_assets');
  assert.equal(where('utility_pole'), 'road_assets');
  assert.equal(where('tree'), 'landscape');
  assert.equal(where('hill'), 'landscape');
});

test('phím tắt: không trùng, mỗi nhóm có đúng một phím, giữ L/C/A/S/O/H cũ', () => {
  const sc = cfg.SCENE_TOOL_SHORTCUTS;
  const keys = Object.keys(sc);
  assert.equal(new Set(keys).size, keys.length);
  for (const k of keys) assert.match(k, /^[a-z]$/);
  assert.ok(!keys.includes('r'), 'R dành cho xoay đối tượng');
  const byGroup = new Map();
  for (const [k, v] of Object.entries(sc)) if (v.group) byGroup.set(v.group, (byGroup.get(v.group) || []).concat(k));
  for (const g of groups) assert.equal((byGroup.get(g.id) || []).length, 1, `${g.id} cần đúng 1 phím`);
  for (const [k, id] of Object.entries({ l: 'road_line', c: 'curve', a: 'arrow', s: 'shape_symbols', o: 'scene_object', h: 'road_assets', x: 'two_wheel' })) {
    assert.equal(sc[k].group, id);
  }
});

for (const page of ['index.html', 'so-do-hien-truong.html']) {
  test(`${page}: thanh công cụ có đủ nút nhóm đúng thứ tự, đúng phím và đúng icon mặc định`, () => {
    const html = read(page);
    const rail = html.slice(html.indexOf('id="sceneToolRail"'));
    const buttons = [...rail.matchAll(/<button class="draw-tool-btn draw-tool-group-btn" id="btnGroup_(\w+)"[^>]*?data-group="(\w+)" data-tool="(\w+)" data-shortcut="(\w)"[^>]*?onclick="toggleToolSubmenu\(event, '(\w+)'\)"/g)];
    assert.deepEqual(buttons.map(m => m[1]), Object.keys(cfg.TOOL_GROUPS_CONFIG), 'thứ tự nút ≠ thứ tự nhóm');
    for (const [, id, group, tool, key, arg] of buttons) {
      assert.equal(group, id);
      assert.equal(arg, id);
      assert.equal(tool, cfg.groupActiveTools[id], `${id}: data-tool lệch công cụ mặc định`);
      assert.equal(cfg.SCENE_TOOL_SHORTCUTS[key.toLowerCase()].group, id, `${id}: phím ${key} không khớp`);
      const icon = html.match(new RegExp(`id="groupIcon_${id}"[^>]*>\\s*(<svg[\\s\\S]*?</svg>)`));
      assert.ok(icon, `${id}: thiếu icon`);
      if (!['road_line', 'curve', 'arrow', 'shape_symbols', 'scene_object', 'two_wheel'].includes(id)) {
        assert.equal(icon[1].replace(/\s+/g, ' '), cfg.TOOL_ICONS_MAP[tool].replace(/\s+/g, ' '), `${id}: icon ban đầu ≠ icon công cụ mặc định`);
      }
    }
    const labels = [...rail.matchAll(/scene-tool-section-label">([^<]+)</g)].map(m => m[1].replace(/&amp;/g, '&'));
    assert.deepEqual(labels.slice(0, 6), ['Thao tác', 'Vẽ nét', 'Hình & ký hiệu', 'Hiện trường', 'Hạ tầng & cảnh quan', 'Ghi chú']);
  });
}
