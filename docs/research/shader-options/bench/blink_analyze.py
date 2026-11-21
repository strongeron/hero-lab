import sys,os,glob,json
from PIL import Image
d=sys.argv[1]; tgt=tuple(map(int,sys.argv[2].split(','))); tol=int(sys.argv[3]) if len(sys.argv)>3 else 90
sh=[]
for f in sorted(glob.glob(d+'/*.png')):
    _,x,y=os.path.basename(f)[:-4].split('_'); x,y=int(x),int(y)
    im=Image.open(f).convert('RGB'); s=im.width/1440
    box=im.crop((int((x-50)*s),int((y-50)*s),int((x+50)*s),int((y+50)*s)))
    px=list(box.getdata()); hit=sum(1 for p in px if abs(p[0]-tgt[0])+abs(p[1]-tgt[1])+abs(p[2]-tgt[2])<tol)
    sh.append(round(hit/len(px),3))
med=sorted(sh)[len(sh)//2]
bl=[i for i,v in enumerate(sh) if i>2 and v<med*0.25]
print(json.dumps({'frames':len(sh),'fps':round(len(sh)/3,1),'median':med,'blinkFrames':len(bl),'blinkIdx':bl[:20],'shares':sh}))
