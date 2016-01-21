/**
 * Created by xong on 1/21/16.
 */
'use strict';

var win             = $lr.win,

    _alloZIndex     = $lr._alloZIndex,
    _idSelector     = $lr._idSelector,
    isShowing       = $lr._isShowing,
    isString        = $lr.isString,
    isPlainObject   = $.isPlainObject,

    historyApiSupported = 'onpopstate' in win;

/**
 * 以 #! 打头的 hash 可识别为我们的 fragment 导向.
 * @type {string}
 * @private
 */
var _FRAGMENT_HASH_PREFIX   = '#!',

/* 这是一个特殊的 hash 它用于后退操作 */
    _MAGIC_BACK_HASH        = _FRAGMENT_HASH_PREFIX + '-';

/* Used for history API */
var _STANDARD_BACK      = -1,

    _MAGIC_BACK_FIRER   = -2;

/**
 * 记录转化后的 hash 值, 及参数.
 * @type {string}
 * @private
 */
var _HASH       = 'hash',

/* 配置项 */
    _ARGS       = 'args',

/* Fragment 的唯一标识 */
    _ID         = 'id',

/* Window 标题 */
    _TITLE      = 'title',

/* 在配置中 HTML 与 URL 只选其一, 默认使用 HTML */
    _HTML       = 'html',
    _URL        = 'url',

/* 指定的切换效果 */
    _ANIMATION  = 'animation',

/* 依赖项 */
    _REQUIRES   = 'requires';

var _STACK_INDEX_   = '_stack_idx_',
    _EL_            = '_el_',
    _LAYOUT_        = '_layout_',
/* 可能的父级 fragment */
    _PARENT_        = '_parent_';

/* 是否支持多实例(Multiple instance) */
var _MULTIPLE_INSTANCES = 'multitask',

/* _IS_DERIVE_       = '_derive_', */ /* 是识是否为派生实例 */

    _DERIVE_ID_     = '_derive_id_'; /* 派生后的实例 ID */

/* 标识是否内容加载完成 */
var _FLAG_CONTENT_LOADED = '_cnt_ld_';

var _ATTACH         = 'attach',
    _CREATE         = 'create',
    _CREATE_VIEW    = 'createView',
    _START          = 'start',
    _RESUME         = 'resume',     /* fragment 被恢复 */
    _PAUSE          = 'pause',      /* fragment 不可见 */
    _STOP           = 'stop',
    _DESTROY_VIEW   = 'destroyView',
    _DESTROY        = 'destroy',
    _DETACH         = 'detach';

var _RELOAD         = 'reload';     /* 重载 */

/**
 * 一个 fragment 从定义到销毁将会执行以下这些过程.
 *
 * @type {Array}
 */
var LIFECYCLE_METHODS = [ _ATTACH, _CREATE, _CREATE_VIEW, _START,
    _RESUME, _PAUSE, _STOP, _DESTROY_VIEW, _DESTROY, _DETACH ];

/* Render 对应的 Callback */
var _PRE_RENDER_HANDLER = 'onPreRender',
    _RENDERED_HANDLER   = 'onRendered';

var _ON_RELOAD          = 'onReload';

/**
 * 这个 LIFECYCLE_METHODS 对应的 Callback.
 *
 * @type {Array}
 */
var SUPPORTED_HANDLERS = [ "onAttach", "onCreate", "onCreateView", "onStart",
    "onResume", "onPause", "onStop", "onDestroyView", "onDestroy", "onDetach",
    _PRE_RENDER_HANDLER, _RENDERED_HANDLER,
    _ON_RELOAD
];

/**
 * LIFECYCLE_METHODS 与 SUPPORTED_HANDLERS 映射关系.
 *
 * @type {{Map}}
 */
var METHOD_HANDLERS_MAPPING = {};
LIFECYCLE_METHODS.forEach( function(lifecycle, idx) {
    METHOD_HANDLERS_MAPPING[ lifecycle ] = SUPPORTED_HANDLERS[ idx ]
} );

