import {frameVariables,getFrame} from './imageFrame';

test('missing device settings inherit desktop without altering the source record',()=>{
  const value={desktop:{x:20,y:30,zoom:1.6,fit:'contain',ratio:1}};
  expect(getFrame(value,'phone')).toEqual(value.desktop);
  expect(value).not.toHaveProperty('phone');
  expect(frameVariables(value)['--frame-phone-x']).toBe('20%');
});
test('separate phone settings can use the page frame while desktop has a custom ratio',()=>{
  const value={desktop:{x:20,ratio:1},phone:{x:70,ratio:null}};
  expect(getFrame(value,'phone').x).toBe(70);
  expect(frameVariables(value)['--frame-phone-ratio']).toContain('--image-default-ratio');
});
test('unsafe or nonfinite fallback values never enter CSS',()=>{
  const style=frameVariables({desktop:{x:Infinity,y:-80,zoom:NaN,fit:'url(evil)',ratio:NaN}});
  expect(style['--frame-desktop-x']).toBe('50%');expect(style['--frame-desktop-y']).toBe('0%');
  expect(style['--frame-desktop-zoom']).toBe('1');expect(style['--frame-desktop-fit']).toBe('cover');
});
