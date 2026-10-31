const tracks = new Map();
export const PARTNER_CARD_WIDTH = 128;
export const PARTNER_CARD_HEIGHT = 92;

// Equal arc-length spacing keeps the whole catalogue on two rounded orbital
// paths. Cards never need collision-based hiding or a visibility threshold.
function track(rx, ry) {
  const key = `${rx}:${ry}`;
  if (tracks.has(key)) return tracks.get(key);
  const points = [];
  let length = 0;
  for (let step=0;step<=512;step++) {
    const theta=step/512*Math.PI*2;
    const c=Math.cos(theta),s=Math.sin(theta);
    const point={x:rx*Math.sign(c)*Math.abs(c)**(2/3),y:ry*Math.sign(s)*Math.abs(s)**(2/3)};
    if(step) length+=Math.hypot(point.x-points[step-1].x,point.y-points[step-1].y);
    points.push({...point,length});
  }
  const result={points,length};
  if(tracks.size>16)tracks.clear();
  tracks.set(key,result);
  return result;
}

function position(path, fraction) {
  const distance=((fraction%1)+1)%1*path.length;
  let low=0,high=path.points.length-1;
  while(high-low>1){const mid=(low+high)>>1;if(path.points[mid].length<distance)low=mid;else high=mid;}
  const a=path.points[low],b=path.points[high],t=(distance-a.length)/(b.length-a.length);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}

export function partnerOrbitLayout(count, width, height, angle) {
  const unit=Math.min(width/1440,height/900);
  const size=unit*Math.min(1,26/Math.max(1,count));
  const cx=width/2,cy=(84+height-24)/2;
  const outerRx=width/2-PARTNER_CARD_WIDTH*unit/2-22;
  const outerRy=(height-108)/2-PARTNER_CARD_HEIGHT*unit/2-12;
  const radii=[[outerRx,outerRy],[outerRx-170*unit,outerRy-132*unit]];
  const populations=[Math.ceil(count*.615),Math.floor(count*.385)];
  return Array.from({length:count},(_,index)=>{
    const ring=index<populations[0]?0:1;
    const slot=ring?index-populations[0]:index;
    const [rx,ry]=radii[ring];
    const fraction=slot/populations[ring]+angle/(Math.PI*2)*(ring ? -.72 : 1)+(ring ? .037 : 0);
    const point=position(track(rx,ry),fraction);
    const z=point.y/ry;
    const scale=size*(.95+.05*(z+1)/2);
    const x=cx+point.x,y=cy+point.y,w=PARTNER_CARD_WIDTH*scale,h=PARTNER_CARD_HEIGHT*scale;
    return {index,x,y,z,scale,visible:true,opacity:1,left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2};
  });
}
