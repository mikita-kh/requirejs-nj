define(function( require, exports, module ) {
	module.exports = function ( nunjucks, env, obj, dependencies ) {
		var oldRoot = obj.root;
		obj.root = function( env, context, frame, runtime, cb ) {
			var oldGetTemplate = env.getTemplate;
			env.getTemplate = function( name, eagerCompile, parentName, cb ) {
                if ( name && name.raw ) {
                    name = name.raw;
                }
                if ( typeof name !== 'string' ) {
                    throw new Error('template names must be a string: ' + name);
                }
                if ( typeof parentName === 'function' ) {
                    cb = parentName;
                    parentName = null;
                    eagerCompile = eagerCompile || false;
                }
				if ( typeof eagerCompile === "function" ) {
					cb = eagerCompile;
					eagerCompile = false;
				}
				var _require = function(name) {
					try {
						// add a reference to the already resolved dependency here...
						return dependencies[name];
					} catch (e) {
						if ( frame.get( '_require' ) ) {
							return frame.get( '_require' )( name );
						}
					}
				};
				var tmpl = _require( name );
				frame.set( '_require', _require );
                if ( eagerCompile ) {
                    tmpl.compile();
                }
                if ( cb ) {
                    cb(null, tmpl);
                } else {
                    return tmpl;
                }
			};
			oldRoot( env, context, frame, runtime, function( err, res ) {
				env.getTemplate = oldGetTemplate;
				cb( err, res );
			});
		};
		var src = {
			obj: obj,
			type: 'code'
		};
		return new nunjucks.Template( src, env );
	};
})