/* Assistant page. Holds no data: everything shown is fetched from the bot.
   Every value from the bot is put on the page as text, never as HTML. */
(function(){
  var API = 'https://nia-bot-uvyk.onrender.com';
  var refreshTimer = null;

  function $(id){ return document.getElementById(id); }
  function el(tag, cls, text){
    var n = document.createElement(tag);
    if(cls){ n.className = cls; }
    if(text != null && text !== ''){ n.textContent = String(text); }
    return n;
  }
  function money(cents){ return '$' + (Number(cents || 0) / 100).toFixed(2); }
  function small(cents){
    if(cents == null){ return ''; }
    var c = Number(cents);
    if(c === 0){ return 'under 1¢'; }
    return c < 100 ? (Math.round(c * 100) / 100) + '¢' : money(c);
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
  function hours(h){
    h = Number(h || 0);
    if(h < 48){ return (Math.round(h * 10) / 10) + ' hours'; }
    return (Math.round(h / 2.4) / 10) + ' days';
  }
  function call(path, options){
    options = options || {};
    options.mode = 'cors';
    options.cache = 'no-store';
    options.credentials = 'omit';
    return fetch(API + path, options).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(body){ return { status: r.status, body: body }; });
    });
  }

  /* ---------- public numbers ---------- */
  function setNumber(id, value){ $(id).textContent = value == null ? '–' : value; }
  function loadPublic(){
    call('/dash/public').then(function(r){
      if(r.status !== 200){ throw new Error('status ' + r.status); }
      var n = r.body;
      setNumber('n-jobs', n.jobs_today);
      setNumber('n-cost', n.avg_cost_cents == null ? null : small(n.avg_cost_cents));
      setNumber('n-up', n.uptime_percent == null ? null : n.uptime_percent + '%');
      setNumber('n-recipes', n.recipes);
      setNumber('n-skills', n.skills);
      setNumber('n-agents', n.agents);
      $('pulse').textContent = 'live';
      $('pulse').className = 'pulse on';
    }).catch(function(){
      $('pulse').textContent = 'offline';
      $('pulse').className = 'pulse bad';
      $('live-note').textContent = 'The bot did not answer just now, so there are no live numbers to show.';
    });
  }

  /* ---------- building the private cards ---------- */
  function card(title, wide){
    var c = el('div', 'dcard' + (wide ? ' wide' : ''));
    c.appendChild(el('h3', null, title));
    $('cards').appendChild(c);
    return c;
  }
  function empty(parent, text){ parent.appendChild(el('p', 'empty', text)); }
  function missing(title){ empty(card(title), 'Could not be read just now.'); }
  function list(parent){ var u = el('ul', 'items'); parent.appendChild(u); return u; }
  function item(ul, main, side, sub, meta){
    var li = el('li'), top = el('div', 'top');
    top.appendChild(el('span', 'main', main));
    if(side){ top.appendChild(el('span', 'side', side)); }
    li.appendChild(top);
    if(sub){ li.appendChild(el('div', 'sub', sub)); }
    if(meta){ li.appendChild(el('div', 'meta', meta)); }
    ul.appendChild(li);
    return li;
  }
  function pill(li, text, kind){ li.querySelector('.main').appendChild(el('span', 'pill' + (kind ? ' ' + kind : ''), text)); }
  function heading(parent, text){ parent.appendChild(el('h4', null, text)); }
  function shortAgent(name){ return String(name || '').replace(/^assistant-/, ''); }

  function showNow(d){
    if(!d){ return missing('Running and waiting on me'); }
    var c = card('Running and waiting on me', true);
    heading(c, 'Waiting on me');
    var any = d.waiting.length + d.drafts_waiting.length + (d.old_watch_emails_waiting ? 1 : 0);
    if(!any){ empty(c, 'Nothing is waiting on you.'); }
    else{
      var u = list(c);
      d.waiting.forEach(function(w){ item(u, w.what, when(w.since), w.needs); });
      d.drafts_waiting.forEach(function(m){
        item(u, 'Draft ' + m.id + ' in ' + m.where, when(m.saved), 'To ' + m.who + ' · ' + m.subject, 'Waiting for your yes or no by text');
      });
      if(d.old_watch_emails_waiting){
        item(u, d.old_watch_emails_waiting + ' email' + (d.old_watch_emails_waiting === 1 ? '' : 's') + ' from the hourly inbox watch', '', 'Waiting for send, edit or skip by text');
      }
    }
    heading(c, 'Running now');
    if(!d.running.length){ empty(c, 'No jobs are running.'); }
    else{
      var r = list(c);
      d.running.forEach(function(t){ item(r, 'Task #' + t.n + ': ' + t.job, when(t.started), null, t.kind); });
    }
  }

  function agentRows(parent, rows){
    if(!rows.length){ return empty(parent, 'Nothing yet.'); }
    var u = list(parent);
    rows.slice().sort(function(a, b){ return b.cents - a.cents; }).forEach(function(a){
      item(u, shortAgent(a.agent), money(a.cents), null, a.jobs + ' job' + (a.jobs === 1 ? '' : 's'));
    });
  }
  function showSpend(d){
    if(!d){ return missing('Spend'); }
    var c = card('Spend');
    var big = el('div', 'big', money(d.today_cents));
    big.appendChild(el('small', null, ' of ' + money(d.limit_cents) + ' today'));
    c.appendChild(big);
    var meter = el('div', 'meter' + (d.today_cents >= d.limit_cents * 0.8 ? ' hot' : '')), fill = el('i');
    fill.style.width = Math.min(100, d.limit_cents ? d.today_cents / d.limit_cents * 100 : 0) + '%';
    meter.appendChild(fill);
    c.appendChild(meter);
    c.appendChild(el('div', 'meta fine', d.jobs_today + ' jobs today' + (d.paused_by_limit ? ' · new jobs are paused until midnight' : '')));
    heading(c, d.month + ' so far: ' + money(d.month_cents));
    agentRows(c, d.month_by_agent);
    heading(c, 'Today by agent');
    agentRows(c, d.today_by_agent);
    var r = d.replies;
    if(r){
      heading(c, 'The bot\'s own replies');
      var u = list(c);
      item(u, 'Today', money(r.today_cents), r.today_count + (r.today_count === 1 ? ' reply' : ' replies'));
      item(u, d.month + ' so far', money(r.month_cents), r.month_count + (r.month_count === 1 ? ' reply' : ' replies'),
        r.counting_since ? 'Counted since ' + when(r.counting_since) : '');
    }
    c.appendChild(el('p', 'fine', 'The agents are counted the way the daily limit counts: every job is at least 1 cent. ' +
      (r ? 'The bot\'s own replies are an estimate from their token counts at list price. They are billed separately and are not part of the daily limit.'
         : 'The bot\'s own replies are billed separately.')));
  }

  function showLogins(d, pic){
    if(!d){ return missing('Logins'); }
    var c = card('Logins'), u = list(c);
    d.forEach(function(l){
      var expired = l.state === 'expired';
      var li = item(u, l.site, hours(l.lasted_hours),
        expired ? 'Expired ' + when(l.expired) + '. It lasted ' + hours(l.lasted_hours) + '.'
                : 'Signed in ' + when(l.signed_in) + '. ' + hours(l.lasted_hours) + ' so far.',
        l.last_seen_working ? 'Last seen working ' + when(l.last_seen_working) : '');
      pill(li, l.state, expired ? 'warn' : 'ok');
    });
    c.appendChild(el('p', 'fine', 'The bot does not open a browser to check. It only knows a login expired when a job runs into the sign-in page.'));
    heading(c, 'The bot');
    var b = list(c);
    item(b, 'Up since ' + when(pic.up_since), pic.uptime_percent + '%', null, 'Uptime counted since ' + when(pic.counting_since));
  }

  function showRecipes(d){
    if(!d){ return missing('Recipes'); }
    var c = card('Recipes');
    if(!d.on){ return empty(c, 'Recipes are off.'); }
    if(!d.list.length){ return empty(c, 'No recipes yet. Text one to set it up.'); }
    var u = list(c);
    d.list.forEach(function(r){
      var meta = [r.when];
      if(r.next){ meta.push('next ' + r.next); }
      if(r.last){ meta.push('last ' + r.last); }
      if(r.avg_cents != null){ meta.push(small(r.avg_cents) + ' a run'); }
      var li = item(u, '#' + r.n + ' ' + r.name, '', r.does, meta.join(' · '));
      pill(li, r.paused ? 'paused' : 'active', r.paused ? 'warn' : 'ok');
    });
  }

  function showSkills(d){
    if(!d){ return missing('Skills and style notes'); }
    var c = card('Skills and style notes');
    if(!d.on){ return empty(c, 'Skills are off.'); }
    heading(c, 'How-tos it saved');
    if(!d.skills.length){ empty(c, 'None yet.'); }
    else{
      var u = list(c);
      d.skills.forEach(function(s){ item(u, s.title, when(s.saved), 'Use when: ' + s.when, s.why); });
    }
    heading(c, 'Email style notes');
    if(!d.style.length){ empty(c, 'None yet.'); }
    else{
      var v = list(c);
      d.style.forEach(function(s){ item(v, s.rule, when(s.saved)); });
    }
  }

  function showHeartbeat(d){
    if(!d){ return missing('Heartbeat'); }
    var c = card('Heartbeat', true);
    var live = String(d.mode || '').indexOf('live') === 0;
    var u = list(c);
    item(u, d.last_run ? 'Last run ' + when(d.last_run) : 'No run seen yet', d.runs_today + ' today', 'Mode: ' + d.mode, money(d.cents_today) + ' today');
    heading(c, live ? 'What it decided to text today' : 'What it would have texted today');
    if(!d.would_have_texted.length){ empty(c, 'Nothing today.'); }
    else{
      var t = list(c);
      d.would_have_texted.forEach(function(e){ item(t, e.text, when(e.at), e.why, e.eyes ? '' : 'ran blind, without the snapshot'); });
    }
    heading(c, 'Recent runs');
    if(!d.log.length){ empty(c, 'No log entries today.'); }
    else{
      var l = list(c);
      d.log.forEach(function(e){
        var li = item(l, e.why || e.decision, when(e.at), e.hand_off ? (live ? 'Offered: ' : 'Would hand off: ') + e.hand_off : null);
        pill(li, e.decision, e.decision === 'nothing' ? '' : 'ok');
      });
    }
  }

  function showWatch(d){
    if(!d){ return missing('Inbox watch'); }
    var c = card('Inbox watch', true);
    c.appendChild(el('p', 'empty', 'Mode: ' + (d.mode === 'shadow' ? 'silent (records what it would do, texts and marks nothing)' : d.mode)));
    if(!d.runs.length){ return empty(c, 'No runs yet.'); }
    var u = list(c);
    d.runs.forEach(function(r){
      var what = r.problem ? 'Problem: ' + r.problem
        : (r.new || r.ads) ? r.new + ' new, ' + r.ads + ' ads' : 'Nothing new';
      var meta = [];
      if(r.model_run){ meta.push('sorted by the agent' + (r.cost_cents != null ? ', ' + small(r.cost_cents) : '')); }
      else{ meta.push('no model run'); }
      if(r.would_mark_read){ meta.push('would mark ' + r.would_mark_read + ' read'); }
      var li = item(u, what, when(r.at), null, meta.join(' · '));
      r.flagged.forEach(function(m){
        li.appendChild(el('div', 'sub', (m.kind ? m.kind + ': ' : 'Flagged: ') + m.who + ' · ' + m.subject));
      });
      if(r.problem){ pill(li, 'problem', 'warn'); }
    });
  }

  function showJobs(d){
    if(!d){ return missing('Recent jobs'); }
    var c = card('Recent jobs', true);
    if(!d.length){ return empty(c, 'No jobs since yesterday.'); }
    var u = list(c);
    d.forEach(function(j){
      var li = item(u, j.what || 'Job', small(j.cents), null, shortAgent(j.agent) + ' · ' + when(j.at));
      pill(li, j.result, j.result === 'failed' ? 'warn' : (j.result === 'waiting on you' ? 'ok' : ''));
    });
  }

  function showSettings(d){
    if(!d){ return missing('Switches'); }
    var c = card('Switches');
    var kv = el('dl', 'kv');
    d.values.forEach(function(s){
      kv.appendChild(el('dt', null, s.name));
      kv.appendChild(el('dd', s['default'] ? 'dim' : null, s.value + (s['default'] ? ' (default)' : '')));
    });
    c.appendChild(kv);
    heading(c, 'Secret settings (values are never shown)');
    var sk = el('dl', 'kv');
    d.secrets.forEach(function(s){
      sk.appendChild(el('dt', null, s.name));
      sk.appendChild(el('dd', s.set ? null : 'dim', s.set ? 'set' : 'not set'));
    });
    c.appendChild(sk);
  }

  function showErrors(d){
    if(!d){ return missing('Recent errors'); }
    var c = card('Recent errors');
    if(!d.length){ return empty(c, 'No errors on record.'); }
    var u = list(c);
    d.forEach(function(e){ item(u, e.what, when(e.at), null, e.from); });
  }

  function showChecks(d){
    if(!d){ return; }
    var c = card('Checks');
    if(!d.length){ return empty(c, 'Nothing has been read yet.'); }
    var u = list(c);
    d.forEach(function(k){
      var li = item(u, k.name, when(k.at), k.ok ? '' : (k.last_ok ? 'Last answered ' + when(k.last_ok) : 'Has not answered since the bot started'));
      pill(li, k.ok ? 'answered' : 'failed', k.ok ? 'ok' : 'warn');
    });
  }

  function render(pic){
    $('cards').textContent = '';
    $('asof').textContent = 'As of ' + when(pic.as_of) + ' Eastern';
    $('dashmsg').textContent = pic.new_path_on ? '' : 'The agent path is switched off, so most of this is empty.';
    showNow(pic.now);
    showSpend(pic.spend);
    showLogins(pic.logins, pic);
    showRecipes(pic.recipes);
    showSkills(pic.skills);
    showHeartbeat(pic.heartbeat);
    showWatch(pic.watch);
    showJobs(pic.jobs);
    showSettings(pic.settings);
    showErrors(pic.errors);
    showChecks(pic.checks);
  }

  /* ---------- login: the steps themselves are in assistant-login.js ---------- */
  var Login = window.AssistantLogin;
  var form = Login.wire({ form: $('loginform'), label: $('pwlab'), password: $('pw'), code: $('code'),
                          button: $('go'), message: $('loginmsg'), onIn: start });
  function locked(message){
    clearInterval(refreshTimer);
    $('cards').textContent = '';
    $('dash').hidden = true;
    $('gate').hidden = false;
    $('lockstate').textContent = 'locked';
    $('lockstate').className = 'pulse';
    form.reset();
    form.say(message || '', false);
  }
  function say(id, text, bad){ $(id).textContent = text; $(id).className = 'msg' + (bad ? ' bad' : ''); }
  function loadPrivate(first){
    if(!Login.has()){ return; }
    $('refresh').disabled = true;
    Login.call('/dash/private').then(function(r){
      $('refresh').disabled = false;
      if(r.status === 401){
        Login.forget();
        return locked(first ? '' : 'Your login ran out. Enter the password again.');
      }
      if(r.status !== 200){ throw new Error('status ' + r.status); }
      $('gate').hidden = true;
      $('dash').hidden = false;
      $('lockstate').textContent = 'unlocked';
      $('lockstate').className = 'pulse on';
      render(r.body);
    }).catch(function(){
      $('refresh').disabled = false;
      if($('dash').hidden){ form.say('The bot did not answer. Try again in a minute.', true); }
      else{ say('dashmsg', 'Could not refresh just now. Showing the last picture.', true); }
    });
  }
  function start(){
    loadPrivate(true);
    clearInterval(refreshTimer);
    refreshTimer = setInterval(function(){ if(!document.hidden){ loadPrivate(false); } }, 120000);
  }
  $('refresh').addEventListener('click', function(){ loadPrivate(false); });
  $('signout').addEventListener('click', function(){
    Login.signOut();
    locked('Signed out.');
  });

  /* ---------- making a password hash, in the browser only ---------- */
  function b64(bytes){
    var s = '';
    new Uint8Array(bytes).forEach(function(b){ s += String.fromCharCode(b); });
    return btoa(s);
  }
  $('hashform').addEventListener('submit', function(e){
    e.preventDefault();
    var a = $('np1').value, b = $('np2').value, rounds = 600000;
    $('hashout').hidden = true;
    $('hashcopy').hidden = true;
    if(a !== b){ return say('hashmsg', 'The two do not match.', true); }
    if(a.length < 10){ return say('hashmsg', 'Use at least 10 characters.', true); }
    if(!window.crypto || !crypto.subtle){ return say('hashmsg', 'This browser cannot do it. Try Safari or Chrome over https.', true); }
    say('hashmsg', 'Working…', false);
    var salt = crypto.getRandomValues(new Uint8Array(16));
    crypto.subtle.importKey('raw', new TextEncoder().encode(a), 'PBKDF2', false, ['deriveBits'])
      .then(function(key){
        return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: rounds, hash: 'SHA-256' }, key, 256);
      })
      .then(function(bits){
        $('np1').value = '';
        $('np2').value = '';
        $('hashout').value = 'pbkdf2_sha256$' + rounds + '$' + b64(salt) + '$' + b64(bits);
        $('hashout').hidden = false;
        $('hashcopy').hidden = false;
        say('hashmsg', 'Paste this line into Render as DASHBOARD_PASSWORD_HASH. It is safe to copy: it is not the password.', false);
      })
      .catch(function(){ say('hashmsg', 'Could not make the hash in this browser.', true); });
  });
  $('hashcopy').addEventListener('click', function(){
    var text = $('hashout').value;
    var done = function(){ say('hashmsg', 'Copied. Paste it into Render as DASHBOARD_PASSWORD_HASH.', false); };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done).catch(function(){ $('hashout').select(); });
    } else { $('hashout').select(); }
  });

  /* ---------- start ---------- */
  loadPublic();
  if(Login.has()){ start(); }
})();
