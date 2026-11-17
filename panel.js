/* The Assistant panel. Holds no data: everything shown is fetched from the bot after the login,
   and every value from the bot is put on the page as text, never as HTML.
   The panel is a shell with sections. A section is added with Panel.section({...}), so later
   phases add their own without changing this shell. Every button goes through Panel.press(),
   which is the bot's one door for buttons, so every press is in the log. */
(function(){
  var Login = window.AssistantLogin;
  var sections = [], current = null, home = null;

  try{
    var theme = localStorage.getItem('theme');   /* the same choice as the rest of the site */
    if(theme){ document.documentElement.setAttribute('data-theme', theme); }
  }catch(e){}

  function $(id){ return document.getElementById(id); }
  function el(tag, cls, text){
    var n = document.createElement(tag);
    if(cls){ n.className = cls; }
    if(text != null && text !== ''){ n.textContent = String(text); }
    return n;
  }
  /* "2026-11-16 14:05" becomes "Nov 16, 2:05 PM". Times are the bot's, Eastern. */
  function when(stamp){
    var m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(stamp || '');
    if(!m){ return stamp || ''; }
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var out = months[+m[2] - 1] + ' ' + (+m[3]);
    if(m[4] != null){
      var h = +m[4];
      out += ', ' + (h % 12 || 12) + ':' + m[5] + (h < 12 ? ' AM' : ' PM');
    }
    return out;
  }
  function say(text, bad){ $('appmsg').textContent = text || ''; $('appmsg').className = 'msg' + (bad ? ' bad' : ''); }
  function card(parent, title){
    var c = el('section', 'p-card');
    c.appendChild(el('h2', '', title));
    parent.appendChild(c);
    return c;
  }
  function rows(parent){ var u = el('ul', 'p-rows'); parent.appendChild(u); return u; }
  function row(list, main, side, sub, meta){
    var li = el('li'), top = el('div', 'p-row-top');
    top.appendChild(el('span', 'p-row-main', main));
    if(side){ top.appendChild(el('span', 'p-row-side', side)); }
    li.appendChild(top);
    if(sub){ li.appendChild(el('div', 'p-row-sub', sub)); }
    if(meta){ li.appendChild(el('div', 'p-row-meta', meta)); }
    list.appendChild(li);
    return li;
  }
  function pill(parent, text, kind){ var p = el('span', 'p-pill' + (kind ? ' ' + kind : ''), text); parent.appendChild(p); return p; }
  function button(parent, text, kind, onClick){
    var b = el('button', 'p-btn' + (kind ? ' ' + kind : ''), text);
    b.type = 'button';
    b.addEventListener('click', function(){ onClick(b); });
    parent.appendChild(b);
    return b;
  }

  /* ---------- talking to the bot ---------- */
  function signedOut(message){
    Login.forget();
    home = null;
    $('app').hidden = true;
    $('tabs').hidden = true;
    $('signout').hidden = true;
    $('device').textContent = '';
    $('gate').hidden = false;
    form.reset();
    form.say(message || '', false);
  }
  function ask(path, options){
    return Login.call(path, options).then(function(r){
      if(r.status === 401){ signedOut('Your login ran out. Enter the password again.'); throw new Error('signed out'); }
      return r;
    });
  }
  /* Every button in the panel. The bot writes the press to the log before it answers. */
  function press(name, args, btn){
    if(btn){ btn.disabled = true; }
    return ask('/panel/do/' + name, { json: args || {} }).then(function(r){
      if(btn){ btn.disabled = false; }
      if(r.status === 429){ say('Too many requests. Wait a minute.', true); }
      else if(r.status !== 200){ say('That did not work (' + (r.body.why || r.body.error || r.status) + ').', true); }
      return r;
    }).catch(function(e){
      if(btn){ btn.disabled = false; }
      if(e.message !== 'signed out'){ say('The bot did not answer. Try again in a minute.', true); }
      throw e;
    });
  }

  /* ---------- the shell ---------- */
  function show(id){
    var s = sections.filter(function(x){ return x.id === id; })[0] || sections[0];
    current = s.id;
    try{ history.replaceState(null, '', '#' + s.id); }catch(e){}
    Array.prototype.forEach.call($('tabs').children, function(t){
      if(t.dataset.id === s.id){ t.setAttribute('aria-current', 'page'); } else { t.removeAttribute('aria-current'); }
    });
    var view = $('view');
    view.textContent = '';
    say('');
    var stack = el('div', 'p-stack');
    view.appendChild(stack);
    s.render(stack, home);
    window.scrollTo(0, 0);
  }
  function buildTabs(){
    $('tabs').textContent = '';
    sections.forEach(function(s){
      var t = el('button', 'p-tab', s.title);
      t.type = 'button';
      t.dataset.id = s.id;
      t.addEventListener('click', function(){ show(s.id); });
      $('tabs').appendChild(t);
    });
  }
  function load(){
    return ask('/panel/home').then(function(r){
      if(r.status !== 200){ throw new Error('status ' + r.status); }
      home = r.body;
      $('gate').hidden = true;
      $('app').hidden = false;
      $('tabs').hidden = false;
      $('signout').hidden = false;
      $('device').textContent = home.device.label;
      show(current || location.hash.slice(1));
    }).catch(function(e){
      if(e.message === 'signed out'){ return; }
      if($('app').hidden){ $('gate').hidden = false; form.say('The bot did not answer. Try again in a minute.', true); }
      else{ say('Could not refresh just now.', true); }
    });
  }

  var form = Login.wire({ form: $('loginform'), label: $('pwlab'), password: $('pw'), code: $('code'),
                          button: $('go'), message: $('loginmsg'), onIn: load });
  $('signout').addEventListener('click', function(){
    Login.signOut();
    signedOut('Signed out.');
  });

  window.Panel = {
    section: function(s){ sections.push(s); },
    press: press, ask: ask, reload: load, say: say,
    el: el, card: card, rows: rows, row: row, pill: pill, button: button, when: when
  };

  /* ---------- sections ---------- */
  Panel.section({ id: 'assistant', title: 'Assistant', render: function(root){
    var c = card(root, 'Assistant');
    c.appendChild(el('p', 'p-empty', 'Drafts waiting on you, today\'s tracker and to-dos, and the switches arrive here in the next phase.'));
    var a = el('div', 'p-actions');
    var link = el('a', 'p-btn', 'Open the dashboard');
    link.href = 'assistant.html#private';
    a.appendChild(link);
    c.appendChild(a);
  }});

  Panel.section({ id: 'study', title: 'Study', render: function(root){
    var c = card(root, 'Study');
    c.appendChild(el('p', 'p-empty', 'The study library, flashcards and workbooks arrive here in a later phase.'));
  }});

  Panel.section({ id: 'log', title: 'Log', render: function(root){
    var c = card(root, 'Every button pressed');
    var note = el('p', 'p-empty', 'Loading…');
    c.appendChild(note);
    ask('/panel/log').then(function(r){
      if(r.status !== 200){ note.textContent = 'The log could not be read just now.'; return; }
      var entries = r.body.entries || [];
      if(!entries.length){ note.textContent = 'Nothing yet this month.'; return; }
      note.remove();
      var list = rows(c);
      entries.forEach(function(e){
        var li = row(list, e.what, when(e.at), e.detail, e.device + (e.saved ? '' : ' · not saved yet'));
        var bad = e.result !== 'ok';
        pill(li.querySelector('.p-row-meta'), e.result, bad ? 'bad' : 'ok');
      });
    }).catch(function(e){ if(e.message !== 'signed out'){ note.textContent = 'The bot did not answer.'; } });
  }});

  Panel.section({ id: 'system', title: 'System', render: function(root, h){
    /* the data repo */
    var repo = h.data_repo || {}, c = card(root, 'Data repo');
    var list = rows(c);
    var li = row(list, repo.on ? repo.repo : 'Not connected', '', repo.on ? '' : 'Set ASSISTANT_DATA_TOKEN on Render to connect it.',
                 repo.error ? 'Last problem: ' + repo.error : '');
    pill(li.querySelector('.p-row-top'), !repo.on ? 'off' : (repo.ok === false ? 'failing' : 'connected'), !repo.on || repo.ok === false ? 'bad' : 'ok');
    var a = el('div', 'p-actions');
    button(a, 'Check the data repo', '', function(b){
      press('check_data_repo', {}, b).then(function(r){
        if(r.status === 200 && r.body.ok){ say(r.body.made.length ? 'Connected. Made: ' + r.body.made.join(', ') : 'Connected. Every folder is there.'); }
        else if(r.status === 200){ say(r.body.why, true); }
      }).catch(function(){});
    });
    c.appendChild(a);

    /* the settings file */
    var s = h.settings || {};
    c = card(root, 'Settings file');
    c.appendChild(el('p', 'p-note', s.source === 'file'
      ? 'Read from settings/switches.json when the bot last started. A switch that is not in the file keeps its Render setting.'
      : 'Using the Render settings, because ' + (s.why || 'the file was not read') + '.'));
    list = rows(c);
    (s.switches || []).forEach(function(w){
      var r = row(list, w.name.replace(/_/g, ' '), w.value, w.note || '', 'from ' + w.from);
      if(w.from === 'file'){ r.querySelector('.p-row-side').classList.add('p-from-file'); }
    });
    if((s.ignored || []).length){ c.appendChild(el('p', 'msg bad', 'Ignored in the file: ' + s.ignored.join(', '))); }

    /* the copies */
    var k = h.copies || {};
    c = card(root, 'Copies');
    list = rows(c);
    row(list, 'Memory copy', k.day ? when(k.at) : 'none yet',
        k.on ? 'Every day at ' + k.copy_time + '. ' + k.keep_days + ' days are kept.' : 'Off until the data repo is connected.',
        k.day ? k.files + ' files' + ((k.problems || []).length ? ' · could not read: ' + k.problems.join(', ') : '') : '');
    row(list, 'Heartbeat snapshots', k.last_snapshot ? when(k.last_snapshot) : 'none since the bot started',
        'What each heartbeat run saw. ' + k.snapshot_days + ' days are kept.', k.snapshot_problem ? 'Last problem: ' + k.snapshot_problem : '');
    a = el('div', 'p-actions');
    button(a, 'Copy memory now', '', function(b){
      press('copy_memory', {}, b).then(function(r){
        if(r.status === 200){ say(r.body.started ? 'Copy started. Give it a minute, then reopen this tab.' : 'Not started: ' + r.body.why + '.', !r.body.started); }
      }).catch(function(){});
    });
    c.appendChild(a);

    /* devices */
    c = card(root, 'Signed-in devices');
    list = rows(c);
    (h.devices || []).forEach(function(d){
      var mine = d.id === h.device.id;
      var r = row(list, d.label + (mine ? ' (this one)' : ''), '', 'Signed in ' + when(d.first) + ', until ' + when(d.until), 'Last used ' + when(d.last));
      if(!mine){
        r.className = 'p-row-with-btn';
        var wrap = el('div');
        while(r.firstChild){ wrap.appendChild(r.firstChild); }
        r.appendChild(wrap);
        button(r, 'Sign out', 'danger', function(b){
          press('sign_out_device', { id: d.id }, b).then(function(){ load(); }).catch(function(){});
        });
      }
    });
  }});

  /* ---------- start ---------- */
  /* Waits for the page to finish loading, so sections added by later files are in the tabs too */
  document.addEventListener('DOMContentLoaded', function(){
    buildTabs();
    if(Login.has()){ load(); } else { $('gate').hidden = false; }
  });
})();
