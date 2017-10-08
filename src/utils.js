const trimString = (last, count, line, i) => {
  const isFirst = i === 0;
  const isLast = i === count - 1;
  const isLastNonEmpty = i === last;
  let trimmed = line.replace(/\t/g, ' ');

  if (!isFirst) {
    trimmed = trimmed.replace(/^[ ]+/, '');
  }
  if (!isLast) {
    trimmed = trimmed.replace(/[ ]+$/, '');
  }
  if (trimmed.length > 0) {
    if (!isLastNonEmpty) {
      trimmed += ' ';
    }
    return trimmed;
  }
  return '';
};

const handleWhitespace = value => {
  const lines = value.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;

  for (let i = lines.length - 1; i > 0; i--) {
    if (lines[i].match(/[^ \t]/)) {
      lastNonEmpty = i;
      break;
    }
  }

  const str = lines
    .map(trimString.bind(null, lastNonEmpty, lines.length))
    .filter(line => line.length > 0)
    .join('');

  if (str.length > 0) {
    return str;
  }
  return '';
};

const getHoisted = (last, path) => {
  if (path.parentPath === null) {
    const body = path.node.body;
    const index = body.indexOf(last);
    return {
      index,
      node: path.node,
    };
  } else {
    return getHoisted(path.node, path.parentPath);
  }
};

const addCreateImport = (t, toInsert, opts) => {
  const {node, index} = toInsert;

  if (opts.imports) {
    node.body.splice(
      index,
      0,
      t.importDeclaration(
        [
          t.ImportSpecifier(
            t.identifier('createVNode'),
            t.identifier(opts.pragma || 'createVNode'),
          ),
        ],
        t.stringLiteral(
          typeof opts.imports === 'string' ? opts.imports : 'shard',
        ),
      ),
    );
  } else if (!opts.pragma) {
    node.body.splice(
      index,
      0,
      t.VariableDeclaration('var', [
        t.VariableDeclarator(
          t.Identifier('createVNode'),
          t.memberExpression(
            t.identifier('Shard'),
            t.identifier('createVNode'),
          ),
        ),
      ]),
    );
  }
};

const getValue = (t, value) => {
  if (!value) {
    return t.BooleanLiteral(true);
  }
  if (value.type === 'JSXExpressionContainer') {
    return value.expression;
  }
  return value;
};

const getName = (t, name) => {
  if (name.indexOf('-') !== 0) {
    return t.stringLiteral(name);
  }
  return t.identifier(name);
};

export {
  trimString,
  handleWhitespace,
  getHoisted,
  addCreateImport,
  getValue,
  getName,
};
