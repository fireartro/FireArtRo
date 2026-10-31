import { partnerOrbitLayout } from './partnerOrbitLayout';

test.each([[1024,600],[1280,600],[1536,736],[1366,500],[1200,741],[1440,900],[1512,982],[1920,1080],[3840,2160]])('all 26 partners remain visible without overlapping cards or the title at %sx%s', (width,height)=>{
 const halfWidth=height<=740?Math.max(140,Math.min(width*.14,220)):Math.min(width*.17,255),center=height/2+30;
 const halfHeight=height<=560?50:height<=740?72:100;
 const heading={left:width/2-halfWidth,right:width/2+halfWidth,top:center-halfHeight,bottom:center+halfHeight};
 const seen=new Set();
 const hits=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 for(let step=0;step<180;step++){
  const cards=partnerOrbitLayout(26,width,height,step*Math.PI/90,.5,heading).filter(card=>card.visible);
  expect(cards.length).toBe(26);
  cards.forEach((card,index)=>{
   seen.add(card.index);expect(hits(card,heading)).toBe(false);expect(card.opacity).toBe(1);
   expect(card.left).toBeGreaterThanOrEqual(0);expect(card.right).toBeLessThanOrEqual(width);
   expect(cards.slice(index+1).some(other=>hits(card,other))).toBe(false);
  });
 }
 expect(seen.size).toBe(26);
});

test('card movement remains continuous through a complete orbit',()=>{
 let previous=partnerOrbitLayout(26,1440,900,0);
 for(let frame=1;frame<=720;frame++){
  const next=partnerOrbitLayout(26,1440,900,frame*Math.PI/360);
  next.forEach((card,index)=>expect(Math.hypot(card.x-previous[index].x,card.y-previous[index].y)).toBeLessThan(7));
  previous=next;
 }
});
