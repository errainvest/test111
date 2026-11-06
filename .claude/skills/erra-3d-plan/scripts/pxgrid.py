import sys
from PIL import Image, ImageDraw, ImageFont
Image.MAX_IMAGE_PIXELS=None
src,out=sys.argv[1],sys.argv[2]; x0,y0,x1,y1=map(int,sys.argv[3].split(',')); sc=float(sys.argv[4]); step=int(sys.argv[5]) if len(sys.argv)>5 else 100
im=Image.open(src).convert('RGB').crop((x0,y0,x1,y1)); d=ImageDraw.Draw(im)
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',int(14/sc))
for x in range((x0//step+1)*step, x1, step):
    d.line([(x-x0,0),(x-x0,y1-y0)],fill=(255,0,0) if x%(step*5)==0 else (255,160,160),width=max(1,int(1/sc)))
    if x%(step*5)==0: d.text((x-x0+3,3),str(x),fill=(255,0,0),font=f)
for y in range((y0//step+1)*step, y1, step):
    d.line([(0,y-y0),(x1-x0,y-y0)],fill=(0,0,255) if y%(step*5)==0 else (160,160,255),width=max(1,int(1/sc)))
    if y%(step*5)==0: d.text((3,y-y0+3),str(y),fill=(0,0,255),font=f)
im.resize((int(im.width*sc),int(im.height*sc))).save(out)
