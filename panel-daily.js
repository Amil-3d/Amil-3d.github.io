/* The Assistant section of the panel: Today, Chat, Morning, Waiting on you, Switches.
   Chat, Morning and the trading card on Today are drawn by panel-extras.js.
   Like the rest of the panel it holds no data. Everything is fetched from the bot after the login,
   every value is put on the page as text, and every button goes through Panel.press(), so the bot
   writes each press to the log. Styles come only from panel.css. */
(function(){
  var P = window.Panel, el = P.el;
  var X = window.PanelExtras;
  var VIEWS = [['today', 'Today'], ['chat', 'Chat'], ['morning', 'Morning'], ['waiting', 'Waiting'], ['switches', 'Switches']];   /* the panel opens on the first */
  var view = (/^#assistant\/(\w+)/.exec(location.hash) || [])[1];
  if(!VIEWS.some(function(v){ return v[0] === view; })){ view = VIEWS[0][0]; }
  var body = null, timer = null, run = 0;

  function clock(text){   /* "14:30" becomes "2:30 PM" */
    var h = +text.slice(0, 2);
    return (h % 12 || 12) + ':' + text.slice(3) + (h < 12 ? ' AM' : ' PM');
  }
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
  /* A button that asks for a second tap before it does something that cannot be taken back */
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
    var input = el(big ? 'textarea' : 'input', 'p-input' + (big ? ' p-area' : ''));
    if(!big){ input.type = 'text'; }
    input.value = value || '';
    input.autocapitalize = 'off';
    parent.appendChild(input);
    return input;
  }
  /* What a press came back with, as one line under the top bar. True when it worked. */
  function told(r, good){
    if(r.status !== 200){ return false; }
    if(r.body.ok === false || r.body.started === false){ P.say(r.body.why || 'That did not work.', true); return false; }
    P.say(good + (r.body.saved === false ? ' ' + r.body.why : ''), r.body.saved === false);
    return true;
  }

  /* ---------- Waiting on you ---------- */
  function showWaiting(){
    clearTimeout(timer);
    load('/panel/waiting', function(w){
      body.textContent = '';
      if(w.paused){ body.appendChild(el('p', 'p-note', 'Everything is paused, so nothing can be sent or redone until you turn it back on.')); }
      if(!w.waiting.length){
        var none = P.card(body, 'Waiting on you');
        none.appendChild(el('p', 'p-empty', 'No drafts are waiting on your yes.'));
      }
      w.waiting.forEach(function(d){ draftCard(d, w.paused); });
      if((w.old_watch || []).length){
        var o = P.card(body, 'From the hourly inbox watch');
        o.appendChild(el('p', 'p-note', 'These are answered by text, not here.'));
        var ol = P.rows(o);
        w.old_watch.forEach(function(line){ P.row(ol, line); });
      }
      if(w.handled.length){
        var h = P.card(body, 'Recently handled');
        var list = P.rows(h);
        w.handled.forEach(function(d){
          var li = P.row(list, d.subject || '(no subject)', P.when(d.saved), 'To ' + d.to, d.note);
          P.pill(li.querySelector('.p-row-top'), d.status, d.status === 'sent' ? 'ok' : (d.status === 'unsure' || d.status === 'changed' ? 'bad' : ''));
        });
      }
      /* Outlook work happens in a browser behind the bot, so the page looks again while one is busy */
      if(w.waiting.some(function(d){ return d.busy || d.status === 'sending'; })){ timer = setTimeout(function(){ if(view === 'waiting' && body.isConnected){ showWaiting(); } }, 6000); }
    });
  }
  function draftCard(d, paused){
    var c = P.card(body, d.where + ' draft ' + d.id);
    var head = el('div', 'p-mail-head');
    head.appendChild(el('div', '', 'To ' + d.to + (d.cc ? ' (cc ' + d.cc + ')' : '')));
    head.appendChild(el('div', 'p-mail-subject', d.subject));
    c.appendChild(head);
    c.appendChild(el('div', 'p-mail-body', d.body));
    var meta = el('div', 'p-row-meta', 'Saved ' + P.when(d.saved) + (d.asked ? ' · a task is waiting on your yes' : ''));
    c.appendChild(meta);
    if(d.note){ c.appendChild(el('p', 'p-note p-outcome', d.note)); }
    if(d.busy || d.status === 'sending'){
      P.pill(meta, d.busy || 'sending', '');
      c.appendChild(el('p', 'p-empty', d.where === 'Outlook' ? 'Working in Outlook. This takes about a minute.' : 'Working on it.'));
      return;
    }
    var slow = d.where === 'Outlook';
    var a = el('div', 'p-actions');
    c.appendChild(a);
    function after(r, good){ if(told(r, good)){ showWaiting(); } }
    if(!paused){
      twice(a, 'Send', 'Tap again to send', 'main', function(b){
        P.press('draft_send', { id: d.id, mark: d.mark }, b).then(function(r){ after(r, slow ? 'Sending from Outlook. This takes about a minute.' : r.body.said || 'Sent.'); }).catch(function(){});
      });
      P.button(a, 'Edit', '', function(){ a.hidden = true; editor(c, d, a); });
      P.button(a, 'Redo with Opus', '', function(b){
        P.press('draft_redo', { id: d.id, mark: d.mark }, b).then(function(r){ after(r, 'Opus is rewriting it. The new draft shows up here when it is ready.'); }).catch(function(){});
      });
    }
    twice(a, 'Discard', 'Tap again to discard', 'danger', function(b){
      P.press('draft_discard', { id: d.id, mark: d.mark }, b).then(function(r){ after(r, slow ? 'Discarding it in Outlook. This takes about a minute.' : 'Discarded.'); }).catch(function(){});
    });
  }
  function editor(c, d, actions){
    var box = el('div', 'p-edit');
    var to = field(box, 'To', d.to);
    var cc = d.where === 'Gmail' ? field(box, 'Cc', d.cc) : null;
    var subject = field(box, 'Subject', d.subject);
    var text = field(box, 'Email', d.body, true);
    var a = el('div', 'p-actions');
    twice(a, 'Send this version', 'Tap again to send', 'main', function(b){
      var args = { id: d.id, mark: d.mark, to: to.value, subject: subject.value, body: text.value };
      if(cc){ args.cc = cc.value; }
      P.press('draft_edit_send', args, b).then(function(r){
        if(told(r, d.where === 'Outlook' ? 'Sending your version from Outlook. This takes about a minute.' : r.body.said || 'Sent.')){ showWaiting(); }
      }).catch(function(){});
    });
    P.button(a, 'Cancel', 'quiet', function(){ box.remove(); actions.hidden = false; });
    box.appendChild(a);
    c.appendChild(box);
    text.focus();
  }

  /* ---------- Today ---------- */
  var day = '', picked = {}, undo = null;
  function showToday(){
    load('/panel/today' + (day ? '?day=' + day : ''), function(t){
      day = t.day;
      body.textContent = '';
      var days = el('div', 'p-chips');
      t.days.forEach(function(d){
        var b = P.button(days, d.name, 'p-chip', function(){ day = d.day; picked = {}; undo = null; showToday(); });
        if(d.day === t.day){ b.setAttribute('aria-pressed', 'true'); }
      });
      body.appendChild(days);
      if(t.can_fill){ tracker(t); }
      todos(t);
      X.trading(body);
    });
  }
  function tracker(t){
    var c = P.card(body, 'Tracker, ' + t.name.toLowerCase());
    if(!Array.isArray(t.slots)){ c.appendChild(el('p', 'p-empty', 'The tracker row could not be read just now.')); return; }
    var grid = el('div', 'p-slots'), bar = el('div', 'p-slot-bar'), noteLine = el('p', 'p-note p-slot-note');
    t.slots.forEach(function(s, n){
      var b = el('button', 'p-slot' + (s.value ? ' filled' : '') + (n === t.now_slot ? ' now' : '') + (s.note ? ' noted' : ''));
      b.type = 'button';
      b.appendChild(el('span', 'p-slot-time', s.time.replace(':00', '').replace(' ', '').toLowerCase()));
      b.appendChild(el('span', 'p-slot-value', s.value || '·'));
      b.setAttribute('aria-pressed', picked[n] ? 'true' : 'false');
      b.setAttribute('aria-label', s.time + ', ' + (s.value || 'empty') + (s.note ? ', note: ' + s.note : ''));
      b.addEventListener('click', function(){
        if(picked[n]){ delete picked[n]; } else { picked[n] = true; }
        b.setAttribute('aria-pressed', picked[n] ? 'true' : 'false');
        drawBar();
      });
      grid.appendChild(b);
    });
    c.appendChild(grid);
    c.appendChild(noteLine);
    c.appendChild(bar);
    function chosen(){ return Object.keys(picked).map(Number).sort(function(a, b){ return a - b; }); }
    function set(code, btn){
      P.press('slot_set', { day: t.day, slots: chosen(), code: code }, btn).then(function(r){
        if(r.status !== 200){ return; }
        if(!r.body.ok){ P.say(r.body.why, true); return; }
        picked = {};
        undo = r.body.changed.length ? { day: t.day, changed: r.body.changed } : null;
        P.say(r.body.changed.length ? '' : 'Those slots already held that.');
        showToday();
      }).catch(function(){});
    }
    function drawBar(){
      var slots = chosen();
      bar.textContent = '';
      var notes = slots.filter(function(n){ return t.slots[n].note; }).map(function(n){ return t.slots[n].time + ': ' + t.slots[n].note; });
      noteLine.textContent = notes.join(' · ');
      if(!slots.length){
        if(undo && undo.day === t.day){
          var line = el('div', 'p-undo');
          line.appendChild(el('span', '', 'Changed ' + undo.changed.map(function(x){ return x.time + ' was ' + (x.old || 'empty') + ', now ' + (x.new || 'empty'); }).join('; ') + '.'));
          P.button(line, 'Undo', '', function(b){
            var back = {}, expect = {};
            undo.changed.forEach(function(x){ back[x.slot] = x.old; expect[x.slot] = x.new; });
            P.press('slot_undo', { day: t.day, back: back, expect: expect }, b).then(function(r){
              if(r.status !== 200){ return; }
              if(!r.body.ok){ P.say(r.body.why, true); return; }
              undo = null;
              P.say('Put back.');
              showToday();
            }).catch(function(){});
          });
          bar.appendChild(line);
        } else {
          bar.appendChild(el('p', 'p-empty', 'Tap slots to pick them, then pick what they were. A tap writes over what is there, and you can undo it.'));
        }
        return;
      }
      bar.appendChild(el('p', 'p-note', slots.length + (slots.length === 1 ? ' slot' : ' slots') + ' picked, from ' + t.slots[slots[0]].time + '. Set to:'));
      var keys = el('div', 'p-chips');
      (Array.isArray(t.key) ? t.key : []).forEach(function(k){
        P.button(keys, k.code + ' ' + k.name, 'p-chip', function(b){ set(k.code, b); });
      });
      bar.appendChild(keys);
      var more = el('div', 'p-actions');
      var split = el('input', 'p-input p-split');
      split.type = 'text'; split.placeholder = 'Split, like 5/8'; split.maxLength = 8; split.autocapitalize = 'characters';
      more.appendChild(split);
      P.button(more, 'Set split', '', function(b){ if(split.value.trim()){ set(split.value.trim(), b); } });
      P.button(more, 'Empty', 'danger', function(b){ set('', b); });
      P.button(more, 'Cancel', 'quiet', function(){ picked = {}; showToday(); });
      bar.appendChild(more);
    }
    drawBar();
  }
  function todos(t){
    var c = P.card(body, 'To-dos, ' + t.name.toLowerCase());
    if(!Array.isArray(t.todos)){ c.appendChild(el('p', 'p-empty', 'The to-do list could not be read just now.')); return; }
    if(!t.todos.length){ c.appendChild(el('p', 'p-empty', 'Nothing on the list.')); }
    var list = el('ul', 'p-todos');
    t.todos.forEach(function(item){
      var li = el('li'), b = el('button', 'p-todo' + (item.open ? ' open' : ' done'));
      b.type = 'button';
      b.setAttribute('aria-pressed', item.open ? 'false' : 'true');
      b.appendChild(el('span', 'p-check', item.open ? '' : '✓'));
      b.appendChild(el('span', 'p-todo-text', item.text));
      b.addEventListener('click', function(){
        P.press('todo_check', { day: t.day, item: item.text, done: item.open }, b).then(function(r){
          if(r.status === 200 && !r.body.ok){ P.say(r.body.why, true); }
          else if(r.status === 200){ P.say(''); }
          showToday();
        }).catch(function(){});
      });
      li.appendChild(b);
      list.appendChild(li);
    });
    c.appendChild(list);
    var add = el('form', 'p-add');
    var input = el('input', 'p-input');
    input.type = 'text'; input.placeholder = 'Add a to-do'; input.maxLength = 120; input.setAttribute('aria-label', 'Add a to-do');
    var go = el('button', 'p-btn', 'Add');
    go.type = 'submit';
    add.appendChild(input); add.appendChild(go);
    add.addEventListener('submit', function(e){
      e.preventDefault();
      var text = input.value.trim();
      if(!text){ return; }
      if(text.indexOf(',') >= 0){ P.say('One item at a time, with no commas in it.', true); return; }
      P.press('todo_add', { day: t.day, item: text }, go).then(function(r){
        if(r.status === 200 && !r.body.ok){ P.say(r.body.why, true); return; }
        if(r.status === 200){ P.say(''); showToday(); }
      }).catch(function(){});
    });
    c.appendChild(add);
  }

  /* ---------- Switches ---------- */
  function toggle(parent, on, label, onChange){
    var b = el('button', 'p-switch');
    b.type = 'button';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.setAttribute('aria-label', label);
    b.appendChild(el('span', 'p-switch-knob'));
    b.addEventListener('click', function(){ onChange(!on, b); });
    parent.appendChild(b);
    return b;
  }
  function switchRow(list, title, sub, on, label, onChange){
    var li = el('li', 'p-row-with-btn'), text = el('div');
    text.appendChild(el('div', 'p-row-main', title));
    if(sub){ text.appendChild(el('div', 'p-row-sub', sub)); }
    li.appendChild(text);
    toggle(li, on, label, onChange);
    list.appendChild(li);
    return li;
  }
  function setSwitch(name, value, btn, good){
    P.press('switch_set', { name: name, value: value }, btn).then(function(r){ told(r, good); showSwitches(); }).catch(function(){});
  }
  function times(from, to){
    var out = [];
    for(var m = (+from.slice(0, 2)) * 60 + (+from.slice(3)); m <= (+to.slice(0, 2)) * 60 + (+to.slice(3)); m += 15){
      out.push(('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2));
    }
    return out;
  }
  function picker(parent, label, options, value, onPick){
    parent.appendChild(el('label', 'p-label', label));
    var s = el('select', 'p-input');
    s.setAttribute('aria-label', label);
    options.forEach(function(o){
      var opt = el('option', '', o[1]);
      opt.value = o[0];
      if(String(o[0]) === String(value)){ opt.selected = true; }
      s.appendChild(opt);
    });
    s.addEventListener('change', function(){ onPick(s.value, s); });
    parent.appendChild(s);
    return s;
  }
  function showSwitches(){
    load('/panel/switches', function(w){
      body.textContent = '';
      P.paused(w.paused);

      var c = P.card(body, 'Pause everything');
      c.appendChild(el('p', 'p-note', w.paused
        ? 'Paused. No agent runs, no email is sent and no check-ins go out. I still answer your texts, and to-dos, the tracker and reminders still work.'
        : 'Stops every agent and every email send until you turn it back on. Running jobs are stopped. I still answer your texts, and to-dos, the tracker and reminders keep working.'));
      var a = el('div', 'p-actions');
      if(w.paused){
        P.button(a, 'Turn everything back on', 'main', function(b){
          P.press('resume_all', {}, b).then(function(r){ told(r, 'Everything is back on.'); showSwitches(); }).catch(function(){});
        });
      } else {
        twice(a, 'Pause everything', 'Tap again to pause', 'danger', function(b){
          P.press('pause_all', {}, b).then(function(r){
            told(r, 'Paused.' + ((r.body.stopped || []).length ? ' Stopped ' + r.body.stopped.length + ' running job' + (r.body.stopped.length === 1 ? '.' : 's.') : ''));
            showSwitches();
          }).catch(function(){});
        });
      }
      c.appendChild(a);
      if(w.unsaved){ c.appendChild(el('p', 'msg bad', 'The last change is in place but was not saved (' + w.unsaved + '), so a restart would lose it.')); }
      if(w.running.length){ c.appendChild(el('p', 'p-row-meta', 'Running now: ' + w.running.map(function(n){ return 'task #' + n; }).join(', '))); }

      c = P.card(body, 'Heartbeat');
      var list = P.rows(c);
      switchRow(list, 'Check-ins', w.heartbeat === 'shadow' ? 'In shadow mode: it runs and records, and texts nothing.'
                : (w.heartbeat === 'live' ? 'Runs every 30 minutes and texts you when it has something.' : 'Off. It does not run and costs nothing.'),
                w.heartbeat !== 'off', 'Heartbeat', function(on, b){ setSwitch('heartbeat', on ? 'live' : 'off', b, on ? 'The heartbeat is on.' : 'The heartbeat is off.'); });
      var k = w.checkin;
      picker(c, 'Texts per day, at most', [1, 2, 3, 4, 5].map(function(n){ return [n, n === 5 ? '5, and a 6th only if the day needs it' : String(n)]; }),
             k.texts, function(v, s){ setSwitch('checkin_texts', +v, s, 'At most ' + v + ' a day.'); });
      var firsts = times(k.earliest, k.latest).filter(function(x){ return x < k.last; });
      var lasts = times(k.earliest, k.latest).filter(function(x){ return x > k.first; });
      picker(c, 'Quiet hours end, first check-in from', firsts.map(function(x){ return [x, clock(x)]; }), k.first,
             function(v, s){ setSwitch('checkin_first', v, s, 'No check-ins before ' + clock(v) + '.'); });
      picker(c, 'Quiet hours start, last check-in by', lasts.map(function(x){ return [x, clock(x)]; }), k.last,
             function(v, s){ setSwitch('checkin_last', v, s, 'No check-ins after ' + clock(v) + '.'); });
      c.appendChild(el('p', 'p-row-meta', 'Quiet from ' + clock(k.last) + ' to ' + clock(k.first) + '. Your rule keeps ' + clock(k.latest) + ' to ' + clock(k.earliest) + ' quiet whatever is picked, and check-ins stay 2.5 hours apart.'));

      c = P.card(body, 'Inbox watch');
      picker(c, 'The bot\'s hourly inbox watch', [['on', 'On'], ['shadow', 'Silent comparison'], ['off', 'Off']], w.inbox_watch,
             function(v, s){ setSwitch('inbox_watch', v, s, 'The inbox watch is ' + (v === 'shadow' ? 'in silent comparison' : v) + '.'); });
      c.appendChild(el('p', 'p-row-meta', 'On: it sorts new mail, marks read, drafts replies and texts you. Silent comparison: it only records what it would have done.'));

      c = P.card(body, 'Recipes');
      if(!w.recipes_on){ c.appendChild(el('p', 'p-empty', 'Recipes are switched off on Render.')); }
      else if(!w.recipes.length){ c.appendChild(el('p', 'p-empty', 'No recipes yet. Text me one, like "every Sunday at 8 PM, text me my week".')); }
      else {
        list = P.rows(c);
        w.recipes.forEach(function(r){
          switchRow(list, r.name, r.when + (r.on && r.next ? ' · next ' + r.next : ''), r.on, r.name, function(on, b){
            P.press('recipe_switch', { number: r.n, on: on }, b).then(function(x){ told(x, r.name + (on ? ' is on.' : ' is off.')); showSwitches(); }).catch(function(){});
          });
        });
      }
    });
  }

  /* ---------- the section ---------- */
  var SHOW = { waiting: showWaiting, today: showToday, switches: showSwitches,
    chat: function(){ run++; var mine = body; X.chat(body, function(){ return view === 'chat' && mine.isConnected; }); },
    morning: function(){ run++; X.morning(body); } };
  P.section({ id: 'assistant', title: 'Assistant', render: function(root){
    clearTimeout(timer);
    var asked = (/^#assistant\/(\w+)/.exec(location.hash) || [])[1];
    if(SHOW[asked]){ view = asked; }
    try{ history.replaceState(null, '', '#assistant/' + view); }catch(e){}
    var nav = el('div', 'p-seg');
    nav.setAttribute('role', 'tablist');
    VIEWS.forEach(function(v){
      var b = P.button(nav, v[1], 'p-seg-btn', function(){
        view = v[0];
        try{ history.replaceState(null, '', '#assistant/' + view); }catch(e){}
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
