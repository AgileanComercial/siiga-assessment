# Renders every page of a PDF to PNG (pymupdf) for visual review.
# Usage: python scratch/render_pdf_png.py <pdf> <out_dir> [dpi]
import sys, os, pymupdf
pdf, out = sys.argv[1], sys.argv[2]
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 130
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.endswith('.png'): os.remove(os.path.join(out, f))
d = pymupdf.open(pdf)
print('pages', len(d), 'size_kb', os.path.getsize(pdf) // 1024, 'meta', d.metadata.get('title'))
for i, p in enumerate(d):
    p.get_pixmap(dpi=dpi).save(os.path.join(out, 'p%02d.png' % (i + 1)))
