define(['module', 'text', 'nunjucks'], function (module, text, nunjucks) {

    var DEFAULT_EXTENSION = '.html';

    function getConfig(cfg) {
        cfg = cfg || {};
        if (typeof cfg.env !== 'string') {
            if (!cfg.env || cfg.env.constructor !== Object) {
                cfg.env = {};
            }
            if (!cfg.env.path) {
                cfg.env.path = '/';
            }
            if (!cfg.env.options) {
                cfg.env.options = {};
            }
            cfg.env = 'nj-env-' + Date.now();
            var env = nunjucks.configure(cfg.env.path, cfg.env.options);
            define(cfg.env, [], function () {
                return env;
            });
        }
        cfg.extension = cfg.extension || DEFAULT_EXTENSION;
        cfg.asFunction = cfg.asFunction !== false;
        return cfg;
    }

    if (typeof window !== 'undefined') {
        window.nunjucksPrecompiled || (window.nunjucksPrecompiled = {});
    }
    nunjucks.configure = function configure (templatesPath, opts) {
        opts = opts || {};
        if (Object(templatesPath) === templatesPath) {
            opts = templatesPath;
            templatesPath = null;
        }
        return new env.Environment([], opts);
    };

    var buildMap = {};
    var njMasterConfig = getConfig(module.config ? module.config() : {});
    var globalDependencies = ['nunjucks', njMasterConfig.env];
    var reGetTemplate = /\.getTemplate\((.*?)/g;
    var reRequire = /@requires (?:module:)?(\S+)/g;

    function precompileString(str, name, env, asFunction) {
        var lib = nunjucks.require('lib');
        var compiler = nunjucks.require('compiler');

        env = env || new nunjucks.Environment([]);

        var asyncFilters = env.asyncFilters;
        var extensions = env.extensionsList;

        var out = '(function() {' +
            '(window.nunjucksPrecompiled = window.nunjucksPrecompiled || {})' +
            '["' + name.replace(/\\/g, '/') + '"] = (function() {';

        out += lib.withPrettyErrors(
            name,
            false,
            function () {
                return compiler.compile(str,
                    asyncFilters,
                    extensions,
                    name);
            }
        );
        out += '})();\n';

        if (asFunction) {
            out += 'return function(ctx, cb) { return nunjucks.render("' + name + '", ctx, cb); }';
        }

        out += '})();\n';
        return out;
    }

    if (typeof nunjucks.precompileString === 'function') {
        precompileString = function (str, name, env, asFunction) {
            var source = nunjucks.precompileString(str, {
                name: name,
                env: env,
                asFunction: asFunction
            });
            return source;
        };
    }

    function getDependencies(source) {
        var dependencies = [];
        var dep;
        var match;
        while ((match = reGetTemplate.exec(source))) {
            dep = match[1];
            if (dep && dep[0] === dep[dep.length - 1]) {
                dependencies.push(dep.slice(1, -1));
            }
        }
        while ((match = reRequire.exec(source))) {
            dep = match[1];
            if (dep) {
                if (dep[0] === dep[dep.length - 1]) {
                    dep = dep.slice(1, -1);
                }
                dependencies.push(dep);
            }
        }
        return dependencies;
    }

    return {

        load: function (name, req, load) {
            var doLoad = function (source) {
                console.log('[LOADED]', name);
                load(new Function('nunjucks', 'return ' + source)(nunjucks));
            };
            // load text files with text plugin
            text.get(req.toUrl(name + njMasterConfig.extension), function (str) {
                console.log(njMasterConfig.env);
                req([njMasterConfig.env], function compileTemplate(env) {
                    try {
                        console.log(req(njMasterConfig.env));
                    } catch (ex) {
                        console.log(ex.message);
                    }
                    console.log('[LOADING]', name);
                    try {
                        var source = precompileString(str, name, env, njMasterConfig.asFunction);
                        var dependencies = getDependencies(source);
                        buildMap[name] = {
                            source: source,
                            dependencies: globalDependencies.concat(dependencies).map(function (d) {
                                return '"' + d + '"';
                            })
                        };
                    } catch (ex) {
                        console.log('[ENV]', env);
                        console.log(ex.message);
                    }
                    if (dependencies.length) {
                        req(dependencies, function () {
                            doLoad(source);
                        });
                    } else {
                        doLoad(source);
                    }
                });
            });
        },

        write: function (pluginName, moduleName, writeModule) {
            if (moduleName in buildMap) {
                writeModule(
                    'define("' +
                    pluginName + '!' + moduleName + '", ' +
                    '[' + buildMap[moduleName].dependencies + '], ' +
                    'function(nunjucks){' +
                    'return ' + buildMap[moduleName].source +
                    '}' +
                    ')'
                );
            }
        }

    };
});