(function(){
  var SUPABASE_URL=(window.ULAKASHA_SUPABASE_URL||"").replace(/\/$/,"");
  var SUPABASE_ANON_KEY=window.ULAKASHA_SUPABASE_ANON_KEY||"";
  var PRODUCTS_TABLE=window.ULAKASHA_PRODUCTS_TABLE||"products";
  var BUCKET=window.ULAKASHA_PRODUCT_IMAGES_BUCKET||"product-images";
  var token=localStorage.getItem("ulakasha_admin_token")||"";
  var products=[];
  var dynamicFieldsets={
    "accessorio-tessile":{
      title:"Abitare il corpo · Accessorio tessile",
      fields:[
        ["nome_prodotto","Titolo prodotto","text"],
        ["descrizione","Descrizione","textarea"],
        ["parole_akasha","Le parole dell'Akasha","textarea"],
        ["materiale_cura","Materiale e cura","textarea"],
        ["dimensione_taglia","Dimensione - taglia","text"],
        ["descrizione_tessuto","Descrizione tessuto","textarea"],
        ["composizione","Composizione","textarea"],
        ["colore","Colore","text"],
        ["varianti_colore","Varianti colore","textarea"],
        ["spedizioni_resi","Spedizioni e resi","textarea"]
      ]
    },
    "abbigliamento":{
      title:"Abitare il corpo · Abbigliamento",
      fields:[
        ["nome_prodotto","Nome prodotto","text"],
        ["descrizione","Descrizione","textarea"],
        ["dimensione","Dimensione","text"],
        ["descrizione_tessuto","Descrizione tessuto","textarea"],
        ["composizione","Composizione","textarea"],
        ["variante","Variante","text"],
        ["varianti_colore","Varianti colore","textarea"]
      ]
    },
    "bijoux":{
      title:"Abitare il corpo · Bijoux",
      fields:[
        ["nome_prodotto","Nome prodotto","text"],
        ["descrizione","Descrizione","textarea"],
        ["parole_akasha","Le parole dell'Akasha","textarea"],
        ["materiale_cura","Materiale e cura","textarea"],
        ["dimensione","Dimensione","text"],
        ["composizione","Composizione","textarea"],
        ["colore","Colore","text"],
        ["variante","Variante","text"],
        ["varianti_colore","Varianti colore","textarea"],
        ["spedizioni_resi","Spedizioni e resi","textarea"]
      ]
    },
    "tessile":{
      title:"Abitare la casa · Tessile",
      fields:[
        ["nome_prodotto","Nome prodotto","text"],
        ["descrizione_prodotto","Descrizione prodotto","textarea"],
        ["dimensioni","Dimensioni","text"],
        ["variante","Variante","text"],
        ["varianti_colore","Varianti colore","textarea"],
        ["frasi_akasha","Frasi Akasha","textarea"]
      ]
    },
    "tavola":{
      title:"Abitare la casa · Tavola",
      fields:[
        ["nome_prodotto","Nome prodotto","text"],
        ["descrizione_prodotto","Descrizione prodotto","textarea"],
        ["dimensioni","Dimensioni","text"],
        ["variante","Variante","text"],
        ["frasi_akasha","Frasi Akasha","textarea"],
        ["materiale_cura","Materiale e cura","textarea"],
        ["composizione","Composizione","textarea"],
        ["colore","Colore","text"],
        ["varianti_colore","Varianti colore","textarea"]
      ]
    },
    "bottiglia":{
      title:"Abitare la casa · Tavola · Bottiglie",
      fields:[
        ["nome_prodotto","Nome prodotto","text"],
        ["descrizione_prodotto","Descrizione prodotto","textarea"],
        ["dimensioni","Dimensioni","text"],
        ["variante","Variante","text"],
        ["frasi_akasha","Frasi Akasha","textarea"],
        ["materiale_cura","Materiale e cura","textarea"],
        ["composizione","Composizione","textarea"],
        ["colore","Colore","text"],
        ["varianti_colore","Varianti colore","textarea"]
      ]
    },
    "tazze":{
      title:"Abitare la casa · Tavola · Tazze",
      fields:[
        ["nome_prodotto","Nome prodotto","text"],
        ["descrizione_prodotto","Descrizione prodotto","textarea"],
        ["dimensioni","Dimensioni","text"],
        ["variante","Variante","text"],
        ["frasi_akasha","Frasi Akasha","textarea"],
        ["materiale_cura","Materiale e cura","textarea"],
        ["composizione","Composizione","textarea"],
        ["colore","Colore","text"],
        ["varianti_colore","Varianti colore","textarea"]
      ]
    },
    "arte":{
      title:"Abitare l'arte",
      fields:[
        ["nome_opera","Nome opera","text"],
        ["descrizione","Descrizione opera","textarea"],
        ["parole_akasha","Le parole dell'Akasha","textarea"],
        ["tecnica","Tecnica","textarea"],
        ["dimensioni","Dimensioni","text"],
        ["materiale_cura","Materiale e cura","textarea"],
        ["colore","Colore","text"],
        ["spedizioni_resi","Spedizioni e resi","textarea"]
      ]
    }
  };

  function el(id){return document.getElementById(id);}
  function configured(){return !!(SUPABASE_URL&&SUPABASE_ANON_KEY);}
  function status(id,msg){var e=el(id);if(e)e.textContent=msg||"";}
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
  function lines(value){return (value||"").split(/\n+/).map(function(v){return v.trim();}).filter(Boolean);}
  function csv(value){return (value||"").split(",").map(function(v){return v.trim();}).filter(Boolean);}
  function storageFolderForCategory(category){
    var map={
      "accessorio-tessile":"accessorio tessile",
      "abbigliamento":"abbigliamento",
      "bijoux":"bijoux",
      "tessile":"abitare la casa",
      "tavola":"tavola",
      "bottiglia":"bottiglia",
      "tazze":"tazze",
      "arte":"arte"
    };
    return map[category]||"";
  }
  function normalizeStoragePath(path,category){
    var clean=(path||"").trim().replace(/^\/+/,"");
    if(!clean||/^https?:\/\//i.test(clean))return clean;
    if(clean.indexOf("/")===-1){
      var folder=storageFolderForCategory(category);
      if(folder)clean=folder+"/"+clean;
    }
    return clean;
  }
  function publicObjectUrl(path){return SUPABASE_URL+"/storage/v1/object/public/"+encodeURIComponent(BUCKET)+"/"+path.split("/").map(encodeURIComponent).join("/");}
  function storagePathToUrl(path,category){
    var clean=(path||"").trim().replace(/^\/+/,"");
    if(!clean)return "";
    if(/^https?:\/\//i.test(clean))return clean;
    clean=normalizeStoragePath(clean,category);
    return publicObjectUrl(clean);
  }
  function normalizeImageUrl(value,category){
    var clean=(value||"").trim();
    if(!clean)return "";
    if(/^https?:\/\//i.test(clean))return clean;
    return storagePathToUrl(clean,category);
  }
  function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch];});}

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

  async function listProducts(){
    var res=await fetch(rest(PRODUCTS_TABLE,"?select=*&order=sort_order.asc,slug.asc"),{headers:headers(true)});
    if(!res.ok)throw new Error("Non riesco a leggere i prodotti");
    products=await res.json();
    renderList();
  }

  function renderList(){
    var box=el("admin-product-list");
    if(!box)return;
    if(!products.length){box.innerHTML='<p class="admin-empty">Nessun prodotto ancora.</p>';return;}
    box.innerHTML=products.map(function(p){
      var name=(p.nome&&p.nome.it)||p.name_it||p.slug||p.id;
      return '<button type="button" class="admin-product-row" data-id="'+String(p.id).replace(/"/g,"&quot;")+'"><strong>'+name+'</strong><span>'+((p.categoria||"").toString())+(p.active?"":" · nascosto")+'</span></button>';
    }).join("");
  }

  function renderDynamicFields(category,values,labels){
    var config=dynamicFieldsets[category]||dynamicFieldsets.abbigliamento;
    var title=el("dynamic-title"),box=el("dynamic-fields");
    if(title)title.textContent=config.title;
    if(!box)return;
    values=values||{};
    labels=labels||{};
    box.innerHTML=config.fields.map(function(field){
      var key=field[0],label=escapeHtml(labels[key]||field[1]),type=field[2],value=escapeHtml(values[key]||"");
      var labelInput='<span class="dynamic-label-row"><span>Nome campo</span><input class="dynamic-label-input" data-label-key="'+key+'" type="text" value="'+label+'"></span>';
      if(type==="textarea"){
        return '<label><span class="dynamic-current-label">'+label+'</span>'+labelInput+'<textarea class="dynamic-input" data-detail-key="'+key+'" rows="4">'+value+'</textarea></label>';
      }
      return '<label><span class="dynamic-current-label">'+label+'</span>'+labelInput+'<input class="dynamic-input" data-detail-key="'+key+'" type="text" value="'+value+'"></label>';
    }).join("");
  }

  function collectDynamicDetails(){
    var details={};
    var inputs=document.querySelectorAll(".dynamic-input");
    for(var i=0;i<inputs.length;i++){
      var key=inputs[i].getAttribute("data-detail-key");
      if(key)details[key]=inputs[i].value.trim();
    }
    return details;
  }

  function collectDynamicLabels(){
    var labels={};
    var inputs=document.querySelectorAll(".dynamic-label-input");
    for(var i=0;i<inputs.length;i++){
      var key=inputs[i].getAttribute("data-label-key");
      if(key)labels[key]=inputs[i].value.trim();
    }
    return labels;
  }

  function detailTitle(details,category){
    details=details||{};
    return details.nome_prodotto||details.nome_opera||details.descrizione||details.descrizione_prodotto||category||"prodotto";
  }

  function buildSlugSource(details,category){
    details=details||{};
    var title=detailTitle(details,category);
    var parts=[title];
    if(!title||title===category||title==="prodotto"){
      parts=[category,details.dimensione_taglia||details.dimensione||details.dimensioni,details.variante||details.colore||Date.now()];
    }else{
      parts.push(details.variante||details.colore||"");
    }
    return parts.filter(Boolean).join(" ");
  }

  function syncSizeFromDetails(details){
    details=details||{};
    var size=details.dimensione_taglia||details.dimensione||details.dimensioni||"";
    if(size&&!el("product-sizes").value.trim())el("product-sizes").value=size;
  }

  function showPanel(){
    document.body.classList.remove("admin-locked");
    el("admin-login-panel").hidden=true;
    el("admin-panel").hidden=false;
    el("admin-panel").style.display="";
    listProducts().catch(function(err){status("admin-product-status",err.message);});
  }

  function showLogin(){
    document.body.classList.add("admin-locked");
    el("admin-login-panel").hidden=false;
    el("admin-panel").hidden=true;
    el("admin-panel").style.display="none";
  }

  function clearForm(){
    el("admin-form-title").textContent="Nuovo prodotto";
    el("product-id").value="";
    el("product-slug").value="";
    el("product-sort").value="100";
    el("product-category").value="abbigliamento";
    el("product-active").checked=true;
    el("product-hide-price").checked=false;
    ["price","sizes","badge","stripe","images"].forEach(function(id){
      var node=el("product-"+id);
      if(node)node.value=id==="price"?"0":"";
    });
    el("product-storage-paths").value="";
    renderDynamicFields(el("product-category").value,{},{});
    status("admin-product-status","");
  }

  function fillForm(product){
    el("admin-form-title").textContent="Modifica prodotto";
    el("product-id").value=product.id||"";
    el("product-slug").value=product.slug||"";
    el("product-sort").value=product.sort_order||100;
    el("product-category").value=product.categoria||"abbigliamento";
    el("product-active").checked=product.active!==false;
    var details=product.details||{};
    el("product-hide-price").checked=product.hide_price===true||details.nascondi_prezzo===true||details.nascondi_prezzo==="true"||details.nascondi_prezzo==="1";
    el("product-price").value=product.prezzo||0;
    el("product-sizes").value=(product.taglie||[]).join(", ");
    el("product-badge").value=product.badge||"";
    el("product-stripe").value=product.stripe_link||"";
    el("product-images").value=(product.foto||[]).join("\n");
    el("product-storage-paths").value="";
    renderDynamicFields(el("product-category").value,product.details||{},product.details_labels||{});
  }

  function generateStorageUrls(){
    var category=el("product-category").value;
    var generated=lines(el("product-storage-paths").value).map(function(path){return storagePathToUrl(path,category);}).filter(Boolean);
    if(!generated.length){
      status("admin-product-status","Inserisci almeno un nome file o percorso Storage.");
      return;
    }
    var existing=lines(el("product-images").value);
    var merged=existing.concat(generated).filter(function(url,index,list){return list.indexOf(url)===index;});
    el("product-images").value=merged.join("\n");
    status("admin-product-status","URL immagini generati. Ora salva il prodotto.");
  }

  async function findProductBySlug(slug){
    var res=await fetch(rest(PRODUCTS_TABLE,"?select=*&slug=eq."+encodeURIComponent(slug)+"&limit=1"),{headers:headers(true)});
    if(!res.ok)return null;
    var data=await res.json();
    return data&&data[0]?data[0]:null;
  }

  async function saveProduct(e){
    e.preventDefault();
    status("admin-product-status","Salvataggio...");
    try{
      if(!configured())throw new Error("Configura Supabase in supabase-config.js");
      var details=collectDynamicDetails();
      var detailsLabels=collectDynamicLabels();
      if(el("product-hide-price").checked)details.nascondi_prezzo="true";
      else delete details.nascondi_prezzo;
      syncSizeFromDetails(details);
      var category=el("product-category").value;
      var urls=lines(el("product-images").value).map(function(url){return normalizeImageUrl(url,category);}).filter(Boolean);
      var slug=slugify(el("product-slug").value||buildSlugSource(details,category));
      if(!slug)slug=category+"-"+Date.now();
      var id=el("product-id").value||undefined;
      if(!id){
        var existingProduct=await findProductBySlug(slug);
        if(existingProduct&&existingProduct.id)id=existingProduct.id;
      }
      var payload={
        slug:slug,
        sort_order:Number(el("product-sort").value||100),
        active:el("product-active").checked,
        categoria:category,
        prezzo:Number(el("product-price").value||0),
        taglie:csv(el("product-sizes").value),
        badge:el("product-badge").value.trim(),
        badge_class:"",
        foto:urls,
        details:details,
        details_labels:detailsLabels,
        stripe_link:el("product-stripe").value.trim()
      };
      var url=id?rest(PRODUCTS_TABLE,"?id=eq."+encodeURIComponent(id)):rest(PRODUCTS_TABLE,"?on_conflict=slug");
      var method=id?"PATCH":"POST";
      var prefer=id?"return=representation":"resolution=merge-duplicates,return=representation";
      var res=await fetch(url,{
        method:method,
        headers:headers(true,{"Content-Type":"application/json","Prefer":prefer}),
        body:JSON.stringify(payload)
      });
      if(!res.ok){
        var saveDetail="";
        try{saveDetail=await res.text();}catch(e){}
        throw new Error("Salvataggio prodotto non riuscito"+(saveDetail?": "+saveDetail:""));
      }
      var saved=await res.json();
      status("admin-product-status","Prodotto salvato.");
      if(saved&&saved[0])fillForm(saved[0]);
      await listProducts();
    }catch(err){
      status("admin-product-status",err.message);
    }
  }

  async function deleteProduct(){
    var id=el("product-id").value;
    if(!id)return status("admin-product-status","Seleziona un prodotto da eliminare.");
    if(!confirm("Eliminare questo prodotto?"))return;
    status("admin-product-status","Eliminazione...");
    try{
      var res=await fetch(rest(PRODUCTS_TABLE,"?id=eq."+encodeURIComponent(id)),{method:"DELETE",headers:headers(true)});
      if(!res.ok)throw new Error("Eliminazione non riuscita");
      clearForm();
      await listProducts();
      status("admin-product-status","Prodotto eliminato.");
    }catch(err){
      status("admin-product-status",err.message);
    }
  }

  document.addEventListener("DOMContentLoaded",function(){
    showLogin();
    if(!configured())status("admin-login-status","Configura Supabase in supabase-config.js prima di usare l'admin.");
    el("admin-login-form").addEventListener("submit",async function(e){
      e.preventDefault();
      status("admin-login-status","Accesso...");
      try{await signIn(el("admin-email").value,el("admin-password").value);showPanel();}
      catch(err){status("admin-login-status",err.message);}
    });
    el("admin-product-form").addEventListener("submit",saveProduct);
    el("product-category").addEventListener("change",function(){renderDynamicFields(this.value,{},{});});
    el("admin-generate-urls").addEventListener("click",generateStorageUrls);
    el("admin-new-product").addEventListener("click",clearForm);
    el("admin-delete-product").addEventListener("click",deleteProduct);
    el("admin-logout").addEventListener("click",function(){localStorage.removeItem("ulakasha_admin_token");location.reload();});
    el("admin-product-list").addEventListener("click",function(e){
      var btn=e.target.closest(".admin-product-row");
      if(!btn)return;
      var product=products.find(function(p){return String(p.id)===btn.dataset.id;});
      if(product)fillForm(product);
    });
    if(token&&configured()){
      status("admin-login-status","Controllo sessione...");
      validateSession().then(function(ok){
        if(ok)showPanel();
        else{showLogin();status("admin-login-status","Sessione scaduta. Accedi di nuovo.");}
      }).catch(function(){
        showLogin();
        status("admin-login-status","Sessione scaduta. Accedi di nuovo.");
      });
    }
    renderDynamicFields(el("product-category").value,{},{});
  });
})();
