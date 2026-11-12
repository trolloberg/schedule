# Baut index.html aus den Teilen (Symbole werden eingesetzt).
# Aufruf: python3 build.py [Ziel]   – ohne Ziel landet die Datei in der iPhone-App (../Schedule/www/index.html).
import os, sys
d = os.path.dirname(os.path.abspath(__file__)) + os.sep
icons = open(d + 'icons.js', encoding='utf-8').read().strip()
parts = [open(d + f, encoding='utf-8').read() for f in ['p1_head.html', 'p2_core.js', 'p3_ui.js', 'p4_views.js', 'p4b_prod.js', 'p5_edit.js', 'p6_sheets.js', 'p7_app.js']]
core = parts[1]
assert '/*@@ICONS@@*/' in core
parts[1] = core.replace('/*@@ICONS@@*/', icons)
out = ''.join(parts)
dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(d, '..', 'Schedule', 'www', 'index.html')
open(dst, 'w', encoding='utf-8').write(out)
print(dst, len(out.encode()))
