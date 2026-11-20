/* 혼플 upload.js — 사진을 올리기 전에 브라우저에서 줄입니다 (관리자·호스트센터 공용)
   긴 변 1600px 안팎의 JPG 와, 카드에 쓰는 560px 작은 그림을 만듭니다. 원본은 서버로 가지 않습니다. */
(function () {
  const LIMIT = 1150000; // base64 글자 수 (≈ 860KB)
  H.shrinkImage = async (file) => {
    if (!/^image\//.test(file.type || '')) throw new Error('사진 파일만 올릴 수 있습니다');
    if (file.size > 30 * 1024 * 1024) throw new Error('30MB보다 큰 사진은 올릴 수 없습니다');
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      bmp = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('이 사진은 열 수 없습니다. 아이폰의 HEIC 사진이라면 JPG로 바꿔서 올려 주세요'));
        i.src = URL.createObjectURL(file);
      });
    }
    const bw = bmp.width || bmp.naturalWidth, bh = bmp.height || bmp.naturalHeight;
    if (Math.max(bw, bh) < 600) throw new Error('사진이 너무 작습니다. 긴 변이 600px 이상인 사진을 올려 주세요');
    const draw = (max, q) => {
      const sc = Math.min(1, max / Math.max(bw, bh));
      const w = Math.round(bw * sc), h = Math.round(bh * sc);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
      x.imageSmoothingQuality = 'high';
      x.drawImage(bmp, 0, 0, w, h);
      return { b64: c.toDataURL('image/jpeg', q).split(',')[1], w, h };
    };
    let main = draw(1600, 0.82);
    if (main.b64.length > LIMIT) main = draw(1600, 0.7);
    if (main.b64.length > LIMIT) main = draw(1280, 0.7);
    if (main.b64.length > LIMIT) throw new Error('사진을 충분히 줄이지 못했습니다. 다른 사진으로 올려 주세요');
    const th = draw(560, 0.78);
    return { data: main.b64, thumb: th.b64, w: main.w, h: main.h };
  };
})();
