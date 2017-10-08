'use strict';

var shardConstants = require('shard-constants');

const NoU = obj => obj === undefined || obj === null;
const isComponent = name => name.charAt(0).toUpperCase() === name.charAt(0);
const isAstNull = ast => {
    if (!ast) {
        return true;
    }
    if (ast.type === 'ArrayExpression' && ast.elements.length === 0) {
        return true;
    }
    return ast.name === 'null';
};

const svgAttributes = {
    accentHeight               : 'accent-height',
    alignmentBaseline          : 'alignment-baseline',
    arabicForm                 : 'arabic-form',
    baselineShift              : 'baseline-shift',
    capHeight                  : 'cap-height',
    clipPath                   : 'clip-path',
    clipRule                   : 'clip-rule',
    colorInterpolation         : 'color-interpolation',
    colorInterpolationFilters  : 'color-interpolation-filters',
    colorProfile               : 'color-profile',
    colorRendering             : 'color-rendering',
    dominantBaseline           : 'dominant-baseline',
    enableBackground           : 'enable-background',
    fillOpacity                : 'fill-opacity',
    fillRule                   : 'fill-rule',
    floodColor                 : 'flood-color',
    floodOpacity               : 'flood-opacity',
    fontFamily                 : 'font-family',
    fontSize                   : 'font-size',
    fontSizeAdjust             : 'font-size-adjust',
    fontStretch                : 'font-stretch',
    fontStyle                  : 'font-style',
    fontVariant                : 'font-variant',
    fontWeight                 : 'font-weight',
    glyphName                  : 'glyph-name',
    glyphOrientationHorizontal : 'glyph-orientation-horizontal',
    glyphOrientationVertical   : 'glyph-orientation-vertical',
    horizAdvX                  : 'horiz-adv-x',
    horizOriginX               : 'horiz-origin-x',
    imageRendering             : 'image-rendering',
    letterSpacing              : 'letter-spacing',
    lightingColor              : 'lighting-color',
    markerEnd                  : 'marker-end',
    markerMid                  : 'marker-mid',
    markerStart                : 'marker-start',
    markerHeight               : 'markerHeight',
    overlinePosition           : 'overline-position',
    overlineThickness          : 'overline-thickness',
    paintOrder                 : 'paint-order',
    panose1                    : 'panose-1',
    pointerEvents              : 'pointer-events',
    renderingIntent            : 'rendering-intent',
    shapeRendering             : 'shape-rendering',
    stopColor                  : 'stop-color',
    stopOpacity                : 'stop-opacity',
    strikethroughPosition      : 'strikethrough-position',
    strikethroughThickness     : 'strikethrough-thickness',
    strokeDasharray            : 'stroke-dasharray',
    strokeDashoffset           : 'stroke-dashoffset',
    strokeLinecap: 'stroke-linecap',
    strokeLinejoin: 'stroke-linejoin',
    strokeMiterlimit: 'stroke-miterlimit',
    strokeOpacity: 'stroke-opacity',
    strokeWidth: 'stroke-width',
    textDecoration: 'text-decoration',
    textRendering: 'text-rendering',
    underlinePosition: 'underline-position',
    underlineThickness: 'underline-thickness',
    unicodeBidi: 'unicode-bidi',
    unicodeRange: 'unicode-range',
    unitsPerEm: 'units-per-em',
    vAlphabetic: 'v-alphabetic',
    vHanging: 'v-hanging',
    vIdeographic: 'v-ideographic',
    vMathematical: 'v-mathematical',
    vectorEffect: 'vector-effect',
    vertAdvY: 'vert-adv-y',
    vertOriginX: 'vert-origin-x',
    vertOriginY: 'vert-origin-y',
    wordSpacing: 'word-spacing',
    writingMode: 'writing-mode',
    xHeight: 'x-height',
    xlinkActuate: 'xlink:actuate',
    xlinkArcrole: 'xlink:arcrole',
    xlinkHref: 'xlink:href',
    xlinkRole: 'xlink:role',
    xlinkShow: 'xlink:show',
    xlinkTitle: 'xlink:title',
    xlinkType: 'xlink:type',
    xmlBase: 'xml:base',
    xmlnsXlink: 'xmlns:xlink',
    xmlLang: 'xml:lang',
    xmlSpace: 'xml:space'
};

const trimString = (last, count, line, i) => {
    const isFirst = (i === 0);
    const isLast = (i === count - 1);
    const isLastNonEmpty = (i === last);
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
            node : path.node,
        };
    } else {
        return getHoisted(path.node, path.parentPath);
    }
};