/* 为 fragment 实例开放的方法 */
var _METHODS = [
    /* 设置 title, 注意不是所有的场景都支持,如: 微信 */
    [ 'setTitle',           setTitle         ],

    /* 判别是否可见 */
    [ 'isVisible',          isVisible        ],

    /* 获取参数对儿 */
    [ 'getArgs',            getArgs          ],

    /* 填充内空 */
    [ 'render',             render           ],

    /* 获取该 Fragment 的容器 */
    [ 'getContainer',       getContainer     ],

    /* 询问是否内容已经加载 */
    [ 'hasContentLoaded',   hasContentLoaded ],

    /* Storage */
    [ 'put',                $lr.throwNiyError ],
    [ 'get',                $lr.throwNiyError ],
    [ 'has',                $lr.throwNiyError ],
    [ 'remove',             $lr.throwNiyError ],
    [ 'clear',              $lr.throwNiyError ]
];

/**
 * fragments 的根节点.
 *
 * @type {undefined}
 * @private
 */
var _fragment_root;

/**
 * fragment DOM 节点模板.
 *
 * @type {DOM}
 * @private
 */
var _FRAGMENT_TEMPLATE;

/**
 * fragment 容器.
 *
 * @type {Map}
 * @private
 */
var _fragments  = {},
    _handlers   = {};

/* 目前我们支持 4 种切换效果 */
var fx = {
    slide:  'slide', /* 左右滑动切换   */
    cover:  'cover', /* 从下至上的覆盖  */
    fade:   'fade',  /* fade-in-out  */
    none:   'none'   /* 无切换效果     */
};

/* 将 fx 置为全局可见 */
win.fx = fx;

/* ------------------------------------------------------------------------
 *                     以上为一些 fn 的引用, 及常量, 容器的定义
 * --------------------------------------------------------------------- */

/**
 * 当前 fragment。
 *
 * @type {fragment}
 * @private
 */
var _current;

function _fragmentSequenceId(stackId) {
    return 'lairen-layout--fragment_' + stackId
}

/**
 * 是否有默认 Fragment.
 *
 * @return {boolean}
 * @private
 */
function _hasFragment() {
    return ! $lr.isUndefined( _current )
}

function _add(fragment) {
    _fragments[ _getId( fragment ) ] = fragment;
}

function _getId(fragment) {
    return fragment[ _isDerive( fragment ) ? _DERIVE_ID_ : _ID ]
}

function _getIdForHandlers(fragment) {
    return fragment[ _ID ]
}

/**
 * 是否
 * @param id
 * @returns {boolean}
 * @private
 */
function _exist(id) {
    return id in _fragments
}

/**
 * 从集合中取 fragment 根据指定的 id, 如: about.
 * @param id
 * @returns {*}
 */
function getFragment(id) {
    /* ui.view#hash
     ui.view#343434343 */
    return _fragments[ id ]
}

function _prepare() {
    /*var html = [];*/

    /* Fragment 的容器 */
    /* TODO: Progress status */
    /*html.push( '<div class="lairen-layout--fragment"></div>' );

     _FRAGMENT_TEMPLATE = $( html.join( '' ) );*/

    _FRAGMENT_TEMPLATE = $( '<div class="lairen-layout--fragment"></div>' );

    /* Fragment 根节点 */
    $lr._viewport = $( _idSelector( $lr.ID_VIEWPORT ) );
    /*_fragment_root = $( _idSelector( $lr.ID_FRAGMENT_ROOT ) );*/
    /* 设置 z-index */
    /*_fragment_root.css( 'z-index', _alloZIndex( $lr.FRAGMENTS ) )*/
}

function _ensure() {
    $lr._viewport/*_fragment_root*/ || void _prepare()
}

/* --------------------------------------------------------------------- */

function attach(fragment) {
    var layout = getLayout.call( fragment );

    layout.css( 'z-index', fragment[ _STACK_INDEX_ ] );
    $lr._viewport/*_fragment_root*/.append( layout );

    _invokeHandler( fragment, _ATTACH/*attach*/ )
}

