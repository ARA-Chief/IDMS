// Shared crew display helpers — canonical copy.
// Mirror lives at IDMS-Console/src/renderer/js/crew-display.js.
// Keep the two files identical; the Console copy carries a sync header.
//
// Crew records currently store the name as a single `name` string
// (e.g. "William Ostara"). Splitting happens here at display time.
// TODO(tech-debt): migrate `name` -> first_name/last_name and drop the
// whitespace parsing below.

(function (root) {
  function parseName(raw) {
    var s = (raw == null ? '' : String(raw)).trim();
    if (!s) return { first: '', last: '' };
    var i = s.search(/\s+/);
    if (i < 0) return { first: s, last: '' };
    return { first: s.slice(0, i), last: s.slice(i).replace(/^\s+/, '') };
  }

  function getNickname(crew) {
    if (!crew) return '';
    var n = crew.nickname;
    return (typeof n === 'string' && n.trim()) ? n.trim() : '';
  }

  function getDisplayFirstName(crew) {
    if (!crew) return '';
    var nick = getNickname(crew);
    if (nick) return nick;
    return parseName(crew.name).first;
  }

  function getDisplayFullName(crew) {
    if (!crew) return '';
    var raw = (crew.name == null ? '' : String(crew.name)).trim();
    var nick = getNickname(crew);
    if (!nick) return raw;
    var parts = parseName(raw);
    if (!parts.first && !parts.last) return '"' + nick + '"';
    if (!parts.last) return parts.first + ' "' + nick + '"';
    return parts.first + ' "' + nick + '" ' + parts.last;
  }

  var api = {
    getDisplayFirstName: getDisplayFirstName,
    getDisplayFullName: getDisplayFullName
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.CrewDisplay = api;
    root.getDisplayFirstName = getDisplayFirstName;
    root.getDisplayFullName = getDisplayFullName;
  }
})(typeof window !== 'undefined' ? window : this);