const addCreateImport = (t, toInsert, opts) => {
    const { node, index } = toInsert;

    if (opts.imports) {
        node.body.splice(index, 0, t.importDeclaration([
            t.ImportSpecifier(t.identifier('createVNode'), t.identifier(opts.pragma || 'createVNode'))
        ], t.stringLiteral(typeof opts.imports === 'string' ? opts.imports : 'shard')));
    } else if (!opts.pragma) {
        node.body.splice(index, 0, t.VariableDeclaration('var', [
            t.VariableDeclarator(
                t.Identifier('createVNode'),
                t.memberExpression(t.identifier('Shard'), t.identifier('createVNode'))
            )
        ]));
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

let NULL;

const getNodeType = (t, type) => {
    const astType = type.type;
    let component = false;
    let flags;

    if (astType === 'JSXIdentifier') {
        if (isComponent(type.name)) {
            component = true;
            flags = shardConstants.NodeFlags.ComponentUnknown;
        } else {
            const tag = type.name;
            type = t.StringLiteral(tag);

            switch (tag) {
                case 'svg':
                    flags = shardConstants.NodeFlags.SvgElement;
                    break;
                case 'input':
                    flags = shardConstants.NodeFlags.InputElement;
                    break;
                case 'textarea':
                    flags = shardConstants.NodeFlags.TextareaElement;
                    break;
                case 'select':
                    flags = shardConstants.NodeFlags.SelectElement;
                    break;
                case 'media':
                    flags = shardConstants.NodeFlags.MediaElement;
                    break;
                default:
                    flags = shardConstants.NodeFlags.HtmlElement;
            }
        }
    } else if (astType === 'JSXMemberExpression') {
        component = true;
        flags = shardConstants.NodeFlags.ComponentUnknown;
    }

    return {
        flags,
        isComponent : component,
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
            if (canParentKey === false & child.openingElement) {
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


const getNodeProps = (t, astProps, isComponent$$1) => {
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
                astSpread: astProp.argument
            });
        } else {
            let propName = astProp.name;
            if (propName.type === 'JSXIdentifier') {
                propName = propName.name;
            } else if (propName.type === 'JSXNamespacedName') {
                propName = propName.namespace.name + ':' + propName.name.name;
            }

            if (!isComponent$$1 && (propName === 'className' || propName === 'class')) {
                className = getValue(t, astProp.value);
            } else if (!isComponent$$1 && (propName === 'htmlFor')) {
                props.push({
                    astName: getName(t, 'for'),
                    astValue: getValue(t, astProp.value),
                    astSpread: null
                });
            } else if (propName.substr(0, 11) === 'onComponent' && isComponent$$1) {
                if (!ref) {
                    ref = t.ObjectExpression([]);
                }

                ref.properties.push(t.ObjectProperty(getName(t, propName), getValue(t, astProp.value)));
            } else if (!isComponent$$1 && propName in svgAttributes) {
                props.push({
                    astName: getName(t, svgAttributes[propName]),
                    astValue: getValue(t, astProp.value),
                    astSpread: null
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
                            astSpread: null
                        });
                }
            }
        }
    }

    return {
        props: NoU(props) ? NULL : props = t.ObjectExpression(
            props.map(prop => {
                return !prop.astSpread
                    ? t.ObjectProperty(prop.astName, prop.astValue)
                    : t.SpreadProperty(prop.astSpread);
            })
        ),
        key: NoU(key) ? NULL : key,
        ref: NoU(ref) ? NULL : ref,
        hasKeyedChildren,
        hasNonKeyedChildren,
        ignoreNormalize,
        className: NoU(className) ? NULL : className
    };
};

const createNodeArgs = (t, flags, type, className, children, props, key, ref, ignoreNormalize) => {
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
            const vProps = getNodeProps(t, openingElement.attributes, vType.isComponent);
            const childrenResults = getNodeChildren(t, astNode.children, opts);
            let vChildren = childrenResults.children;

            let flags = vType.flags;
            let props = vProps.props;

            if (vProps.hasKeyedChildren || childrenResults.canParentKey) {
                flags = flags | shardConstants.NodeFlags.HasKeyedChildren;
            }
            if (vProps.hasNonKeyedChildren) {
                flags = flags | shardConstants.NodeFlags.HasNonKeyedChildren;
            }

            if (vType.isComponent && vChildren) {
                let addChildrenToProps = true;
                if (vChildren.type === 'ArrayExpression' && vChildren.elements.length === 0) {
                    addChildrenToProps = false;
                }

                if (addChildrenToProps) {
                    if (props.properties) {
                        props.properties.push(t.objectProperty(t.identifier('children'), vChildren));
                    } else {
                        props = t.ObjectExpression([
                            t.ObjectProperty(t.identifier('children'), vChildren)
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
                    vProps.ignoreNormalize
                )
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

module.exports = function (options) {
    const t = options.types;
    NULL = t.identifier('null');

    return {
        visitor: {
            JSXElement: {
                enter: function (path, state) {
                    const opts = state.opts;
                    const node = createNode(t, path.node, opts);

                    path.replaceWith(node);
                    if (!opts.hostCreateVNode) {
                        opts.hostCreateVNode = true;
                        addCreateImport(t, getHoisted(path.node, path.parentPath), opts);
                    }
                }
            }
        },
        inherits: require('babel-plugin-syntax-jsx')
    }
};