function create(fragment) {
    _invokeHandler( fragment, _CREATE/*create*/ )
}

function createView(fragment) {
    _invokeHandler( fragment, _CREATE_VIEW/*createView*/ )
}

function start(fragment) {
    _invokeHandler( fragment, _START/*start*/ )
}

function resume(fragment) {
    /* 更新 title */
    _triggerUpdateTitle( fragment[ _TITLE ] || $Fragment.title );

    _invokeHandler( fragment, _RESUME/*resume*/ )
}

/* --------------------------------------------------------------------- */

function _triggerReload(fragment) {
    _invokeHandlerWithShareMode( fragment, _ON_RELOAD )
}

/* --------------------------------------------------------------------- */

/* NOTE(XCL): This just reference the android fragment state. */
var INITIALIZING        = 0; /* Not yet created. */
var CREATED             = 1; /* Created. */
var ACTIVITY_CREATED    = 2; /* The activity has finished its creation. */
var STOPPED             = 3; /* Fully created, not started. */
var STARTED             = 4; /* Created and started, not resumed. */
var RESUMED             = 5; /* Created started and resumed. */

var state               = INITIALIZING;

function _invokeHandler(fragment, fn) {
    var handler  = METHOD_HANDLERS_MAPPING[ fn/*fn.name*/ ],
        handlers = _getHandlers( fragment );

    handlers
    && handler in handlers
    && handlers[ handler ]
        .apply( fragment, 3 in arguments ? arguments.slice( 2 ) : [] )
}

function _invokeHandlerWithShareMode(fragment, handler) {
    var handlers = _getHandlers( fragment );

    handlers
    && handler in handlers
    && handlers[ handler ]
        .apply( fragment, 3 in arguments ? arguments.slice( 2 ) : [] )
}

/**
 * 获取指定 fragment 的 callback(s).
 *
 * @param fragment
 * @returns {map}
 * @private
 */
function _getHandlers(fragment) {
    return _handlers[ _getIdForHandlers( fragment ) ]
}

/* --------------------------------------------------------------------- */

/**
 * 是否强制 Render 哪怕 View 不可见.
 *
 * @type {boolean}
 * @private
 */
var _force_render = !! 0;

function _invokeRender(fragment, data) {
    render.call( fragment, data )
}

/**
 * 填充内容, 可以传入 HTML 片段或 URL.
 *
 * { html: html }
 * { url: url, param: params }
 */
function render(data) {
    /* TODO: URL 支持参数 */
    if ( _force_render && ! getContainer.call( this ).parentNode )
        throw new Error( "You haven't call the show method with this fragment!" );

    /* 是否能够立刻请求进行 render 操作 */
    var immediate = data && _HTML in data;

    /* Before rendering */
    immediate && preRender.call( this, data );

    /* Rendering */
    immediate
        ? _renderWithHtml.call( this, data )
        : ( _URL in data && _renderWithUrl.call( this, data ) );

    /* After rendered */
    immediate && rendered.call( this, data );
}

/**
 * 开始 render.
 */
function preRender() {
    _invokeRenderHandler( this, _PRE_RENDER_HANDLER );
}

/**
 * Render 操作已交付至浏览器.
 */
function rendered() {
    _invokeRenderHandler( this, _RENDERED_HANDLER );
}

function _invokeRenderHandler(fragment, handler) {
    /* 目前针对多实例 fragment 我们采用的是 handler 共享机制 */
    var handlers = _getHandlers( fragment );

    handlers
    && handler in handlers
    && handlers[ handler ]
        .call( fragment, getLayout.call( fragment ) );
}

/**
 * 获取 fragment 的容器.
 *
 * @returns {DOM Element}
 */
function getContainer() {
    return getLayout.call( this )[ 0 ]
}

/**
 * 返回 fragment 容器, 这是一个 ZeptoCollection 类型的数据.
 *
 * @returns {ZeptoCollection}
 */
