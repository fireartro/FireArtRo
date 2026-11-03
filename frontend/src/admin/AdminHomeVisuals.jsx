import { useState } from 'react';
import { useAdminDraft } from './AdminDraftContext';
import AdminImageFrame from './AdminImageFrame';
import AdminMediaPicker from './AdminMediaPicker';
import { buildCategoryRanges, getCategoryLabel } from '@/lib/categoryNavigation';
import { HOME_PACKAGE_IMAGE_IDS } from '@/lib/homeMediaSelection';
import catalogue from '@/data/importedGalleryItems.json';

export default function AdminHomeVisuals() {
  const {draft,update}=useAdminDraft();
  const categories=buildCategoryRanges(draft.packages,{includeDroneRequest:true}).map(item=>item.category);
  const [selected,setSelected]=useState(categories[0]);
  const category=categories.includes(selected) ? selected : categories[0];
  const entries=draft.homePage.packageVisuals || [];
  const placement=entries.find(item=>item.category === category);
  const mediaId=placement?.mediaId || HOME_PACKAGE_IMAGE_IDS[category] || draft.packages.find(item=>item.category === category)?.imageMediaId || '';
  const media=draft.mediaItems.find(item=>item.id === mediaId) || catalogue.find(item=>item.id === mediaId);
  const change = next => update('homePage.packageVisuals',next ? [...entries.filter(item=>item.category !== category),{category,...next}] : entries.filter(item=>item.category !== category));
  const repeated=entries.filter(item=>item.mediaId === mediaId).length>1;
  return <section className="cms-home-visuals"><header><div><h2>Imaginile categoriilor de pe prima pagină</h2><p>Alegi poza și încadrarea fiecărui chenar din secțiunea Pachete.</p></div></header>
    <nav className="cms-visual-categories" aria-label="Categoria de imagine">{categories.map(item=><button key={item} type="button" aria-pressed={item === category} onClick={()=>setSelected(item)}>{getCategoryLabel(item)}</button>)}</nav>
    <div className="cms-home-visuals__selection"><AdminMediaPicker label={`Imagine ${getCategoryLabel(category)}`} value={mediaId} items={draft.mediaItems} imageOnly clearable={false} onChange={id=>change(id ? {mediaId:id,imageFrame:placement?.imageFrame} : null)}/>
      {placement && <button type="button" className="admin-button" onClick={()=>change(null)}>Revino la imaginea inițială</button>}</div>
    {repeated && <p className="cms-inline-warning" role="status">Această imagine este aleasă și la altă categorie. Selecția ta rămâne păstrată.</p>}
    <AdminImageFrame src={media?.src} value={placement?.imageFrame} surface="home-packages" target={category} onChange={imageFrame=>{
      if(draft.mediaItems.some(item=>item.id === mediaId)) change({mediaId,imageFrame});
    }}/>
    {media && !draft.mediaItems.some(item=>item.id === mediaId) && <p className="cms-inline-warning">Imaginea inițială aparține catalogului. Alege un material din bibliotecă pentru reglaje personalizate.</p>}
  </section>;
}
