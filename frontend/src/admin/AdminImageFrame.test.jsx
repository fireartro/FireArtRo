import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import AdminImageFrame from './AdminImageFrame';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let container,root,changes;
function Harness(){const [value,setValue]=useState(null);return <><AdminImageFrame src="/image.webp" value={value} onChange={next=>{changes.push(next);setValue(next);}}/><output data-value>{JSON.stringify(value)}</output></>;}
const output=()=>JSON.parse(container.querySelector('[data-value]').textContent);
const button=text=>[...container.querySelectorAll('button')].find(item=>item.textContent === text);
const slide=async(name,value)=>act(async()=>{const input=container.querySelector(`input[aria-label="${name}"]`);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));});
beforeEach(async()=>{changes=[];container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<Harness/>));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});

test('device changes create independent values and resetting phone resumes desktop inheritance',async()=>{
  await slide('Poziție orizontală',20);
  await act(async()=>button('Telefon').click());
  expect(container.querySelector('input[type=checkbox]').checked).toBe(true);
  await slide('Poziție orizontală',75);
  expect(output().desktop.x).toBe(20);expect(output().phone.x).toBe(75);
  await act(async()=>button('Resetează telefon').click());
  expect(output()).not.toHaveProperty('phone');
  expect(container.querySelector('input[aria-label="Poziție orizontală"]').value).toBe('20');
});

test('copying applies the selected frame to all devices and full reset restores defaults',async()=>{
  await act(async()=>button('Tabletă').click());await slide('Mărimea imaginii',1.8);
  await act(async()=>button('Aplică pe toate').click());
  expect(output().desktop.zoom).toBe(1.8);expect(output().phone.zoom).toBe(1.8);
  await act(async()=>container.querySelector('[aria-label="Resetează toate încadrările"]').click());
  expect(output()).toBeNull();
});

test('a drag follows image overflow and creates a single undoable change',async()=>{
  const image=container.querySelector('img');Object.defineProperty(image,'naturalWidth',{value:1000});Object.defineProperty(image,'naturalHeight',{value:500});
  const stage=container.querySelector('.cms-frame-stage');stage.getBoundingClientRect=()=>({width:300,height:300});
  const pointer=(type,x)=>{const event=new Event(type,{bubbles:true});Object.assign(event,{button:0,pointerId:1,clientX:x,clientY:100});stage.dispatchEvent(event);};
  await act(async()=>pointer('pointerdown',100));await act(async()=>pointer('pointermove',130));await act(async()=>pointer('pointermove',160));
  expect(changes).toHaveLength(0);
  await act(async()=>pointer('pointerup',160));
  expect(changes).toHaveLength(1);expect(output().desktop.x).toBe(30);expect(output().desktop.y).toBe(50);
});

test('unavailable source gives a recoverable message rather than a broken crop canvas',async()=>{
  await act(async()=>container.querySelector('img').dispatchEvent(new Event('error')));
  expect(container.querySelector('[role="status"]').textContent).toContain('Imaginea nu poate fi încărcată');
  expect(container.querySelector('.cms-frame-stage')).toBeNull();
});

test('precise custom ratios persist while invalid values stay out of the draft',async()=>{
  const input=[...container.querySelectorAll('input[type=number]')].find(element=>element.closest('label').textContent.includes('Raport lățime'));
  const enter=async value=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
  await enter('1.6');expect(output().desktop.ratio).toBe(1.6);
  await enter('0.2');expect(output().desktop.ratio).toBe(1.6);expect(container.querySelector('[role="alert"]')).not.toBeNull();
});