function getLayout() {
    return this[ _EL_ ][ _LAYOUT_ ]
}

/**
 * 返回一个标识, 标识是否没有内容被成功加载.
 *
 * @returns {boolean}
 */
function hasContentLoaded() {
    return this[ _FLAG_CONTENT_LOADED ]
}

/**
 * 销毁自身并返回上一级,如果当前 view 为根级, 则不会执行该操作并返回 false.
 *
 * @returns {boolean}
 */
function finish() {
    if ( ! canBack() )
        return ! 1;

    _scheduleDestroy( _current );

    back();

    return ! 0
}

function _finishAndGo(id, args) {
    if ( _hasFragmentTransInProcessing() ) return;

    /* TODO: current -> update hash direct */
    _exist( id )
    && (
        args && _overrideArgs( id, args ),
            _performFinishAndGo.call( getFragment( id ) )
    )
}

function _performFinishAndGo() {
    /* hide current */
    /* show next */

    /* destroy current */
    /* pop current */

    var current = _current,
        next    = this,

    /* 是否有默认 view(Stack-based) */
        first   = ! _hasFragment(),
    /* 要前往的 fragment */
        layout  = next[ _EL_ ][ _LAYOUT_ ];

    /* 是否在操作本身 */
    if ( first || current && next == current )
        $lr.throwNiyError();
    /* return; */

    _beginTrans();

    _casStackIfNecessary( current, next );

    /* 暂停当前 fragment */
    pause( current );
    /* 隐藏当前 fragment */
    _hide( current, _FROM_STACK_YES, /*firer*/1 );

    /* 如果为首次呈现则需要执行一系列的初始动作 */
    layout[ 0 ].parentNode
    || (
        attach      ( next ),
            create      ( next ),
            createView  ( next ),
            start       ( next )
    );

    /* FIXME(XCL): 不管是否被暂停这里绝对执行恢复操作 */
    resume( next );

    /* 呈现下一个 fragment */
    _show( next, /*_TRANSITION_SLIDE, */_FROM_STACK_NO );

    try {
        /* 销毁 current */
        current && _scheduleDestroy( current );
    } finally {
        _current = next;

        /* 更新至 location.hash */
        _applyHash( _current );

        ALWAYS_POST_COMMIT_ON_BACK || _endTrans();
    }
}

/**
 * 设置当前 title.
 * @param title
 */
function setTitle(title) {
    document.title = title
}

/**
 * 当前 fragment 是否可见.
 * @returns {*}
 */
function isVisible() {
    return this[ _EL_ ][ _LAYOUT_ ]
        && isShowing( this[ _EL_ ][ _LAYOUT_ ] )
}

function getArgs() {
    return this[ _ARGS ]
}

function _triggerUpdateTitle(title) {
    setTitle( title )
}

function _isInBackStack() {
}

function _hasFragmentTransInProcessing() {
    var ret = _in_transaction_;
    if ( ret ) {
        /*alert('transaction: ' + ret);*/
    }
    /*_dumpTrans('Lock');*/
    return ret;
}

/**
 * 是否可以进行后退操作.
 *
 * @returns {boolean}
 */
function canBack() {
    return ! _hasFragmentTransInProcessing() && _hasBackStackRecords()
}

/**
 * 是否 Back stack 中有记录.
 *
 * @returns {boolean}
 * @private
 */
function _hasBackStackRecords() {
    return 0 in _backStack
}

/* 标识操作从 URI 触发 */
var _OP_FROM_URI = 1;

/**
 * 请求进行后退操作, 如果 BackStack 有可用的记录.
 */
function back(fromUri) {
    /*if ( ! canBack() )*/
    if ( _hasFragmentTransInProcessing() )
        return;

    if ( fromUri && ! _hasBackStackRecords() ) {
        _navigateUpTo('home');
        return
    }

    /* 暂时用 History API */
    history.go( fromUri ? _MAGIC_BACK_FIRER : _STANDARD_BACK );

    /* _performBack() */
}

