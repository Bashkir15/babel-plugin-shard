import {NodeFlags} from 'shard-constants';
import {
  NoU,
  isComponent,
  isArray,
  toExpression,
  toStatement,
  toReference,
  flattenExpression,
  isAstNull,
} from './helpers';
import {svgAttributes} from './svgAttributes';
import {
  trimString,
  handleWhitespace,
  getHoisted,
  addCreateImport,
  getValue,
  getName,
} from './utils';

let NULL;

const getNodeType = (t, type) => {
  const astType = type.type;
  let component = false;
  let flags;

  if (astType === 'JSXIdentifier') {
    if (isComponent(type.name)) {
      component = true;
      flags = NodeFlags.ComponentUnknown;
    } else {
      const tag = type.name;
      type = t.StringLiteral(tag);

      switch (tag) {
        case 'svg':
          flags = NodeFlags.SvgElement;
          break;
        case 'input':
          flags = NodeFlags.InputElement;
          break;
        case 'textarea':
          flags = NodeFlags.TextareaElement;
          break;
        case 'select':
          flags = NodeFlags.SelectElement;
          break;
        case 'media':
          flags = NodeFlags.MediaElement;
          break;
        default:
          flags = NodeFlags.HtmlElement;
      }
    }
  } else if (astType === 'JSXMemberExpression') {
    component = true;
    flags = NodeFlags.ComponentUnknown;
  }

  return {
    flags,
    isComponent: component,
    type,
  };
};

const getNodeChildren = (t, astChildren, opts) => {
  const children = [];
  let canParentKey = false;

  for (let i = 0; i < astChildren.length; i++) {
    const child = astChildren[i];
    const node = createNode(t, child, opts);
    if (!NoU(node)) {
      children.push(node);
      if ((canParentKey === false) & child.openingElement) {
        const props = child.openingElement.attributes;
        let len = props.length;

        while (canParentKey === false && len-- > 0) {
          const prop = props[len];
          if (prop.name && prop.name.name === 'key') {
            canParentKey = true;
          }
        }
      }
    }
  }

  const hasSingle = children.length === 1;
  return {
    canParentKey: hasSingle === false && canParentKey,
    children: hasSingle ? children[0] : t.arrayExpression(children),
  };
};

const getNodeProps = (t, astProps, isComponent) => {
  let props = [];
  let key = null;
  let ref = null;
  let className = null;
  let hasKeyedChildren = false;
  let hasNonKeyedChildren = false;
  let ignoreNormalize = false;

  for (let i = 0; i < astProps.length; i++) {
    const astProp = astProps[i];

    if (astProp.type === 'JSXSpreadAttribute') {
      props.push({
        astName: null,
        astValue: null,
        astSpread: astProp.argument,
      });
    } else {
      let propName = astProp.name;
      if (propName.type === 'JSXIdentifier') {
        propName = propName.name;
      } else if (propName.type === 'JSXNamespacedName') {
        propName = propName.namespace.name + ':' + propName.name.name;
      }

      if (!isComponent && (propName === 'className' || propName === 'class')) {
        className = getValue(t, astProp.value);
      } else if (!isComponent && propName === 'htmlFor') {
        props.push({
          astName: getName(t, 'for'),
          astValue: getValue(t, astProp.value),
          astSpread: null,
        });
      } else if (propName.substr(0, 11) === 'onComponent' && isComponent) {
        if (!ref) {
          ref = t.ObjectExpression([]);
        }

        ref.properties.push(
          t.ObjectProperty(getName(t, propName), getValue(t, astProp.value)),
        );
      } else if (!isComponent && propName in svgAttributes) {
        props.push({
          astName: getName(t, svgAttributes[propName]),
          astValue: getValue(t, astProp.value),
          astSpread: null,
        });
      } else {
        switch (propName) {
          case 'ignoreNormalize':
            ignoreNormalize = true;
            break;
          case 'hasNonKeyedChildren':
            hasNonKeyedChildren = true;
            break;
          case 'hasKeyedChildren':
            hasKeyedChildren = true;
            break;
          case 'ref':
            ref = getValue(t, astProp.value);
            break;
          case 'key':
            key = getValue(t, astProp.value);
            break;
          default:
            props.push({
              astName: getName(t, propName),
              astValue: getValue(t, astProp.value),
              astSpread: null,
            });
        }
      }
    }
  }

  return {
    props: NoU(props)
      ? NULL
      : (props = t.ObjectExpression(
          props.map(prop => {
            return !prop.astSpread
              ? t.ObjectProperty(prop.astName, prop.astValue)
              : t.SpreadProperty(prop.astSpread);
          }),
        )),
    key: NoU(key) ? NULL : key,
    ref: NoU(ref) ? NULL : ref,
    hasKeyedChildren,
    hasNonKeyedChildren,
    ignoreNormalize,
    className: NoU(className) ? NULL : className,
  };
};

