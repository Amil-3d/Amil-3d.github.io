/* The Brain section of the panel: Memory, Recipes, Skills.
   Like the rest of the panel it holds no data. Everything is fetched from the bot after the login,
   every value is put on the page as text, and every button goes through Panel.press(), so the bot
   writes each press to the log. Styles come only from panel.css. */
(function(){
  var P = window.Panel, el = P.el;
  var VIEWS = [['memory', 'Memory'], ['recipes', 'Recipes'], ['skills', 'Skills']];
  var view = 'memory', body = null, run = 0;

  function money(cents){ return '$' + (cents / 100).toFixed(2); }
  function load(path, then){
    var mine = ++run;
    return P.ask(path).then(function(r){
      if(mine !== run){ return; }
      if(r.status !== 200){ body.textContent = ''; body.appendChild(el('p', 'p-empty', 'That could not be read just now. Try again in a minute.')); return; }
      then(r.body);
    }).catch(function(e){
      if(e.message !== 'signed out' && mine === run){ body.textContent = ''; body.appendChild(el('p', 'p-empty', 'The bot did not answer. Try again in a minute.')); }
    });
  }
  function told(r, good){
    if(r.status !== 200){ return false; }
    if(r.body.ok === false || r.body.started === false){ P.say(r.body.why || 'That did not work.', true); return false; }
    P.say(good);
    return true;
  }
  function line(parent, cls, text){ var p = el('p', cls, text); parent.appendChild(p); return p; }
  /* A button that only acts on the second tap within 4 seconds */
  function twice(parent, text, again, kind, onSure){
    var armed = 0;
    var b = P.button(parent, text, kind, function(){
      if(Date.now() - armed < 4000){ armed = 0; b.textContent = text; onSure(b); return; }
      armed = Date.now();
      b.textContent = again;
      setTimeout(function(){ if(armed && Date.now() - armed >= 4000){ armed = 0; b.textContent = text; } }, 4100);
    });
    return b;
  }
  function field(parent, label, value, big){
    parent.appendChild(el('label', 'p-label', label));
    var input = el(big ? 'textarea' : 'input', 'p-input' + (big ? ' p-area p-area-short' : ''));
    if(!big){ input.type = 'text'; }
    input.value = value || '';
    parent.appendChild(input);
    return input;
  }
  function q(source, path){ return '?source=' + encodeURIComponent(source) + '&path=' + encodeURIComponent(path); }

  /* ---------- Memory ---------- */
  var open = null;   /* the file being shown: {source, path} */
  function showMemory(){
    if(open){ showFile(); return; }
    load('/panel/memory', function(m){
      body.textContent = '';
      line(body, 'p-note', 'Fix or delete one line at a time. ' + m.applies);
      m.sources.forEach(function(s){
        var c = P.card(body, s.title || 'Memory');
        if(s.about){ line(c, 'p-note', s.about); }
        if(s.error){ line(c, 'p-empty', s.error === 'off' ? 'The agents are switched off, so there is nothing to show.' : 'This could not be read just now.'); return; }
        if(!s.files.length){ line(c, 'p-empty', 'Nothing here yet.'); return; }
        var list = el('ul', 'p-rows p-files');
        c.appendChild(list);
        s.files.forEach(function(f){
          var li = el('li');
          P.button(li, f.name + (f.lines != null ? ' (' + f.lines + (f.lines === 1 ? ' line)' : ' lines)') : ''), 'quiet p-link p-file', function(){
            open = { source: s.id, path: f.path };
            showFile();
          });
          list.appendChild(li);
        });
      });
      if(m.copies && m.copies.day){ line(body, 'p-row-meta', 'Last daily copy: ' + P.when(m.copies.at) + '. Any file can be put back from a copy.'); }
    });
  }
  function showFile(undo){
    var at = open;
    load('/panel/memory/file' + q(at.source, at.path), function(f){ drawFile(at, f, undo); });
  }
  function drawFile(at, f, undo){
    body.textContent = '';
    var back = el('div', 'p-actions p-back');
    P.button(back, '‹ All memory', 'quiet p-link', function(){ open = null; P.say(''); showMemory(); });
    body.appendChild(back);
    var c = P.card(body, f.name);
    if(undo){
      var bar = el('div', 'p-actions p-undo');
      P.button(bar, 'Undo that', '', function(b){
        P.press('memory_undo', { undo: undo }, b).then(function(r){
          if(told(r, 'Undone. ' + (r.body.applies || ''))){ f.lines = r.body.lines; drawFile(at, f, null); }
        }).catch(function(){});
      });
      c.appendChild(bar);
    }
    function wrote(r, good){
      if(r.status === 200 && r.body.lines){ f.lines = r.body.lines; }
      var ok = told(r, good + ' ' + ((r.body && r.body.applies) || ''));
      drawFile(at, f, ok ? r.body.undo : null);
      if(!ok && r.status === 200){ P.say(r.body.why || 'That did not work.', true); }
    }
    if(!f.lines.length){ line(c, 'p-empty', 'This file is empty.'); }
    var list = el('ul', 'p-rows p-lines');
    c.appendChild(list);
    f.lines.forEach(function(text, i){
      var li = el('li');
      if(text.trim() === ''){ li.className = 'p-gap'; list.appendChild(li); return; }
      li.appendChild(el('div', 'p-line-text', text));
      var a = el('div', 'p-actions');
      P.button(a, 'Fix', 'quiet p-link', function(){
        a.hidden = true;
        var box = el('div', 'p-edit'), input = field(box, 'Line ' + (i + 1), text, true), ea = el('div', 'p-actions');
        P.button(ea, 'Save', 'main', function(b){
          P.press('memory_line', { source: at.source, path: at.path, line: i, was: text, text: input.value }, b).then(function(r){ wrote(r, 'Saved.'); }).catch(function(){});
        });
        P.button(ea, 'Cancel', 'quiet', function(){ box.remove(); a.hidden = false; });
        box.appendChild(ea);
        li.appendChild(box);
        input.focus();
      });
      twice(a, 'Delete', 'Tap again to delete', 'quiet p-link p-danger-link', function(b){
        P.press('memory_line', { source: at.source, path: at.path, line: i, was: text, text: null }, b).then(function(r){ wrote(r, 'Deleted.'); }).catch(function(){});
      });
      li.appendChild(a);
      list.appendChild(li);
    });

    var days = Array.isArray(f.days) ? f.days : [];
    c = P.card(body, 'Daily copies');
    if(!days.length){ line(c, 'p-empty', 'No daily copy holds this file yet. Copies are made at 3:37 AM.'); return; }
    line(c, 'p-note', 'Pick a day to see this file as it was, and put it back if you want.');
    var pick = el('select', 'p-input');
    pick.setAttribute('aria-label', 'Day of the copy');
    days.forEach(function(d){ var o = el('option', '', P.when(d)); o.value = d; pick.appendChild(o); });
    c.appendChild(pick);
    var a2 = el('div', 'p-actions'), shown = el('div');
    P.button(a2, 'Show that copy', '', function(b){
      b.disabled = true;
      P.ask('/panel/memory/file' + q(at.source, at.path) + '&day=' + pick.value).then(function(r){
        b.disabled = false;
        shown.textContent = '';
        if(r.status !== 200){ P.say('That copy could not be read just now.', true); return; }
        shown.appendChild(el('pre', 'p-snap', r.body.lines.join('\n') || '(empty)'));
        if(r.body.same){ line(shown, 'p-row-meta', 'This is the same as the file now.'); return; }
        var ra = el('div', 'p-actions'), day = r.body.day;
        twice(ra, 'Put this copy back', 'Tap again to replace the file', '', function(rb){
          P.press('memory_restore', { source: at.source, path: at.path, day: day }, rb).then(function(x){ wrote(x, 'Put back from ' + P.when(day) + '.'); window.scrollTo(0, 0); }).catch(function(){});
        });
        shown.appendChild(ra);
      }).catch(function(e){ b.disabled = false; if(e.message !== 'signed out'){ P.say('The bot did not answer.', true); } });
    });
    c.appendChild(a2);
    c.appendChild(shown);
  }

  /* ---------- Recipes ---------- */
  var DAY_NAMES = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  var REACH = { mail: 'Reads your email, so no browser and no web.', browser: 'Can open Canvas and the web, so it cannot read your email.',
                both: 'Runs as two separate parts, one for email and one for Canvas and the web.' };
  function spoken(t){ var m = /^(\d{2}):(\d{2})$/.exec(t); if(!m){ return t; } var h = +m[1]; return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' AM' : ' PM'); }
  /* "8pm", "8:30 PM" or "20:00" becomes "20:00"; anything else is null */
  function clock(typed){
    var m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?m?\.?$/i.exec(typed.trim());
    if(!m){ return null; }
    var h = +m[1], min = +(m[2] || 0), half = (m[3] || '').toLowerCase();
    if(half){ if(h < 1 || h > 12){ return null; } h = (h % 12) + (half === 'p' ? 12 : 0); }
    if(h > 23 || min > 59){ return null; }
    return (h < 10 ? '0' : '') + h + ':' + (min < 10 ? '0' : '') + min;
  }
  function showRecipes(){
    load('/panel/recipes', function(w){ drawRecipes(w); });
  }
  function drawRecipes(w){
    body.textContent = '';
    if(!w.on){ line(P.card(body, 'Recipes'), 'p-empty', 'Recipes are switched off.'); return; }
    line(body, 'p-note', 'Scheduled texts you set up. To add one, text me, like "every Sunday at 8 PM, text me my week".');
    if(w.paused){ line(body, 'msg bad', 'Everything is paused, so nothing runs.'); }
    if(!w.recipes.length){ line(P.card(body, 'Recipes'), 'p-empty', 'No recipes yet.'); return; }
    w.recipes.forEach(function(r){
      var c = P.card(body, '#' + r.n + ' ' + r.name);
      P.pill(c, r.on ? 'On' : 'Paused', r.on ? 'ok' : '');
      line(c, 'p-site-line', r.when + (r.next ? ' · next ' + r.next : ''));
      c.appendChild(el('div', 'p-mail-body', r.what));
      line(c, 'p-row-meta', REACH[r.reach] || '');
      line(c, 'p-row-meta', r.runs + (r.runs === 1 ? ' run' : ' runs') + ', ' + money(r.cents) + ' so far' + (r.last ? ' · last: ' + r.last : ''));
      var a = el('div', 'p-actions');
      c.appendChild(a);
      if(!w.paused){
        twice(a, 'Run now', 'Tap again to run it', 'main', function(b){
          P.press('recipe_run', { number: r.n }, b).then(function(x){ told(x, x.body.say || 'Running.'); }).catch(function(){});
        });
      }
      P.button(a, 'Edit', '', function(){ a.hidden = true; recipeEditor(c, r, a, w); });
      twice(a, 'Delete', 'Tap again to delete', 'danger', function(b){
        P.press('recipe_delete', { number: r.n }, b).then(function(x){ if(told(x, 'Deleted recipe #' + r.n + '.')){ w.recipes = x.body.recipes; drawRecipes(w); } }).catch(function(){});
      });
    });
    line(body, 'p-row-meta', 'Run now is one real run: it can text you, and it counts toward spend (each run is capped at ' + w.cap + ' cents).');
  }
  function recipeEditor(c, r, actions, w){
    var box = el('div', 'p-edit');
    var name = field(box, 'Name', r.name);
    var what = field(box, 'What it does', r.what, true);
    box.appendChild(el('label', 'p-label', 'Days'));
    var chips = el('div', 'p-chips'), on = {};
    w.days.forEach(function(d){
      on[d] = r.days.indexOf(d) >= 0;
      var b = P.button(chips, DAY_NAMES[d] || d, 'p-chip', function(){ on[d] = !on[d]; b.setAttribute('aria-pressed', on[d] ? 'true' : 'false'); });
      b.setAttribute('aria-pressed', on[d] ? 'true' : 'false');
    });
    box.appendChild(chips);
    var times = field(box, 'Times, with commas between', r.times.map(spoken).join(', '));
    var a = el('div', 'p-actions');
    P.button(a, 'Save', 'main', function(b){
      var days = w.days.filter(function(d){ return on[d]; });
      var list = times.value.split(',').map(clock);
      if(!days.length){ P.say('Pick at least one day.', true); return; }
      if(!list.length || list.some(function(t){ return t === null; })){ P.say('Type times like 8:00 PM or 20:00, with commas between.', true); return; }
      P.press('recipe_edit', { number: r.n, name: name.value, what: what.value, days: days, times: list }, b).then(function(x){
        if(told(x, 'Saved. It applies from its next run.')){ w.recipes = x.body.recipes; drawRecipes(w); }
      }).catch(function(){});
    });
    P.button(a, 'Cancel', 'quiet', function(){ box.remove(); actions.hidden = false; });
    box.appendChild(a);
    c.appendChild(box);
    name.focus();
  }

  /* ---------- Skills ---------- */
  function showSkills(){
    load('/panel/skills', function(w){ drawSkills(w); });
  }
  function drawSkills(w){
    body.textContent = '';
    line(body, 'p-note', 'How-tos I saved after your jobs, and notes on how you like emails written. Agents read a how-to when a job fits, so there is nothing to run. Edits apply from the next job.');
    if(!w.on){ line(body, 'p-row-meta', 'Learning new skills is switched off. The saved ones are still used.'); }
    if(!w.skills.length){ line(P.card(body, 'How-tos'), 'p-empty', 'Nothing learned yet.'); }
    w.skills.forEach(function(s){
      var c = P.card(body, s.title);
      line(c, 'p-site-line', 'Use when: ' + s.when);
      c.appendChild(el('div', 'p-mail-body', s.steps));
      line(c, 'p-row-meta', 'Saved ' + P.when(s.saved) + (s.task ? ' from task #' + s.task : '') + (s.edited ? ' · you edited it ' + P.when(s.edited) : ''));
      var a = el('div', 'p-actions');
      c.appendChild(a);
      P.button(a, 'Edit', '', function(){
        a.hidden = true;
        var box = el('div', 'p-edit');
        var title = field(box, 'Title (starts with "How to")', s.title);
        var when = field(box, 'Use when', s.when);
        var steps = field(box, 'Steps (up to ' + w.most.steps + ' characters)', s.steps, true);
        var ea = el('div', 'p-actions');
        P.button(ea, 'Save', 'main', function(b){
          P.press('skill_edit', { slug: s.slug, title: title.value, when: when.value, steps: steps.value }, b).then(function(x){
            if(told(x, x.body.applies || 'Saved.')){ w.skills = x.body.skills; drawSkills(w); }
          }).catch(function(){});
        });
        P.button(ea, 'Cancel', 'quiet', function(){ box.remove(); a.hidden = false; });
        box.appendChild(ea);
        c.appendChild(box);
        steps.focus();
      });
      twice(a, 'Delete', 'Tap again to delete', 'danger', function(b){
        P.press('skill_delete', { slug: s.slug }, b).then(function(x){ if(told(x, 'Deleted.')){ w.skills = x.body.skills; drawSkills(w); } }).catch(function(){});
      });
    });

    if(w.skills.length < w.most.skills){
      var ac = P.card(body, 'Add a how-to'), abox = el('div', 'p-edit p-add-box');
      abox.hidden = true;
      var open2 = el('div', 'p-actions p-back');
      P.button(open2, 'Write one', '', function(){ abox.hidden = false; open2.hidden = true; nt.focus(); });
      ac.appendChild(open2);
      var nt = field(abox, 'Title (starts with "How to")', 'How to ');
      var nw = field(abox, 'Use when', '');
      var ns = field(abox, 'Steps (up to ' + w.most.steps + ' characters)', '', true);
      var aa = el('div', 'p-actions');
      P.button(aa, 'Add', 'main', function(b){
        P.press('skill_add', { title: nt.value, when: nw.value, steps: ns.value }, b).then(function(x){
          if(told(x, x.body.applies || 'Added.')){ w.skills = x.body.skills; drawSkills(w); }
        }).catch(function(){});
      });
      P.button(aa, 'Cancel', 'quiet', function(){ abox.hidden = true; open2.hidden = false; });
      abox.appendChild(aa);
      ac.appendChild(abox);
    }

    var c = P.card(body, 'Email style notes');
    if(w.style.length < w.most.style){
      var sform = el('form', 'p-add'), sin = el('input', 'p-input'), sgo = el('button', 'p-btn', 'Add');
      sin.type = 'text';
      sin.placeholder = 'A new style note';
      sin.setAttribute('aria-label', 'A new email style note');
      sgo.type = 'submit';
      sform.appendChild(sin);
      sform.appendChild(sgo);
      sform.addEventListener('submit', function(e){
        e.preventDefault();
        if(!sin.value.trim()){ return; }
        P.press('style_add', { rule: sin.value }, sgo).then(function(x){
          if(told(x, x.body.applies || 'Added.')){ w.style = x.body.style; drawSkills(w); }
        }).catch(function(){});
      });
      c.appendChild(sform);
    }
    if(!w.style.length){ line(c, 'p-empty p-after', 'No style notes yet. They also come from what you say about drafts.'); return; }
    var list = el('ul', 'p-rows p-lines');
    c.appendChild(list);
    w.style.forEach(function(s, i){
      var li = el('li');
      li.appendChild(el('div', 'p-line-text p-plain', s.rule));
      var a = el('div', 'p-actions');
      function sent(x, good){ if(told(x, good)){ w.style = x.body.style; drawSkills(w); } else if(x.status === 200 && x.body.style){ w.style = x.body.style; } }
      P.button(a, 'Fix', 'quiet p-link', function(){
        a.hidden = true;
        var box = el('div', 'p-edit'), input = field(box, 'Style note', s.rule), ea = el('div', 'p-actions');
        P.button(ea, 'Save', 'main', function(b){
          P.press('style_edit', { index: i, was: s.rule, rule: input.value }, b).then(function(x){ sent(x, (x.body && x.body.applies) || 'Saved.'); }).catch(function(){});
        });
        P.button(ea, 'Cancel', 'quiet', function(){ box.remove(); a.hidden = false; });
        box.appendChild(ea);
        li.appendChild(box);
        input.focus();
      });
      twice(a, 'Delete', 'Tap again to delete', 'quiet p-link p-danger-link', function(b){
        P.press('style_edit', { index: i, was: s.rule, rule: null }, b).then(function(x){ sent(x, 'Deleted.'); }).catch(function(){});
      });
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* ---------- the section ---------- */
  var SHOW = { memory: showMemory, recipes: showRecipes, skills: showSkills };
  P.section({ id: 'brain', title: 'Brain', after: 'inside', render: function(root){
    var asked = (/^#brain\/(\w+)/.exec(location.hash) || [])[1];
    if(SHOW[asked]){ view = asked; }
    try{ history.replaceState(null, '', '#brain/' + view); }catch(e){}
    var nav = el('div', 'p-seg');
    nav.setAttribute('role', 'tablist');
    VIEWS.forEach(function(v){
      var b = P.button(nav, v[1], 'p-seg-btn', function(){
        view = v[0];
        open = null;
        try{ history.replaceState(null, '', '#brain/' + view); }catch(e){}
        P.say('');
        Array.prototype.forEach.call(nav.children, function(x){ x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        body.textContent = '';
        body.appendChild(el('p', 'p-empty', 'Loading…'));
        SHOW[view]();
      });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', v[0] === view ? 'true' : 'false');
    });
    root.appendChild(nav);
    body = el('div', 'p-stack');
    body.appendChild(el('p', 'p-empty', 'Loading…'));
    root.appendChild(body);
    SHOW[view]();
  }});
})();
