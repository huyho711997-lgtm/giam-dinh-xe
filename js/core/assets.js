// Resolve against the page so this also works under a GitHub Pages repository path.
const TascoAssets = (() => {
  const binaries = new Map();
  const url = path => new URL(path, document.baseURI).href;
  async function binary(path) {
    const href = url(path);
    if (!binaries.has(href)) {
      const request = fetch(href).then(response => {
        if (!response.ok) throw new Error('Không thể tải mẫu tài liệu. Vui lòng thử lại.');
        return response.arrayBuffer();
      }).then(buffer => new Uint8Array(buffer)).catch(error => {
        binaries.delete(href);
        throw error;
      });
      binaries.set(href, request);
    }
    return binaries.get(href);
  }
  return Object.freeze({ url, binary });
})();
