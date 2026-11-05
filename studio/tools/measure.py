"""Find wall faces on a rendered drawing by scanning for dark pixel runs.

usage:
  python3 measure.py DRAWING.png OX OY PX_PER_M z  X0 X1 Z0 Z1   # horizontal walls: scan z between Z0..Z1 over the x band X0..X1
  python3 measure.py DRAWING.png OX OY PX_PER_M x  Z0 Z1 X0 X1   # vertical walls:   scan x between X0..X1 over the z band Z0..Z1
Prints the positions (meters, plan frame) where more than half of the band is dark: wall faces come in pairs,
and the wall centerline is their midpoint.
"""
import sys
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

png, ox, oy, s, mode = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
b0, b1, c0, c1 = map(float, sys.argv[6:10])
im = np.array(Image.open(png).convert('L'))
hits = []
for c in np.arange(c0, c1, .02):
    if mode == 'z':
        y = int(oy + c * s); band = im[y, int(ox + b0 * s):int(ox + b1 * s)]
    else:
        x = int(ox + c * s); band = im[int(oy + b0 * s):int(oy + b1 * s), x]
    f = (band < 110).mean()
    if f > .5: hits.append((round(float(c), 2), round(float(f), 2)))
print(hits)
