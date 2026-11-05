import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
const dir=path.dirname(fileURLToPath(import.meta.url));
await build({absWorkingDir:dir,entryPoints:['viewer.js'],bundle:true,minify:true,outfile:'viewer.bundle.js',legalComments:'inline'});
const license=await fs.readFile(path.join(dir,'../node_modules/three/LICENSE'),'utf8');
await fs.writeFile(path.join(dir,'THREE-LICENSE.txt'),license);
const exporter=await build({absWorkingDir:dir,stdin:{contents:`import {catalog,createPart} from './parts.js';import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
window.exportParts=async()=>{for(const [id] of catalog){const bytes=await new GLTFExporter().parseAsync(createPart(id),{binary:true});await window.savePart(id,await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob([bytes]))}))}}`,resolveDir:dir},bundle:true,write:false});
for(const name of ['models','previews'])await fs.mkdir(path.join(dir,name),{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 await page.exposeFunction('savePart',(id,bytes)=>fs.writeFile(path.join(dir,'models',id+'.glb'),Buffer.from(bytes,'base64')));
 await page.goto(pathToFileURL(path.join(dir,'index.html')).href);await page.addScriptTag({content:exporter.outputFiles[0].text});await page.evaluate(()=>window.exportParts());
 await page.addStyleTag({content:'#stage{width:350px;height:240px}'});for(const button of await page.locator('#grid button').all()){
 const id=await button.getAttribute('data-id');await button.click();await page.locator('#stage canvas').screenshot({path:path.join(dir,'previews',id+'.png')});
 }console.log('Exported 15 GLB files and previews.');
}finally{await browser.close()}
