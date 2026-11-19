/* The Ideas section: a whiteboard of sticky notes. An idea texted to the bot lands here by itself; here Amil
   adds, drags, edits, recolors and deletes notes, and sticks small notes beside an idea.
   Like the rest of the panel it holds no data: the board is read from the bot (/panel/board) and every change
   is a press of a board button, so it lands in the log. Every word on a note is put on the page as text.
   The board has its own units (the bot says how big); the page scales it to fit and snaps to the graph paper. */
(function(){
  var P = window.Panel, el = P.el;
  var BOARD = 'ideas', GRID = 24, IDEA_W = 204, NOTE_W = 156;
  var COLOR_NAMES = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink', orange: 'Orange', white: 'White' };
  var st = null;   /* everything about the open section; null when another section is showing */

  function alive(mine){ return st === mine && document.body.contains(mine.root); }
  function snap(v){ return Math.round(v / GRID) * GRID; }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function told(r){
    if(r.status !== 200){ return false; }
    if(r.body.ok === false){ P.say(r.body.why || 'That did not work.', true); return false; }
    return true;
  }
  function remember(key, value){ try{ localStorage.setItem('ideas-' + key, value); }catch(e){} }
  function recall(key, fallback){ try{ return localStorage.getItem('ideas-' + key) || fallback; }catch(e){ return fallback; } }

  /* ---------- reading ---------- */
  function load(s, quiet){
    return P.ask('/panel/board?name=' + BOARD).then(function(r){
      if(!alive(s)){ return; }
      if(r.status !== 200){ if(!quiet){ P.say('The board could not be read just now.', true); } return; }
      s.data = r.body;
      if(!s.busy()){ draw(s); }
    }).catch(function(e){ if(e.message !== 'signed out' && alive(s) && !quiet){ P.say('The bot did not answer. Try again in a minute.', true); } })
      .then(function(){ if(alive(s)){ clearTimeout(s.timer); s.timer = setTimeout(function(){ load(s, true); }, 20000); } });
  }
  function apply(s, note){
    /* puts one note the bot sent back into the board as kept here */
    var list = s.data.notes, i;
    for(i = 0; i < list.length; i++){ if(list[i].n === note.n){ list[i] = note; return; } }
    list.push(note);
  }

  /* ---------- the toolbar ---------- */
  function swatches(parent, chosen, onPick){
    var row = el('div', 'p-swatches');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Color');
    (st.data.colors || Object.keys(COLOR_NAMES)).forEach(function(c){
      var b = el('button', 'p-swatch p-note-' + c);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', COLOR_NAMES[c] || c);
      b.setAttribute('aria-checked', c === chosen ? 'true' : 'false');
      b.addEventListener('click', function(){
        Array.prototype.forEach.call(row.children, function(x){ x.setAttribute('aria-checked', 'false'); });
        b.setAttribute('aria-checked', 'true');
        onPick(c);
      });
      row.appendChild(b);
    });
    parent.appendChild(row);
    return row;
  }
  function toolbar(s){
    var c = el('section', 'p-card p-ideas-bar');
    c.appendChild(el('h2', '', 'New idea'));
    var input = el('textarea', 'p-input p-area p-ideas-new');
    input.rows = 2;
    input.maxLength = s.data.most || 1000;
    input.placeholder = 'Type an idea, or text me "idea: …"';
    c.appendChild(input);
    var row = el('div', 'p-ideas-row');
    var color = 'yellow';
    swatches(row, color, function(picked){ color = picked; });
    var add = P.button(row, 'Stick it', 'main', function(b){
      var text = input.value.trim();
      if(!text){ input.focus(); return; }
      var spot = s.view === 'board' ? visibleSpot(s) : {};
      P.press('board_add', { board: BOARD, text: text, color: color, x: spot.x, y: spot.y }, b).then(function(r){
        if(!told(r) || !alive(s)){ return; }
        input.value = '';
        apply(s, r.body.note);
        s.fresh = r.body.note.n;
        draw(s);
        P.say('Stuck on as #' + r.body.note.n + '.');
      }).catch(function(){});
    });
    add.classList.add('p-ideas-add');
    input.addEventListener('keydown', function(e){ if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)){ add.click(); } });
    c.appendChild(row);

    var tools = el('div', 'p-ideas-tools');
    var seg = el('div', 'p-seg p-ideas-seg');
    [['board', 'Board'], ['list', 'List']].forEach(function(v){
      var b = el('button', 'p-btn p-seg-btn', v[1]);
      b.type = 'button';
      b.setAttribute('aria-selected', s.view === v[0] ? 'true' : 'false');
      b.addEventListener('click', function(){ s.view = v[0]; remember('view', v[0]); draw(s); });
      seg.appendChild(b);
    });
    tools.appendChild(seg);
    s.zoomBox = el('div', 'p-ideas-zoom');
    P.button(s.zoomBox, '−', 'quiet', function(){ zoom(s, s.scale / 1.25); }).setAttribute('aria-label', 'Zoom out');
    P.button(s.zoomBox, 'Fit', 'quiet', function(){ s.fit = true; draw(s); });
    P.button(s.zoomBox, '+', 'quiet', function(){ zoom(s, s.scale * 1.25); }).setAttribute('aria-label', 'Zoom in');
    tools.appendChild(s.zoomBox);
    s.undo = P.button(tools, 'Undo delete', 'quiet', function(b){
      P.press('board_undo', { board: BOARD }, b).then(function(r){
        if(!told(r) || !alive(s)){ return; }
        apply(s, r.body.note);
        s.data.can_undo = Math.max(0, (s.data.can_undo || 1) - 1);
        s.fresh = r.body.note.n;
        draw(s);
        P.say('#' + r.body.note.n + ' is back.');
      }).catch(function(){});
    });
    s.count = el('span', 'p-ideas-count');
    tools.appendChild(s.count);
    c.appendChild(tools);
    return c;
  }
  function zoom(s, to){
    s.fit = false;
    s.scale = clamp(to, 0.2, 1.5);
    draw(s);
  }
  function visibleSpot(s){
    /* the middle of what is on screen now, in board units, so a new note lands where he is looking */
    var w = s.wrap;
    if(!w){ return {}; }
    return { x: snap(clamp((w.scrollLeft + w.clientWidth / 2) / s.scale - IDEA_W / 2, 0, s.data.size[0] - IDEA_W)),
             y: snap(clamp((w.scrollTop + w.clientHeight / 2) / s.scale - 60, 0, s.data.size[1] - 120)) };
  }

  /* ---------- one note ---------- */
  function noteBody(s, n, box){
    var head = el('div', 'p-sticky-head');
    head.appendChild(el('span', 'p-sticky-num', '#' + n.n));
    head.appendChild(el('span', 'p-sticky-from', n.from === 'text' ? 'texted' : ''));
    head.appendChild(el('span', 'p-sticky-at', P.when(n.at)));
    box.appendChild(head);
    var text = el('div', 'p-sticky-text', n.text);
    box.appendChild(text);
    box.appendChild(el('div', 'p-sticky-near', n.near ? 'beside #' + n.near : ''));
    var acts = el('div', 'p-sticky-acts');
    P.button(acts, 'Edit', 'quiet', function(){ edit(s, n, box); });
    if(n.kind !== 'note'){ P.button(acts, '+ Note', 'quiet', function(){ addBeside(s, n); }); }
    var armed = 0, del = P.button(acts, 'Delete', 'quiet p-sticky-del', function(b){
      if(Date.now() - armed > 4000){ armed = Date.now(); b.textContent = 'Sure?'; return; }
      P.press('board_delete', { board: BOARD, n: n.n }, b).then(function(r){
        if(!told(r) || !alive(s)){ return; }
        s.data.notes = s.data.notes.filter(function(x){ return x.n !== n.n; });
        s.data.can_undo = (s.data.can_undo || 0) + 1;
        draw(s);
        P.say('Deleted #' + n.n + '. Undo delete puts it back.');
      }).catch(function(){});
    });
    del.addEventListener('blur', function(){ armed = 0; del.textContent = 'Delete'; });
    box.appendChild(acts);
    return head;
  }
  function edit(s, n, box){
    s.editing = n.n;
    box.classList.add('editing');
    box.textContent = '';
    var area = el('textarea', 'p-input p-area p-sticky-edit');
    area.value = n.text;
    area.maxLength = s.data.most || 1000;
    area.rows = 5;
    box.appendChild(area);
    var color = n.color;
    swatches(box, color, function(picked){ color = picked; });
    var acts = el('div', 'p-sticky-acts');
    P.button(acts, 'Save', 'main', function(b){
      var text = area.value.trim();
      if(!text){ area.focus(); return; }
      P.press('board_edit', { board: BOARD, n: n.n, text: text, color: color }, b).then(function(r){
        if(!told(r) || !alive(s)){ return; }
        s.editing = 0;
        apply(s, r.body.note);
        draw(s);
      }).catch(function(){});
    });
    function cancel(){
      s.editing = 0;
      if(n.text !== '…'){ draw(s); return; }
      /* a note made a moment ago and never written in is taken away again */
      P.press('board_delete', { board: BOARD, n: n.n }).then(function(r){
        if(r.status === 200 && r.body.ok !== false && alive(s)){ s.data.notes = s.data.notes.filter(function(x){ return x.n !== n.n; }); }
        draw(s);
      }).catch(function(){ draw(s); });
    }
    P.button(acts, 'Cancel', 'quiet', cancel);
    box.appendChild(acts);
    area.focus();
    area.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ cancel(); }
      if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)){ acts.firstChild.click(); }
    });
  }
  function addBeside(s, n){
    /* no browser dialogs: a small note is stuck on beside its idea and opens straight into its editor */
    P.press('board_add', { board: BOARD, text: '…', kind: 'note', near: n.n }).then(function(r){
      if(!told(r) || !alive(s)){ return; }
      apply(s, r.body.note);
      s.fresh = r.body.note.n;
      s.openEdit = r.body.note.n;
      draw(s);
    }).catch(function(){});
  }

  /* ---------- dragging, on the note's top strip only, so the board still scrolls on a phone ---------- */
  function draggable(s, n, box, handle){
    handle.addEventListener('pointerdown', function(e){
      if(e.button !== 0 || s.editing){ return; }
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      var start = { px: e.clientX, py: e.clientY, x: n.x, y: n.y }, moved = false;
      s.dragging = true;
      box.classList.add('lifted');
      function move(ev){
        var dx = (ev.clientX - start.px) / s.scale, dy = (ev.clientY - start.py) / s.scale;
        if(Math.abs(dx) + Math.abs(dy) > 3){ moved = true; }
        n.x = clamp(snap(start.x + dx), 0, s.data.size[0] - 60);
        n.y = clamp(snap(start.y + dy), 0, s.data.size[1] - 60);
        box.style.left = n.x + 'px';
        box.style.top = n.y + 'px';
        lines(s);
      }
      function up(){
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        s.dragging = false;
        box.classList.remove('lifted');
        if(!moved || (n.x === start.x && n.y === start.y)){ return; }
        /* a small note follows its idea */
        var moves = [{ n: n.n, x: n.x, y: n.y }];
        s.data.notes.forEach(function(k){
          if(k.near === n.n){
            k.x = clamp(k.x + n.x - start.x, 0, s.data.size[0] - 60);
            k.y = clamp(k.y + n.y - start.y, 0, s.data.size[1] - 60);
            moves.push({ n: k.n, x: k.x, y: k.y });
          }
        });
        if(moves.length > 1){ draw(s); }
        P.press('board_move', { board: BOARD, moves: moves }).then(function(r){
          if(r.status !== 200 && alive(s)){ load(s); }
        }).catch(function(){});
      }
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
    handle.addEventListener('keydown', function(e){
      /* arrow keys move a note one square, for anyone not using a pointer */
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if(!d){ return; }
      e.preventDefault();
      n.x = clamp(n.x + d[0] * GRID, 0, s.data.size[0] - 60);
      n.y = clamp(n.y + d[1] * GRID, 0, s.data.size[1] - 60);
      box.style.left = n.x + 'px';
      box.style.top = n.y + 'px';
      lines(s);
      clearTimeout(s.keyTimer);
      s.keyTimer = setTimeout(function(){ P.press('board_move', { board: BOARD, moves: [{ n: n.n, x: n.x, y: n.y }] }).catch(function(){}); }, 600);
    });
  }

  /* ---------- the board ---------- */
  var SVG = 'http://www.w3.org/2000/svg';
  function lines(s){
    /* a dashed line from each small note to the idea it sits beside */
    if(!s.svg){ return; }
    while(s.svg.firstChild){ s.svg.removeChild(s.svg.firstChild); }
    var by = {};
    s.data.notes.forEach(function(n){ by[n.n] = n; });
    s.data.notes.forEach(function(n){
      var to = n.near && by[n.near];
      if(!to){ return; }
      var l = document.createElementNS(SVG, 'line');
      l.setAttribute('x1', to.x + IDEA_W / 2);
      l.setAttribute('y1', to.y + 30);
      l.setAttribute('x2', n.x + NOTE_W / 2);
      l.setAttribute('y2', n.y + 16);
      l.setAttribute('class', 'p-board-line');
      s.svg.appendChild(l);
    });
  }
  function drawBoard(s, holder){
    var size = s.data.size || [3000, 2000];
    var wrap = el('div', 'p-board-wrap');
    var keepLeft = s.wrap ? s.wrap.scrollLeft : 0, keepTop = s.wrap ? s.wrap.scrollTop : 0;
    holder.appendChild(wrap);
    if(s.fit){
      /* fit the notes, not the whole board: zoom to what is used, never past full size */
      var right = 900, bottom = 600;
      s.data.notes.forEach(function(n){ right = Math.max(right, n.x + IDEA_W + 48); bottom = Math.max(bottom, n.y + 240); });
      s.scale = clamp(Math.min((wrap.clientWidth || 700) / right, 1), 0.25, 1);
    }
    var sizer = el('div', 'p-board-sizer');
    sizer.style.width = Math.round(size[0] * s.scale) + 'px';
    sizer.style.height = Math.round(size[1] * s.scale) + 'px';
    var board = el('div', 'p-board');
    board.style.width = size[0] + 'px';
    board.style.height = size[1] + 'px';
    board.style.transform = 'scale(' + s.scale + ')';
    s.svg = document.createElementNS(SVG, 'svg');
    s.svg.setAttribute('class', 'p-board-lines');
    s.svg.setAttribute('width', size[0]);
    s.svg.setAttribute('height', size[1]);
    s.svg.setAttribute('aria-hidden', 'true');
    board.appendChild(s.svg);
    if(!s.data.notes.length){
      var empty = el('div', 'p-board-empty');
      empty.appendChild(el('strong', '', 'Nothing on the board yet.'));
      empty.appendChild(el('span', '', 'Text me "idea: …" or type one above. Double-click the board to stick one right there.'));
      board.appendChild(empty);
    }
    s.data.notes.slice().sort(function(a, b){ return a.n - b.n; }).forEach(function(n){
      var box = el('article', 'p-sticky p-note-' + (n.color || 'yellow') + (n.kind === 'note' ? ' small' : '') + (s.fresh === n.n ? ' fresh' : ''));
      box.style.left = n.x + 'px';
      box.style.top = n.y + 'px';
      box.style.width = (n.kind === 'note' ? NOTE_W : IDEA_W) + 'px';
      box.setAttribute('aria-label', 'Note ' + n.n);
      var handle = noteBody(s, n, box);
      handle.tabIndex = 0;
      handle.setAttribute('aria-label', 'Move note ' + n.n + ' (arrow keys)');
      draggable(s, n, box, handle);
      board.appendChild(box);
      if(s.openEdit === n.n){ s.openEdit = 0; setTimeout(function(){ edit(s, n, box); box.querySelector('textarea').select(); }, 0); }
    });
    board.addEventListener('dblclick', function(e){
      if(e.target !== board && e.target !== s.svg){ return; }
      var rect = board.getBoundingClientRect();
      var x = snap((e.clientX - rect.left) / s.scale), y = snap((e.clientY - rect.top) / s.scale);
      P.press('board_add', { board: BOARD, text: '…', x: x, y: y }).then(function(r){
        if(!told(r) || !alive(s)){ return; }
        apply(s, r.body.note);
        s.fresh = r.body.note.n;
        s.openEdit = r.body.note.n;
        draw(s);
      }).catch(function(){});
    });
    sizer.appendChild(board);
    wrap.appendChild(sizer);
    s.wrap = wrap;
    wrap.scrollLeft = keepLeft;
    wrap.scrollTop = keepTop;
    lines(s);
    if(s.fresh){
      var f = board.querySelector('.fresh');
      if(f && (f.offsetTop * s.scale > wrap.scrollTop + wrap.clientHeight || f.offsetLeft * s.scale > wrap.scrollLeft + wrap.clientWidth)){
        wrap.scrollTop = f.offsetTop * s.scale - 40;
        wrap.scrollLeft = f.offsetLeft * s.scale - 40;
      }
      setTimeout(function(){ s.fresh = 0; }, 1600);
    }
  }
  function drawList(s, holder){
    var c = el('section', 'p-card');
    c.appendChild(el('h2', '', 'Newest first'));
    if(!s.data.notes.length){ c.appendChild(el('p', 'p-empty', 'Nothing yet. Text me "idea: …" or type one above.')); holder.appendChild(c); return; }
    var list = el('div', 'p-ideas-list');
    s.data.notes.slice().sort(function(a, b){ return b.n - a.n; }).forEach(function(n){
      var box = el('article', 'p-sticky in-list p-note-' + (n.color || 'yellow') + (n.kind === 'note' ? ' small' : ''));
      noteBody(s, n, box);
      list.appendChild(box);
      if(s.openEdit === n.n){ s.openEdit = 0; setTimeout(function(){ edit(s, n, box); box.querySelector('textarea').select(); }, 0); }
    });
    c.appendChild(list);
    holder.appendChild(c);
  }
  function draw(s){
    if(!alive(s)){ return; }
    s.editing = 0;
    s.holder.textContent = '';
    s.count.textContent = s.data.notes.length + (s.data.notes.length === 1 ? ' note' : ' notes') + (s.data.unsaved ? ' · saving' : '');
    s.undo.hidden = !s.data.can_undo;
    s.zoomBox.hidden = s.view !== 'board';
    Array.prototype.forEach.call(s.root.querySelectorAll('.p-ideas-seg .p-seg-btn'), function(b, i){
      b.setAttribute('aria-selected', (i === 0) === (s.view === 'board') ? 'true' : 'false');
    });
    if(s.view === 'board'){ drawBoard(s, s.holder); } else { drawList(s, s.holder); s.svg = null; }
    if(s.data.problem){ P.say('The board is not saved yet (' + s.data.problem + '). It will try again.', true); }
  }

  Panel.section({ id: 'ideas', title: 'Ideas', after: 'study', render: function(root){
    if(st){ clearTimeout(st.timer); }
    var s = st = { root: root, data: null, view: recall('view', window.innerWidth < 640 ? 'list' : 'board'), scale: 1, fit: true,
                   editing: 0, dragging: false, fresh: 0, openEdit: 0, timer: null };
    s.busy = function(){ return s.dragging || !!s.editing || !!(document.activeElement && document.activeElement.closest &&
                                                              document.activeElement.closest('.p-ideas-bar textarea')); };
    var wait = el('p', 'p-empty', 'Loading the board…');
    root.appendChild(wait);
    P.ask('/panel/board?name=' + BOARD).then(function(r){
      if(!alive(s)){ return; }
      if(r.status !== 200){ wait.textContent = 'The board could not be read just now.'; return; }
      s.data = r.body;
      wait.remove();
      root.appendChild(toolbar(s));
      s.holder = el('div', 'p-ideas-holder');
      root.appendChild(s.holder);
      draw(s);
      s.timer = setTimeout(function(){ load(s, true); }, 20000);
    }).catch(function(e){ if(e.message !== 'signed out' && alive(s)){ wait.textContent = 'The bot did not answer.'; } });
  }});
})();
