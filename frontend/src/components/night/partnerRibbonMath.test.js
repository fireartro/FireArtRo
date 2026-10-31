import {ribbonLayout, ribbonDistance, ribbonPeriod, writeRibbonVertex} from './partnerRibbonMath';

test.each([[320,300],[390,470],[844,210],[1440,600]])(
  'every partner travels through the %sx%s viewport on two continuous bands', (width,height) => {
    const layout=ribbonLayout(width,height);
    const visited=new Set();
    for(let step=0;step<=100;step++) {
      for(let index=0;index<26;index++) {
        const distance=ribbonDistance(index,26,step/100*ribbonPeriod(26,layout),layout);
        if(Math.abs(distance)<width/2)visited.add(index);
      }
    }
    expect(visited.size).toBe(26);
    const point={};
    writeRibbonVertex(point,-width*.3,0,0,0,layout);
    expect(point.y).toBeLessThan(0);
    writeRibbonVertex(point,width*.3,0,0,0,layout);
    expect(point.y).toBeGreaterThan(0);
    writeRibbonVertex(point,width*.3,0,1,0,layout);
    expect(point.y).toBeLessThan(0);
  },
);

test('a card surface bends through the same continuous frame instead of remaining flat',()=>{
  const layout=ribbonLayout(1200,600), left={},middle={},right={};
  writeRibbonVertex(left,150,0,0,0,layout);
  writeRibbonVertex(middle,250,0,0,0,layout);
  writeRibbonVertex(right,350,0,0,0,layout);
  expect(Math.abs(middle.y-(left.y+right.y)/2)).toBeGreaterThan(.3);
  expect(Math.abs(middle.z-(left.z+right.z)/2)).toBeGreaterThan(.3);
});

test('the ribbons circle behind the sphere and retain opposite front-facing tilts',()=>{
  const layout=ribbonLayout(1200,600),front={},back={},first={},second={};
  writeRibbonVertex(front,0,0,0,0,layout);
  writeRibbonVertex(back,Math.PI*layout.radius,0,0,0,layout);
  expect(front.z).toBeGreaterThan(0);
  expect(back.z).toBeLessThan(0);
  writeRibbonVertex(first,layout.radius*.5,0,0,0,layout);
  writeRibbonVertex(second,layout.radius*.5,0,1,0,layout);
  expect(first.y).toBeGreaterThan(0);
  expect(second.y).toBeLessThan(0);
});
