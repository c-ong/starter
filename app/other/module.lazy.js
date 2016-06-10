/**
 * Created by xong on 6/9/16.
 */
$Fragment.define('module.lazy', {
    onResume: function() {
        var args = this.getArgs() || {};
        this.render( { html: '<div>This is lazing loaded module, args is ' + args['key'] + '</div>' } );
    }
});