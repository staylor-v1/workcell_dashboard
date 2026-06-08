function stripComment(line) {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && !escaped) inString = !inString;
    if (char === '#' && !inString) return line.slice(0, index).trim();
    escaped = char === '\\' && !escaped;
    if (char !== '\\') escaped = false;
  }
  return line.trim();
}

function splitTopLevel(source, delimiter = ',') {
  const parts = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (const char of source) {
    if (char === '"' && !escaped) inString = !inString;
    if (!inString) {
      if (char === '[' || char === '{') depth += 1;
      if (char === ']' || char === '}') depth -= 1;
      if (char === delimiter && depth === 0) {
        parts.push(current.trim());
        current = '';
        escaped = false;
        continue;
      }
    }
    current += char;
    escaped = char === '\\' && !escaped;
    if (char !== '\\') escaped = false;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseString(value) {
  return JSON.parse(value);
}

function parseInlineTable(value) {
  const body = value.slice(1, -1).trim();
  if (!body) return {};
  return Object.fromEntries(
    splitTopLevel(body).map((entry) => {
      const equals = entry.indexOf('=');
      const key = entry.slice(0, equals).trim();
      const item = entry.slice(equals + 1).trim();
      return [key, parseValue(item)];
    }),
  );
}

function parseValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) return parseString(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    const body = value.slice(1, -1).trim();
    return body ? splitTopLevel(body).map(parseValue) : [];
  }
  if (value.startsWith('{') && value.endsWith('}')) return parseInlineTable(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  const number = Number(value);
  return Number.isNaN(number) ? value : number;
}

function childForPath(root, path, arrayContexts) {
  let context = root;
  let consumed = [];
  for (const segment of path) {
    consumed = [...consumed, segment];
    const contextKey = consumed.join('.');
    if (arrayContexts.has(contextKey)) {
      context = arrayContexts.get(contextKey);
      continue;
    }
    context[segment] ??= {};
    context = context[segment];
  }
  return context;
}

export function parseToml(source) {
  const root = {};
  const arrayContexts = new Map();
  let context = root;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (!line) continue;

    const arrayHeader = line.match(/^\[\[([^\]]+)\]\]$/);
    if (arrayHeader) {
      const path = arrayHeader[1].split('.');
      const arrayName = path.at(-1);
      const parent = childForPath(root, path.slice(0, -1), arrayContexts);
      parent[arrayName] ??= [];
      const item = {};
      parent[arrayName].push(item);
      const contextKey = path.join('.');
      arrayContexts.set(contextKey, item);
      context = item;
      continue;
    }

    const tableHeader = line.match(/^\[([^\]]+)\]$/);
    if (tableHeader) {
      context = childForPath(root, tableHeader[1].split('.'), arrayContexts);
      continue;
    }

    const equals = line.indexOf('=');
    if (equals === -1) continue;
    const key = line.slice(0, equals).trim();
    const value = line.slice(equals + 1).trim();
    context[key] = parseValue(value);
  }

  return root;
}
