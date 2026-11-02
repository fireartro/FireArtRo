import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { InitialPublicRenderDataProvider, usePublicRenderData } from './PublicRenderData';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('leaving the initial route permanently discards blog bootstrap but retains CMS data', async()=>{
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  function Probe(){const data=usePublicRenderData();const navigate=useNavigate();return <><span data-testid="posts">{data?.posts?.length || 0}</span><span data-testid="revision">{data?.publication?.revision_id}</span><button onClick={()=>navigate('/contact')}>Away</button><button onClick={()=>navigate('/blog')}>Back</button></>;}
  const data={pathname:'/blog',publication:{revision_id:'current'},posts:[{title:'Once published'}]};
  try {
    await act(async()=>root.render(<MemoryRouter initialEntries={['/blog']}><InitialPublicRenderDataProvider value={data}><Probe /></InitialPublicRenderDataProvider></MemoryRouter>));
    expect(host.querySelector('[data-testid="posts"]').textContent).toBe('1');
    await act(async()=>host.querySelectorAll('button')[0].click());
    expect(host.querySelector('[data-testid="posts"]').textContent).toBe('0');
    await act(async()=>host.querySelectorAll('button')[1].click());
    expect(host.querySelector('[data-testid="posts"]').textContent).toBe('0');
    expect(host.querySelector('[data-testid="revision"]').textContent).toBe('current');
  } finally { await act(async()=>root.unmount());host.remove(); }
});
