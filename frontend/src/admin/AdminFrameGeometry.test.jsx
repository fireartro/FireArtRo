import { act } from 'react';
import { createRoot } from 'react-dom/client';
import AdminFrameGeometry from './AdminFrameGeometry';

jest.mock('./AdminDraftContext', () => ({useAdminDraft:()=>({draft:{homePage:{promoSlides:[]}}})}));
jest.mock('@/content/ManagedContentProvider', () => ({DraftPreviewProvider:({children})=>children}));
jest.mock('@/components/night/HomePackages', () => ()=><div data-package-category="Artificii de noapte"/>);
jest.mock('@/components/night/HomeGallery', () => ()=><div/>);

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('measurement cleanup tolerates an iframe document detached during source or frame changes', async()=>{
  const container=document.createElement('div');document.body.append(container);
  const root=createRoot(container);
  await act(async()=>root.render(<AdminFrameGeometry surface="home-packages" target="Artificii de noapte" device="desktop" onRatio={()=>{}}/>));
  const iframe=container.querySelector('iframe');
  await act(async()=>{iframe.dispatchEvent(new Event('load'));});
  const doc=iframe.contentDocument;
  expect(doc.querySelector('[data-package-category]')).toBeTruthy();
  // Removing a real iframe clears its document's defaultView before React's cleanup.
  Object.defineProperty(doc,'defaultView',{configurable:true,get:()=>null});
  await act(async()=>{expect(()=>root.unmount()).not.toThrow();});
  container.remove();
});
