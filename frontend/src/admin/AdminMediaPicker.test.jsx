import {act} from 'react';
import {createRoot} from 'react-dom/client';
import AdminMediaPicker from './AdminMediaPicker';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let container,root;
const items=[{id:'image-1',type:'image',title:'Fotografie',category:'Noapte',src:'/one.webp'},{id:'video-1',type:'video',title:'Film',category:'Noapte',src:'/clip.mp4',poster:'/poster.webp'}];
beforeEach(()=>{container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const open=async(imageOnly=false)=>{
  await act(async()=>root.render(<AdminMediaPicker label="Material" value="image-1" items={items} onChange={()=>{}} imageOnly={imageOnly}/>));
  await act(async()=>container.querySelector('button').click());
  return document.querySelector('[role="dialog"]');
};
test('the current selection stays visible when filters hide its grid item',async()=>{
  const dialog=await open();
  expect(dialog.querySelector('.cms-media-picker__current img')?.getAttribute('src')).toBe('/one.webp');
  const search=dialog.querySelector('input[type=search]');
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(search,'inexistent');search.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(dialog.querySelectorAll('.cms-media-picker__grid button')).toHaveLength(0);
  expect(dialog.querySelector('.cms-media-picker__current').textContent).toContain('Fotografie');
});
test('mixed media can be filtered by type while image-only placements omit that control',async()=>{
  const dialog=await open();const select=dialog.querySelector('select[aria-label="Filtrează după tip"]');
  expect(select).not.toBeNull();
  await act(async()=>{select.value='video';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect([...dialog.querySelectorAll('.cms-media-picker__grid button')].map(button=>button.textContent)).toEqual(['FilmNoapte']);
  await act(async()=>root.render(<AdminMediaPicker label="Material" value="image-1" items={items} onChange={()=>{}} imageOnly/>));
  expect(dialog.querySelector('select[aria-label="Filtrează după tip"]')).toBeNull();
});
