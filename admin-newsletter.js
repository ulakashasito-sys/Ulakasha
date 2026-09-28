(function(){
  var SUPABASE_URL=(window.ULAKASHA_SUPABASE_URL||"").replace(/\/$/,"");
  var SUPABASE_ANON_KEY=window.ULAKASHA_SUPABASE_ANON_KEY||"";
  var NEWSLETTER_TABLE=window.ULAKASHA_NEWSLETTER_TABLE||"newsletter_subscribers";
  var TOKEN_KEY="ulakasha_admin_token";
  var token=localStorage.getItem(TOKEN_KEY)||"";
  var subscribers=[];

  function el(id){return document.getElementById(id);}
  function configured(){return !!(SUPABASE_URL&&SUPABASE_ANON_KEY);}
  function status(id,msg){var node=el(id);if(node)node.textContent=msg||"";}
  function headers(auth,extra){
    var h={"apikey":SUPABASE_ANON_KEY,"Accept":"application/json"};
    h.Authorization="Bearer "+(auth?token:SUPABASE_ANON_KEY);
    if(extra){Object.keys(extra).forEach(function(key){h[key]=extra[key];});}
    return h;
  }
  function rest(table,query){
    return SUPABASE_URL+"/rest/v1/"+encodeURIComponent(table)+(query||"");
  }
  function escapeHtml(value){
    return String(value||"").replace(/[&<>"']/g,function(ch){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch];
    });
  }
  function dateTimeLabel(value){
    if(!value)return "";
    var date=new Date(value);
    if(isNaN(date.getTime()))return value;
    return date.toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"});
  }
  function dateFileStamp(){
    return new Date().toISOString().slice(0,10);
  }
  function emptyLabel(value){
    return value?""+value:"Non indicato";
  }
  function consentLabel(value){
    return value?"Si":"No";
  }
  function newsletterLanguageLabel(value){
    if(value==="en")return "Inglese";
    if(value==="it")return "Italiano";
    return emptyLabel(value);
  }
  function downloadBlob(content,type,filename){
    var blob=content instanceof Blob?content:new Blob([content],{type:type});
    var url=URL.createObjectURL(blob);
    var link=document.createElement("a");
    link.href=url;
    link.download=filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(function(){
      URL.revokeObjectURL(url);
      link.remove();
    },250);
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
    localStorage.setItem(TOKEN_KEY,token);
  }

  async function validateSession(){
    if(!token||!configured())return false;
    var res=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:headers(true)});
    if(res.ok)return true;
    token="";
    localStorage.removeItem(TOKEN_KEY);
    return false;
  }

  function showPanel(){
    document.body.classList.remove("admin-locked");
    el("newsletter-login-panel").hidden=true;
    el("newsletter-login-panel").style.display="none";
    el("newsletter-admin-panel").hidden=false;
    el("newsletter-admin-panel").style.display="";
    listSubscribers().catch(function(err){status("newsletter-status",err.message);});
  }

  function showLogin(){
    document.body.classList.add("admin-locked");
    el("newsletter-login-panel").hidden=false;
    el("newsletter-login-panel").style.display="";
    el("newsletter-admin-panel").hidden=true;
    el("newsletter-admin-panel").style.display="none";
  }

  function newsletterQuery(){
    var params=[
      "select=created_at,name,email,phone,newsletter_language,site_language,consent,message,page_url,source",
      "order=created_at.desc"
    ];
    var from=el("newsletter-date-from")?el("newsletter-date-from").value:"";
    var to=el("newsletter-date-to")?el("newsletter-date-to").value:"";
    if(from)params.push("created_at=gte."+encodeURIComponent(from+"T00:00:00"));
    if(to)params.push("created_at=lte."+encodeURIComponent(to+"T23:59:59"));
    return "?"+params.join("&");
  }

  async function listSubscribers(){
    status("newsletter-status","Caricamento iscritti...");
    var res=await fetch(rest(NEWSLETTER_TABLE,newsletterQuery()),{headers:headers(true)});
    if(!res.ok){
      var detail="";
      try{detail=await res.text();}catch(e){}
      throw new Error("Non riesco a leggere gli iscritti newsletter"+(detail?": "+detail:""));
    }
    subscribers=await res.json();
    renderSubscribers();
    status("newsletter-status",subscribers.length?("Iscritti caricati: "+subscribers.length):"Nessun iscritto nel periodo selezionato.");
  }

  function renderSubscribers(){
    var body=el("newsletter-table-body");
    var summary=el("newsletter-summary");
    if(summary){
      var first=subscribers[subscribers.length-1];
      var last=subscribers[0];
      summary.textContent=subscribers.length
        ? subscribers.length+" iscritti visualizzati - dal "+dateTimeLabel(first.created_at)+" al "+dateTimeLabel(last.created_at)
        : "Nessun iscritto visualizzato.";
    }
    if(!body)return;
    if(!subscribers.length){
      body.innerHTML='<tr><td colspan="7">Nessun iscritto nel periodo selezionato.</td></tr>';
      return;
    }
    body.innerHTML=subscribers.map(function(item){
      var email=item.email||"";
      return '<tr>'+
        '<td>'+escapeHtml(dateTimeLabel(item.created_at))+'</td>'+
        '<td>'+escapeHtml(emptyLabel(item.name))+'</td>'+
        '<td><a href="mailto:'+encodeURIComponent(email)+'">'+escapeHtml(email)+'</a></td>'+
        '<td>'+escapeHtml(emptyLabel(item.phone))+'</td>'+
        '<td>'+escapeHtml(newsletterLanguageLabel(item.newsletter_language))+'</td>'+
        '<td>'+escapeHtml(consentLabel(item.consent))+'</td>'+
        '<td>'+escapeHtml(item.message||"")+'</td>'+
      '</tr>';
    }).join("");
  }

  function applyPreset(){
    var preset=el("newsletter-range-preset").value;
    var from=el("newsletter-date-from");
    var to=el("newsletter-date-to");
    if(!from||!to||!preset)return;
    if(preset==="all"){
      from.value="";
      to.value="";
      return;
    }
    var end=new Date();
    var start=new Date();
    start.setDate(end.getDate()-Number(preset)+1);
    from.value=start.toISOString().slice(0,10);
    to.value=end.toISOString().slice(0,10);
  }

  function exportRows(){
    return subscribers.map(function(item){
      return {
        "Data iscrizione":dateTimeLabel(item.created_at),
        "Nome":item.name||"",
        "Email":item.email||"",
        "Telefono":emptyLabel(item.phone),
        "Lingua newsletter":newsletterLanguageLabel(item.newsletter_language),
        "Lingua sito":newsletterLanguageLabel(item.site_language),
        "Consenso privacy":consentLabel(item.consent),
        "Messaggio":item.message||"",
        "Origine":item.source||"",
        "Pagina":item.page_url||""
      };
    });
  }

  function exportExcel(){
    if(!subscribers.length)return status("newsletter-status","Nessun iscritto da esportare.");
    var rows=exportRows();
    var columns=Object.keys(rows[0]);
    var html='<!doctype html><html><head><meta charset="utf-8"></head><body><table><thead><tr>'+
      columns.map(function(column){return '<th>'+escapeHtml(column)+'</th>';}).join("")+
      '</tr></thead><tbody>'+
      rows.map(function(row){
        return '<tr>'+columns.map(function(column){return '<td>'+escapeHtml(row[column])+'</td>';}).join("")+'</tr>';
      }).join("")+
      '</tbody></table></body></html>';
    downloadBlob(html,"application/vnd.ms-excel;charset=utf-8","iscritti-newsletter-ulakasha-"+dateFileStamp()+".xls");
  }

  function pdfSafe(value){
    return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g," ").replace(/[\\()]/g,function(ch){return "\\"+ch;});
  }
  function wrapPdfLine(text,max){
    var words=String(text||"").split(/\s+/);
    var lines=[];
    var line="";
    words.forEach(function(word){
      var test=line?line+" "+word:word;
      if(test.length>max&&line){
        lines.push(line);
        line=word;
      }else{
        line=test;
      }
    });
    if(line)lines.push(line);
    return lines.length?lines:[""];
  }
  function exportPdf(){
    if(!subscribers.length)return status("newsletter-status","Nessun iscritto da esportare.");
    var printable=["Iscritti newsletter Ulakasha","Esportazione: "+dateTimeLabel(new Date().toISOString()),""];
    exportRows().forEach(function(row,index){
      var line=(index+1)+". "+row["Data iscrizione"]+" | "+row.Nome+" | "+row.Email+" | Tel: "+row.Telefono+" | Lingua: "+row["Lingua newsletter"]+" | Consenso: "+row["Consenso privacy"];
      wrapPdfLine(pdfSafe(line),92).forEach(function(part){printable.push(part);});
      if(row.Messaggio){
        wrapPdfLine(pdfSafe("Messaggio: "+row.Messaggio),92).forEach(function(part){printable.push(part);});
      }
      printable.push("");
    });
    var chunks=[];
    while(printable.length)chunks.push(printable.splice(0,50));
    var pageCount=chunks.length||1;
    var fontObj=3+pageCount*2;
    var objects=[
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids ["+chunks.map(function(_,i){return (3+i*2)+" 0 R";}).join(" ")+"] /Count "+pageCount+" >>"
    ];
    chunks.forEach(function(lines,pageIndex){
      var contentObj=4+pageIndex*2;
      var stream=["BT","/F1 14 Tf","50 790 Td"];
      lines.forEach(function(line,index){
        if(pageIndex===0&&index===0)stream.push("("+pdfSafe(line)+") Tj","/F1 9 Tf","0 -22 Td");
        else stream.push("("+pdfSafe(line)+") Tj","0 -13 Td");
      });
      stream.push("ET");
      var streamText=stream.join("\n");
      objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 "+fontObj+" 0 R >> >> /Contents "+contentObj+" 0 R >>");
      objects.push("<< /Length "+streamText.length+" >>\nstream\n"+streamText+"\nendstream");
    });
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    var pdf="%PDF-1.4\n";
    var offsets=[0];
    objects.forEach(function(obj,i){
      offsets.push(pdf.length);
      pdf+=(i+1)+" 0 obj\n"+obj+"\nendobj\n";
    });
    var xref=pdf.length;
    pdf+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
    for(var i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
    pdf+="trailer\n<< /Size "+(objects.length+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
    downloadBlob(pdf,"application/pdf","iscritti-newsletter-ulakasha-"+dateFileStamp()+".pdf");
  }

  document.addEventListener("DOMContentLoaded",function(){
    showLogin();
    if(!configured())status("newsletter-login-status","Configura Supabase in supabase-config.js prima di usare l'admin.");

    el("newsletter-login-form").addEventListener("submit",async function(event){
      event.preventDefault();
      status("newsletter-login-status","Accesso...");
      try{
        await signIn(el("newsletter-admin-email").value,el("newsletter-admin-password").value);
        status("newsletter-login-status","");
        showPanel();
      }catch(err){
        status("newsletter-login-status",err.message);
      }
    });

    el("newsletter-filter-form").addEventListener("submit",function(event){
      event.preventDefault();
      listSubscribers().catch(function(err){status("newsletter-status",err.message);});
    });
    el("newsletter-range-preset").addEventListener("change",applyPreset);
    el("newsletter-clear-filter").addEventListener("click",function(){
      el("newsletter-date-from").value="";
      el("newsletter-date-to").value="";
      el("newsletter-range-preset").value="all";
      listSubscribers().catch(function(err){status("newsletter-status",err.message);});
    });
    el("newsletter-refresh").addEventListener("click",function(){
      listSubscribers().catch(function(err){status("newsletter-status",err.message);});
    });
    el("newsletter-export-excel").addEventListener("click",exportExcel);
    el("newsletter-export-pdf").addEventListener("click",exportPdf);
    el("newsletter-logout").addEventListener("click",function(){
      localStorage.removeItem(TOKEN_KEY);
      token="";
      subscribers=[];
      showLogin();
      status("newsletter-login-status","Accesso chiuso.");
    });

    if(token&&configured()){
      status("newsletter-login-status","Controllo sessione...");
      validateSession().then(function(ok){
        if(ok)showPanel();
        else showLogin();
      }).catch(function(){
        showLogin();
      });
    }
  });
})();
