import { partnerOrbitLayout } from './partnerOrbitLayout';

test.each([[1440,900],[1512,982],[1920,1080],[3840,2160]])('all 26 partners orbit without overlapping cards or the title at %sx%s', (width,height)=>{
 const heading={left:width*.33,right:width*.67,top:height/2-150,bottom:height/2+150};
 const seen=new Set();
 const hits=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 for(let step=0;step<180;step++){
  const cards=partnerOrbitLayout(26,width,height,step*Math.PI/90,.5,heading).filter(card=>card.visible);
  expect(cards.length).toBeGreaterThanOrEqual(4);
  cards.forEach((card,index)=>{
   seen.add(card.index);expect(hits(card,heading)).toBe(false);
   expect(card.left).toBeGreaterThanOrEqual(0);expect(card.right).toBeLessThanOrEqual(width);
   expect(cards.slice(index+1).some(other=>hits(card,other))).toBe(false);
  });
 }
 expect(seen.size).toBe(26);
});
