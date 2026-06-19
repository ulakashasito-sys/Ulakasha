(function(){
  var SUPABASE_URL=(window.ULAKASHA_SUPABASE_URL||"").replace(/\/$/,"");
  var SUPABASE_ANON_KEY=window.ULAKASHA_SUPABASE_ANON_KEY||"";
  var PRODUCTS_TABLE=window.ULAKASHA_PRODUCTS_TABLE||"products";
  var BUCKET=window.ULAKASHA_PRODUCT_IMAGES_BUCKET||"product-images";
  var token=localStorage.getItem("ulakasha_admin_token")||"";
  var lastPreview=[];

  var knownColumns={
    categoria:1,category:1,categoria_shop:1,sottocategoria:1,slug:1,ordine:1,sort_order:1,active:1,visibile:1,
    prezzo:1,price:1,taglie:1,sizes:1,badge:1,immagini:1,foto:1,images:1,url_immagini:1,
    link_checkout:1,stripe_link:1,shopify:1,checkout:1,nome:1,nome_prodotto:1,titolo:1,nome_opera:1
  };

  var keyAliases={
    "nome prodotto":"nome_prodotto",
    "titolo prodotto":"nome_prodotto",
    "nome opera":"nome_opera",
    "descrizione prodotto":"descrizione_prodotto",
    "le parole del akasha":"parole_akasha",
    "le parole dell akasha":"parole_akasha",
    "le parole dell'akasha":"parole_akasha",
    "parole akasha":"parole_akasha",
    "frasi akasha":"frasi_akasha",
    "materiale e cura":"materiale_cura",
    "dimensione taglia":"dimensione_taglia",
    "dimensione - taglia":"dimensione_taglia",
    "descrizione tessuto":"descrizione_tessuto",
    "spedizioni e resi":"spedizioni_resi",
    "link checkout":"link_checkout",
    "url immagini":"url_immagini"
  };

  function el(id){return document.getElementById(id);}
  function configured(){return !!(SUPABASE_URL&&SUPABASE_ANON_KEY);}
  function status(msg){var e=el("import-status");if(e)e.textContent=msg||"";}
  function headers(auth,extra){
    var h={"apikey":SUPABASE_ANON_KEY,"Accept":"application/json"};
    h.Authorization="Bearer "+(auth?token:SUPABASE_ANON_KEY);
    if(extra){Object.keys(extra).forEach(function(k){h[k]=extra[k];});}
    return h;
  }
  function rest(table,query){return SUPABASE_URL+"/rest/v1/"+encodeURIComponent(table)+(query||"");}
  function slugify(value){
    return (value||"").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  }
  function normalizeHeader(value){
    var clean=(value||"").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'");
    if(keyAliases[clean])return keyAliases[clean];
    return clean.replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }
  function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch];});}
  function splitList(value){
    return String(value||"").split(/\n|;|,/).map(function(v){return v.trim();}).filter(Boolean);
  }
  function csv(value){return splitList(value);}
  function publicObjectUrl(path){
    var clean=String(path||"").trim().replace(/^\/+/,"");
    if(!clean)return "";
    if(/^https?:\/\//i.test(clean))return clean;
    return SUPABASE_URL+"/storage/v1/object/public/"+encodeURIComponent(BUCKET)+"/"+clean.split("/").map(encodeURIComponent).join("/");
  }
  function parseDelimited(text){
    text=String(text||"").replace(/\r\n/g,"\n").replace(/\r/g,"\n").trim();
    if(!text)return [];
    var delimiter=text.indexOf("\t")!==-1?"\t":",";
    var rows=[],row=[],cell="",quoted=false;
    for(var i=0;i<text.length;i++){
      var ch=text[i],next=text[i+1];
      if(ch==='"'){
        if(quoted&&next==='"'){cell+='"';i++;}
        else quoted=!quoted;
      }else if(ch===delimiter&&!quoted){
        row.push(cell);cell="";
      }else if(ch==="\n"&&!quoted){
        row.push(cell);rows.push(row);row=[];cell="";
      }else{
        cell+=ch;
      }
    }
    row.push(cell);rows.push(row);
    return rows.filter(function(r){return r.some(function(c){return String(c||"").trim();});});
  }
  function rowValue(row){
    for(var i=1;i<arguments.length;i++){
      var key=arguments[i];
      if(row[key]!==undefined&&String(row[key]).trim()!=="")return String(row[key]).trim();
    }
    return "";
  }
  function normalizeCategory(value){
    var raw=String(value||"").trim().toLowerCase();
    var slug=slugify(raw);
    if(slug.indexOf("accessorio")!==-1)return "accessorio-tessile";
    if(slug.indexOf("abbigliamento")!==-1||slug.indexOf("abito")!==-1||slug.indexOf("corpo")!==-1)return "abbigliamento";
    if(slug.indexOf("bijoux")!==-1||slug.indexOf("gioi")!==-1)return "bijoux";
    if(slug.indexOf("bott")!==-1)return "bottiglia";
    if(slug.indexOf("tazz")!==-1||slug.indexOf("cup")!==-1)return "tazze";
    if(slug.indexOf("tavola")!==-1||slug.indexOf("table")!==-1)return "tavola";
    if(slug.indexOf("tessile")!==-1||slug.indexOf("casa")!==-1||slug.indexOf("home")!==-1)return "tessile";
    if(slug.indexOf("arte")!==-1||slug.indexOf("opera")!==-1||slug.indexOf("poster")!==-1)return "arte";
    return slug||"abbigliamento";
  }
  function normalizeBool(value){
    var v=String(value||"").trim().toLowerCase();
    if(!v)return true;
    return !(/^(no|false|0|nascosto|non visibile)$/i.test(v));
  }
  function tableRowsToObjects(rows){
    if(rows.length<2)return [];
    var headers=rows[0].map(normalizeHeader);
    return rows.slice(1).map(function(cols){
      var obj={};
      for(var i=0;i<headers.length;i++)obj[headers[i]]=cols[i]!==undefined?String(cols[i]).trim():"";
      return obj;
    });
  }
  function makeProduct(row,index){
    var category=normalizeCategory(rowValue(row,"categoria","category","categoria_shop","sottocategoria"));
    var title=rowValue(row,"nome_prodotto","nome","titolo","nome_opera")||category+" "+(index+1);
    var details={},labels={};
    Object.keys(row).forEach(function(key){
      var value=String(row[key]||"").trim();
      if(!value)return;
      if(knownColumns[key])return;
      details[key]=value;
      labels[key]=key.replace(/_/g," ").replace(/\b\w/g,function(ch){return ch.toUpperCase();});
    });
    if(category==="arte")details.nome_opera=rowValue(row,"nome_opera","nome_prodotto","nome","titolo")||title;
    else details.nome_prodotto=title;
    ["descrizione","descrizione_prodotto","parole_akasha","frasi_akasha","materiale_cura","dimensione_taglia","dimensione","dimensioni","descrizione_tessuto","composizione","colore","variante","spedizioni_resi","tecnica"].forEach(function(key){
      var value=rowValue(row,key);
      if(value)details[key]=value;
    });
    var images=splitList(rowValue(row,"immagini","foto","images","url_immagini")).map(publicObjectUrl).filter(Boolean);
    var slug=slugify(rowValue(row,"slug")||title);
    if(!slug)slug=category+"-"+Date.now()+"-"+index;
    return {
      slug:slug,
      sort_order:Number(rowValue(row,"ordine","sort_order")||((index+1)*10)),
      active:normalizeBool(rowValue(row,"active","visibile")),
      categoria:category,
      prezzo:Number(String(rowValue(row,"prezzo","price")||"0").replace(",", "."))||0,
      taglie:csv(rowValue(row,"taglie","sizes")),
      badge:rowValue(row,"badge"),
      badge_class:"",
      foto:images,
      details:details,
      details_labels:labels,
      stripe_link:rowValue(row,"link_checkout","stripe_link","shopify","checkout")
    };
  }
  function parseProducts(){
    var rows=parseDelimited(el("import-raw").value);
    var objects=tableRowsToObjects(rows);
    return objects.map(makeProduct);
  }
  function renderPreview(products){
    lastPreview=products;
    var box=el("import-preview-box");
    if(!box)return;
    if(!products.length){
      box.hidden=false;
      box.innerHTML='<p class="admin-empty">Nessun prodotto letto. Controlla che la prima riga contenga le intestazioni.</p>';
      return;
    }
    box.hidden=false;
    box.innerHTML='<h3>Anteprima: '+products.length+' prodotti</h3><div class="import-table"><table><thead><tr><th>Categoria</th><th>Slug</th><th>Nome</th><th>Foto</th></tr></thead><tbody>'+products.map(function(p){
      var name=p.details.nome_prodotto||p.details.nome_opera||p.slug;
      return '<tr><td>'+escapeHtml(p.categoria)+'</td><td>'+escapeHtml(p.slug)+'</td><td>'+escapeHtml(name)+'</td><td>'+p.foto.length+'</td></tr>';
    }).join("")+'</tbody></table></div>';
  }
  async function signIn(email,password){
    var res=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{
      method:"POST",
      headers:headers(false,{"Content-Type":"application/json"}),
      body:JSON.stringify({email:email,password:password})
    });
    if(!res.ok){
      var error={};
      try{error=await res.json();}catch(e){}
      throw new Error(error.msg||error.message||"Login non riuscito");
    }
    var data=await res.json();
    token=data.access_token;
    localStorage.setItem("ulakasha_admin_token",token);
  }
  async function validateSession(){
    if(!token||!configured())return false;
    var res=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:headers(true)});
    if(res.ok)return true;
    token="";
    localStorage.removeItem("ulakasha_admin_token");
    return false;
  }
  function showPanel(){
    document.body.classList.remove("admin-locked");
    el("import-login-panel").hidden=true;
    el("import-panel").hidden=false;
    el("import-panel").style.display="";
  }
  function showLogin(){
    document.body.classList.add("admin-locked");
    el("import-login-panel").hidden=false;
    el("import-panel").hidden=true;
    el("import-panel").style.display="none";
  }
  async function upsertProduct(product){
    var res=await fetch(rest(PRODUCTS_TABLE,"?on_conflict=slug"),{
      method:"POST",
      headers:headers(true,{"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"}),
      body:JSON.stringify(product)
    });
    if(!res.ok){
      var detail="";
      try{detail=await res.text();}catch(e){}
      throw new Error(product.slug+": "+detail);
    }
  }
  async function runImport(){
    var products=lastPreview.length?lastPreview:parseProducts();
    renderPreview(products);
    if(!products.length)return status("Nessun prodotto da importare.");
    status("Import in corso...");
    var ok=0;
    try{
      for(var i=0;i<products.length;i++){
        await upsertProduct(products[i]);
        ok++;
        status("Importati "+ok+" / "+products.length+" prodotti...");
      }
      status("Import completato: "+ok+" prodotti salvati.");
    }catch(err){
      status("Import interrotto dopo "+ok+" prodotti. "+err.message);
    }
  }
  function insertSample(){
    el("import-raw").value=[
      "categoria\tslug\tnome_prodotto\tdescrizione\tprezzo\ttaglie\timmagini",
      "accessorio-tessile\tfoulard-garofano-blu\tFoulard a rombo stampa Garofano\tDescrizione del foulard\t0\tTaglia unica\tabitare-il-corpo/accessorio-tessile/foulard-garofano-blu/01.jpg; abitare-il-corpo/accessorio-tessile/foulard-garofano-blu/02.jpg",
      "arte\topera-order-reversed\tThe order is reversed\tOpera originale Ulakasha\t0\t\tabitare-arte/opera-order-reversed/01.jpg; abitare-arte/opera-order-reversed/02.jpg"
    ].join("\n");
    renderPreview(parseProducts());
  }
  document.addEventListener("DOMContentLoaded",function(){
    showLogin();
    if(!configured())status("Configura Supabase in supabase-config.js prima di usare l'import.");
    el("import-login-form").addEventListener("submit",async function(e){
      e.preventDefault();
      status("Accesso...");
      try{await signIn(el("import-email").value,el("import-password").value);showPanel();status("");}
      catch(err){status(err.message);}
    });
    el("import-preview").addEventListener("click",function(){renderPreview(parseProducts());status("Anteprima aggiornata.");});
    el("import-run").addEventListener("click",runImport);
    el("import-sample").addEventListener("click",insertSample);
    el("import-clear").addEventListener("click",function(){el("import-raw").value="";lastPreview=[];el("import-preview-box").hidden=true;status("");});
    if(token&&configured()){
      validateSession().then(function(ok){if(ok)showPanel();else showLogin();}).catch(showLogin);
    }
  });
})();
