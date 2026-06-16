(function(){
  var SUPABASE_URL=(window.ULAKASHA_SUPABASE_URL||"").replace(/\/$/,"");
  var SUPABASE_ANON_KEY=window.ULAKASHA_SUPABASE_ANON_KEY||"";
  var PRODUCTS_TABLE=window.ULAKASHA_PRODUCTS_TABLE||"products";
  var BUCKET=window.ULAKASHA_PRODUCT_IMAGES_BUCKET||"product-images";
  var token=localStorage.getItem("ulakasha_admin_token")||"";
  var products=[];

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
  function publicObjectUrl(path){return SUPABASE_URL+"/storage/v1/object/public/"+encodeURIComponent(BUCKET)+"/"+path.split("/").map(encodeURIComponent).join("/");}

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
    ["name-it","name-en","sub-it","sub-en","material-it","material-en","story-it","story-en","price","sizes","badge","stripe","images"].forEach(function(id){
      var node=el("product-"+id);
      if(node)node.value=id==="price"?"0":"";
    });
    el("product-image-file").value="";
    status("admin-product-status","");
  }

  function fillForm(product){
    el("admin-form-title").textContent="Modifica prodotto";
    el("product-id").value=product.id||"";
    el("product-slug").value=product.slug||"";
    el("product-sort").value=product.sort_order||100;
    el("product-category").value=product.categoria||"body";
    el("product-active").checked=product.active!==false;
    el("product-name-it").value=(product.nome&&product.nome.it)||product.name_it||"";
    el("product-name-en").value=(product.nome&&product.nome.en)||product.name_en||"";
    el("product-sub-it").value=(product.sottotitolo&&product.sottotitolo.it)||"";
    el("product-sub-en").value=(product.sottotitolo&&product.sottotitolo.en)||"";
    el("product-material-it").value=(product.materiale&&product.materiale.it)||"";
    el("product-material-en").value=(product.materiale&&product.materiale.en)||"";
    el("product-story-it").value=(product.storia&&product.storia.it)||"";
    el("product-story-en").value=(product.storia&&product.storia.en)||"";
    el("product-price").value=product.prezzo||0;
    el("product-sizes").value=(product.taglie||[]).join(", ");
    el("product-badge").value=product.badge||"";
    el("product-stripe").value=product.stripe_link||"";
    el("product-images").value=(product.foto||[]).join("\n");
    el("product-image-file").value="";
  }

  async function uploadImage(file,slug){
    if(!file)return "";
    var safeSlug=slugify(slug)||"prodotto";
    var ext=(file.name.split(".").pop()||"jpg").toLowerCase();
    var objectPath=safeSlug+"/"+Date.now()+"."+ext;
    var res=await fetch(SUPABASE_URL+"/storage/v1/object/"+encodeURIComponent(BUCKET)+"/"+objectPath,{
      method:"POST",
      headers:headers(true,{"Content-Type":file.type||"application/octet-stream","x-upsert":"true"}),
      body:file
    });
    if(!res.ok)throw new Error("Upload immagine non riuscito");
    return publicObjectUrl(objectPath);
  }

  async function saveProduct(e){
    e.preventDefault();
    status("admin-product-status","Salvataggio...");
    try{
      if(!configured())throw new Error("Configura Supabase in supabase-config.js");
      var slug=slugify(el("product-slug").value||el("product-name-it").value);
      var file=el("product-image-file").files[0];
      var urls=lines(el("product-images").value);
      var uploaded=await uploadImage(file,slug);
      if(uploaded)urls.unshift(uploaded);
      var id=el("product-id").value||undefined;
      var payload={
        slug:slug,
        sort_order:Number(el("product-sort").value||100),
        active:el("product-active").checked,
        categoria:el("product-category").value,
        nome:{it:el("product-name-it").value.trim(),en:el("product-name-en").value.trim()},
        sottotitolo:{it:el("product-sub-it").value.trim(),en:el("product-sub-en").value.trim()},
        materiale:{it:el("product-material-it").value.trim(),en:el("product-material-en").value.trim()},
        storia:{it:el("product-story-it").value.trim(),en:el("product-story-en").value.trim()},
        prezzo:Number(el("product-price").value||0),
        taglie:csv(el("product-sizes").value),
        badge:el("product-badge").value.trim(),
        badge_class:"",
        foto:urls,
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
      if(!res.ok)throw new Error("Salvataggio prodotto non riuscito");
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
  });
})();
