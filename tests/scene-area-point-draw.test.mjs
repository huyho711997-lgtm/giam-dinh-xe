import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync(new URL('../js/features/scene/scene-editor-ui.js', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../js/features/scene/runtime.js', import.meta.url), 'utf8');

test('4 công cụ vùng vào chế độ bấm điểm khi được chọn; đổi công cụ khác thì thoát', () => {
  assert.match(ui, /SCENE_AREA_POINT_TOOLS = \['forest', 'rice_field', 'rock_field', 'hill'\]/);
  assert.match(ui, /window\.setActiveDrawTool = wrapped/);
  assert.match(ui, /startSceneryOutlineDraw\(toolName\)/);
});

test('tạo vùng mới từ điểm bấm: không rê tay, Ctrl+Z bỏ điểm cuối, Esc về công cụ Chọn', () => {
  assert.match(ui, /!creating && !stroke/);
  assert.match(ui, /e\.ctrlKey \|\| e\.metaKey\) && \(e\.key === 'z'/);
  assert.match(ui, /wasCreating && !silent[^\n]*setActiveDrawTool\('select'\)/);
});

test('mô tả công cụ nói rõ cách vẽ bằng bấm điểm', () => {
  for (const id of ['rice_field', 'forest', 'rock_field', 'hill']) {
    const m = runtime.match(new RegExp("id: '" + id + "', name: '[^']+', desc: '([^']+)'"));
    assert.ok(m && /Bấm từng điểm/.test(m[1]), id);
  }
});
