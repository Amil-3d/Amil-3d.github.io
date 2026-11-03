document.getElementById('yr').textContent = new Date().getFullYear();

var root = document.documentElement, btn = document.getElementById('theme');
var saved = null;
try{ saved = localStorage.getItem('theme'); }catch(e){}
if(saved){ root.setAttribute('data-theme', saved); }
btn.addEventListener('click', function(){
  var cur = root.getAttribute('data-theme');
  var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var next = cur ? (cur === 'dark' ? 'light' : 'dark') : (sysDark ? 'light' : 'dark');
  root.setAttribute('data-theme', next);
  try{ localStorage.setItem('theme', next); }catch(e){}
});
