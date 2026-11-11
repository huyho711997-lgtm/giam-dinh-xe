// Thứ tự lớp của sơ đồ hiện trường (hàm thuần, không phụ thuộc DOM nên kiểm thử được).
// Lớp 1 = dưới cùng (vẽ trước), lớp N = trên cùng (vẽ sau) — khớp với chữ "Lớp: x/N" ở panel thuộc tính,
// tức vị trí của hình trong mảng sceneShapes cộng 1.

// Đọc số lớp người dùng gõ. Chỉ nhận số nguyên dương; số vượt tổng số lớp được đưa về lớp trên cùng,
// số 0 được đưa về lớp dưới cùng. Trả về null nếu không phải số hợp lệ.
function sceneParseLayerNumber(text, total) {
  const raw = String(text ?? '').trim();
  const count = Number(total);
  if (!/^\d{1,4}$/.test(raw) || !Number.isInteger(count) || count < 1) return null;
  return Math.min(count, Math.max(1, parseInt(raw, 10)));
}

// Đưa hình có id `shapeId` tới lớp `layer` (1..N). Không sửa mảng gốc: trả về mảng mới.
// from / to là số lớp (1-based) trước và sau khi chuyển; changed = false nếu hình đã ở đúng lớp.
function sceneMoveShapeToLayer(shapes, shapeId, layer) {
  const list = Array.isArray(shapes) ? shapes : [];
  const fromIndex = list.findIndex(shape => shape && shape.id === shapeId);
  const toIndex = Number.isInteger(layer) && list.length ? Math.min(list.length, Math.max(1, layer)) - 1 : -1;
  const result = { ok: false, changed: false, shapes: list, from: fromIndex + 1, to: toIndex + 1 };
  if (fromIndex < 0 || toIndex < 0) return result;
  result.ok = true;
  if (fromIndex === toIndex) return result;
  const next = list.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  result.changed = true;
  result.shapes = next;
  return result;
}
