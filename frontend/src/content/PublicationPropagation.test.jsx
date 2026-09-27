import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {ManagedContentProvider,useManagedContentSnapshot} from './ManagedContentProvider';
import {CMS_DEFAULTS} from '@/data/cmsDefaults';
import HeroMontage from '@/components/site/HeroMontage';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const originalFetch=global.fetch;
let containers,roots,revision,content,failContent;
const tick=async ms=>act(async()=>{jest.advanceTimersByTime(ms);for(let i=0;i<12;i++) await Promise.resolve();});
function Consumer(){const value=useManagedContentSnapshot();return <><p data-revision={value.revisionId}>{value.content?.siteDetails.name}</p><HeroMontage/></>;}
beforeEach(()=>{
  jest.useFakeTimers();revision='r1';content=JSON.parse(JSON.stringify(CMS_DEFAULTS));failContent=false;
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
  Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
  jest.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
  jest.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined);
  jest.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  global.fetch=jest.fn(async(url,options)=>{
    if(url==='/api/content' && failContent) return new Promise(()=>{});
    if(options.headers['If-None-Match']===`"${revision}"`) return {status:304};
    return {ok:true,status:200,json:async()=>({revision_id:revision,published_at:'2026-09-27T10:00:00Z',...(url==='/api/content'?{content}:{})})};
  });
  containers=[0,1].map(()=>{const el=document.createElement('div');document.body.appendChild(el);return el;});
  roots=containers.map(el=>createRoot(el));
});
afterEach(async()=>{await act(async()=>roots.forEach(root=>root.unmount()));containers.forEach(el=>el.remove());jest.restoreAllMocks();jest.useRealTimers();global.fetch=originalFetch;});
const render=()=>act(async()=>roots.forEach(root=>root.render(<MemoryRouter><ManagedContentProvider><Consumer/></ManagedContentProvider></MemoryRouter>)));

test('two public consumers receive a published change without remounting their playing films',async()=>{
  await render();await act(async()=>containers.forEach(el=>el.querySelector('img').dispatchEvent(new Event('load'))));await tick(2000);
  const films=containers.map(el=>el.querySelector('video'));expect(films.every(Boolean)).toBe(true);
  films.forEach(video=>{video.currentTime=12;});
  content.siteDetails.name='Publicare confirmată';revision='r2';await tick(5000);
  containers.forEach((el,i)=>{expect(el.querySelector('p[data-revision]').dataset.revision).toBe('r2');expect(el.textContent).toContain('Publicare confirmată');expect(el.querySelector('video')).toBe(films[i]);expect(films[i].currentTime).toBe(12);});
  const fullFetches=global.fetch.mock.calls.filter(([url])=>url==='/api/content').length;
  await tick(5000);expect(global.fetch.mock.calls.filter(([url])=>url==='/api/content')).toHaveLength(fullFetches);
});
test('a stalled full-content refresh keeps the last publication and later recovers',async()=>{
  await render();revision='r2';content.siteDetails.name='Recovered';failContent=true;
  await tick(5000);await tick(15000);
  expect(containers[0].querySelector('p').dataset.revision).toBe('r1');
  failContent=false;await tick(10000);
  expect(containers[0].querySelector('p').dataset.revision).toBe('r2');
});
