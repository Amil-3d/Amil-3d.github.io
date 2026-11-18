/* Portfolio pages: theme toggle, footer year, home page (rotating figure + project index),
   project page (gallery + lightbox). Content comes from projects.json, same shape as before,
   so editor.html keeps working. The Assistant pages keep using site.js. */
(function(){
  var root = document.documentElement;

  /* ---- theme (same localStorage key as site.js, so the choice carries across every page) ---- */
  var saved = null;
  try{ saved = localStorage.getItem('theme'); }catch(e){}
  if(saved){ root.setAttribute('data-theme', saved); }
  var tbtn = document.getElementById('theme');
  if(tbtn){
    tbtn.addEventListener('click', function(){
      var cur = root.getAttribute('data-theme');
      var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next = cur ? (cur === 'dark' ? 'light' : 'dark') : (sysDark ? 'light' : 'dark');
      root.setAttribute('data-theme', next);
      try{ localStorage.setItem('theme', next); }catch(e){}
    });
  }
  var yr = document.getElementById('yr');
  if(yr){ yr.textContent = new Date().getFullYear(); }

  /* ---- helpers ---- */
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function slug(t){
    return String(t || '').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function roleParts(p){
    var parts = String(p.role || '').split('·').map(function(s){ return s.trim(); }).filter(Boolean);
    var period = parts.length > 1 && /\d{4}/.test(parts[parts.length - 1]) ? parts.pop() : '';
    return { org: parts[0] || '', detail: parts.slice(1).join(' · '), period: period };
  }
  function short(s, n){
    s = String(s || '');
    if(s.length <= n){ return s; }
    return s.slice(0, n).replace(/\s+\S*$/, '') + '…';
  }
  /* images (and a video, if there is one) as slides; accepts "images" or a legacy single "image" */
  function mediaOf(p){
    var out = [];
    var imgs = p.images;
    if(!imgs && p.image){ imgs = [p.image]; }
    (imgs || []).forEach(function(it){
      var src = typeof it === 'string' ? it : it.src;
      if(!src){ return; }
      out.push({ type:'image', src:src, alt:(typeof it === 'string' ? p.title : (it.alt || p.title)) });
    });
    if(p.video && p.video.src){
      out.push({ type:'video', src:p.video.src, poster:p.video.poster || '',
        alt:(p.video.label || 'Video') + ' — ' + p.title });
    }
    return out;
  }
  function lead(p){
    var m = mediaOf(p).filter(function(x){ return x.type === 'image'; })[0];
    return m ? m.src : '';
  }
  function pageURL(p){ return 'project.html?p=' + encodeURIComponent(slug(p.title)); }
  function loadProjects(){
    return fetch('projects.json').then(function(r){
      if(!r.ok){ throw new Error('projects.json ' + r.status); }
      return r.json();
    });
  }
  var LOAD_FAIL = '<p class="empty m">Projects load from projects.json. View this page over http, not by opening the file.</p>';

  var page = document.body.getAttribute('data-page');

  /* =================== home =================== */
  if(page === 'home'){
    loadProjects().then(function(list){
      var host = document.getElementById('projects');
      host.innerHTML = list.map(function(p, i){
        var r = roleParts(p), src = lead(p);
        return '<a class="row" href="' + pageURL(p) + '">' +
          '<div class="n m">' + pad(i + 1) + '</div>' +
          (src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '<div></div>') +
          '<div><h3>' + esc(p.title) + '</h3><div class="m muted">' + esc(r.org) + '</div></div>' +
          '<p>' + esc(short(p.summary, 130)) + '</p>' +
          '<div class="y m">' + esc(r.period) + ' &rarr;</div></a>';
      }).join('');
      var count = document.getElementById('count');
      if(count){ count.textContent = list.length + ' entries'; }
      heroRotate(list);
    }).catch(function(){
      document.getElementById('projects').innerHTML = LOAD_FAIL;
    });
  }

  /* Hero figure: cycles through the lead photo of each featured project on a timer.
     Pauses on hover, on keyboard focus, when the tab is hidden, or with the pause button.
     Starts paused for people who ask their system for reduced motion. */
  function heroRotate(list){
    var fig = document.getElementById('fig');
    if(!fig){ return; }
    var picks = list.filter(function(p){ return p.featured && lead(p); });
    if(picks.length < 2){ picks = list.filter(function(p){ return lead(p); }); }
    if(!picks.length){ return; }
    var DUR = 6000;
    fig.style.setProperty('--dur', DUR + 'ms');
    var ph = fig.querySelector('.ph'), cap = document.getElementById('figcap'),
        meta = document.getElementById('figmeta'), ticks = fig.querySelector('.ticks'),
        pbtn = document.getElementById('figpause');
    ph.innerHTML = picks.map(function(p, i){
      var al = (mediaOf(p)[0] || {}).alt || p.title;
      return '<img src="' + esc(lead(p)) + '" alt="' + esc(al) + '"' + (i ? ' loading="lazy"' : '') + (i === 0 ? ' class="on"' : '') + '>';
    }).join('');
    ticks.innerHTML = picks.map(function(){ return '<i></i>'; }).join('');
    var imgs = ph.querySelectorAll('img'), bars = ticks.querySelectorAll('i');
    var idx = 0, timer = null, userPaused = false, hover = false;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce){ userPaused = true; }

    function show(i){
      idx = (i + picks.length) % picks.length;
      var p = picks[idx], r = roleParts(p);
      imgs.forEach(function(im, k){ im.classList.toggle('on', k === idx); });
      bars.forEach(function(b, k){
        b.classList.remove('on'); b.classList.toggle('done', k < idx);
      });
      void ticks.offsetWidth;            // restart the progress animation
      bars[idx].classList.add('on');
      ph.href = pageURL(p);
      ph.setAttribute('aria-label', 'Open ' + p.title);
      cap.innerHTML = 'Fig. ' + pad(idx + 1) + ' — <a href="' + pageURL(p) + '">' + esc(p.title) + '</a>';
      meta.textContent = [r.org, r.period].filter(Boolean).join(' · ');
      schedule();
    }
    function paused(){ return userPaused || hover || document.hidden; }
    function schedule(){
      clearTimeout(timer);
      fig.classList.toggle('paused', paused());
      if(!paused()){ timer = setTimeout(function(){ show(idx + 1); }, DUR); }
    }
    function setHover(v){
      hover = v;
      if(v){ clearTimeout(timer); fig.classList.add('paused'); }
      else { show(idx); }   // resume from the start of this photo
    }
    fig.addEventListener('mouseenter', function(){ setHover(true); });
    fig.addEventListener('mouseleave', function(){ setHover(false); });
    fig.addEventListener('focusin', function(){ setHover(true); });
    fig.addEventListener('focusout', function(e){ if(!fig.contains(e.relatedTarget)){ setHover(false); } });
    document.addEventListener('visibilitychange', function(){ if(!document.hidden){ show(idx); } else { schedule(); } });
    document.getElementById('figprev').addEventListener('click', function(){ show(idx - 1); });
    document.getElementById('fignext').addEventListener('click', function(){ show(idx + 1); });
    function syncPause(){
      pbtn.textContent = userPaused ? '▶' : '❚❚';
      pbtn.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
      pbtn.setAttribute('aria-pressed', String(userPaused));
    }
    pbtn.addEventListener('click', function(){ userPaused = !userPaused; syncPause(); schedule(); });
    syncPause();
    show(0);
  }

  /* =================== project page =================== */
  if(page === 'project'){
    var want = new URLSearchParams(location.search).get('p') || '';
    loadProjects().then(function(list){
      var i = -1;
      list.forEach(function(p, k){ if(slug(p.title) === want){ i = k; } });
      if(i < 0){
        document.getElementById('ptitle').textContent = 'Project not found';
        document.getElementById('pmain').innerHTML = '<p class="empty">That project is not on the list any more. <a href="index.html#work">See all projects</a>.</p>';
        return;
      }
      renderProject(list, i);
    }).catch(function(){
      document.getElementById('pmain').innerHTML = LOAD_FAIL;
    });
  }

  function renderProject(list, i){
    var p = list[i], r = roleParts(p), slides = mediaOf(p);
    document.title = p.title + ' · Amil Dhookie';
    document.getElementById('pno').textContent = pad(i + 1);
    document.getElementById('psheet').textContent = pad(i + 1) + ' / ' + pad(list.length);
    document.getElementById('ptitle').textContent = p.title;
    document.getElementById('prole').textContent = p.role || '';

    var gal;
    if(!slides.length){
      gal = '<div class="stage"><p class="empty m">No photos yet</p></div>';
    } else {
      gal = '<div class="stage" id="stage"></div>' +
        '<div class="gcap m"><span id="gcap"></span><span id="gnum"></span></div>' +
        (slides.length > 1 ? '<div class="strip" id="strip">' + slides.map(function(m, k){
          var t = m.type === 'video' ? m.poster : m.src;
          return '<button data-i="' + k + '" aria-current="' + (k === 0) + '" aria-label="' + esc(m.alt) + '">' +
            (t ? '<img src="' + esc(t) + '" alt="" loading="lazy">' : '') +
            (m.type === 'video' ? '<span class="play">&#9654;</span>' : '') + '</button>';
        }).join('') + '</div>' : '');
    }
    var rows = [];
    if(r.org){ rows.push(['Team', r.org]); }
    if(r.detail){ rows.push(['Role', r.detail]); }
    if(r.period){ rows.push(['Period', r.period]); }
    var tags = (p.tags || []).map(function(t){ return '<span class="chip">' + esc(t) + '</span>'; }).join('');
    if(tags){ rows.push(['Skills', '<div class="chips">' + tags + '</div>', true]); }
    var more = p.link ? '<p><a class="btn p" href="' + esc(p.link) + '">More on this project &rarr;</a></p>' : '';

    document.getElementById('pmain').innerHTML =
      '<div class="proj"><div class="gal">' + gal + '</div>' +
      '<div class="txt"><div class="m muted" style="margin-bottom:12px">Notes</div><p>' + esc(p.summary) + '</p>' +
      '<table class="spec">' + rows.map(function(x){
        return '<tr><th class="m">' + esc(x[0]) + '</th><td>' + (x[2] ? x[1] : esc(x[1])) + '</td></tr>';
      }).join('') + '</table>' + more + '</div></div>';

    var prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    document.getElementById('pn').innerHTML =
      '<a href="' + pageURL(prev) + '"><span class="m muted">&larr; Previous</span><b>' + esc(prev.title) + '</b></a>' +
      '<a href="' + pageURL(next) + '"><span class="m muted">Next &rarr;</span><b>' + esc(next.title) + '</b></a>';

    if(!slides.length){ return; }
    var stage = document.getElementById('stage'), cur = 0;
    function show(k){
      cur = k;
      var m = slides[k];
      if(m.type === 'video'){
        stage.innerHTML = '<video controls preload="metadata"' + (m.poster ? ' poster="' + esc(m.poster) + '"' : '') +
          '><source src="' + esc(m.src) + '" type="video/mp4">Your browser cannot play this video.</video>';
      } else {
        stage.innerHTML = '<img src="' + esc(m.src) + '" alt="' + esc(m.alt) + '">' +
          '<button class="open" aria-label="View larger"></button>';
      }
      document.getElementById('gcap').textContent = m.alt;
      document.getElementById('gnum').textContent = (k + 1) + ' / ' + slides.length;
      var strip = document.getElementById('strip');
      if(strip){ strip.querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-current', String(+b.getAttribute('data-i') === k)); }); }
    }
    show(0);
    var strip = document.getElementById('strip');
    if(strip){ strip.addEventListener('click', function(e){ var b = e.target.closest('button'); if(b){ show(+b.getAttribute('data-i')); } }); }
    stage.addEventListener('click', function(e){
      if(e.target.closest('.open')){ lbOpen(slides.filter(function(m){ return m.type === 'image'; }), slides[cur].src); }
    });
  }

  /* ---- lightbox ---- */
  var lb = document.getElementById('lb'), lbList = [], lbI = 0;
  function lbShow(){
    if(!lbList.length){ return; }
    lbI = (lbI + lbList.length) % lbList.length;
    var m = lbList[lbI];
    document.getElementById('lbimg').src = m.src;
    document.getElementById('lbimg').alt = m.alt;
    document.getElementById('lbcap').textContent = m.alt + '  (' + (lbI + 1) + '/' + lbList.length + ')';
  }
  function lbOpen(list, src){
    lbList = list; lbI = 0;
    list.forEach(function(m, k){ if(m.src === src){ lbI = k; } });
    lb.classList.add('on'); document.body.style.overflow = 'hidden';
    lbShow();
    document.getElementById('lbclose').focus();
  }
  function lbClose(){
    lb.classList.remove('on'); document.getElementById('lbimg').src = ''; document.body.style.overflow = '';
  }
  if(lb){
    document.getElementById('lbclose').addEventListener('click', lbClose);
    document.getElementById('lbprev').addEventListener('click', function(e){ e.stopPropagation(); lbI--; lbShow(); });
    document.getElementById('lbnext').addEventListener('click', function(e){ e.stopPropagation(); lbI++; lbShow(); });
    lb.addEventListener('click', function(e){ if(e.target === lb || e.target.id === 'lbimg'){ lbClose(); } });
    document.addEventListener('keydown', function(e){
      if(!lb.classList.contains('on')){ return; }
      if(e.key === 'Escape'){ lbClose(); }
      if(e.key === 'ArrowLeft'){ lbI--; lbShow(); }
      if(e.key === 'ArrowRight'){ lbI++; lbShow(); }
    });
  }
})();
