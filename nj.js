define( ["text", "nunjucks"], function ( text, nunjucks ) {

    var DEFAULT_EXTENSION = ".html";
    var buildMap = {},
        njConfig,
        njEnv,
        depEnv,
        deps = [ 'nunjucks' ];

    if ( typeof window !== 'undefined' ) {
        window.nunjucksPrecompiled || (window.nunjucksPrecompiled = {});
    }

    function getConfig ( cfg ) {
        if ( !njConfig ) {
            njConfig = cfg || {};
            if ( typeof njConfig.env === 'string' ) {
                depEnv = njConfig.env;
            }
            if ( !njConfig.env || njConfig.env.constructor !== Object ) {
                njConfig.env = {};
            }
            if ( !njConfig.env.path ) {
                njConfig.env.path = '/';
            }
            if ( !njConfig.env.options ) {
                njConfig.env.options = {};
            }
            if ( njConfig.asFunction !== false ) {
                njConfig.asFunction = true;
            }
        }
        return njConfig;
    }

    function precompileString ( str, name, env, asFunction ) {
        var lib = nunjucks.require( 'lib' ),
            compiler = nunjucks.require( 'compiler' );

        env = env || new Environment( [] );

        var asyncFilters = env.asyncFilters;
        var extensions = env.extensionsList;

        var out = '(function() {' +
            '(window.nunjucksPrecompiled = window.nunjucksPrecompiled || {})' +
            '["' + name.replace( /\\/g, '/' ) + '"] = (function() {';

        out += lib.withPrettyErrors(
            name,
            false,
            function () {
                return compiler.compile( str,
                    asyncFilters,
                    extensions,
                    name );
            }
        );
        out += '})();\n';

        if ( asFunction ) {
            out += 'return function(ctx, cb) { return nunjucks.render("' + name + '", ctx, cb); }';
        }

        out += '})();\n';
        return out;
    }

    if ( typeof nunjucks.precompileString === 'function' ) {
        precompileString = function ( str, name, env, asFunction ) {
            var source = nunjucks.precompileString( str, {
                name       : name,
                env        : env,
                asFunction : asFunction
            } );
            return source;
        };
    }

    return {

        load : function ( name, req, load, config ) {
            var njConfig = getConfig( config.nunjucks ),
                doLoad = function ( source ) {
                    load( new Function( 'nunjucks', 'return ' + source )( nunjucks ) );
                };
            // load text files with text plugin
            text.get( req.toUrl( name + (njConfig.extension != null ? njConfig.extension : DEFAULT_EXTENSION) ), function ( str ) {
                function compileTemplate ( env ) {
                    njEnv = njEnv || env || nunjucks.configure( njConfig.env.path, njConfig.env.options );
                    var source = precompileString( str, name, njEnv, njConfig.asFunction );
                    var dependencies = (source.match( /getTemplate\("(.*?)"/g ) || []).map( function ( t ) {
                        return t.replace( 'getTemplate(', '' )
                    } );
                    buildMap[name] = {
                        source       : source,
                        dependencies : deps.concat( dependencies ).map( function ( d ) {
                            return '"' + d + '"';
                        } )
                    };
                    if ( !config.isBuild ) {
                        if ( dependencies.length ) {
                            req( dependencies, function () {
                                doLoad( source );
                            } );
                        } else {
                            doLoad( source );
                        }
                    } else {
                        load( str );
                    }
                }

                if ( depEnv && !njEnv ) {
                    deps.push( depEnv );
                    req( [depEnv], compileTemplate );
                } else {
                    compileTemplate();
                }
            } );
        },

        write : function ( pluginName, moduleName, writeModule ) {
            if ( moduleName in buildMap ) {
                writeModule( 'define("' + pluginName + '!' + moduleName + '", [' + buildMap[moduleName].dependencies + '], function(nunjucks){return ' + buildMap[moduleName].source + '})' );
            }
        }

    };
} );