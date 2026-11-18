/* The panel's extras: the chat box, the morning report page and the trading card. The Assistant
   section (panel-daily.js) shows them. Like the rest of the panel this file holds no data, and
   nothing from the bot is ever put on the page as HTML: a reply's tables, lists and links are built
   piece by piece as text, and a link is only made for an https address. Styles come from panel.css. */
(function(){
  var P = window.Panel, el = P.el;

  /* ---------- text with tables, lists and links, built safely ---------- */
  var INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https:\/\/[^\s)]+\)|https:\/\/[^\s<>()]+)/g;
  function link(text, href){
    var a = el('a', 'p-a', text);
    if(/^https:\/\/[^\s]+$/.test(href)){ a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  }
  function inline(parent, text){
    String(text).split(INLINE).forEach(function(part){
      if(!part){ return; }
      var m;
      if(/^\*\*[^*]+\*\*$/.test(part)){ parent.appendChild(el('strong', '', part.slice(2, -2))); }
      else if(/^`[^`]+`$/.test(part)){ parent.appendChild(el('code', 'p-code', part.slice(1, -1))); }
      else if((m = /^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/.exec(part))){ parent.appendChild(link(m[1], m[2])); }
      else if(/^https:\/\//.test(part)){
        var end = /[.,;:!?]+$/.exec(part), href = end ? part.slice(0, -end[0].length) : part;
        parent.appendChild(link(href, href));
        if(end){ parent.appendChild(document.createTextNode(end[0])); }
      }
      else { parent.appendChild(document.createTextNode(part)); }
    });
    return parent;
  }
  function cells(row){ return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function(c){ return c.trim(); }); }
  function table(rows){
    var wrap = el('div', 'p-table-wrap'), t = el('table', 'p-table'), head = true;
    rows.forEach(function(row){
      if(/^[\s|:\-]+$/.test(row)){ return; }
      var tr = el('tr');
      cells(row).forEach(function(c){ tr.appendChild(inline(el(head ? 'th' : 'td'), c)); });
      t.appendChild(tr);
      head = false;
    });
    wrap.appendChild(t);
    return wrap;
  }
  var BULLET = /^\s*[-•*]\s+/;
  /* headings: true for a report, where a short line after a gap is a section title */
  function rich(text, headings){
    var box = el('div', 'p-rich'), lines = String(text || '').split('\n'), i = 0;
    while(i < lines.length){
      var line = lines[i];
      if(line.trim() === ''){ i++; continue; }
      if(/^\s*\|.*\|\s*$/.test(line)){
        var rows = [];
        while(i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])){ rows.push(lines[i]); i++; }
        box.appendChild(table(rows));
        continue;
      }
      if(BULLET.test(line)){
        var ul = el('ul', 'p-list');
        while(i < lines.length && BULLET.test(lines[i])){ ul.appendChild(inline(el('li'), lines[i].replace(BULLET, ''))); i++; }
        box.appendChild(ul);
        continue;
      }
      var gapBefore = i === 0 || lines[i - 1].trim() === '';
      if(/^#{1,4}\s+/.test(line) || (headings && gapBefore && line.trim().length <= 40 && i + 1 < lines.length && lines[i + 1].trim() !== '')){
        box.appendChild(inline(el('h3', 'p-rich-h'), line.replace(/^#{1,4}\s+/, '')));
        i++;
        continue;
      }
      var p = el('p');
      while(i < lines.length && lines[i].trim() !== '' && !BULLET.test(lines[i]) && !/^\s*\|.*\|\s*$/.test(lines[i])){
        if(p.childNodes.length){ p.appendChild(el('br')); }
        inline(p, lines[i]);
        i++;
      }
      box.appendChild(p);
    }
    return box;
  }

  /* ---------- Chat ---------- */
  function chat(body, alive){
    var timer = null, list = null, typing = null, input = null, go = null, shown = -1;
    function draw(messages, busy){
      if(messages.length !== shown){
        list.textContent = '';
        if(!messages.length){ list.appendChild(el('p', 'p-empty', 'Nothing yet. Ask me anything you would text me.')); }
        messages.forEach(function(m){
          var row = el('div', 'p-msg ' + (m.who === 'you' ? 'you' : 'bot'));
          var bubble = el('div', 'p-bubble');
          if(m.who === 'you'){ bubble.textContent = m.text; } else { bubble.appendChild(rich(m.text, false)); }
          row.appendChild(bubble);
          row.appendChild(el('div', 'p-msg-at', P.when(m.at)));
          list.appendChild(row);
        });
        shown = messages.length;
        list.scrollTop = list.scrollHeight;
      }
      typing.hidden = !busy;
      go.disabled = !!busy;
      clearTimeout(timer);
      if(busy){ timer = setTimeout(look, 2500); }
    }
    function look(){
      if(!alive()){ return; }
      P.ask('/panel/chat').then(function(r){
        if(!alive()){ return; }
        if(r.status !== 200){ P.say('The chat could not be read just now.', true); return; }
        draw(r.body.messages, r.body.busy);
      }).catch(function(e){ if(e.message !== 'signed out' && alive()){ timer = setTimeout(look, 6000); } });
    }
    function send(){
      var text = input.value.trim();
      if(!text || go.disabled){ return; }
      P.press('chat_send', { text: text }, go).then(function(r){
        if(r.status !== 200){ return; }
        if(r.body.started === false){ P.say(r.body.why || 'That did not send.', true); return; }
        P.say('');
        input.value = '';
        draw(r.body.messages, true);
      }).catch(function(){});
    }
    body.textContent = '';
    var c = P.card(body, 'Chat');
    c.appendChild(el('p', 'p-note', 'The same as texting me: same rules, same limits, and a yes here counts as your yes. Jobs I start still report back by text.'));
    list = el('div', 'p-chat');
    list.setAttribute('aria-live', 'polite');
    c.appendChild(list);
    typing = el('p', 'p-empty p-typing', 'Thinking…');
    typing.hidden = true;
    c.appendChild(typing);
    var form = el('form', 'p-chat-form');
    input = el('textarea', 'p-input p-chat-input');
    input.rows = 2;
    input.placeholder = 'Message';
    input.setAttribute('aria-label', 'Message to the Assistant');
    go = el('button', 'p-btn main', 'Send');
    go.type = 'submit';
    form.appendChild(input);
    form.appendChild(go);
    form.addEventListener('submit', function(e){ e.preventDefault(); send(); });
    input.addEventListener('keydown', function(e){ if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); send(); } });
    c.appendChild(form);
    var a = el('div', 'p-actions'), armed = 0;
    var clear = P.button(a, 'Clear the chat', 'quiet p-link', function(b){
      if(Date.now() - armed > 4000){ armed = Date.now(); clear.textContent = 'Tap again to clear'; setTimeout(function(){ clear.textContent = 'Clear the chat'; }, 4100); return; }
      armed = 0;
      P.press('chat_clear', {}, b).then(function(r){
        if(r.status === 200 && r.body.ok){ shown = -1; draw([], false); P.say('Cleared.'); }
        else if(r.status === 200){ P.say(r.body.why || 'Not cleared.', true); }
      }).catch(function(){});
    });
    c.appendChild(a);
    look();
  }

  /* ---------- Morning report ---------- */
  function morning(body, day){
    P.ask('/panel/morning' + (day ? '?day=' + encodeURIComponent(day) : '')).then(function(r){
      body.textContent = '';
      if(r.status !== 200){ body.appendChild(el('p', 'p-empty', 'That could not be read just now. Try again in a minute.')); return; }
      var m = r.body, c = P.card(body, 'Morning report');
      if(!m.on){ c.appendChild(el('p', 'p-note', 'The morning report is switched off.')); }
      if(!m.today && m.status){ c.appendChild(el('p', 'p-row-meta', 'Today: ' + m.status + '.')); }
      if(!m.days.length){ c.appendChild(el('p', 'p-empty', 'No report has been kept yet. The next one shows here as soon as it is texted.')); return; }
      var pick = el('select', 'p-input');
      pick.setAttribute('aria-label', 'Day');
      m.days.forEach(function(d){
        var o = el('option', '', d.name);
        o.value = d.day;
        if(d.day === m.day){ o.selected = true; }
        pick.appendChild(o);
      });
      pick.addEventListener('change', function(){ morning(body, pick.value); });
      c.appendChild(pick);
      c = P.card(body, m.name === 'Today' ? 'This morning' : m.name);
      c.appendChild(rich(m.text.replace(/^Morning report[^\n]*\n?/, ''), true));
      c.appendChild(el('p', 'p-row-meta p-after', 'Texted ' + P.when(m.at) + '.'));
    }).catch(function(e){
      if(e.message !== 'signed out'){ body.textContent = ''; body.appendChild(el('p', 'p-empty', 'The bot did not answer. Try again in a minute.')); }
    });
  }

  /* ---------- Trading card: only drawn when the bot says there is a summary ---------- */
  function trading(parent){
    P.ask('/panel/trading').then(function(r){
      if(r.status !== 200 || !r.body.show || !parent.isConnected){ return; }
      var c = P.card(parent, 'Trading');
      c.appendChild(rich(r.body.text.replace(/^(Trading check|Weekly trading review)[^\n]*\n?/, ''), false));
      c.appendChild(el('p', 'p-row-meta p-after', (r.body.kind === 'weekly' ? 'Weekly review' : r.body.kind === 'daily' ? 'Daily review' : 'Summary') +
        (r.body.at ? ', ' + P.when(r.body.at) : '') + '. From the trading bot\'s own log. I can\'t see or touch Robinhood.'));
    }).catch(function(){});
  }

  window.PanelExtras = { chat: chat, morning: morning, trading: trading, rich: rich };
})();
