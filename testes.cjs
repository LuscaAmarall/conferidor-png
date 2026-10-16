const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'conferidor-png.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const core=vm.runInNewContext(script+';PNGTools;');
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures.json'),'utf8'));
const fixture=name=>Buffer.from(fixtures[name],'base64');
let checks=0;function check(name,fn){fn();checks++;process.stdout.write(name+' OK\n')}
check('dimensoes conhecidas',()=>{const h=core.header(fixture('sprites.png'));assert.equal(h.width,96);assert.equal(h.height,48)});
check('entrada corrompida',()=>assert.throws(()=>core.header(fixture('quebrado.png'))));
check('final IEND ausente',()=>{const b=fixture('sprites.png');assert.throws(()=>core.header(b.subarray(0,b.length-12)))});
check('final IEND invalido',()=>{const b=fixture('sprites.png');const tail=Buffer.alloc(13);tail.writeUInt32BE(1,0);tail.write('IEND',4);assert.throws(()=>core.header(Buffer.concat([b.subarray(0,b.length-12),tail])))});
check('duplicata byte a byte',()=>assert(core.equal(fixture('sprites.png'),fixture('sprites-copia.png'))));
check('conteudos diferentes',()=>assert(!core.equal(fixture('sprites.png'),fixture('fundo.png'))));
check('imagens acima do limite',()=>{const b=Buffer.from(fixture('sprites.png'));b.writeUInt32BE(20000000,16);assert.throws(()=>core.header(b))});
check('APNG rejeitado',()=>{const b=fixture('sprites.png');const chunk=Buffer.alloc(20);chunk.writeUInt32BE(8,0);chunk.write('acTL',4);assert.throws(()=>core.header(Buffer.concat([b.subarray(0,33),chunk,b.subarray(33)])))});
const rows=[
 {name:'sprites.png',width:96,height:48,transparent:true},
 {name:'sprites-copia.png',width:96,height:48,transparent:true,duplicate:'sprites.png'},
 {name:'fundo.png',width:96,height:96,transparent:false},
 {name:'tamanho-irregular.png',width:50,height:48,transparent:true},
 {name:'=icone.png',width:48,height:48,transparent:false},
 {name:'quebrado.png',error:'Arquivo não reconhecido como PNG.'}
];
check('pendencias iniciais',()=>assert.equal(rows.filter(r=>core.issues(r,{grid:true,tile:48,alpha:false}).length).length,3));
check('criterio de transparencia',()=>assert.equal(rows.filter(r=>core.issues(r,{grid:true,tile:48,alpha:true}).length).length,5));
check('grade desativada',()=>assert.equal(rows.filter(r=>core.issues(r,{grid:false,alpha:false}).length).length,2));
check('CSV preserva seis registros',()=>assert.equal(core.csv(rows,{grid:true,tile:48,alpha:false}).split('\r\n').filter(Boolean).length,7));
check('CSV neutraliza formulas',()=>assert.equal(core.csvCell('=icone.png'),'"\'=icone.png"'));
check('CSV neutraliza espaco e formula',()=>assert.equal(core.csvCell('  @arquivo.png'),'"\'  @arquivo.png"'));
check('CSV escapa aspas',()=>assert.equal(core.csvCell('a";b.png'),'"a"";b.png"'));
check('sem dependencias de rede',()=>{assert(!/<script[^>]+src=|<link[^>]+href=|\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(html))});
console.log('Total: '+checks+' verificacoes.');
