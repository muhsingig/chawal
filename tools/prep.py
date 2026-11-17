"""Prepare chawal photos: resized webp photos, polaroid face crops, die-cut stickers.
Usage: python tools/prep.py <chawal images folder>"""
import sys, glob, os
from PIL import Image, ImageOps, ImageFilter
SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
fs = sorted(glob.glob(os.path.join(SRC, '*.jpeg')) + glob.glob(os.path.join(SRC, '*.jpg')))
imgs = {}
for i, f in enumerate(fs, 1):
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    imgs[i] = im
    t = im.copy(); t.thumbnail((1400, 1400), Image.LANCZOS)
    t.save(f'{OUT}/photos/p{i:02d}.webp', quality=82)

# polaroid face crops from photo 2 (traditional day): (cx, cy, w)
faces = {'hatim': (125, 470, 240), 'pavitra': (300, 530, 230), 'hamza': (485, 455, 240),
         'tanya': (690, 520, 214), 'muhsin': (860, 485, 196)}
p2 = imgs[2]
for name, (cx, cy, w) in faces.items():
    h = int(w * 1.15)
    box = (max(0, cx - w // 2), max(0, cy - h // 2), min(p2.width, cx + w // 2), cy + h // 2)
    c = p2.crop(box).resize((480, int(480 * (box[3]-box[1]) / (box[2]-box[0]))), Image.LANCZOS)
    c = c.filter(ImageFilter.UnsharpMask(2, 60, 2))
    c.save(f'{OUT}/people/{name}-face.webp', quality=88)

# die-cut stickers via rembg
from rembg import remove, new_session
sess = new_session('isnet-general-use')
def sticker(im, name, border=14, maxside=1100):
    im = im.copy(); im.thumbnail((maxside, maxside), Image.LANCZOS)
    cut = remove(im, session=sess, post_process_mask=True)
    a = cut.split()[3].point(lambda v: 255 if v > 128 else 0)
    import numpy as np
    from scipy import ndimage
    arr = np.array(a) > 0
    lab, n = ndimage.label(arr)
    if n > 1:
        sizes = ndimage.sum(arr, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz > sizes.max() * 0.04])
        arr = keep
        a = Image.fromarray((arr * 255).astype('uint8'))
        cut.putalpha(Image.fromarray((np.array(cut.split()[3]) * arr).astype('uint8')))
    # keep alpha clean, add white die-cut border
    pad = border * 2
    W, H = cut.width + pad * 2, cut.height + pad * 2
    base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    am = Image.new('L', (W, H), 0); am.paste(a, (pad, pad))
    grown = am.filter(ImageFilter.MaxFilter(border * 2 + 1)).filter(ImageFilter.GaussianBlur(1.2))
    grown = grown.point(lambda v: 255 if v > 100 else 0).filter(ImageFilter.GaussianBlur(.8))
    white = Image.new('RGBA', (W, H), (255, 253, 247, 255)); white.putalpha(grown)
    base.alpha_composite(white)
    cc = Image.new('RGBA', (W, H), (0, 0, 0, 0)); cc.paste(cut, (pad, pad))
    cc.putalpha(Image.composite(Image.new('L', (W, H), 255), Image.new('L', (W, H), 0), am))
    base.alpha_composite(cc)
    bb = base.getbbox(); base = base.crop(bb)
    base.save(f'{OUT}/people/{name}.webp', quality=88)
    print('sticker', name, base.size)

sticker(imgs[2], 'group-traditional')
sticker(imgs[4], 'group-argentina')
sticker(imgs[9], 'horse-rider')
print('done', len(fs))
