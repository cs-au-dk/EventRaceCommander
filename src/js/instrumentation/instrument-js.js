// External
var falafel = require('falafel');
var proxy = require('rewriting-proxy');
var util = require('util');

// Internal
var config = require('../config.js').config;

function instrumentJavaScript(input, options) {
    // Only hoist if it is an inline/external script, since declarations
    // in inline event handlers do not write to the global scope)
    var hoist = !options.allowReturnOutsideFunction;

    function transform(node) {
        // Instrument index-assignments
        if (options.instrumentPropertyNames &&
                node.type === 'AssignmentExpression' &&
                node.operator === '=' &&
                node.left.type === 'MemberExpression') {
            var left = node.left;
            if (left.computed) {
                node.update(util.format('$_C.assign(%s, \%s\, %s)', left.object.source(), left.property.source(), node.right.source()));
            } else {
                var property = left.property.source();

                // Intercept event handler registrations and assignments to 'src',
                // since setting the 'src' attribute of an image element will perform a request
                if (options.instrumentPropertyNames.indexOf(property) >= 0 || property === 'src') {
                    node.update(util.format('$_C.assign(%s, \'%s\', %s)', left.object.source(), left.property.source(), node.right.source()));
                }
            }
        }

        // Hoist declarations
        if (hoist && options.wrapper) {
            if (node.funcDepth === 0 && node.type === 'VariableDeclaration') {
                var decls = [];
                var clears = [];
                var assignments = [];
                for (var i = 0, n = node.declarations.length; i < n; ++i) {
                    var decl = node.declarations[i];
                    var id = decl.id.source();
                    // decls.push(id + ' = window.' + id);
                    clears.push(id + ' = undefined || window.' + id);
                    if (decl.init) {
                        assignments.push(id + ' = ' + decl.init.source());
                    }
                }
                // result.push('var ' + decls.join(', ') + ';');
                innerDecls.push(clears.join(', ') + ';');
                if (assignments.length) {
                    // Only add a trailing semicolon if it is not a variable declaration in a for statement
                    var trailingSemicolon = node.parent.type === 'ForStatement' && node === node.parent.init ? '' : ';';
                    node.update(assignments.join(', ') + trailingSemicolon);
                } else if (node.parent.type === 'ForInStatement' || node.parent.type === 'ForOfStatement') {
                    node.update(node.declarations[0].id.source());
                } else {
                    node.update('');
                }
            } else if (node.funcDepth === 1 && node.type === 'FunctionDeclaration') {
                var id = node.id.source();
                innerDecls.push(node.source());
                innerDecls.push('window.' + id + ' = ' + id + ';');
                node.update('');
            }
        }
    }

    var result = [], innerDecls = [], instr;
    try {
        instr = falafel({
            allowReturnOutsideFunction: options.allowReturnOutsideFunction,
            source: input,
            visit: function (node) {
                if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
                    node.funcDepth = (node.parent.funcDepth || 0) + 1;
                } else if (node.parent) {
                    node.funcDepth = node.parent.funcDepth;
                } else {
                    node.funcDepth = 0;
                }
            }
        }, transform).toString().trim();
    } catch (e) {
        if (e.name === 'SyntaxError') {
            // Remove the syntax error, otherwise the code in the wrapper will not execute...
            instr = 'throw new SyntaxError(' + JSON.stringify(e.message) + ');';
        } else {
            console.error('Failure during script instrumentation:', e.message + ' (' + e.name + ').');
            console.error('Source:', input);
            throw e;
        }
    }
    if (options.wrapper) {
        var lines = instr.split('\n');
        if (lines[0].indexOf('<![CDATA[') >= 0 && lines[lines.length-1].indexOf(']]>') >= 0) {
            // Delete first and last non empty line
            lines.shift();
            var lastLine = lines.pop();
            var commentIdx = lastLine.indexOf('//');
            if (commentIdx >= 0) {
                lines.push(lastLine.substring(0, commentIdx));
            }
            instr = lines.join('\n');
        }
        result.push(options.wrapper(innerDecls.join('') + instr));
    } else {
        result.push(instr);
    }
    return result.join('\n');
}

module.exports = function (input, options) {
    if (!config.instrument) {
        return input;
    }

    options.instrumentPropertyNames = proxy.eventHandlerAttributeNames.concat(['innerHTML', 'src']);
    if (typeof options.allocNum === 'number' && !options.allowReturnOutsideFunction) {
        options.wrapper = function (code) {
            return util.format('$_M.onEvent($_L.Event.next(new $_S.OID(\'%s\', %s), \'%s\', %s, %s), function () { %s\n}, %s);',
                options.allocName,
                options.allocNum,
                options.eventName,
                options.event,
                options.allocName === 'script' ? util.format('{ inline: %s }',
                    options.isExternal ? 'false' : 'true') : 'undefined',
                code,
                options.receiver);
        };
    }
    return instrumentJavaScript(input, options);
};
