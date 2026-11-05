import sys
from PIL import Image, ImageDraw, ImageFont
Image.MAX_IMAGE_PIXELS=None
png,ox,oy,s,out=sys.argv[1],float(sys.argv[2]),float(sys.argv[3]),float(sys.argv[4]),sys.argv[5]
x0,z0,x1,z1=map(float,sys.argv[6].split(','))
im=Image.open(png).convert('RGB'); d=ImageDraw.Draw(im)
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22) if True else None
P=lambda x,z:(ox+x*s, oy+z*s)   # origin = wall centerline (0,0)
k=x0
import math
x=math.floor(x0*2)/2
while x<=x1:
    a=P(x,z0);b=P(x,z1); d.line([a,b],fill=(255,0,0) if abs(x-round(x))<1e-6 else (255,170,170),width=2 if abs(x-round(x))<1e-6 else 1)
    if abs(x-round(x))<1e-6: d.text((a[0]+3,a[1]+3),str(int(x)),fill=(255,0,0),font=f)
    x+=.5
z=math.floor(z0*2)/2
while z<=z1:
    a=P(x0,z);b=P(x1,z); d.line([a,b],fill=(0,0,255) if abs(z-round(z))<1e-6 else (170,170,255),width=2 if abs(z-round(z))<1e-6 else 1)
    if abs(z-round(z))<1e-6: d.text((a[0]+3,a[1]+3),str(int(z)),fill=(0,0,255),font=f)
    z+=.5
A=P(x0,z0);B=P(x1,z1)
c=im.crop((int(A[0]),int(A[1]),int(B[0]),int(B[1])))
sc=float(sys.argv[7]) if len(sys.argv)>7 else .5
c.resize((int(c.width*sc),int(c.height*sc))).save(out)
