import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../js/features/contacts/directory.js', import.meta.url), 'utf8');

test('danh bạ: bấm ra ngoài hộp thoại không đóng; nút Đóng/X và Esc vẫn đóng', () => {
  // Không còn nhánh đóng theo nền mờ (#ctModal).
  assert.doesNotMatch(src, /t\.id\s*===\s*'ctModal'/);
  // Nút đóng vẫn hoạt động.
  assert.match(src, /if \(t\.closest\('\[data-ct-close\]'\)\) return void closeModal\(\);/);
  // Phím Esc vẫn đóng hộp thoại đang mở.
  assert.match(src, /else if \(modal\) closeModal\(\)/);
});
