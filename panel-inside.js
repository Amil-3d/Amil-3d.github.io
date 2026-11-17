/* The Inside section of the panel: Why it did that, Spend, Logins.
   Like the rest of the panel it holds no data. Everything is fetched from the bot after the login,
   every value is put on the page as text, and every button goes through Panel.press(), so the bot
   writes each press to the log. Styles come only from panel.css. */
(function(){
  var P = window.Panel, el = P.el;
  var VIEWS = [['why', 'Why'], ['spend', 'Spend'], ['logins', 'Logins']];
  var view = 'why', body = null, timer = null, run = 0;

  function money(cents){ return (cents < 0 ? '-$' : '$') + (Math.abs(cents) / 100).toFixed(2); }
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
  /* What a press came back with, as one line under the top bar. True when it worked. */
  function told(r, good){
    if(r.status !== 200){ return false; }
    if(r.body.ok === false || r.body.started === false){ P.say(r.body.why || 'That did not work.', true); return false; }
    P.say(good + (r.body.saved === false || r.body.why ? ' ' + (r.body.why || '') : ''), r.body.saved === false);
    return true;
  }
  function line(parent, cls, text){ var p = el('p', cls, text); parent.appendChild(p); return p; }
  function meter(parent, part, whole, label){
    var m = el('progress', 'p-meter' + (whole > 0 && part >= whole ? ' full' : ''));
    m.max = Math.max(whole, 1);
    m.value = Math.max(0, Math.min(part, whole));
    m.setAttribute('aria-label', label);
    parent.appendChild(m);
    return m;
  }

  /* ---------- Why it did that ---------- */
  var day = '';
  var KINDS = { sent: ['Texted', 'ok'], held: ['Held back', 'bad'], quiet: ['Quiet', ''], problem: ['Problem', 'bad'] };
  function showWhy(){
    load('/panel/why' + (day ? '?day=' + day : ''), function(w){
      day = w.day;
      body.textContent = '';
      var c = P.card(body, 'Heartbeat runs');
      var pick = el('select', 'p-input');
      pick.setAttribute('aria-label', 'Day');
      w.days.forEach(function(d){
        var o = el('option', '', d.name);
        o.value = d.day;
        if(d.day === w.day){ o.selected = true; }
        pick.appendChild(o);
      });
      pick.addEventListener('change', function(){ day = pick.value; showWhy(); });
      c.appendChild(pick);
      var n = w.counts;
      line(c, 'p-note p-sum', n.runs + (n.runs === 1 ? ' run' : ' runs') + ': ' + n.texted + ' texted, ' + n.held + ' held back, ' + n.quiet + ' quiet.');
      line(c, 'p-row-meta', (w.mode === 'live' ? 'Live. ' : w.mode === 'shadow' ? 'Shadow mode, nothing is sent. ' : 'The heartbeat is off. ') + w.rule);
      if(!w.record && w.runs.length){ line(c, 'p-row-meta', 'What the bot did with each run was not kept for this day.'); }

      if(!w.runs.length){
        c = P.card(body, w.name);
        c.appendChild(el('p', 'p-empty', 'No heartbeat runs in the log for this day.'));
        return;
      }
      c = P.card(body, w.name);
      var list = el('ul', 'p-rows p-runs');
      c.appendChild(list);
      w.runs.forEach(function(r){ runRow(list, r, w); });
    });
  }
  function runRow(list, r, w){
    var li = el('li'), top = el('div', 'p-row-top');
    top.appendChild(el('span', 'p-row-main', r.run));
    var pills = el('span', 'p-run-pills');
    if(r.wrote && !r.eyes){ P.pill(pills, 'Could not see your day', 'bad'); }
    var kind = KINDS[r.kind];
    if(kind){ P.pill(pills, kind[0], kind[1]); }
    top.appendChild(pills);
    li.appendChild(top);
    if(r.text){ li.appendChild(el('div', 'p-mail-body p-run-text', r.text)); }
    if(r.why){ part(li, 'Why', r.why); }
    if(r.offer){ part(li, 'Offered', r.offer); }
    part(li, 'Then', r.did);
    if(w.snapshots && r.wrote){
      var a = el('div', 'p-actions'), box = null;
      var b = P.button(a, 'What it saw', 'quiet p-link', function(){
        if(box){ box.remove(); box = null; b.textContent = 'What it saw'; return; }
        b.disabled = true;
        P.ask('/panel/snapshot?day=' + w.day + '&run=' + r.slot).then(function(x){
          b.disabled = false;
          if(x.status !== 200){ P.say('The snapshot could not be read just now.', true); return; }
          box = x.body.kept ? el('pre', 'p-snap', x.body.text) : el('p', 'p-empty', 'No snapshot was kept for this run.');
          li.appendChild(box);
          b.textContent = 'Hide what it saw';
        }).catch(function(e){ b.disabled = false; if(e.message !== 'signed out'){ P.say('The bot did not answer.', true); } });
      });
      li.appendChild(a);
    }
    list.appendChild(li);
  }
  function part(li, label, text){
    var d = el('div', 'p-run-part');
    d.appendChild(el('span', 'p-run-label', label));
    d.appendChild(el('span', '', text));
    li.appendChild(d);
  }

  /* ---------- Spend ---------- */
  function showSpend(){
    load('/panel/spend', function(s){
      body.textContent = '';
      var c = P.card(body, 'Today');
      line(c, 'p-big', money(s.today_cents) + ' of ' + money(s.limit_cents));
      meter(c, s.today_cents, s.limit_cents, 'Spent today against the daily limit');
      line(c, 'p-row-meta', s.jobs_today + (s.jobs_today === 1 ? ' agent run' : ' agent runs') + ' today' +
           (s.stopped_by_limit ? ' · the daily limit was hit, new jobs wait until midnight' : ''));
      if(!s.agents_on){ line(c, 'p-note', 'The agents are switched off.'); }
      if(s.today_by_agent.length){
        var list = P.rows(c);
        s.today_by_agent.forEach(function(a){ P.row(list, a.agent.replace(/^assistant-/, ''), money(a.cents), '', a.jobs + (a.jobs === 1 ? ' run' : ' runs')); });
      }
      line(c, 'p-row-meta', 'My own replies to your texts: ' + money(s.replies_today_cents) + ' today. They are not under the daily limit.');

      c = P.card(body, s.month + ' credits');
      line(c, 'p-big', money(s.left_cents) + ' left of ' + money(s.credits_cents));
      meter(c, s.used_cents, s.credits_cents, 'Credits used this month');
      line(c, 'p-row-meta', 'Agents ' + money(s.month_cents) + ' + my replies ' + money(s.replies_month_cents) + ' = ' + money(s.used_cents) + ' used' +
           (s.counting_since ? ', counted since ' + s.counting_since : '') + '.');
      line(c, 'p-note p-after', 'This is my own count at list prices. The Console\'s billing page is the real number.');
      amount(c, 'Credits each month', s.credits_cents, 0, s.most_credits, function(cents, b){
        P.press('cap_set', { name: 'credits_month', cents: cents }, b).then(function(r){ if(told(r, 'Monthly credits set to ' + money(cents) + '.')){ showSpend(); } }).catch(function(){});
      });

      c = P.card(body, 'Caps');
      line(c, 'p-note', 'A run stops when it reaches its cap. I text you every time a cap changes.');
      if(s.unsaved){ line(c, 'msg bad', 'The last change is in place but was not saved (' + s.unsaved + '), so a restart would lose it.'); }
      s.caps.forEach(function(k){
        var title = k.label.charAt(0).toUpperCase() + k.label.slice(1);
        amount(c, title + ' · ' + money(k.least) + ' to ' + money(k.most) + (k.cents !== k.usual ? ' · usually ' + money(k.usual) : ''),
               k.cents, k.least, k.most, function(cents, b){
          P.press('cap_set', { name: k.name, cents: cents }, b).then(function(r){
            if(told(r, r.body.same ? title + ' is already ' + money(cents) + '.' : title + ' is now ' + money(cents) + '. I texted you.')){ showSpend(); }
          }).catch(function(){});
        });
      });
      line(c, 'p-row-meta p-after', 'Each heartbeat run is capped at ' + money(s.heartbeat_cap_cents) + '. That one is set on its schedule in the Console, not here.');

      if(s.days.length){
        c = P.card(body, 'Earlier days');
        var days = P.rows(c);
        s.days.forEach(function(d){ P.row(days, d.name, money(d.cents), '', 'replies ' + money(d.replies_cents)); });
      }
    });
  }
  /* A dollar amount with a Save button. onSave gets whole cents. */
  function amount(parent, label, cents, least, most, onSave){
    parent.appendChild(el('label', 'p-label', label));
    var form = el('form', 'p-add p-amount');
    var input = el('input', 'p-input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = (cents / 100).toFixed(2);
    input.setAttribute('aria-label', label + ', in dollars');
    var go = el('button', 'p-btn', 'Save');
    go.type = 'submit';
    form.appendChild(el('span', 'p-amount-sign', '$'));
    form.appendChild(input);
    form.appendChild(go);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var typed = input.value.trim().replace(/^\$/, '');
      if(!/^\d{1,4}(\.\d{1,2})?$/.test(typed)){ P.say('Type an amount in dollars, like 5 or 2.50.', true); return; }
      var wanted = Math.round(parseFloat(typed) * 100);
      if(wanted < least || wanted > most){ P.say('That one can be ' + money(least) + ' to ' + money(most) + '.', true); return; }
      onSave(wanted, go);
    });
    parent.appendChild(form);
  }

  /* ---------- Logins ---------- */
  var STATES = { working: ['Working', 'ok'], broken: ['Broken', 'bad'], unknown: ['Not checked', ''], off: ['Off', 'bad'] };
  var SAFE_LINK = /^https:\/\/[a-z0-9.\-]+\.(kernel\.sh|onkernel\.com)(:\d+)?\//;
  function showLogins(){
    clearTimeout(timer);
    load('/panel/logins', function(w){
      body.textContent = '';
      var c = P.card(body, 'Browser in use');
      var list = P.rows(c);
      var li = P.row(list, w.browser.name, '', w.browser.note);
      P.pill(li.querySelector('.p-row-top'), 'in use', 'ok');
      w.sites.forEach(siteCard);
      if(w.sites.some(function(s){ return s.busy; })){ timer = setTimeout(function(){ if(view === 'logins' && body.isConnected){ showLogins(); } }, 5000); }
    });
  }
  function siteCard(s){
    if(!s.site){ return; }
    var c = P.card(body, s.site);
    var st = STATES[s.state] || STATES.unknown;
    P.pill(c, st[0], st[1]);
    line(c, 'p-site-line', s.line);
    (s.details || []).forEach(function(d){ line(c, 'p-row-sub', d); });
    if(s.note){ line(c, 'p-note p-outcome', s.note); }
    if(s.busy){ line(c, 'p-empty p-after', 'Working in the browser (' + s.busy + '). This takes up to a minute.'); return; }
    var a = el('div', 'p-actions');
    c.appendChild(a);
    if(s.check){
      P.button(a, s.check, '', function(b){
        P.press('login_check', { site: s.id }, b).then(function(r){
          if(told(r, r.body.started ? 'Checking. This takes up to a minute.' : r.body.said || 'It works.') || r.status === 200){ showLogins(); }
        }).catch(function(){});
      });
    }
    if(!s.fix){ return; }
    var steps = el('ol', 'p-steps');
    (s.steps || []).forEach(function(t){ steps.appendChild(el('li', '', t)); });
    steps.hidden = s.state !== 'broken' && !s.fixing;
    var how = P.button(a, s.state === 'broken' ? 'Hide the steps' : 'How to fix it', s.state === 'broken' ? 'quiet' : '', function(){
      steps.hidden = !steps.hidden;
      how.textContent = steps.hidden ? 'How to fix it' : 'Hide the steps';
      fixRow.hidden = steps.hidden;
    });
    c.appendChild(steps);
    var fixRow = el('div', 'p-actions');
    fixRow.hidden = steps.hidden;
    c.appendChild(fixRow);
    if(s.fix === 'signin'){ signIn(fixRow, s); }
    if(s.fix === 'confirm'){
      P.button(fixRow, 'I\'ve signed in again', 'main', function(b){
        P.press('login_fix_done', { site: s.id }, b).then(function(r){ if(told(r, r.body.said || 'Noted.')){ showLogins(); } }).catch(function(){});
      });
    }
  }
  function signIn(row, s){
    function opened(link, minutes){
      row.textContent = '';
      if(!SAFE_LINK.test(link)){ P.say('The sign-in page had a link I do not trust, so it is not shown.', true); return; }
      var go = el('a', 'p-btn main', 'Open the sign-in page');
      go.href = link;
      go.target = '_blank';
      go.rel = 'noopener noreferrer';
      row.appendChild(go);
      P.button(row, 'I\'m signed in', '', function(b){
        P.press('login_fix_done', { site: s.id }, b).then(function(r){ if(told(r, 'Checking your sign-in. This takes up to a minute.') || r.status === 200){ showLogins(); } }).catch(function(){});
      });
      row.appendChild(el('span', 'p-row-meta', 'Open for about ' + minutes + ' more minute' + (minutes === 1 ? '' : 's') + '. Treat that page like your mailbox: do not share it.'));
    }
    if(s.fixing){ opened(s.fixing.link, s.fixing.minutes_left); return; }
    P.button(row, 'Open a sign-in browser', s.state === 'broken' ? 'main' : '', function(b){
      P.say('Opening a browser. This takes a few seconds.');
      P.press('login_fix', { site: s.id }, b).then(function(r){
        if(told(r, 'The sign-in browser is open.')){ opened(r.body.link, r.body.minutes); }
      }).catch(function(){});
    });
  }

  /* ---------- the section ---------- */
  var SHOW = { why: showWhy, spend: showSpend, logins: showLogins };
  P.section({ id: 'inside', title: 'Inside', after: 'assistant', render: function(root){
    clearTimeout(timer);
    var asked = (/^#inside\/(\w+)/.exec(location.hash) || [])[1];
    if(SHOW[asked]){ view = asked; }
    try{ history.replaceState(null, '', '#inside/' + view); }catch(e){}
    var nav = el('div', 'p-seg');
    nav.setAttribute('role', 'tablist');
    VIEWS.forEach(function(v){
      var b = P.button(nav, v[1], 'p-seg-btn', function(){
        view = v[0];
        try{ history.replaceState(null, '', '#inside/' + view); }catch(e){}
        P.say('');
        clearTimeout(timer);
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
