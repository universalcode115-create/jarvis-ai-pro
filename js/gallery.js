/* =====================================================
   GALLERY (all generated images, pulled from active chat + saved history)
   ===================================================== */
function renderGalleryTab(){
  var grid = document.getElementById('galleryGrid');
  var images = [];
  activeChatMessages.forEach(function(m){ if(m.isImage && m.imgUrl) images.push(m.imgUrl); });
  chatHistorySessions.forEach(function(s){
    (s.messages||[]).forEach(function(m){ if(m.isImage && m.imgUrl) images.push(m.imgUrl); });
  });
  images = images.filter(function(u,i){ return images.indexOf(u)===i; }); // dedupe
  if(images.length===0){
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:13px;padding:30px 10px;">No generated images saved yet — images you create will show up here.</div>';
    return;
  }
  grid.innerHTML = images.reverse().map(function(url){
    return '<div style="position:relative;border-radius:12px;overflow:hidden;box-shadow:var(--shadow);">'+
      '<img src="'+url+'" style="width:100%;height:140px;object-fit:cover;display:block;">'+
      '<i class="fa-solid fa-download" onclick="saveImage(\''+url.replace(/'/g,"\\'")+'\')" style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,0.55);color:#fff;padding:7px 9px;border-radius:50%;font-size:12px;"></i>'+
      '</div>';
  }).join('');
}

