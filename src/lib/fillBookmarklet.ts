// "Fill login": a one-time bookmark that fills a login page from what "Login & open" copied. It can't be done from our own
// page (browsers stop one site typing into another), so the filling code runs on the login page itself, from a bookmark.
// The bookmark holds no username or password: it only knows how to read the copied text and fill the form.

/** What "Login & open" puts on the clipboard, and what the bookmark looks for. */
export const FILL_PREFIX = "SPARKFILL:";

export function fillPayload(username: string, password: string): string {
  return FILL_PREFIX + JSON.stringify({ u: username, p: password });
}

// Written as readable lines, then joined: a bookmark URL must be a single line.
const SOURCE = [
  "(async()=>{",
  "try{",
  // https pages (and localhost) can read the clipboard; plain http pages can't, so ask for a paste instead.
  "let t=navigator.clipboard&&navigator.clipboard.readText?await navigator.clipboard.readText():prompt('Paste the copied login here');",
  `if(!t||t.indexOf('${FILL_PREFIX}')!==0){alert('Nothing to fill. Click Login & open on the test user first.');return}`,
  `const d=JSON.parse(t.slice(${FILL_PREFIX.length}));`,
  "const vis=e=>e.offsetParent!==null&&!e.disabled&&!e.readOnly;",
  "const set=(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))};",
  "const pw=[...document.querySelectorAll('input[type=password]')].find(vis);",
  "if(!pw){alert('No password field found on this page.');return}",
  "const us=[...document.querySelectorAll('input')].filter(e=>vis(e)&&/^(text|email|tel)?$/i.test(e.type));",
  "const before=us.filter(e=>pw.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_PRECEDING);",
  "const u=before[before.length-1]||us[0];",
  "if(u)set(u,d.u);",
  "set(pw,d.p);",
  // The password only needs to sit on the clipboard until it is used.
  "if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText('');",
  "}catch(e){alert('Could not fill the login: '+e.message)}",
  "})();",
].join("");

export const FILL_BOOKMARKLET = `javascript:${SOURCE}`;
