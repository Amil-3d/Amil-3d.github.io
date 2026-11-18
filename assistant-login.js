/* The one login for the dashboard and the panel. Holds no data and no password.
   - The password is checked by the bot. On a device the bot has not seen, the bot texts a 6 digit
     code and this page asks for it.
   - After that the bot remembers this device for 30 days. What the page keeps is the device's own
     token, in this browser only. Signing out throws it away here and on the bot. */
window.AssistantLogin = (function(){
  var API = 'https://nia-bot-uvyk.onrender.com';
  var KEY = 'assistant-device';
  var token = null;
  try{ token = localStorage.getItem(KEY); }catch(e){}
  try{ sessionStorage.removeItem('assistant-login'); }catch(e){}  /* the old 12 hour login */

  function remember(value){
    token = value || null;
    try{ if(token){ localStorage.setItem(KEY, token); } else { localStorage.removeItem(KEY); } }catch(e){}
  }
  /* Every request to the bot goes through here. Nothing is sent anywhere else. */
  function call(path, options){
    options = options || {};
    options.mode = 'cors';
    options.cache = 'no-store';
    options.credentials = 'omit';
    options.headers = options.headers || {};
    if(token){ options.headers['Authorization'] = 'Bearer ' + token; }
    if(options.json !== undefined){
      options.method = options.method || 'POST';
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.json);
      delete options.json;
    }
    return fetch(API + path, options).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(body){ return { status: r.status, body: body }; });
    });
  }
  function minutes(seconds){
    var m = Math.ceil(seconds / 60);
    return m >= 120 ? Math.round(m / 60) + ' hours' : m + ' minute' + (m === 1 ? '' : 's');
  }
  function tries(n){ return n + ' tr' + (n === 1 ? 'y' : 'ies') + ' left'; }

  /* Wires one login form. parts: form, label, password, code, button, message (elements), and
     onIn, called once the device is signed in. The same form does both steps. */
  function wire(parts){
    var ticket = null;
    function say(text, bad){ parts.message.textContent = text; parts.message.className = 'msg' + (bad ? ' bad' : ''); }
    function step(code){
      ticket = code ? ticket : null;
      parts.code.hidden = !code;
      parts.password.hidden = !!code;
      parts.password.required = !code;
      parts.label.textContent = code ? 'Code from the text' : 'Password';
      parts.label.htmlFor = code ? parts.code.id : parts.password.id;
      parts.button.textContent = code ? 'Confirm' : 'Unlock';
      if(code){ parts.code.value = ''; parts.code.focus(); }
    }
    function done(){ parts.button.disabled = false; }
    function failed(){ done(); say('The bot did not answer. Try again in a minute.', true); }
    parts.form.addEventListener('submit', function(e){
      e.preventDefault();
      if(ticket){
        var code = parts.code.value.replace(/\D/g, '');
        if(code.length !== 6){ return say('The code is 6 digits.', true); }
        parts.button.disabled = true;
        say('Checking…', false);
        call('/dash/login/code', { json: { ticket: ticket, code: code } }).then(function(r){
          done();
          if(r.status === 200 && r.body.token){
            remember(r.body.token);
            step(false);
            say('', false);
            parts.onIn();
          } else if(r.body.error === 'wrong_code'){
            parts.code.value = '';
            say('Wrong code. ' + tries(r.body.tries_left) + '.', true);
          } else if(r.status === 429){
            say('Too many requests. Wait a minute.', true);
          } else {
            step(false);
            say('That code ran out. Enter the password again for a new one.', true);
          }
        }).catch(failed);
        return;
      }
      var pw = parts.password.value;
      if(!pw){ return; }
      parts.button.disabled = true;
      say('Checking…', false);
      call('/dash/login', { json: { password: pw } }).then(function(r){
        done();
        parts.password.value = '';
        if(r.status === 200 && r.body.token){          /* a bot from before the code step */
          remember(r.body.token);
          say('', false);
          parts.onIn();
        } else if(r.status === 200 && r.body.need_code){
          ticket = r.body.ticket;
          step(true);
          say('New device. I texted you a 6 digit code, good for ' + r.body.minutes + ' minutes.', false);
        } else if(r.status === 401){
          say('Wrong password. ' + tries(r.body.tries_left) + ' before it locks.', true);
        } else if(r.status === 429 && r.body.error === 'too_many_codes'){
          say('Too many codes sent. Try again in ' + minutes(r.body.retry_seconds || 60) + '.', true);
        } else if(r.status === 429){
          say('Locked for ' + minutes(r.body.retry_seconds || 60) + '.', true);
        } else if(r.status === 503 && r.body.error === 'text_failed'){
          say('The code text could not be sent. Try again in a minute.', true);
        } else if(r.status === 503){
          say('No password is set yet.', true);
        } else {
          say('The bot refused the request.', true);
        }
      }).catch(failed);
    });
    return { say: say, reset: function(){ step(false); } };
  }

  function signOut(){
    var had = token;
    var sent = had ? call('/dash/logout', { method: 'POST' }).catch(function(){}) : Promise.resolve();
    remember(null);
    return sent;
  }

  return { api: API, call: call, wire: wire, signOut: signOut, forget: function(){ remember(null); },
           has: function(){ return !!token; }, minutes: minutes };
})();
