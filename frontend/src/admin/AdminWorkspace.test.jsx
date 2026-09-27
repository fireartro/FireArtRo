import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {CMS_DEFAULTS} from '@/data/cmsDefaults';
import {AdminDraftProvider, useAdminDraft} from './AdminDraftContext';
import AdminLayout from './AdminLayout';
import AdminContentEditor from './AdminContentEditor';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mockContent;
let mockVersion;
let mockSaveError;
const originalFetch=global.fetch;
const originalMatchMedia=window.matchMedia;
const handleRequest = async (url, options = {}) => {
  if (url === '/api/content') return {revision_id:'r1',published_at:'2026-09-27T10:00:00Z',content:CMS_DEFAULTS};
  if (url === '/api/admin/content/draft') {
    if (options.method === 'PUT' && mockSaveError) throw mockSaveError;
    if (options.method === 'PUT') {mockContent=JSON.parse(options.body).content;mockVersion++;}
    return {version:mockVersion,base_revision_id:'r1',published_revision_id:'r1',published_at:'2026-09-27T10:00:00Z',content:mockContent,updated_at:'2026-09-27T10:00:00Z',updated_by:'operator'};
  }
  if (url.includes('integrations')) return {};
  throw new Error('Unexpected request: '+url);
};
const mockRequest = jest.fn(handleRequest);
jest.mock('./AdminSessionContext',()=>({useAdminSession:()=>({status:'authenticated',admin:{username:'operator'},request:mockRequest,logout:()=>{}})}));
let root;
let container;
beforeEach(()=>{jest.useFakeTimers();mockSaveError=null;window.matchMedia=()=>({matches:true,addEventListener:()=>{},removeEventListener:()=>{}});mockRequest.mockImplementation(handleRequest);global.fetch=jest.fn(async()=>({ok:true,status:200,json:async()=>({revision_id:'r1',published_at:'2026-09-27T10:00:00Z',content:CMS_DEFAULTS})}));mockContent=JSON.parse(JSON.stringify(CMS_DEFAULTS));mockVersion=0;container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();jest.useRealTimers();mockRequest.mockClear();global.fetch=originalFetch;window.matchMedia=originalMatchMedia;});
function Loaded({children}) {return useAdminDraft().draft ? children : null;}
const render = async element => act(async()=>root.render(<MemoryRouter><AdminDraftProvider><Loaded>{element}</Loaded></AdminDraftProvider></MemoryRouter>));
const click = async text => {const button=[...container.querySelectorAll('button')].find(e=>e.textContent===text);expect(button).toBeDefined();await act(async()=>button.click());};
const type = async (input,value) => act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});

