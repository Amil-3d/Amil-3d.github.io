/* The Study section of the panel: Schedule, Library, Cards.
   Like the rest of the panel it holds no data. Everything is fetched from the bot after the login,
   every value is put on the page as text, and every button goes through Panel.press(), so the bot
   writes each press to the log. Styles come only from panel.css.
   A workbook is a page somebody else wrote, so it never runs in this page. It is shown in a sealed
   frame that the bot serves by itself: the frame has no login, cannot reach this page or its buttons,
   and cannot reach the network. It can only send this page a message with its progress, which this
   page checks and saves through a button. */
(function(){
  var P = window.Panel, el = P.el, Login = window.AssistantLogin;
  var VIEWS = [['plan', 'Schedule'], ['library', 'Library'], ['pinned', 'Pinned']];
  /* what a library item is: a workbook, a mock or practice test (a workbook the bot marks as one), or a card set */
  var SORTS = [['workbook', 'Workbooks'], ['mock', 'Mock tests'], ['cards', 'Cards']];
  function sortOf(i){ return i.kind === 'cards' ? 'cards' : i.mock ? 'mock' : 'workbook'; }
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var view = 'plan', body = null, run = 0, data = null, search = '', listener = null, leave = null;
  var shelf = null, part = null;   /* the notebook open in the Library (null is everything) and its section (null is all of it) */

  /* ---------- small helpers ---------- */
  function line(parent, cls, text){ var p = el('p', cls, text); parent.appendChild(p); return p; }
  function dayText(iso, withDay){
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if(!m){ return iso || ''; }
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return (withDay ? DAYS[d.getDay()] + ' ' : '') + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }
  function left(n){ return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? 'done' : 'in ' + n + ' days'; }
  function told(r, good){
    if(r.status !== 200){ return false; }
    if(r.body.ok === false || r.body.started === false){ P.say(r.body.why || 'That did not work.', true); return false; }
    P.say(good || r.body.said || '');
    return true;
  }
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
  function field(parent, label, type, value){
    parent.appendChild(el('label', 'p-label', label));
    var input = el(type === 'area' ? 'textarea' : 'input', 'p-input' + (type === 'area' ? ' p-area p-area-short' : ''));
    if(type !== 'area'){ input.type = type || 'text'; }
    input.value = value == null ? '' : value;
    input.setAttribute('aria-label', label);
    parent.appendChild(input);
    return input;
  }
  function picker(parent, label, options, value){
    parent.appendChild(el('label', 'p-label', label));
    var s = el('select', 'p-input');
    s.setAttribute('aria-label', label);
    options.forEach(function(o){
      var opt = el('option', '', o[1]);
      opt.value = String(o[0]);
      if(String(o[0]) === String(value)){ opt.selected = true; }
      s.appendChild(opt);
    });
    parent.appendChild(s);
    return s;
  }
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
  function range(from, to){ var out = []; for(var i = from; i <= to; i++){ out.push(i); } return out; }
  function clear(){
    if(leave){ var go = leave; leave = null; go(); }
    if(listener){ window.removeEventListener('message', listener); listener = null; }
    closeMenu();
    document.documentElement.classList.remove('p-book-open');
    if(document.fullscreenElement && document.exitFullscreen){ try{ document.exitFullscreen(); }catch(e){} }
    body.textContent = '';
  }
  function fetchAll(then){
    var mine = ++run;
    return P.ask('/panel/study').then(function(r){
      if(mine !== run){ return; }
      if(r.status !== 200){ clear(); line(body, 'p-empty', 'That could not be read just now. Try again in a minute.'); return; }
      data = r.body;
      if(!data.on){ clear(); line(P.card(body, 'Study'), 'p-empty', data.why || 'The study library is off.'); return; }
      then(data);
    }).catch(function(e){
      if(e.message !== 'signed out' && mine === run){ clear(); line(body, 'p-empty', 'The bot did not answer. Try again in a minute.'); }
    });
  }
  function refresh(){ SHOW[view](); }

  /* ---------- Schedule ---------- */
  var editing = null;
  function showPlan(){
    fetchAll(function(d){
      clear();
      var today = d.tests.filter(function(t){ return t.today && t.on && !t.past; });
      var due = d.items.reduce(function(n, i){ return n + (i.kind === 'cards' ? i.due : 0); }, 0);
      var c = P.card(body, 'Today');
      if(!today.length && !due){ line(c, 'p-empty', 'Nothing planned for today.'); }
      else{
        var list = P.rows(c);
        today.forEach(function(t){ P.row(list, t['class'] + ': ' + t.title, t.minutes + ' min', 'Test ' + left(t.days_left) + ', ' + dayText(t.date, true)); });
        if(due){
          var li = P.row(list, 'Flashcards due', String(due), '');
          li.className = 'p-row-with-btn';
          var wrap = el('div');
          while(li.firstChild){ wrap.appendChild(li.firstChild); }
          li.appendChild(wrap);
          P.button(li, 'Review', 'main', function(){ pick('pinned'); });
        }
      }

      c = P.card(body, 'Tests');
      var coming = d.tests.filter(function(t){ return !t.past; });
      if(!coming.length){ line(c, 'p-empty', 'No tests yet. Check Canvas below, or add one.'); }
      else{
        line(c, 'p-note', 'Study days count back from each test. Change anything; Canvas never overwrites what you changed.');
        list = P.rows(c);
        coming.forEach(function(t){ testRow(list, t, d); });
      }

      c = P.card(body, 'Add a test');
      var box = el('div', 'p-edit p-add-box');
      var cls = picker(box, 'Class', d.classes.map(function(x){ return [x, x]; }).concat([['', 'Another class']]), d.classes[0] || '');
      var other = field(box, 'Class name', 'text', '');
      other.hidden = d.classes.length > 0;
      other.previousSibling.hidden = other.hidden;
      cls.addEventListener('change', function(){ other.hidden = cls.value !== ''; other.previousSibling.hidden = other.hidden; });
      var title = field(box, 'What it is', 'text', '');
      title.placeholder = 'Exam 3';
      title.maxLength = 80;
      var date = field(box, 'Date', 'date', '');
      date.min = d.today;
      var a = el('div', 'p-actions');
      P.button(a, 'Add', 'main', function(b){
        P.press('study_test_add', { 'class': cls.value || other.value, title: title.value, date: date.value }, b)
          .then(function(r){ if(told(r, 'Added.')){ showPlan(); } }).catch(function(){});
      });
      box.appendChild(a);
      c.appendChild(box);

      c = P.card(body, 'Your usual plan');
      box = el('div', 'p-edit p-add-box');
      var start = picker(box, 'Start studying this many days before', range(d.limits.start_days[0], d.limits.start_days[1]).map(function(n){ return [n, n + (n === 1 ? ' day' : ' days')]; }), d.defaults.start_days);
      var mins = picker(box, 'One session is', range(1, 12).map(function(n){ return [n * 15, n * 15 + ' minutes']; }), d.defaults.minutes);
      function setUsual(args, s){ P.press('study_defaults', args, s).then(function(r){ if(told(r, 'Saved. Tests without their own plan follow it.')){ showPlan(); } }).catch(function(){}); }
      start.addEventListener('change', function(){ setUsual({ start_days: +start.value }, start); });
      mins.addEventListener('change', function(){ setUsual({ minutes: +mins.value }, mins); });
      c.appendChild(box);
      list = P.rows(c);
      var q = el('li', 'p-row-with-btn'), text = el('div');
      text.appendChild(el('div', 'p-row-main', 'Plan for quizzes too'));
      text.appendChild(el('div', 'p-row-sub', 'New quizzes from Canvas start with study days. Off: they are listed without any.'));
      q.appendChild(text);
      toggle(q, !!d.defaults.quiz, 'Plan for quizzes', function(on, b){ setUsual({ quiz: on }, b); });
      list.appendChild(q);

      c = P.card(body, 'Canvas');
      list = P.rows(c);
      var f = d.feed || {};
      P.row(list, 'Calendar', f.at ? P.when(f.at) : 'not read yet',
            !f.set ? 'No Canvas feed is set on Render.' : 'Read once a day for tests and quizzes. Free, no model.',
            f.at ? (f.ok ? f.found + ' tests and quizzes on it' : 'It did not answer last time') : '');
      var s = d.syllabus || {};
      P.row(list, 'Syllabi', s.running ? 'reading now' : (s.at ? P.when(s.at) : 'not read yet'),
            'One read-only run opens Canvas and looks for test dates that are not on the calendar. A few cents.',
            s.result ? 'Last time: ' + s.result : '');
      a = el('div', 'p-actions');
      P.button(a, 'Check Canvas for tests', '', function(b){
        P.press('study_feed', {}, b).then(function(r){ if(told(r)){ showPlan(); } }).catch(function(){});
      });
      P.button(a, 'Read my syllabi', '', function(b){
        P.press('study_syllabus', {}, b).then(function(r){ if(told(r, 'Started. It takes a few minutes, and I text you if it finds a test.')){ showPlan(); } }).catch(function(){});
      });
      c.appendChild(a);

      asksCard(d);
    });
  }
  function testRow(list, t, d){
    var plan = !t.on ? 'No study days (switched off)'
      : (t.sessions.length ? 'Study ' + t.sessions.map(function(x){ return dayText(x); }).join(', ') + ' · ' + t.minutes + ' min each' : 'Study days are all behind you');
    var li = P.row(list, t['class'] + ': ' + t.title, dayText(t.date, true) + ' · ' + left(t.days_left), plan,
                   (t.source === 'canvas' ? 'From Canvas' : t.source === 'syllabus' ? 'From your syllabus' : 'Added by you') +
                   (t.date_edited ? ' · date changed by you' : '') + (t.kind === 'quiz' ? ' · quiz' : ''));
    var a = el('div', 'p-actions');
    P.button(a, editing === t.id ? 'Close' : 'Change', 'quiet p-link', function(){ editing = editing === t.id ? null : t.id; showPlan(); });
    li.appendChild(a);
    if(editing !== t.id){ return; }
    var box = el('div', 'p-edit');
    function set(args, btn, good){ P.press('study_test_set', Object.assign({ id: t.id }, args), btn).then(function(r){ if(told(r, good || 'Saved.')){ showPlan(); } }).catch(function(){}); }
    var date = field(box, 'Date', 'date', t.date);
    date.addEventListener('change', function(){ if(date.value){ set({ date: date.value }, date); } });
    var start = picker(box, 'Start studying', [['', 'Your usual (' + d.defaults.start_days + ' days before)']].concat(
      range(d.limits.start_days[0], d.limits.start_days[1]).map(function(n){ return [n, n + (n === 1 ? ' day before' : ' days before')]; })), t.own_start ? t.start_days : '');
    start.addEventListener('change', function(){ set({ start_days: start.value === '' ? null : +start.value }, start); });
    var mins = picker(box, 'One session is', [['', 'Your usual (' + d.defaults.minutes + ' minutes)']].concat(
      range(1, 12).map(function(n){ return [n * 15, n * 15 + ' minutes']; })), t.own_minutes ? t.minutes : '');
    mins.addEventListener('change', function(){ set({ minutes: mins.value === '' ? null : +mins.value }, mins); });
    var acts = el('div', 'p-actions');
    P.button(acts, t.on ? 'Stop planning for this one' : 'Plan for this one', '', function(b){ set({ on: !t.on }, b); });
    twice(acts, 'Delete', 'Tap again to delete', 'quiet p-link p-danger-link', function(b){
      P.press('study_test_delete', { id: t.id }, b).then(function(r){ if(told(r, 'Deleted.')){ editing = null; showPlan(); } }).catch(function(){});
    });
    box.appendChild(acts);
    if(d.offload.ready){
      var notes = field(box, 'Make a workbook and cards for it: what should it cover?', 'area', '');
      notes.maxLength = 1200;
      notes.placeholder = 'Chapters, topics, what you keep getting wrong';
      var more = el('div', 'p-actions');
      P.button(more, 'Ask the Claude app', 'main', function(b){
        P.press('study_make', { test_id: t.id, notes: notes.value }, b).then(function(r){ if(told(r)){ editing = null; showPlan(); } }).catch(function(){});
      });
      box.appendChild(more);
    }
    li.appendChild(box);
  }
  function asksCard(d){
    var c = P.card(body, 'Workbooks from the Claude app');
    if(!d.offload.ready){
      line(c, 'p-empty', 'Not set up yet. Once the Claude app task exists and its two settings are on Render, a test gets a "make a workbook" box here. Until then, add files under Library.');
      return;
    }
    line(c, 'p-note', 'Made in the Claude app on your subscription, not by the bot. Open a test above to ask. Up to ' + d.offload.most + ' a day.');
    if(!d.offload.asks.length){ line(c, 'p-empty', 'Nothing asked yet.'); return; }
    var list = P.rows(c);
    d.offload.asks.forEach(function(k){
      var li = P.row(list, k['class'] + (k.test ? ': ' + k.test : ''), P.when(k.at), k.make + (k.notes ? ' · ' + k.notes : ''), '');
      P.pill(li.querySelector('.p-row-top'), k.status === 'arrived' ? 'in your library' : 'asked', k.status === 'arrived' ? 'ok' : '');
    });
  }

  /* ---------- Library ---------- */
  /* The Library is laid out like a notebook: each class is a notebook down the side, each test is a
     section across the top, and each workbook or card set is a page in it. */
  function showLibrary(){
    fetchAll(function(d){
      clear();
      var c = P.card(body, 'Library');
      var find = field(c, 'Search', 'search', search);
      find.placeholder = 'Notebook, test or title';
      var book = el('div', 'p-book'), rail = el('nav', 'p-book-rail'), side = el('div', 'p-book-side');
      rail.setAttribute('aria-label', 'Notebooks');
      book.appendChild(rail);
      book.appendChild(side);
      body.appendChild(book);
      var names = d.classes.slice();
      d.items.forEach(function(i){ if(i['class'] && names.indexOf(i['class']) < 0){ names.push(i['class']); } });
      names.sort(function(a, b){ return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
      if(shelf !== null && names.indexOf(shelf) < 0){ shelf = null; part = null; }
      function byDate(a, b){ return (a.test_date || '9999') + a.title < (b.test_date || '9999') + b.title ? -1 : 1; }
      function tab(parent, cls, label, count, on, go){
        var b = P.button(parent, label, cls, go);
        if(count !== null){ b.appendChild(el('span', 'p-book-count', String(count))); }
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        return b;
      }
      function draw(){
        rail.textContent = '';
        side.textContent = '';
        var words = search.toLowerCase().split(/\s+/).filter(Boolean);
        if(words.length){
          /* a search looks through every notebook at once */
          var hits = d.items.filter(function(i){
            var hay = (i['class'] + ' ' + i.test + ' ' + i.title + ' ' + (i.kind === 'cards' ? 'cards flashcards' : i.mock ? 'mock test practice' : 'workbook')).toLowerCase();
            return words.every(function(w){ return hay.indexOf(w) >= 0; });
          }).sort(byDate);
          book.classList.add('p-book-flat');
          var rc = P.card(side, hits.length ? 'Found ' + hits.length : 'Nothing matches');
          if(!hits.length){ line(rc, 'p-empty', 'Try fewer words.'); return; }
          var rl = P.rows(rc);
          hits.forEach(function(i){ itemRow(rl, i, true); });
          return;
        }
        book.classList.remove('p-book-flat');
        tab(rail, 'p-book-tab', 'Everything', d.items.length, shelf === null, function(){ shelf = null; part = null; draw(); });
        names.forEach(function(n){
          tab(rail, 'p-book-tab', n, d.items.filter(function(i){ return i['class'] === n; }).length, shelf === n,
              function(){ shelf = n; part = null; draw(); });
        });
        var mine = d.items.filter(function(i){ return shelf === null || i['class'] === shelf; }).sort(byDate);
        if(shelf === null){
          /* everything, by test date: the next test first */
          if(!mine.length){ line(P.card(side, 'Nothing here yet'), 'p-empty', 'Workbooks and card sets land here from the drop folder, or add a file below.'); return; }
          var days = {}, order = [];
          mine.forEach(function(i){ var k = i.test_date || ''; if(!days[k]){ days[k] = []; order.push(k); } days[k].push(i); });
          order.forEach(function(k){
            var l = P.rows(P.card(side, k ? dayText(k, true) : 'No test date'));
            days[k].forEach(function(i){ itemRow(l, i, true); });
          });
          return;
        }
        var tests = [];
        mine.forEach(function(i){ var t = i.test || ''; if(tests.indexOf(t) < 0){ tests.push(t); } });
        if(part !== null && tests.indexOf(part) < 0){ part = null; }
        var pc = P.card(side, shelf);
        classTools(pc, shelf, mine.length);
        if(!mine.length){ line(pc, 'p-empty', 'Nothing in ' + shelf + ' yet. Add a file below, or export one from its Claude project.'); return; }
        if(tests.length > 1){
          var secs = el('div', 'p-chips p-book-secs');
          tab(secs, 'p-chip', 'All', null, part === null, function(){ part = null; draw(); });
          tests.forEach(function(t){ tab(secs, 'p-chip', t || 'No test', null, part === t, function(){ part = t; draw(); }); });
          pc.appendChild(secs);
        }
        /* the class's pages, by what they are */
        var shown = mine.filter(function(i){ return part === null || (i.test || '') === part; });
        SORTS.forEach(function(k){
          var these = shown.filter(function(i){ return sortOf(i) === k[0]; });
          var head = el('p', 'p-label p-book-kind', k[1] + ' · ' + these.length);
          pc.appendChild(head);
          if(!these.length){ line(pc, 'p-empty p-book-none', 'None yet.'); return; }
          var pl = P.rows(pc);
          these.forEach(function(i){ itemRow(pl, i, false); });
        });
      }
      /* rename or remove the open notebook (a class or a project): its tests and pages move with a new name, and
         Canvas uses the new name too. A removed one stays gone, and Canvas does not bring it back. */
      function classTools(pc, name, count){
        var a = el('div', 'p-actions p-class-tools');
        P.button(a, 'Rename', 'quiet p-link', function(){
          a.textContent = '';
          var box = el('div', 'p-edit');
          var input = field(box, 'New name for ' + name, 'text', name);
          input.maxLength = 30;
          var b2 = el('div', 'p-actions');
          P.button(b2, 'Save', 'main', function(b){
            var to = input.value.trim();
            if(!to){ P.say('Give it a name.', true); return; }
            P.press('study_class_rename', { label: name, to: to }, b).then(function(r){
              if(told(r, 'Renamed to ' + r.body.label + '.')){ shelf = r.body.label; showLibrary(); }
            }).catch(function(){});
          });
          P.button(b2, 'Cancel', 'quiet p-link', function(){ draw(); });
          box.appendChild(b2);
          a.appendChild(box);
          input.focus();
        });
        if(count){
          line(a, 'p-row-meta', 'To remove ' + name + ', move or delete its ' + count + (count === 1 ? ' page' : ' pages') + ' first (the ⋯ menu on each).');
        }
        else{
          twice(a, 'Remove notebook', 'Tap again to remove ' + name + ' and its tests', 'quiet p-link p-danger-link', function(b){
            P.press('study_class_remove', { label: name }, b).then(function(r){
              if(told(r, 'Removed ' + name + (r.body.tests ? ', with its ' + r.body.tests + (r.body.tests === 1 ? ' test.' : ' tests.') : '.'))){ shelf = null; showLibrary(); }
            }).catch(function(){});
          });
        }
        pc.appendChild(a);
      }
      find.addEventListener('input', function(){ search = find.value; draw(); });
      draw();

      c = P.card(body, 'Add a notebook');
      line(c, 'p-note', 'A class or a project, like the DC motor project. Open a notebook on the left to rename or remove it.');
      var cbox = el('div', 'p-edit p-add-box');
      var cname = field(cbox, 'Name', 'text', '');
      cname.maxLength = 30;
      cname.placeholder = 'Econ, DC motor project ...';
      var ca = el('div', 'p-actions');
      P.button(ca, 'Add notebook', 'main', function(b){
        var n = cname.value.trim();
        if(!n){ P.say('Give it a name.', true); return; }
        P.press('study_class_add', { label: n }, b).then(function(r){ if(told(r, 'Added ' + r.body.label + '.')){ shelf = r.body.label; showLibrary(); } }).catch(function(){});
      });
      cbox.appendChild(ca);
      c.appendChild(cbox);

      c = P.card(body, 'Add a file');
      line(c, 'p-note', 'A workbook (.html) or a card set (.json). It is filed the same way as the drop folder.');
      var box = el('div', 'p-edit p-add-box');
      box.appendChild(el('label', 'p-label', 'File'));
      var file = el('input', 'p-input p-file-input');
      file.type = 'file';
      file.accept = '.html,.htm,.json,text/html,application/json';
      file.setAttribute('aria-label', 'File');
      box.appendChild(file);
      var cls = picker(box, 'Notebook', [['', 'As the file says']].concat(d.classes.map(function(x){ return [x, x]; })), '');
      var test = field(box, 'Test (optional)', 'text', '');
      test.maxLength = 80;
      var a = el('div', 'p-actions');
      P.button(a, 'Add to the library', 'main', function(b){
        var f = file.files && file.files[0];
        if(!f){ P.say('Pick a file first.', true); return; }
        if(f.size > 2000000){ P.say('That file is over 2 MB.', true); return; }
        var reader = new FileReader();
        reader.onload = function(){
          P.press('study_upload', { name: f.name, text: String(reader.result), 'class': cls.value, test: test.value }, b)
            .then(function(r){ if(told(r)){ showLibrary(); } }).catch(function(){});
        };
        reader.onerror = function(){ P.say('That file could not be read.', true); };
        reader.readAsText(f);
      });
      P.button(a, 'Check the drop folder', '', function(b){
        P.press('study_inbox', {}, b).then(function(r){
          if(told(r, r.body.filed && r.body.filed.length ? 'Filed ' + r.body.filed.length + '.' : 'Nothing new in the drop folder.')){ showLibrary(); }
        }).catch(function(){});
      });
      box.appendChild(a);
      c.appendChild(box);
      line(c, 'p-row-meta', 'The drop folder is checked every ' + d.inbox.every_minutes + ' minutes.' + (d.inbox.problem ? ' Last check failed.' : ''));
    });
  }
  function itemRow(list, i, wide){
    var cards = i.kind === 'cards';
    var side = cards ? i.count + ' cards' : (i.total ? i.done + ' of ' + i.total + ' done' : i.mock ? 'mock test' : 'workbook');
    var sub = (wide ? i['class'] + ' · ' : '') + (i.test || 'No test') + (i.test_date ? ' · ' + dayText(i.test_date, true) : '');
    var meta = cards ? (i.due ? i.due + ' due' : 'none due') + (i.missed ? ' · missed ' + i.missed + (i.missed === 1 ? ' time' : ' times') : '')
                     : (i.opened ? 'Last opened ' + P.when(i.opened) : 'Not opened yet');
    var li = P.row(list, i.title, side, sub, meta);
    var a = el('div', 'p-actions');
    P.button(a, cards ? 'Review' : 'Open', 'main', function(){ if(cards){ review(i.id); } else{ openBook(i.id); } });
    if(i.pinned){ a.appendChild(el('span', 'p-pin-mark', 'Pinned')); }
    more(a, i);
    li.appendChild(a);
  }

  /* The ⋯ menu on a library item: pin, move to another notebook, mock test or not, delete */
  var openMenu = null;
  function closeMenu(){
    if(!openMenu){ return; }
    var m = openMenu; openMenu = null;
    m.box.remove();
    m.btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', m.away, true);
    document.removeEventListener('keydown', m.key, true);
  }
  function more(parent, i){
    var wrap = el('div', 'p-more');
    var btn = P.button(wrap, '⋯', 'p-more-btn', function(){
      var was = openMenu && openMenu.btn === btn;
      closeMenu();
      if(was){ return; }
      var box = el('div', 'p-menu');
      box.setAttribute('role', 'menu');
      P.button(box, i.pinned ? 'Unpin' : 'Pin', 'quiet', function(b){ closeMenu(); pin(i, !i.pinned, b); });
      if(i.kind !== 'cards'){
        P.button(box, i.mock ? 'Not a mock test' : 'Mark as mock test', 'quiet', function(b){
          closeMenu();
          P.press('study_item_set', { id: i.id, mock: !i.mock }, b).then(function(r){ if(told(r, i.mock ? 'Moved to Workbooks.' : 'Moved to Mock tests.')){ refresh(); } }).catch(function(){});
        });
      }
      var names = (data && data.classes ? data.classes.slice() : []);
      (data && data.items || []).forEach(function(x){ if(x['class'] && names.indexOf(x['class']) < 0){ names.push(x['class']); } });
      names = names.filter(function(n){ return n !== i['class']; }).sort(function(x, y){ return x.toLowerCase() < y.toLowerCase() ? -1 : 1; });
      if(names.length){
        var mv = el('div', 'p-menu-move');
        var s = el('select', 'p-input');
        s.setAttribute('aria-label', 'Move to notebook');
        var first = el('option', '', 'Move to…'); first.value = ''; s.appendChild(first);
        names.forEach(function(n){ var o = el('option', '', n); o.value = n; s.appendChild(o); });
        s.addEventListener('change', function(){
          if(!s.value){ return; }
          var to = s.value;
          closeMenu();
          P.press('study_item_set', { id: i.id, 'class': to }, btn).then(function(r){ if(told(r, 'Moved to ' + to + '.')){ refresh(); } }).catch(function(){});
        });
        mv.appendChild(s);
        box.appendChild(mv);
      }
      twice(box, 'Delete', 'Tap again to delete', 'quiet p-danger-link', function(b){
        closeMenu();
        P.press('study_item_delete', { id: i.id }, b).then(function(r){ if(told(r, 'Deleted.')){ refresh(); } }).catch(function(){});
      });
      wrap.appendChild(box);
      var m = { box: box, btn: btn };
      m.away = function(e){ if(!wrap.contains(e.target)){ closeMenu(); } };
      m.key = function(e){ if(e.key === 'Escape'){ closeMenu(); btn.focus(); } };
      openMenu = m;
      btn.setAttribute('aria-expanded', 'true');
      document.addEventListener('click', m.away, true);
      document.addEventListener('keydown', m.key, true);
      var f = box.querySelector('button'); if(f){ f.focus(); }
    });
    btn.setAttribute('aria-label', 'More for ' + i.title);
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    parent.appendChild(wrap);
  }

  function pin(i, on, b){
    P.press('study_pin', { id: i.id, pinned: on }, b).then(function(r){ if(told(r, on ? 'Pinned.' : 'Unpinned.')){ refresh(); } }).catch(function(){});
  }

  /* ---------- Pinned: what he is working on now ---------- */
  function showPinned(){
    fetchAll(function(d){
      clear();
      var pins = d.items.filter(function(i){ return i.pinned; })
        .sort(function(a, b){ return (b.pinned_at || '') < (a.pinned_at || '') ? -1 : 1; });
      var due = d.items.reduce(function(n, i){ return n + (i.kind === 'cards' ? i.due : 0); }, 0);
      var c = P.card(body, 'Pinned');
      if(!pins.length){
        line(c, 'p-empty', 'Nothing pinned. Tap Pin on a workbook, mock test or card set in the Library to keep it here while you work on it.');
      }
      else{
        line(c, 'p-note', 'What you are working on now, newest pin first.');
        SORTS.forEach(function(k){
          var these = pins.filter(function(i){ return sortOf(i) === k[0]; });
          if(!these.length){ return; }
          c.appendChild(el('p', 'p-label p-book-kind', k[1] + ' · ' + these.length));
          var l = P.rows(c);
          these.forEach(function(i){ itemRow(l, i, true); });
        });
      }
      c = P.card(body, 'Flashcards');
      line(c, 'p-note', 'A card you miss comes back today. One you know comes back after 1, 2, 4, 7, then 14 days. You can also text "quiz me".');
      /* every set with cards due today, so a review is never more than a tap away */
      var sets = d.items.filter(function(i){ return i.kind === 'cards' && i.due; })
        .sort(function(a, b){ return (a.test_date || '9999') < (b.test_date || '9999') ? -1 : 1; });
      if(!sets.length){ line(c, 'p-empty', d.items.some(function(i){ return i.kind === 'cards'; }) ? 'No cards due today.' : 'No card sets yet.'); return; }
      var l = P.rows(c);
      sets.forEach(function(i){
        var li = P.row(l, i.title, i.due + ' due', i['class'] + (i.test ? ' · ' + i.test : '') + (i.test_date ? ' · ' + dayText(i.test_date, true) : ''));
        var a = el('div', 'p-actions');
        P.button(a, 'Review due cards', 'main', function(){ review(i.id, false); });
        li.appendChild(a);
      });
    });
  }
  function review(id, all){
    var mine = ++run;
    clear();
    line(body, 'p-empty', 'Loading…');
    P.ask('/panel/study/cards?set=' + encodeURIComponent(id)).then(function(r){
      if(mine !== run){ return; }
      clear();
      if(r.status !== 200){ line(body, 'p-empty', 'That set could not be read just now.'); return; }
      var set = r.body, queue = set.cards.filter(function(c){ return all || c.due; });
      if(!queue.length){ queue = set.cards.slice(); }
      queue.sort(function(a, b){ return b.miss - a.miss || a.i - b.i; });
      var right = [], missed = [], again = {}, total = queue.length, saved = false;
      var c = P.card(body, set.title);
      var count = line(c, 'p-row-meta', '');
      var face = el('div', 'p-flash');
      var q = el('div', 'p-flash-q'), ans = el('div', 'p-flash-a');
      face.appendChild(q);
      face.appendChild(ans);
      c.appendChild(face);
      var a = el('div', 'p-actions');
      c.appendChild(a);
      function save(then){
        if(saved || !(right.length || missed.length)){ if(then){ then(); } return; }
        saved = true;
        P.press('cards_review', { set: set.id, right: right, missed: missed }).then(function(x){ told(x, 'Saved: ' + right.length + ' right, ' + missed.length + ' missed.'); if(then){ then(); } })
          .catch(function(){ saved = false; });
      }
      leave = function(){ save(); };
      function done(){
        face.hidden = true;
        a.textContent = '';
        count.textContent = 'Done. ' + right.length + ' right, ' + missed.length + ' missed' + (missed.length ? '. The missed ones are due again today.' : '.');
        leave = null;
        save(function(){ P.button(a, 'Back', 'main', function(){ pick(view); }); });
      }
      function next(){
        if(!queue.length){ done(); return; }
        var card = queue[0];
        count.textContent = (total - queue.length + 1) + ' of ' + total + (again[card.i] ? ' · again' : '');
        q.textContent = card.q;
        ans.textContent = card.a;
        ans.hidden = true;
        a.textContent = '';
        P.button(a, 'Show answer', 'main', function(){
          ans.hidden = false;
          a.textContent = '';
          P.button(a, 'Got it', 'main', function(){ queue.shift(); if(!again[card.i]){ right.push(card.i); } next(); });
          P.button(a, 'Missed it', '', function(){
            queue.shift();
            if(!again[card.i]){ missed.push(card.i); again[card.i] = true; queue.push(card); total++; }
            next();
          });
          P.button(a, 'Stop and save', 'quiet p-link', function(){ queue = []; done(); });
        });
      }
      next();
    }).catch(function(e){ if(e.message !== 'signed out' && mine === run){ clear(); line(body, 'p-empty', 'The bot did not answer.'); } });
  }

  /* ---------- a workbook, in its sealed frame ---------- */
  function openBook(id){
    var mine = ++run;
    clear();
    line(body, 'p-empty', 'Loading…');
    P.ask('/panel/study/workbook?id=' + encodeURIComponent(id)).then(function(r){
      if(mine !== run){ return; }
      clear();
      if(r.status !== 200){ line(body, 'p-empty', 'That workbook could not be opened just now.'); return; }
      var book = r.body, pending = null, timer = null, last = '';
      /* The workbook takes the whole window, over the panel's own bars. One thin bar of the panel's stays
         on top of it: the way back, the title and the saved line. */
      var shell = el('div', 'p-book-full'), bar = el('div', 'p-book-bar');
      P.button(bar, 'Back', 'p-book-back', function(){ pick(view); });
      var names = el('div', 'p-book-name');
      names.appendChild(el('strong', '', book.title));
      var status = el('span', 'p-row-meta', (book['class'] || '') + (book.test ? ' · ' + book.test : '') + (book.total ? ' · ' + book.done + ' of ' + book.total + ' done' : ''));
      names.appendChild(status);
      bar.appendChild(names);
      if(shell.requestFullscreen){
        /* hides the browser's own bars too, where the browser can */
        var big = P.button(bar, 'Full screen', 'p-book-back', function(){
          if(document.fullscreenElement){ document.exitFullscreen(); } else{ shell.requestFullscreen().catch(function(){}); }
        });
        shell.addEventListener('fullscreenchange', function(){ big.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });
      }
      shell.appendChild(bar);
      var frame = el('iframe', 'p-frame');
      frame.setAttribute('sandbox', 'allow-scripts');       /* its own scripts and nothing else: no same-origin, no forms, no popups */
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.title = book.title;
      frame.src = Login.api + book.frame;                   /* a one-time address the bot just made for this login */
      shell.appendChild(frame);
      body.appendChild(shell);
      document.documentElement.classList.add('p-book-open');
      function save(){
        if(timer){ clearTimeout(timer); timer = null; }
        if(!pending || pending.state === last){ return; }
        var sending = pending;
        last = sending.state;
        P.press('workbook_progress', { id: book.id, done: sending.done, total: sending.total, state: sending.state }).then(function(x){
          if(x.status === 200 && x.body.ok){ status.textContent = 'Saved · ' + sending.done + ' of ' + sending.total + ' done'; } else{ last = ''; }
        }).catch(function(){ last = ''; });
      }
      /* The only thing the workbook can do to this page: send it a message. Nothing in it is trusted. */
      listener = function(e){
        if(e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object'){ return; }
        if(e.data.study === 'ready'){ frame.contentWindow.postMessage({ study: 'state', state: book.state || '', theme: theme() }, '*'); return; }
        if(e.data.study !== 'progress'){ return; }
        var done = e.data.done, total = e.data.total, state = e.data.state;
        if(typeof state !== 'string' || state.length > 20000){ return; }
        if(!(Number.isInteger(done) && Number.isInteger(total) && done >= 0 && total >= 0 && total <= 100000)){ return; }
        pending = { done: Math.min(done, total || done), total: total, state: state };
        if(!timer){ timer = setTimeout(save, 15000); }       /* at most one save every 15 seconds */
      };
      window.addEventListener('message', listener);
      leave = save;
    }).catch(function(e){ if(e.message !== 'signed out' && mine === run){ clear(); line(body, 'p-empty', 'The bot did not answer.'); } });
  }

  /* Light or dark as the panel is showing it now, so a workbook can match (it cannot see this page) */
  function theme(){
    var set = document.documentElement.getAttribute('data-theme');
    if(set === 'light' || set === 'dark'){ return set; }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /* ---------- the section ---------- */
  var SHOW = { plan: showPlan, library: showLibrary, pinned: showPinned }, nav = null;
  function pick(v){
    view = v;
    try{ history.replaceState(null, '', '#study/' + view); }catch(e){}
    P.say('');
    Array.prototype.forEach.call(nav.children, function(x){ x.setAttribute('aria-selected', x.dataset.v === view ? 'true' : 'false'); });
    clear();
    line(body, 'p-empty', 'Loading…');
    SHOW[view]();
  }
  P.section({ id: 'study', title: 'Study', render: function(root){
    var asked = (/^#study\/(\w+)/.exec(location.hash) || [])[1];
    if(asked === 'cards'){ asked = 'pinned'; }   /* old links */
    if(SHOW[asked]){ view = asked; }
    nav = el('div', 'p-seg');
    nav.setAttribute('role', 'tablist');
    VIEWS.forEach(function(v){
      var b = P.button(nav, v[1], 'p-seg-btn', function(){ pick(v[0]); });
      b.dataset.v = v[0];
      b.setAttribute('role', 'tab');
    });
    root.appendChild(nav);
    if(body){ clear(); }   /* a review or a workbook left open by another tab is saved and let go */
    body = el('div', 'p-stack');
    root.appendChild(body);
    pick(view);
  }});
  /* Leaving the page or the tab in the middle of a workbook or a review still saves */
  window.addEventListener('pagehide', function(){ if(leave){ var go = leave; leave = null; go(); } });
})();