/**
 * 以 Backward 形式切到指定的 fragment.
 *
 * @param up 这个即指当前 fragment 定义的 parent, 如果没有指定则使用默认的 home
 * @private
 */
function _navigateUpTo(up) {

}

function _performNavigateUpTo() {

}

/* --------------------------------------------------------------------- */

/**
 * 使用 Inline DOM 结构填充 View.
 *
 * @param data
 * @private
 */
function _renderWithHtml(data) {
    /* To render using the html snippet */
    /*data && */this[ _EL_ ][ _LAYOUT_ ].html( data[ _HTML ] );

    /* 通知更新 Content loaded 标识 */
    _notifyContentWasLoaded( this );
}

/**
 * 试图从远程服务上获取 View 内容.
 *
 * @param data
 * @private
 */
function _renderWithUrl(data) {
    /* if ( ! data )
     return; */

    var target = this;

    $lr.get( data[ _URL ], function(response) {
        /* 填充 HTML 片段 */
        /*target.isVisible()
         && *//*target[ _EL_ ][ _LAYOUT_ ].html( response );*/
        var data = {};
        data[ _HTML ] = response;

        _invokeRender( target, data )
    } );
}

/* TODO: */
var _applyHash = _syncHashToBrowser/*function(fragment) {
 _syncHashToBrowser( fragment )
 }*/;

/**
 * 构建一个 hash 串用于更新至浏览器
 *
 * @param fragment
 * @returns {InnerHash}
 * @private
 */
function _buildInnerHashByFragment(fragment) {
    /*
     var x = [ _FRAGMENT_HASH_PREFIX, fragment[ _HASH ] ];

     fragment[ _ARGS ]
     && (
     x.push( _ARG_DELIMITER ),
     x.push( _argsUrlify( fragment[ _ARGS ] ) )
     );

     return x.join( '' )
     */

    var data = {};
    data[ _HASH ] = fragment[ _HASH ];
    data[ _ARGS ] = fragment[ _ARGS ];

    return _buildInnerHash( data )
}

function _buildInnerHash(data) {
    /* #!id:args */
    var x = [ _FRAGMENT_HASH_PREFIX, data[ _HASH ] ];

    data[ _ARGS ]
    && (
        x.push( _ARG_DELIMITER ),
            x.push( _argsUrlify( data[ _ARGS ] ) )
    );

    return x.join( '' )
}

function _syncHashToBrowser(fragment) {
    location.hash = _buildInnerHashByFragment(fragment)
}

/* TODO(XCL): Renaming the fn name to forward */
/**
 * 进行 fragment 切换操作.
 *
 * @param id {string} 指定 fragment 的 id
 * @param args {object} 参数(optional)
 * @param fromUri {boolean} 是否从 uri 触发(optional)
 * @param animation {string} 切换效果(optional)
 * @private
 */
function _requestGo/*_go*/(id, args, fromUri, /*fromUser,*/ animation) {
    if ( _hasFragmentTransInProcessing() )
        return;

    if ( ! _exist( id ) )
        return;

    /*
     console.log( "_requestGo: id, args, fromUri, animation" );
     console.log( "_requestGo: %s, %s, %s, %s", id, args, fromUri, animation );
     */

    /* id, args, ?, ? */
    if ( isPlainObject( args ) ) {
        _overrideArgs(id, args);
    }
    /* id, animation */
    else if ( isString( args ) ) {
        animation = fromUri;
        /* fromUri = args = undefined; */
    }
    /* id, fromUri, ? */
    else if ( $lr.isUndefined(args) ) {
        animation   = fromUri;
        fromUri     = args;
        args        = undefined;
    }

    /* id, args, animation */
    if ( isString( fromUri ) ) {
        animation = fromUri;
        fromUri = undefined;
    }

    /*console.log( "_requestGo: %s, %s, %s, %s, multitask: %s", id, args, fromUri, animation, _isSupportMultiInstance( id ) );*/

    if ( _isSupportMultiInstance( id ) )
        _goNextWithMultiMode( id, args, /*fromUser*/0, fromUri, animation );
    else
        _goNext( id, args, /*fromUser*/0, fromUri, animation );

    /*_performGo.call( getFragment( id ), fromUri, animation )*/
}