test('one shared publication action and four accessible navigation groups retain operational modules',async()=>{
  await render(<AdminLayout/>);
  expect([...container.querySelectorAll('button')].filter(e=>e.textContent==='Publică modificările')).toHaveLength(1);
  expect([...container.querySelectorAll('.admin-sidebar summary')].map(e=>e.textContent)).toEqual(['Pagini','Conținut','Solicitări','Setări']);
  for(const label of ['Cereri de ofertă','Mesaje','Istoric publicări','Biblioteca media']) expect(container.textContent).toContain(label);
});
test('no-match search hides unrelated editor and offers clearing the filter',async()=>{
  await render(<AdminContentEditor moduleKey="partners"/>);
  await type(container.querySelector('input[type="search"]'),'niciun-partener');
  expect(container.querySelector('[role="status"]').textContent).toContain('Niciun rezultat');
  expect(container.querySelector('.cms-editor-fields input')).toBeNull();
  await click('Șterge căutarea');
  expect(container.querySelector('.cms-editor-fields input')).not.toBeNull();
});
test('changing module resets collection search without changing records',async()=>{
  await render(<AdminLayout/>);await click('Parteneri');
  const query=container.querySelector('.cms-collection-list input[type="search"]');
  await type(query,'niciun-partener');await click('Întrebări');
  expect(container.querySelector('.cms-collection-list input[type="search"]').value).toBe('');
  expect(container.querySelector('.cms-collection-choice')).not.toBeNull();
});
test('adding a collection record opens it, and removing it requires confirmation',async()=>{
  await render(<AdminContentEditor moduleKey="partners"/>);
  const before=container.querySelectorAll('.cms-collection-choice').length;
  await click('Adaugă element');
  expect(container.querySelectorAll('.cms-collection-choice')).toHaveLength(before+1);
  await click('Șterge');
  expect(container.querySelectorAll('.cms-collection-choice')).toHaveLength(before+1);
  const dialog=document.querySelector('[role="dialog"]');expect(dialog).not.toBeNull();
  await act(async()=>[...dialog.querySelectorAll('button')].find(e=>e.textContent==='Șterge elementul').click());
  expect(container.querySelectorAll('.cms-collection-choice')).toHaveLength(before);
});
test('collection duplication gets a stable unique id and reordering preserves every record',async()=>{
  await render(<AdminContentEditor moduleKey="partners"/>);
  const before=container.querySelectorAll('.cms-collection-choice').length;
  const original=container.querySelector('.cms-editor-fields input[readonly]').value;
  await click('Duplică');
  expect(container.querySelectorAll('.cms-collection-choice')).toHaveLength(before+1);
  const copy=container.querySelector('.cms-editor-fields input[readonly]').value;
  expect(copy).not.toBe(original);
  await act(async()=>container.querySelector('button[aria-label="Mută în sus"]').click());
  expect(container.querySelector('.cms-editor-fields input[readonly]').value).toBe(copy);
  expect(container.querySelectorAll('.cms-collection-choice')).toHaveLength(before+1);
});
test('save errors remain visible in another section and conflict reload requires confirmation',async()=>{
  await render(<AdminLayout/>);await click('Parteneri');
  mockSaveError=Object.assign(new Error('Conflict verificat'),{status:409});
  const input=[...container.querySelectorAll('.cms-editor-fields input')].find(e=>!e.readOnly);
  await type(input,'Modificare locală');await act(async()=>jest.advanceTimersByTime(700));
  expect(container.querySelector('[role="alert"]').textContent).toContain('Conflict verificat');
  await click('Prima pagină');
  expect(container.querySelector('[role="alert"]').textContent).toContain('Conflict verificat');
  await click('Încarcă versiunea serverului');
  const dialog=document.querySelector('[role="dialog"]');expect(dialog.textContent).toContain('Modificările locale nesalvate');
  const loads=mockRequest.mock.calls.filter(([url,options])=>url==='/api/admin/content/draft'&&!options?.method).length;
  expect(loads).toBe(1);
  await act(async()=>[...dialog.querySelectorAll('button')].find(e=>e.textContent==='Înlocuiește modificările locale').click());
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
test('mobile navigation is modal, closes with Escape and returns focus to its trigger',async()=>{
  await render(<AdminLayout/>);
  const trigger=container.querySelector('button[aria-label="Deschide secțiunile"]');
  await act(async()=>{trigger.focus();trigger.click();});
  const dialog=document.querySelector('[role="dialog"]');expect(dialog).not.toBeNull();
  expect(container.querySelector('.cms-main').closest('[aria-hidden="true"]')).not.toBeNull();
  await act(async()=>dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  await act(async()=>jest.advanceTimersByTime(1));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
test('renaming under a search keeps the selected stable record instead of switching to another match',async()=>{
  mockContent.partners=mockContent.partners.slice(0,2).map((item,i)=>({...item,name:`Search ${i+1}`}));
  await render(<AdminContentEditor moduleKey="partners"/>);
  await type(container.querySelector('input[type="search"]'),'Search');
  await act(async()=>container.querySelector('.cms-collection-choice').click());
  const id=container.querySelector('input[readonly]').value;
  await type(container.querySelector('input[name="partners.0.name"]'),'Renamed');
  expect(container.querySelector('input[readonly]').value).toBe(id);
  expect(container.querySelector('.cms-editor-title h2').textContent).toBe('Renamed');
  expect(container.querySelector('.cms-collection').dataset.view).toBe('editor');
});
test('undoing the only new record returns mobile mode to the empty list',async()=>{
  mockContent.partners=[];await render(<AdminContentEditor moduleKey="partners"/>);
  await click('Adaugă element');
  expect(container.querySelector('.cms-collection').dataset.view).toBe('editor');
  await click('Anulează ultima modificare');
  expect(container.querySelector('.cms-collection').dataset.view).toBe('list');
  expect(container.querySelector('[role="status"]').textContent).toContain('Nu există elemente');
});
test('editing the automatically displayed search match also pins its stable id',async()=>{
  mockContent.partners=mockContent.partners.slice(0,2).map((item,i)=>({...item,name:`Search ${i+1}`}));
  await render(<AdminContentEditor moduleKey="partners"/>);
  await type(container.querySelector('input[type="search"]'),'Search');
  const id=container.querySelector('input[readonly]').value;
  await type(container.querySelector('input[name="partners.0.name"]'),'Renamed directly');
  expect(container.querySelector('input[readonly]').value).toBe(id);
  expect(container.querySelector('.cms-editor-title h2').textContent).toBe('Renamed directly');
});
