"""Extract exact video timestamps for human visual review; no media mutation."""
from pathlib import Path
from PIL import Image,ImageDraw
import argparse,subprocess
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('output',type=Path);p.add_argument('--times',required=True);p.add_argument('--columns',type=int,default=3);p.add_argument('--cuda',action='store_true');args=p.parse_args()
times=[float(t) for t in args.times.split(',')]
w,h=480,300
canvas=Image.new('RGB',(w*args.columns,h*((len(times)+args.columns-1)//args.columns)),'#15191f');draw=ImageDraw.Draw(canvas)
args.output.parent.mkdir(parents=True,exist_ok=True)
for i,t in enumerate(times):
    frame=args.output.with_name(args.output.stem+f'-{i}.jpg')
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y']+(['-hwaccel','cuda'] if args.cuda else [])+['-ss',str(t),'-i',str(args.video),'-frames:v','1','-vf','scale=960:960:force_original_aspect_ratio=decrease',str(frame)],check=True)
    im=Image.open(frame);im.thumbnail((w-8,h-28));x=i%args.columns*w+(w-im.width)//2;y=i//args.columns*h
    canvas.paste(im,(x,y));draw.text((i%args.columns*w+5,y+h-23),f'{t:.3f} s',fill='white')
canvas.save(args.output,quality=94)
print(args.output)