/**
 * TODO(XCL): 暂时未实现多实例 reload.
 * @param id
 * @private
 */
function _reload(id) {
    _exist( id ) && _triggerReload( getFragment( id ) )
}

/* --------------------------------------------------------------------- */

/* TODO(XCL): */
function checkRuntime() {
    /* Object.keys && onhashchange && onpopstate && JSON && more... */
}

function sort(args) {
    var ordered = undefined;
    var keys    = Object.keys( args );

    if ( ! (0 in keys) ) {
        throw new Error( "Args can't be null#" + args );
    }

    ordered = {};

    keys.sort().forEach( function(key) {
        ordered[ key ] = args[ key ];
    } );

    return ordered
}

/* 参考: http://web.archive.org/web/20130703081745/http://www.cogs.susx.ac.uk/courses/dats/notes/html/node114.html */
function hashCode(str) {
    var hash = 0;

    if ( ! (0 ^ str.length) )
        return hash;

    var idx;

    for ( idx = 0; idx < str.length; idx++ ) {
        hash = 31 * hash + str.charCodeAt( idx );

        /* Convert to 32bit integer */
        hash |= 0;
    }

    return hash
}

/**
 * 判断指定 fragment 是否支持多实例.
 *
 * @param id
 * @returns {boolean}
 * @private
 */
function _isSupportMultiInstance(id) {
    /* derive */
    return _exist( id )
        && !! getFragment( id )[ _MULTIPLE_INSTANCES ]
}

/**
 * 是否为派生的 fragment.
 *
 * @param fragment
 * @returns {boolean}
 * @private
 */
function _isDerive(fragment) {
    return fragment
        && _DERIVE_ID_ in fragment
        && fragment[ _DERIVE_ID_ ]
}

function _flattenArgs(args) {
    try {
        return /*JSON.stringify*/$lr.stringify( sort( args ) )
    } catch (ignored) {
        return null
    }
}

function _calculateDeriveKey(id, args) {
    var flattenedArgs = _flattenArgs( args );

    if ( null == flattenedArgs )
        return id;

    return [ id, _DERIVE_DELIMITER, hashCode( flattenedArgs ) ].join( '' )
}

/**
 * 用于间隔实例 hash.
 *
 * @type {string}
 * @private
 */
var _DERIVE_DELIMITER = "#";

/* --------------------------------------------------------------------- */

/* 标识是否正在进行界面切换 */
var _in_transaction_ = ! 1,

/* 记录开始切换界面的时间 */
    _trans_tag_stamp;

/* 标识永远后置提交事务 */
var ALWAYS_POST_COMMIT_ON_BACK = ! 0;

function _beginTrans() {
    /*_dumpTrans( 'Begin' );*/
    _in_transaction_ || (_in_transaction_ = ! 0);
    /*console.log("beginTrans: %s", _in_transaction_);*/
}

function _endTrans() {
    /*_dumpTrans( 'End' );*/
    /* FIXME(XCL): 这里绝对解释无论是否已处于锁态 */
    _in_transaction_ = ! 1;

    /*_in_transaction_ && (_in_transaction_ = ! 1);*/

    _onTransEnded();

    /*$lr.dev && console.timeEnd('Trans');
     console.log("endTrans: %s", _in_transaction_);*/
}

function _dumpTrans(tag) {
    if ( 'Begin' == tag ) {
        _trans_tag_stamp = 'trans-' + ( new Date() ).getTime();
        console.time( _trans_tag_stamp );
        console.log("Dump-Trans: %s %s at ", tag, _in_transaction_, _trans_tag_stamp);
    } else if ( 'End' == tag ) {
        console.log("Dump-Trans: %s %s", tag, _in_transaction_);
        console.timeEnd(_trans_tag_stamp)
    } else {
        console.log("Dump-Trans: %s %s", tag, _in_transaction_);
    }
}

