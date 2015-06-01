# Nunjucks loader for require.js  
  
- `requirejs-nj` precompiled templates in require.js  
- supports `extends` and `include`  
- resolves template dependencies using `require`  
- use the version of nunjucks you want  
  
## Usage  
  
### Installation  
  
`bower install requirejs-nj --save`  
  
### Configuration requirejs  
Add to config:  
  
``` javascript  
// file: main.js  
requirejs.config({  
    path: {  
        nj: 'bower_components/require-js/nj',  
		//helper for resolve dependencies in the templates  
        'runtime-shim': 'bower_components/require-js/runtime-shim'  
    }  
});  
```  
  
Then use it in your module code without the `nj!` prefix:  
  
``` javascript  
define(['jquery', 'nj!./views/layout.nj'], function ( $, template ) {  
	$.getJSON('data.json').then(function(json){  
		$('#placeholder').html(template.render(json));  
	});  
})  
```  
### Adding custom filters and extensions  
  
A custom nunjucks.Environment is used by this loader. To configure the nunjucks environment:  
  
- Create a file that will configure the environment. This should export a function that receives the nunjucks  
 environment as its first argument.  
- Add a `configure` key to the `nunjucks` in main.js  
  
``` javascript  
// file: main.js  
requirejs.config({  
	nunjucks: {  
		configure: 'lib/nunjucks/configure'  
	},  
    path: {  
        nj: 'bower_components/require-js/nj',  
        'runtime-shim': 'bower_components/require-js/runtime-shim'  
    }  
}  
```  
  
#### !IMPORTANT: define configure function and custom filters and extensions as UMD(universal module definition)  
``` javascript  
// file: configure.js  
(function (factory) {  
    if (typeof define === 'function' && define.amd) {  
        define(['./filters/date', './extensions/component'], factory);  
    } else if (typeof exports === 'object') {  
        module.exports = factory(require('./filters/date'), require('./extensions/component'));  
    }  
})(function (dateFilter, ComponentExtension) {  
    return function configure (env) {  
        dateFilter.install(env);  
        ComponentExtension.install(env);  
        env.addGlobal('log', function () {  
            console.log.apply(console, arguments);  
            return '';  
        });  
        env.addGlobal('debugger', function () {  
            /* jshint ignore:start */  
            debugger;  
            /* jshint ignore:end */  
            return '';  
        });  
    };  
});  
// file: filters/date.js  
(function (factory) {  
    if (typeof define === 'function' && define.amd) {  
        define(['moment'], factory);  
    } else if (typeof exports === 'object') {  
        module.exports = factory(require('moment'));  
    }  
})(function (moment) {  
    function dateFilter(dateString, format) {  
        return moment.utc(dateString).format(format);  
    }  
    dateFilter.install = function (env) {  
        env.addFilter('date', dateFilter);  
    };  
    return dateFilter;  
});  
//file: extensions/component.js  
(function (factory) {  
    if (typeof define === 'function' && define.amd) {  
        define(['nunjucks'], factory);  
    } else if (typeof exports === 'object') {  
        module.exports = factory(require('nunjucks'));  
    }  
})(function (nunjucks) {  
    var Component = function () {};  
    Component.install = function (env) {  
        env.addExtension('component', new Component());  
    };  
    return Component;  
});  
```  
  
## Build process  
Nunjucks <= 1.3.4 have issue with r.js. `Cannot read property FileSystemLoader of undefined`. Use r.js optimizer with next configuration:  
``` javascript  
// file: build.config.js  
({  
	rawText: {  
		nunjucks: 'define("nunjucks", function(){ return requirejs.nodeRequire("nunjucks"); })'  
	},  
	onBuildWrite: function (moduleName, path, contents) {  
		if (moduleName === 'nunjucks') {  
			return requirejs.nodeRequire('fs').readFileSync('bower_components/nunjucks/browser/nunjucks-slim.js').replace('define(function', 'define("nunjucks",[], function');  
		}  
		return contents;  
	}  
})  
```