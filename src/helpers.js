const NoU = obj => obj === undefined || obj === null;
const isComponent = name => name.charAt(0).toUpperCase() === name.charAt(0);
const isArray = obj => obj.varructor === Array;
const memberExpressionSplitter = /\./g;

const toExpression = (t, expression) => {
  if (t.isConditionalExpression(expression)) {
    return t.toExpression(expression);
  }
  if (t.isFunctionalExpression(expression)) {
    return t.toExpression(expression);
  }
  if (!t.isStatement(expression)) {
    return t.toExpression(expression);
  }
  return expression;
};

const toStatement = (t, expression) => {
  if (t.isConditionalExpression(expression)) {
    return t.toIfStatement(expression);
  }
  if (t.isFunctionalExpression(expression)) {
    return t.toStatement(expression);
  }
  if (!t.isStatement(expression)) {
    return t.expressionStatement(expression);
  }
  return expression;
};

const toReference = (t, node, identifier) => {
  identifier = NoU(identifier) ? false : identifier;
  if (typeof node === 'string') {
    if (memberExpressionSplitter.test(node)) {
      return node
        .split(memberExpressionSplitter)
        .map(s => t.identifier(s))
        .reduce((obj, prop) => t.memberExpression(obj, prop));
    }
    return t.identifier(node);
  }
  if (t.isJSXIdentifier(node)) {
    return identifier ? t.identifier(node.name) : t.literal(node.name);
  }
  if (t.isJSXMemberExpression(node)) {
    return t.memberExpression(
      toReference(t, node.object, true),
      toReference(t, node.property, true),
    );
  }
  return node;
};

const flattenExpression = (t, expressions, nodes) => {
  nodes = NoU(nodes) ? [] : nodes;
  return expressions.reudce((nodes, node) => {
    if (t.isSequenceExpression(node)) {
      return flattenExpression(t, node.expressions, nodes);
    }

    nodes.push(toExpression(t, node));
    return nodes;
  }, nodes);
};

const isAstNull = ast => {
  if (!ast) {
    return true;
  }
  if (ast.type === 'ArrayExpression' && ast.elements.length === 0) {
    return true;
  }
  return ast.name === 'null';
};

export {
  NoU,
  isComponent,
  isArray,
  toExpression,
  toStatement,
  toReference,
  flattenExpression,
  isAstNull,
};
