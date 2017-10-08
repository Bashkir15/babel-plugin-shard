import test from 'ava';
import plugin from '../src/index.js';
import {transform} from 'babel-core';

const babelSettings = {
  presets: [['es2015', {modules: false}]],
  plugins: [[plugin, {imports: true}], 'syntax-jsx'],
};

const babelSettingsPragma = {
  presets: [['es2015', {modules: false}]],
  plugins: [[plugin, {pragma: 'test'}], 'syntax-jsx'],
};

function pluginTransform(input) {
  return transform(input, babelSettings).code;
}

function trans(input) {
  return pluginTransform(input).replace(
    'import { createVNode } from "shard";\n',
    '',
  );
}

function pluginTransformPragma(input) {
  return transform(input, babelSettingsPragma).code;
}

test('It should transform div', t => {
  t.is(
    pluginTransform('<div></div>'),
    'import { createVNode } from "shard";\ncreateVNode(2, "div");',
  );
});

test('should transform a single div', t => {
  t.is(
    pluginTransform('<div>1</div>'),
    'import { createVNode } from "shard";\ncreateVNode(2, "div", null, "1");',
  );
});

test('should be able to strip imports', t => {
  t.is(trans('<div>1</div>'), 'createVNode(2, "div", null, "1");');
});

test('className should be third param as an element', t => {
  t.is(
    trans('<div className="test">1</div>'),
    'createVNode(2, "div", "test", "1");',
  );
});

test('className should be fifth param as a component', t => {
  t.is(
    trans('<SomeComp className="test">1</SomeComp>'),
    'createVNode(16, SomeComp, null, null, {\n  "className": "test",\n  children: "1"\n});',
  );
});

test('class should have third param as value', t => {
  t.is(
    trans('<div class={variable}>1</div>'),
    'createVNode(2, "div", variable, "1");',
  );
});

test('events should be included in props', t => {
  t.is(
    trans('<div id="test" onClick={func} class={variable}>1</div>'),
    'createVNode(2, "div", variable, "1", {\n  "id": "test",\n  "onClick": func\n});',
  );
});

test('it should transform input and htmlFor', t => {
  const result = trans(
    '<label htmlFor={id}><input id={id} name={name} value={value} onChange={onChange} onInput={onInput} onKeyup={onKeyup} onFocus={onFocus} onClick={onClick} type="number" pattern="[0-9]+([,.][0-9]+)?" inputMode="numeric" min={minimum}/></label>',
  );
  const expected =
    'createVNode(2, "label", null, createVNode(512, "input", null, null, {\n  "id": id,\n  "name": name,\n  "value": value,\n  "onChange": onChange,\n  "onInput": onInput,\n  "onKeyup": onKeyup,\n  "onFocus": onFocus,\n  "onClick": onClick,\n  "type": "number",\n  "pattern": "[0-9]+([,.][0-9]+)?",\n  "inputMode": "numeric",\n  "min": minimum\n}), {\n  "for": id\n});';
  t.is(result, expected);
});

test('Should replace createVNode with pragma value', t => {
  t.is(pluginTransformPragma('<div></div>'), 'test(2, "div");');
});

test('it should transform xlinkHref to xlink:href', t => {
  const result = trans('<svg><use xlinkHref="#test"></use></svg>');
  const expected =
    'createVNode(128, "svg", null, createVNode(2, "use", null, null, {\n  "xlink:href": "#test"\n}));';
  t.is(result, expected);
});

test('it should transform strokeWidth to stroke-width', t => {
  const result = trans('<svg><rect strokeWidth="1px"></rect></svg>');
  const expected =
    'createVNode(128, "svg", null, createVNode(2, "rect", null, null, {\n  "stroke-width": "1px"\n}));';
  t.is(result, expected);
});

test('it should transform strokeWidth to stroke-width', t => {
  const result = trans('<svg><rect fillOpacity="1"></rect></svg>');
  const expected =
    'createVNode(128, "svg", null, createVNode(2, "rect", null, null, {\n  "fill-opacity": "1"\n}));';
  t.is(result, expected);
});
