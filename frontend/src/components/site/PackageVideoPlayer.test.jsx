import {act} from 'react';
import {createRoot} from 'react-dom/client';
import PackageVideoPlayer from './PackageVideoPlayer';
jest.mock('framer-motion',()=>({useReducedMotion:()=>true}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('resetting crop keeps the explicitly selected package image instead of reverting to YouTube',async()=>{
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
  const item={id:'one',title:'Pachet',videoUrl:'https://youtu.be/j2BGRd88qBc',moreVideoUrls:[],imageMediaId:'mine',mediaSelection:'manual'};
  try{
    await act(async()=>root.render(<PackageVideoPlayer item={{...item,imageFrame:{desktop:{x:20}}}} fallback="/mine.webp" label="Noapte"/>));
    expect(container.querySelector('img').getAttribute('src')).toBe('/mine.webp');
    await act(async()=>root.render(<PackageVideoPlayer item={{...item,imageFrame:null}} fallback="/mine.webp" label="Noapte"/>));
    expect(container.querySelector('img').getAttribute('src')).toBe('/mine.webp');
  }finally{await act(async()=>root.unmount());container.remove();}
});