const createNodeArgs = (
  t,
  flags,
  type,
  className,
  children,
  props,
  key,
  ref,
  ignoreNormalize,
) => {
  const args = [];
  const hasClassName = !isAstNull(className);
  const hasChildren = !isAstNull(children);
  const hasProps = props.properties && props.properties.length > 0;
  const hasKey = !isAstNull(key);
  const hasRef = !isAstNull(ref);

  args.push(t.NumericLiteral(flags));
  args.push(type);

  if (hasClassName) {
    args.push(className);
  } else if (hasChildren || hasProps || hasKey || hasRef || ignoreNormalize) {
    args.push(NULL);
  }

  if (hasChildren) {
    args.push(children);
  } else if (hasProps || hasKey || hasRef || ignoreNormalize) {
    args.push(NULL);
  }

  if (hasProps) {
    args.push(props);
  } else if (hasKey || hasRef || ignoreNormalize) {
    args.push(NULL);
  }

  if (hasKey) {
    args.push(key);
  } else if (hasRef || ignoreNormalize) {
    args.push(NULL);
  }

  if (hasRef) {
    args.push(ref);
  } else if (ignoreNormalize) {
    args.push(NULL);
  }

  if (ignoreNormalize) {
    args.push(t.BooleanLiteral(true));
  }

  return args;
};

const createNode = (t, astNode, opts) => {
  const astType = astNode.type;

  switch (astType) {
    case 'JSXElement':
      const openingElement = astNode.openingElement;
      const vType = getNodeType(t, openingElement.name);
      const vProps = getNodeProps(
        t,
        openingElement.attributes,
        vType.isComponent,
      );
      const childrenResults = getNodeChildren(t, astNode.children, opts);
      let vChildren = childrenResults.children;

      let flags = vType.flags;
      let props = vProps.props;

      if (vProps.hasKeyedChildren || childrenResults.canParentKey) {
        flags = flags | NodeFlags.HasKeyedChildren;
      }
      if (vProps.hasNonKeyedChildren) {
        flags = flags | NodeFlags.HasNonKeyedChildren;
      }

      if (vType.isComponent && vChildren) {
        let addChildrenToProps = true;
        if (
          vChildren.type === 'ArrayExpression' &&
          vChildren.elements.length === 0
        ) {
          addChildrenToProps = false;
        }

        if (addChildrenToProps) {
          if (props.properties) {
            props.properties.push(
              t.objectProperty(t.identifier('children'), vChildren),
            );
          } else {
            props = t.ObjectExpression([
              t.ObjectProperty(t.identifier('children'), vChildren),
            ]);
          }
        }

        vChildren = NULL;
      }

      return t.callExpression(
        t.identifier(opts.pragma || 'createVNode'),
        createNodeArgs(
          t,
          flags,
          vType.type,
          vProps.className,
          vChildren,
          props,
          vProps.key,
          vProps.ref,
          vProps.ignoreNormalize,
        ),
      );

    case 'JSXText':
      const text = handleWhitespace(astNode.value);
      if (text !== '') {
        return t.StringLiteral(text);
      }
      break;
    case 'JSXExpressionContainer':
      const expression = astNode.expression;
      if (expression && expression.type !== 'JSXEmptyExpression') {
        return expression;
      }
      break;
    default:
      break;
  }
};

module.exports = function(options) {
  const t = options.types;
  NULL = t.identifier('null');

  return {
    visitor: {
      JSXElement: {
        enter: function(path, state) {
          const opts = state.opts;
          const node = createNode(t, path.node, opts);

          path.replaceWith(node);
          if (!opts.hostCreateVNode) {
            opts.hostCreateVNode = true;
            addCreateImport(t, getHoisted(path.node, path.parentPath), opts);
          }
        },
      },
    },
    inherits: require('babel-plugin-syntax-jsx'),
  };
};