/**
 * 构建一个 animation-name 用于效果呈现, 如 fragment-slide-enter.
 *
 * @param {string} fx
 * @param {boolean} forward
 * @param {boolean} rear
 * @returns {string}
 * @private
 */
function _buildAnimationName(fx, forward, rear) {
    var key = [ 'fragment-', fx, '-' ];

    /* 是否应用于 back stack */
    if ( forward ) {
        key.push( rear ? 'pop-exit' : 'enter'       );
    } else {
        key.push( rear ? 'exit'     : 'pop-enter'   );
    }

    return key.join( '' )
}

function _resolveFx(fx) {
    return fx && fx in win.fx ? fx : win.fx.slide
}

/**
 * 是否没有切换效果?
 *
 * @param transition
 * @returns {boolean}
 * @private
 */
function _isTransitionNone(transition) {
    return _TRANSITION_UNSET === transition;
}

function _buildTransition(fx, forward) {
    /* enter, popExit, popEnter, exit */
    if ( ! $lr.isString( fx ) )
        return _TRANSITION_NONE;

    var scheme = _transits[ _resolveFx( fx ) ];

    /**
     *              front        rear
     * ---------------------------------
     * forward:     enter    <-> popExit
     * backward:    popEnter <-> exit
     */
    var checkRear  = forward ? 'popExit' : 'exit',
        checkFront = forward ? 'enter'   : 'popEnter';

    var rear  = scheme[checkRear ] && _buildAnimationName( fx, forward, 1 );
    var front = scheme[checkFront] && _buildAnimationName( fx, forward, 0 );

    /*var ret = { rear: rear, front: front };
     console.log(JSON.stringify( ret ));*/

    return {
        rear: rear,
        front: front ,
        ease: scheme['ease'] || $lr.cubic_bezier };/*ret*/
}

function _check() {

}

/*
 notifyContentWasLoaded
 did content loaded
 onAnimationEnd
 onFragmentChangeBefore
 onFragmentChangeAfter
 hasContentLoaded
 */

/**
 * 配置 fragment 全局事件 listener.
 *
 * @type {{onFragmentChangeBefore: null, onFragmentChangeAfter: null, onCurrentlyFragmentContentLoaded: null}}
 * @private
 */
var _config = {
    onFragmentChangeBefore:             null,
    onFragmentChangeAfter:              null,
    onCurrentlyFragmentContentLoaded:   null
};

/**
 * 为 $Fragment 配置全局的 listener 及属性.
 *
 * @param newly
 */
function config(newly) {
    if ( ! newly )
        return;

    'onFragmentChangeBefore' in newly
    && (_config.onFragmentChangeBefore = newly.onFragmentChangeBefore);
    'onFragmentChangeAfter' in newly
    && (_config.onFragmentChangeAfter = newly.onFragmentChangeAfter);
    'onCurrentlyFragmentContentLoaded' in newly
    && (_config.onCurrentlyFragmentContentLoaded = newly.onCurrentlyFragmentContentLoaded);
}

/* 用于填补什么都不做的 callback/fn */
var noop = $lr.emptyFn;

/**
 * fragment 切换之前.
 *
 * @param currently
 * @param upcoming
 * @private
 */
function _onFragmentChangeBefore(currently, upcoming) {
    (_config.onFragmentChangeBefore || noop)(currently, upcoming);
}

/**
 * fragment 切换之后.
 *
 * @param older
 * @param currently
 * @private
 */
function _onFragmentChangeAfter(older, currently) {
    (_config.onFragmentChangeAfter || noop)(older, currently);
}

/**
 * 当前 fragment 加载完成后调用.
 *
 * @private
 */
function _onCurrentlyFragmentContentLoaded() {
    (_config.onCurrentlyFragmentContentLoaded || noop)();
}

function _dispatchEvent(event) {

}

function _buildEvent() {

}
