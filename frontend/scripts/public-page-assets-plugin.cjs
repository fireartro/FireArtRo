const routePages = {
  '/': 'Home', '/pachete': 'PackagesPage', '/galerie': 'GalleryPage',
  '/intrebari-frecvente': 'FaqPage', '/contact': 'ContactPage', '/blog': 'BlogPage',
  '/blog/:slug': 'BlogArticlePage', '/servicii/:slug': 'ServicePage',
  '/confidentialitate': 'LegalPage', '/termeni-si-conditii': 'LegalPage', '/cookies': 'LegalPage',
};

// Use the client compilation's own chunk groups so SSR loads precisely the CSS
// the same lazy route would load, with the existing stylesheet order intact.
class PublicPageAssetsPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('PublicPageAssets', compilation => {
      compilation.hooks.processAssets.tap({name:'PublicPageAssets',stage:compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT},()=>{
        const routes={};
        const routeScripts={};
        for(const group of compilation.chunkGroups) {
          const page = group.origins
            .filter(origin => /[/\\]src[/\\]App\.js$/.test(origin.module?.resource || origin.module?.rootModule?.resource || ''))
            .map(origin=>origin.request?.match(/(?:^|\/)pages\/(\w+)/)?.[1]).find(Boolean);
          if(!page) continue;
          const files=group.getFiles().filter(file=>file.endsWith('.css')).map(file=>`/${file}`);
          const scripts=group.getFiles().filter(file=>file.endsWith('.js')).map(file=>`/${file}`);
          for(const [route,name] of Object.entries(routePages)) if(name===page) {
            routes[route]=files;
            routeScripts[route]=scripts;
          }
        }
        const common=[...compilation.entrypoints.values()].flatMap(entry=>entry.getFiles()).filter(file=>file.endsWith('.css')).map(file=>`/${file}`);
        const inlineStyles = {};
        for (const file of new Set([...common, ...Object.values(routes).flat()])) {
          const asset = compilation.getAsset(file.slice(1));
          if (asset) inlineStyles[file] = asset.source.source().toString();
        }
        compilation.emitAsset('public-page-assets.json',new compiler.webpack.sources.RawSource(JSON.stringify({routes,common,inlineStyles,routeScripts})));
      });
    });
  }
}
module.exports=PublicPageAssetsPlugin;
