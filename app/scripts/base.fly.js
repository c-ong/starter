/**
 * Created by xong on 10/29/15.
 *
 * @dependents Zepto
 */
;!function() {
    "use strict";

    /* FIXME(XCL): 考虑 App 注入场景 */
    if ( window[ 'lairen' ] )
        return;

    /* 版本号 */
    var VERSION = '0.0.19';

    var $lr;

    var undefined;
    var win     = window;

    var emptyFn = function() {};

    var ua      = navigator.userAgent.toLowerCase(),
        os      = {},
        browser = {},

        /* 这取自于 zepto 以后可能完全使用 zepto.detect */
        android = ua.match(/(Android);?[\s\/]+([\d.]+)?/),
        ipad    = ua.match(/(iPad).*OS\s([\d_]+)/),
        ipod    = ua.match(/(iPod)(.*OS\s([\d_]+))?/),
        iphone  = ! ipad && ua.match(/(iPhone\sOS)\s([\d_]+)/),

        /* 是否为微信环境 */
        wechat  = ua.match( /MicroMessenger\/([\d.]+)/ig ),
        /* 是否为 Tencent X 系统浏览器(目前为 X5) */
        qqx5    = ua.match( /MQQBrowser\/([\d.]+)/ig );

    if ( android ) {
        os.android = ! 0;
        os.version = android[2];
    } else {
        os.android = ! 1;
    }

    if ( iphone && ! ipod ) {
        os.ios = os.iphone = ! 0;
        os.version = iphone[2].replace(/_/g, '.');
    }
    if ( ipad ) {
        os.ios = os.ipad = ! 0;
        os.version = ipad[2].replace(/_/g, '.');
    }
    if ( ipod ) {
        os.ios = os.ipod = ! 0;
        os.version = ipod[3] ? ipod[3].replace(/_/g, '.') : null;
    }
    'ios' in os ? null : (os.ios = ! 1);

    /* 是否运行于微信 WebView 环境 */
    browser.wechat  = !! wechat;
    /* QQ X5 浏览器 */
    browser.qqx5    = !! qqx5;

    /* 一些判断类型的函数 */
    var isUndefined = function(who) { return undefined === who },
        isString    = function(who) { return 'string' == typeof who },
        isArray     = $.isArray,
        isFunction  = $.isFunction,

        /* 抛出未实现异常, 仅用于开发期间防止无效的调用 */
        throwNiyError = function() { throw new Error( 'Not implement yet!' ); };

    function _parseArgs(url, data, success, error, dataType) {
        if ( isFunction( data ) ) {
            dataType    = error;
            error       = success;
            success     = data;
            data        = undefined;
        }
        if ( ! isFunction( success ) ) {
            dataType    = error;
            error       = dataType;
            success     = undefined;
        }
        if ( ! isFunction( error ) ) {
            dataType    = error;
            error       = undefined;
        }

        return {
            url:        url,
            data:       data,
            success:    success,
            error:      error,
            dataType:   dataType
        }
    }

    /**
     * 执行一个 GET 请求.
     */
    function get(/* url, data, success, error, dataType */) {
        return $.ajax( _parseArgs.apply( null, arguments ) )
    }

    /**
     * 执行一个 POST 请求.
     */
    function post(/* url, data, success, error, dataType */) {
        var options = _parseArgs.apply( null, arguments );
        options.dataType = 'POST';

        $.ajax( options );
    }

    $lr = {
        undefined:      undefined,
        win:            win,

        /* 是否为开发模式 */
        dev:            0,

        /* 用于判断类型的函数 */
        isUndefined:    isUndefined,
        isString:       isString,
        isArray:        isArray,
        isFunction:     isFunction,

        throwNiyError:  throwNiyError,

        /* HTTP 请求 */
        get:            get,
        post:           post,

        /* Runtime Env */
        os:             os,
        browser:        browser,

        /* 提供了短名方法,用于访问 console 方法 */
        /*
        log: console ? function(msg) {
            lairen.dev && console.log( msg )
        } : emptyFn,
        dir: console ? function(obj) {
            lairen.dev && console.dir( obj )
        } : emptyFn,
        error: console ? function(msg) {
            lairen.dev && console.error( msg )
        } : emptyFn */
    };

    /**
     * The root of UIs
     * @type {undefined}
     * @private
     */
    $lr._viewport       = undefined;

    /* --------------------------------------------------------------------- */

    /* Extend */
    /* 可见 DOM 的根节点 */
    $lr.ID_VIEWPORT      = 'lairen_viewport';
    /* Dialog 元素 */
    $lr.ID_DIALOG        = 'lairen_dialog';
    $lr.ID_DIALOG_MASK   = 'dialog_mask';
    /* FIXME(XCL): 由于布局未知原因导致动画不理想, 这里暂时不在嵌套 DOM */
    $lr.ID_FRAGMENT_ROOT = 'lairen_fragments';

    /* Layer manager */
    /* hasTopLayer */

    $lr.DIALOG_WRAPPER  = 'dialog_wrapper';
    /* DIALOG_STACK  = 'dialog_stack', */
    $lr.DIALOG_MASK     = 'dialog_mask';
    $lr.DIALOG          = 'dialog';
    $lr.FRAGMENT        = 'fragment';
    $lr.FRAGMENTS       = 'fragment_root';

    /* --------------------------------------------------------------------- */

    var Z_IDX_FIXED     = 0,
        Z_IDX_MIN       = 1,
        Z_IDX_MAX       = 2,
        Z_IDX_CURRENT   = 3;

    /**
     * 这里定义着所有 UI 的叠放次序.
     * @type {{dialog: number[], dialog_mask: number[], dialog_wrapper: number[]}}
     */
    var zIndexes = {
        /* fixed, min, max, current */

        dialog_wrapper  : [ 0, 1002, 2000, 1002 ],
        /* dialog_stack    : [ 1, 1001, 1001, 1001 ], */
        dialog_mask     : [ 1, 1000, 1000, 1000 ],
        /* container */
        dialog          : [ 1, 999,  999,  999  ],

        fragment        : [ 0, 1,    200,  1    ],
        /* container */
        fragment_root   : [ 1, 0,    0,    0    ]
    };

    /* --------------------------------------------------------------------- */

    /**
     * 分配一个 z-index 用于 UI 的呈现。
     *
     * @param component
     * @returns {*}
     * @private
     */
    $lr._alloZIndex = function(component) {
        if ( ! component || ! zIndexes[ component ] )
            throw new TypeError( "Invalid component" );

        var info = zIndexes[ component ];

        // 当前值
        var current = info[ Z_IDX_CURRENT ],
            next    = current;

        if ( info[ Z_IDX_FIXED ] )
            return next;

        if ( current >= info[ Z_IDX_MAX ] ) {
            next = current = info[ Z_IDX_CURRENT ] = info[ Z_IDX_MIN ];
        } else {
            next = info[ Z_IDX_CURRENT ] = current + 1;
        }

        return next
    };

    /**
     * 合成一个用于 Zepto 的 ID Selector。
     * @param id
     * @returns {string}
     * @private
     */
    $lr._idSelector = function(id) {
        return '#' + id
    };

    $lr._isShowing = function(z_obj/*Zepto*/) {
        return z_obj && 'none' !== z_obj.css( 'display' )
    };

    /* --------------------------------------------------------------------- */

    win.lairen = $lr
}();

/**
 * ----------------------------------------------------------------------------
 *                              Dialog module
 * ----------------------------------------------------------------------------
 */
!function($lr) {
    "use strict";

    var undefined   = $lr.undefined,
        isArray     = $lr.isArray,
        isFunction  = $lr.isFunction,
        isUndefined = $lr.isUndefined,
        _idSelector = $lr._idSelector;

    /**
     * 全部 Dialog
     * @type {Array}
     * @private
     */
    var _dialogs    = {};

    /**
     * The root of dialog element
     * @type {undefined}
     * @private
     */
    var _dialog_root = undefined;

    /**
     * The mask of dialog
     * @type {undefined}
     * @private
     */
    var _dialog_mask = undefined;

    /**
     * 当前 Dialog
     * @type {undefined}
     * @private
     */
    var _dialog_current = undefined;

    /**
     * The wrapper of Dialog.
     * @type {*|jQuery|HTMLElement}
     * @private
     */
    var _DIALOG_WRAPPER_TEMPLATE = undefined;

    function _dialogIdx(stackId) {
        return 'lairen-layout--dialog_' + stackId
    }

    function _ensureDialogBase() {
        _dialog_root || /*$( _idSelector( ID_DIALOG ) ).length || */_prepareDialog()
    }

    function _prepareDialog() {
        var html = [];

        html.push( '<div class="dialog-wrapper" id="dialog_wrapper"><div id="dialog_body"></div></div>' );

        _DIALOG_WRAPPER_TEMPLATE = $( html.join( '' ) );

        _dialog_root = $( _idSelector( $lr.ID_DIALOG ) );
        _dialog_mask = $( _idSelector( $lr.ID_DIALOG_MASK ) );

        _dialog_mask.on( 'click', _handleMaskTap );

        _dialog_root.css( 'z-index', $lr._alloZIndex( $lr.DIALOG ) );
        _dialog_mask.css( 'z-index', $lr._alloZIndex( $lr.DIALOG_MASK ) );
    }

    /**
     * 处理 Mask Touch 事件。
     * @private
     */
    function _handleMaskTap() {
        // 点击 mask 时取消 dialog
        _dialog_current
        && _dialog_current.cancelable
        && void _dialog_current.cancel();
    }

    /**
     * 创建一个 Dialog
     *
     * @returns { {id,
     *          show: Function,
     *          cancel: Function,
     *          dismiss: Function,
     *          _el_: {dialog: (*|jQuery|HTMLElement),
     *          mask: (*|jQuery|HTMLElement),
     *          wrapper: (*|jQuery|HTMLElement)}}|*}
     * @private
     */
    function _build(html, cancelable, actions) {
        _ensureDialogBase();

        isArray( cancelable ) && (actions = cancelable, cancelable = undefined);

        var model;

        /* 分配一个 id 实际上就是 z-index */
        var stackId = $lr._alloZIndex( $lr.DIALOG_WRAPPER );

        /* 通过 clone 来快速获得 DOM 元素 */
        var wrapper = _DIALOG_WRAPPER_TEMPLATE.clone();

        wrapper.css( 'z-index', stackId );

        model = {
            id: stackId,

            /* 是否可取消 */
            cancelable: !!cancelable || 1,

            /* 是否已被 dismiss */
            dismissed: 0,

            _el_: {
                wrapper: wrapper
            }
        };

        /* 对 Dialog 开放的方法 */
        var methods = [
            [ 'show',       show    ],
            [ 'cancel',     cancel  ],
            [ 'dismiss',    dismiss ]
        ];
        methods.forEach( function(fn) {
            model[ fn[ 0 ] ] = fn[ 1 ]
        } );

        _dialogs[ _dialogIdx( stackId ) ] = model;

        /* 填充 Dialog 内容 */
        html && void wrapper.find( '#dialog_body').html( html );

        /* 添加到 Dialog 根节点 */
        _dialog_root.append( wrapper );

        actions && _setUpActionsIfNecessary( model, actions );

        return model
    }

    function _setUpActionsIfNecessary(model, actions) {
        var ctx = model._el_.wrapper;
        var id, callback, target;

        actions.forEach( function(action) {
            id          = action[ 'id' ];
            callback    = action[ 'callback' ];

            id
            && callback
            && (
                target = $( '#' + id, ctx ),
                    target.on( 'click', function() {
                        callback.call( model );
                    } )
            );
        });
    }

    /**
     * 取消 Dialog。
     *
     * @returns {dialog}
     */
    function cancel() {
        var el = this._el_;

        if ( ! $lr._isShowing( el.wrapper ) )
            return;

        ! el.dismissed
        && _hideWrapperOnly.call( this );

        _dialog_mask.animate(
            'dialog-mask-out',
            $.fx.speeds.fast,
            'linear',
            function() {
                _dialog_mask.hide();
                _dialog_root.hide();

                /* Reset the opacity prop */
                /* el.wrapper.css( { opacity: 1 } );
                el.wrapper.hide() */
            } );
        try {
            return this
        } finally {
            _dialog_current = undefined;
        }
    }

    function _hideMask() {

    }

    function _hideWrapperOnly() {
        var el = this._el_;

        /* properties, duration, ease, callback, delay */
        el.wrapper.animate(
            { opacity: .1 },
            $.fx.speeds.fast,
            /*'cubic-bezier(0.4, 0, 0.2, 1)'*/'ease-out',
            function() {
                /* Reset the opacity prop */
                el.wrapper.hide();
                el.wrapper.css( { opacity: 1 } );
            } );

        return this
    }


    /**
     * 呈现 Dialog。
     *
     * @returns {dialog}
     */
    function show() {
        var current = _dialog_current;

        /* 清当前 dialog */
        (current && this != current)
        && void _hideWrapperOnly.call( current );

        var el = this._el_;

        if ( el.dismissed )
            return;

        current
        || (
            _dialog_mask.show(),
                _dialog_root.show(),

                /* properties, duration, ease, callback, delay */
                _dialog_mask.animate(
                    'dialog-mask-in',
                    $.fx.speeds.slow,
                    /*'cubic-bezier(0.4, 0, 0.2, 1)'*/'linear' )
        );

        el.wrapper.show();

        /* Vertical Center */
        var margin = (_dialog_root.height() / 2) - (el.wrapper.height() / 2);
        el.wrapper.css( 'margin-top', margin + "px" );

        try {
            return this
        } finally {
            _dialog_current = this;
        }
    }

    /**
     * 取消 Dialog 并移出对应的 DOM 元素
     */
    function dismiss() {
        var el = this._el_;

        /* 如果已经操作过 dismiss 则不在执行 */
        if ( el.dismissed )
            return;

        /* 设置 dismiss 标识 */
        el.dismissed = ! 0;

        /* 取消 */
        this.cancel();

        /* 移除 DOM */
        el.wrapper.remove();

        delete _dialogs[ _dialogIdx( this.id ) ];
    }

    /**
     * 初始化一个 Dialog 实例，你可以调用内建的方法来实现 show、cancel、dismiss 操作。
     *
     * @param html HTML 片段
     * @param cancelable 是否可以被取消当点击 Mask 时
     * @returns { {id,
     *            show: Function,
     *            cancel: Function,
     *            dismiss: Function,
     *            _el_: {dialog: (*|jQuery|HTMLElement),
     *            mask: (*|jQuery|HTMLElement),
     *            wrapper: (*|jQuery|HTMLElement)}}|* }
     */
    $lr.dialog = function(html, cancelable, actions) {
        return _build( html, cancelable, actions )
    };

    /* TODO: auto dismiss */
}(lairen);

/**
 * ----------------------------------------------------------------------------
 *                              Fragment module
 * ----------------------------------------------------------------------------
 */
!function($lr) {
    "use strict";

    var undefined       = $lr.undefined,

        win             = $lr.win,

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
    var _FRAGMENT_HASH_PREFIX = '#!';

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
     * @type {array}
     */
    var SUPPORTED_HANDLERS = [ "onAttach", "onCreate", "onCreateView", "onStart",
        "onResume", "onPause", "onStop", "onDestroyView", "onDestroy", "onDetach",
        _PRE_RENDER_HANDLER, _RENDERED_HANDLER,
        _ON_RELOAD ];

    /**
     * LIFECYCLE_METHODS 与 SUPPORTED_HANDLERS 映射关系.
     * @type {{map}}
     */
    var METHOD_HANDLERS_MAPPING = {};
    LIFECYCLE_METHODS.forEach( function(lifecycle, idx) {
        METHOD_HANDLERS_MAPPING[ lifecycle ] = SUPPORTED_HANDLERS[ idx ]
    } );

    var _METHODS = [
        /* 设置 title, 注意不是所有的场景都支持,如: 微信 */
        [ 'setTitle',   setTitle    ],

        /* 判别是否可见 */
        [ 'isVisible',  isVisible   ],

        /* 获取参数对儿 */
        [ 'getArgs',    getArgs     ],

        /* 填充内空 */
        [ 'render',     render      ],

        /* 获取该 Fragment 的容器 */
        [ 'getContainer', getContainer ],

        /* Storage */
        [ 'put', $lr.throwNiyError ],
        [ 'get', $lr.throwNiyError ],
        [ 'has', $lr.throwNiyError ],
        [ 'remove', $lr.throwNiyError ],
        [ 'clear', $lr.throwNiyError ]
    ];

    /**
     * fragments 的根节点.
     * @type {undefined}
     * @private
     */
    var _fragment_root = undefined;

    /**
     * fragment DOM 节点模板.
     * @type {DOM}
     * @private
     */
    var _FRAGMENT_TEMPLATE = undefined;

    /**
     * fragment 容器.
     * @type {Map}
     * @private
     */
    var _fragments  = {},
        _handlers   = {};

    /**
     * 当前 fragment。
     * @type {undefined}
     * @private
     */
    var _current    = undefined;

    function _fragmentSequenceId(stackId) {
        return 'lairen-layout--fragment_' + stackId
    }

    /**
     * 是否有默认 Fragment.
     * @private
     */
    function _hasTop() {
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
        var html = [];

        /* Fragment 的容器 */
        /* TODO: Progress status */
        html.push( '<div class="lairen-layout--fragment"></div>' );

        _FRAGMENT_TEMPLATE = $( html.join( '' ) );

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
        // 更新 title
        _triggerUpdateTitle( fragment[ _TITLE ] || $fragment.title );

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
     * @type {boolean}
     * @private
     */
    var _force_render = !! 0;

    function _invokeRender(fragment, data) {
        render.call( fragment, data )
    }

    /**
     * 填充内容, 可以传入 HTML 片段或 URL.
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
     * @returns {DOM Element}
     */
    function getContainer() {
        return getLayout.call( this )[ 0 ]
    }

    function getLayout() {
        return this[ _EL_ ][ _LAYOUT_ ]
    }

    /**
     * 销毁自身并返回上一级,如果当前 view 为根级, 则不会执行该操作并返回 false.
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
            isTop   = ! _hasTop(),
            /* 要前往的 fragment */
            layout  = next[ _EL_ ][ _LAYOUT_ ];

        /* 是否在操作本身 */
        if ( isTop || current && next == current )
            $lr.throwNiyError();
        /* return; */

        _casStackIfNecessary( current, next );

        /* 暂停当前 fragment */
        pause( current );
        /* 隐藏当前 fragment */
        _hide( current, _FROM_STACK_YES );

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
        _show( next, _TRANSITION_YES, _FROM_STACK_NO );

        try {
            /* 销毁 current */
            current && _scheduleDestroy( current );
        } finally {
            _current = next;

            /* 更新至 location.hash */
            _applyHash( _current )
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

    /**
     * 是否可以进行后退操作.
     * @returns {boolean}
     */
    function canBack() {
        return 0 in _backStack
    }

    /**
     * 请求进行后退操作, 如果 BackStack 有可用的记录.
     */
    function back() {
        /* 暂时作用 History API */
        history.back();
        /*_performBack()*/
    }

    /* --------------------------------------------------------------------- */

    function _renderWithHtml(data) {
        /* To render using the html snippet */
        /*data && */this[ _EL_ ][ _LAYOUT_ ].html( data[ _HTML ] )
    }

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

    var _applyHash = function(fragment) {
        /* TODO */
        _syncHashToBrowser( fragment )
    };

    /* 构建一个 hash 串用于更新至浏览器 */
    function _buildHashWithBrowser(fragment) {
        /* #!id:args */
        var x = [ _FRAGMENT_HASH_PREFIX, fragment[ _HASH ] ];

        fragment[ _ARGS ]
            && (
                x.push( _ARG_DELIMITER ),
                x.push( _argsUrlify( fragment[ _ARGS ] ) )
            );

        return x.join( '' )
    }

    function _syncHashToBrowser(fragment) {
        location.hash = _buildHashWithBrowser(fragment)
    }

    function _go(id, args, from_uri) {
        _exist( id )
        && (
            isPlainObject( args )
                ? _overrideArgs( id, args )
                : from_uri = args,

            _performGo.call( getFragment( id ), from_uri )
        )
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

    function checkRuntime() {
        /* Object.keys && onhashchange && onpopstate && more... */
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
    function hash(str) {
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

    function isSupportMultiInstance(id) {
        /* derive */
        return _exist( id )
            && !! getFragment( id )[ _MULTIPLE_INSTANCES ]
    }

    /**
     * 是否为派生的 fragment.
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
            return JSON.stringify( sort( args ) )
        } catch (ignored) {
            return null
        }
    }

    function _calculateDeriveKey(id, args) {
        var flattenedArgs = _flattenArgs( args );

        if ( null == flattenedArgs )
            return id;

        return [ id, _DERIVE_DELIMITER, hash( flattenedArgs ) ].join( '' )
    }

    /**
     * 用于间隔实例 hashcode.
     * @type {string}
     * @private
     */
    var _DERIVE_DELIMITER = "#";

    /* --------------------------------------------------------------------- */

    /**
     * 执行 Go 操作.
     *
     * @param from_uri 默认是通过 $fragment.go 来调用.
     * @private
     */
    function _performGo(from_uri) {
        var current = _current,

            /* 是否有默认 view(Stack-based) */
            isTop   = ! _hasTop(),

            /* 要前往的 fragment */
            next    = this,

            /* DOM */
            layout  = getLayout.call( next );

        /* 是否在操作本身 */
        if ( current && next == current )
            return;

        _casStackIfNecessary( current, next );

        ( layout[ 0 ].parentNode && '' != layout.html() )
            || (
                attach      ( next ),
                create      ( next ),
                createView  ( next ),
                start       ( next )
            );

        /* onVisibilityChanged */

        /* _casStackIfNecessary( current, next ); */

        /* 隐藏当前 fragment */
        current && ( pause( current), _hide( current, _FROM_STACK_YES ) );

        /* FIXME(XCL): 不管是否被暂停这里绝对执行恢复操作 */
        resume( next );

        /* 呈现下一个 fragment */
        try {
            _show( next, isTop, _FROM_STACK_NO )
        } finally {
            /* 加入 BackStack */
            if ( current && ! isTop ) {
                _addToBackStack( current );

                historyApiSupported && _setupCurrentState( next, from_uri )
            } else {
                historyApiSupported && _setupInitialState( next, from_uri )
            }

            _current = next;

            if ( historyApiSupported ) {

            } else {
                /* 更新至 location.hash */
                _applyHash( _current )
            }
        }
    }

    function _setupCurrentState(target, from_uri) {
        var state = _newState(),
            title = target[ _TITLE ],
            hash = _buildHashWithBrowser( target );

        /* console.log( '## setupCurrentState ' + !! from_uri ); */

        if ( from_uri )
            history.replaceState(state, title, hash);
        else
            _pushState( state, title, hash );

         _currentState = history.state;
    }

    function _setupInitialState(/* fragment */initial, from_uri) {
        var state = {};
            state[_IDX] = _FIRST_STATE;

        history.replaceState(
            state,
            initial[ _TITLE ],
            _buildHashWithBrowser( initial ) );

        _currentState = history.state;
    }

    function _performBack() {
        if ( ! canBack() )
            return;

        var current = _current;
        var next    = _popBackStack();

        /* FIXME: */
        /* _casStackIfNecessary( current, next ); */

        pause( current );
        /* 隐藏当前 fragment */
        _hide( current, _FROM_STACK_NO );

        try {
            /* 恢复 */
            resume( next );

            /* 呈现下一个 fragment */
            _show( next, _TRANSITION_YES, _FROM_STACK_YES );
        } finally {
            _current = next;

            /* 支持 history 则不需要手动更新 hash */
            if ( historyApiSupported ) {

            } else {
                _applyHash( _current )
            }
        }
    }

    /* TODO: */
    /* finish -> back && destroy */
    function _destroy(id) {
        var current = _current;
        var target  = getFragment( id );

        /* TODO: 不允许移除顶级 fragment */
        if ( current === target ) {

        }

        _invokeHandler( target, _STOP/*stop*/ );
        _invokeHandler( target, _DESTROY_VIEW/*destroyView*/ );
        _invokeHandler( target, _DESTROY/*destroy*/ );
        _invokeHandler( target, _DETACH/*detach*/ );

        /* DOM 移除 */
        target[ _EL_ ][ _LAYOUT_ ].remove();

        /*delete _fragments[ id ]*/
    }

    function _performDestroy(id) {
        _exist( id ) && _destroy( id )
    }

    function _scheduleDestroy(who) {
        var id = who[ _ID ];

        var trigger = $.fx.speeds.slow * 10 + 25;

        setTimeout( function() {
            _performDestroy( id );
        }, trigger )
    }

    function _requestDestroy(id) {

    }

    /* --------------------------------------------------------------------- */

    var _TRANSITION_YES = 0,
        _TRANSITION_NO  = 1,

        _FROM_STACK_YES = 1,
        _FROM_STACK_NO  = 0;

    function _show(target, noTransition, fromStack) {
        var layout = target[ _EL_ ][ _LAYOUT_ ];

        $lr.dev && console.log( '<< show # ' + target[ _ID ] + ', ' + (noTransition
                ? ''
                : (fromStack ? 'fragment-pop-enter':'fragment-enter') ) );

        /* Show the dom */
        layout.show();

        noTransition
        ||
        layout.animate(
            fromStack ? 'fragment-pop-enter' : 'fragment-enter',
            $.fx.speeds.slow,
            'cubic-bezier(0.4, 0, 0.2, 1)'/*'linear'*/ )
    }

    function _hide(target, fromStack) {
        var layout = target[ _EL_ ][ _LAYOUT_ ];

        $lr.dev && console.log( '>> hide # ' + target[ _ID ] + ', ' + (fromStack
                ? 'fragment-pop-exit'
                : 'fragment-exit') );

        /* properties, duration, ease, callback, delay */
        layout.animate(
            fromStack ? 'fragment-pop-exit' : 'fragment-exit',
            $.fx.speeds.slow,
            'cubic-bezier(0.4, 0, 0.2, 1)'/*'linear'*/,
            function() {
                /* Reset the opacity prop */
                layout.hide();
                /* layout.css( { opacity: 1 } ); */
            } )
    }

    /* --------------------------------------------------------------------- */

    /* FIXME: 相同 hash 不同参数不列为一个新的 Back stack record. */
    var _backStack = [];

    /**
     * 将 fragment 添加至 BackStack, 并返回 stack 的数量.
     * @param fragment
     * @returns {*}
     * @private
     */
    function _addToBackStack(fragment) {
        return _push( fragment )
    }

    function _pushState(state, title, hash) {
        history.pushState( state, title, hash )
    }

    function _casStackIfNecessary(b, f) {
        if ( ! b )
            return;

        var back  = b[ _STACK_INDEX_ ],
            front = f[ _STACK_INDEX_ ];

        if ( front > back )
            return;

        front = front ^ back;
        back  = back ^ front;
        front = front ^ back;

        b[ _STACK_INDEX_ ] = back;
        f[ _STACK_INDEX_ ] = front;

        b[ _EL_ ][ _LAYOUT_ ].css( 'z-index', back );
        f[ _EL_ ][ _LAYOUT_ ].css( 'z-index', front );
    }

    /**
     *
     * @returns {*}
     * @private
     */
    function _popBackStack() {
        var id = _pop();
        return id ? getFragment( id ) : null
    }

    function _push(fragment) {
        return _backStack.push( fragment[ _ID ] )
    }

    function _pop() {
        return _backStack.pop()
    }

    /* --------------------------------------------------------------------- */

    function pause(fragment) {
        _invokeHandler( fragment, _PAUSE/*pause*/ )
    }

    function stop(fragment) {
        _invokeHandler( fragment, _STOP/*stop*/ )
    }

    function destroyView(fragment) {
        _invokeHandler( fragment, _DESTROY_VIEW/*destroyView*/ )
    }

    function destroy(fragment) {
        _invokeHandler( fragment, _DESTROY/*destroy*/ )
    }

    function detach(fragment) {
        _invokeHandler( fragment, _DETACH/*detach*/ )
    }

    /* --------------------------------------------------------------------- */

    function _resolveRequires(requires) {
        /* TODO: */
    }

    function _importRequiresIfNecessary(requires) {
        /* TODO: */
    }

    function _settleHandlers(id, handlers) {
        var map = _handlers[ id ] = {};

        isPlainObject( handlers )
        && SUPPORTED_HANDLERS.forEach( function(fn) {
            (fn in handlers) && (map[ fn ] = handlers[ fn ])
        } );
    }

    function _bindMethods(target) {
        _METHODS.forEach( function(fn) {
            target[ fn[ 0 ] ] = fn[ 1 ]
        } );
    }

    function _buildDerive(sourceId, deriveId, args) {
        var derive = _copyByClone( getFragment( sourceId ) );

        /* ----------------------------------------------------------------- */

        /* 对一个 fragment 开放的实例方法 */
        _bindMethods( derive );

        /* 派生的标识(用到标识唯一) */
        Object.defineProperty(
            derive,
            _DERIVE_ID_,
            { value: deriveId, writable: 0 }
        );

        /* 赋于新的 stack index, 实际上就是 z-index */
        derive[ _STACK_INDEX_ ] = _alloZIndex( $lr.FRAGMENT );
        /* XXX: DOM 节点, 如果为祖先级实例则该 DOM 只会被用于 clone */
        derive[ _EL_ ] = {};
        derive[ _EL_ ][ _LAYOUT_ ] = _FRAGMENT_TEMPLATE.clone();

        /* derive[ _EL_ ][ _LAYOUT_ ][ 0 ][ 'id' ] = _fragmentSequenceId(
            derive[ _STACK_INDEX_ ] ); */

        /* To retain the arguments if present. */
        derive[ _ARGS ] = args;

        /* 填充 HTML 片段，如果已指定该字段 */
        if ( _HTML in derive ) {
            /* _invokeRender( derive ); */
            /* _renderWithHtml.call( derive, { html: derive[ _HTML ] } ); */
        } else if ( _URL in derive ) {
            /* _invokeRender( derive ); */
            /* _renderWithUrl.call( derive, { url: derive[ _URL ] } ); */
        }

        try {
            return derive
        } finally {
            /* 将 clone 的 fragment 放入容器 */
            _add( derive );
        }
    }

    function _copyByClone(source) {
        var clone = {};

        /* Inherit: 处理依赖项 */

        /* Inherit: 处置 Handlers */

        /* Id 也复制但不使用 */
        _copyIfExist( source, clone, _ID );

        /* 标题 */
        _copyIfExist( source, clone, _TITLE );

        /* 解析后的 hash, lairen.ui.home -> lairen/ui/home */
        _copyIfExist( source, clone, _HASH );

        /* 是否支持多实例, 如支持多实例则祖先仅终不会被添加至 DOM 中 */
        _copyIfExist( source, clone, _MULTIPLE_INSTANCES );

        /* ----------------------------------------------------------------- */

        /* HTML 片段或 URL，如果已指定该字段 */
        if ( _HTML in source ) {
            clone[ _HTML ] = source[ _HTML ];
        } else if ( _URL in source ) {
            clone[ _URL ] = source[ _URL ];
        }

        return clone
    }

    function _copyIfExist(source, dest, key) {
        key in source && (dest[ key ] = source[ key ])
    }

    /**
     * 构建一个 fragment.
     * @param id 唯一的 fragment 标识,如: ui.about
     * @param config fragment 的配置数据
     * @returns fragment
     * @private
     */
    function _build(id, config) {
        /* TODO: validate the view id */
        if ( ! isString( id ) )
            throw Error( "Invalid id(" + id + ")" );

        if ( $lr.isUndefined( config ) )
            throw Error( "Must be specify the config for " + id )

        /* TODO: 延迟初始化 */
        _ensure();

        /* Fragment 如果已经定义过则无需再次定义 */
        var frag = _exist( id ) ? getFragment( id ) : {};

        /* 标识是否需要填充默认 fragment */
        var hasTop = _hasTop();

        /* TODO: 已经存在的是否允许更新 */
        if ( _ID in frag )
            return frag;

        /* TODO: 这样会造成祖级元素无法被合理使用 */
        /* 是否为祖先级实例 */
        var isAncestor = _MULTIPLE_INSTANCES in config
            && !! config[ _MULTIPLE_INSTANCES ];

        /* 分配一个 idx 实际上就是 z-index */
        var stackIdx = _alloZIndex( $lr.FRAGMENT ),
            requires = undefined;

        /* 用于容纳 fragment 内容 */
        var layout   = _FRAGMENT_TEMPLATE.clone();
        /* layout[ 0 ][ 'id' ] = _fragmentSequenceId( stackIdx ); */

        /* 处理依赖项 */
        isPlainObject( config )
        && _REQUIRES in config
        && ( requires = _resolveRequires( config.requires ) );

        /* ----------------------------------------------------------------- */

        /* 对一个 fragment 开放的实例方法 */
        _bindMethods( frag );

        /* 处置 Handlers */
        _settleHandlers( id, config );

        /* 初始化依赖项 */
        requires && _importRequiresIfNecessary( requires );

        /* ----------------------------------------------------------------- */

        /* Fragment 的 id */
        frag[ _ID ]             = id;
        /* 叠放次序 */
        frag[ _STACK_INDEX_ ]   = stackIdx;

        /* XXX: DOM 节点, 如果为祖先级实例则该 DOM 只会被用于 clone */
        frag[ _EL_ ]             = {};
        frag[ _EL_ ][ _LAYOUT_ ] = layout;

        /* 标题 */
        isString( config[ _TITLE ] )
        && (frag[ _TITLE ] = config[ _TITLE ]);

        /* 解析后的 hash, lairen.ui.home -> lairen/ui/home */
        frag[ _HASH ]       = _makeIdUrlify( id );

        /* To retain the arguments if present. */
        _ARGS in config
        && (frag[ _ARGS ] = config[ _ARGS ]);

        /* 是否支持多实例, 如支持多实例则祖先仅终不会被添加至 DOM 中 */
        isAncestor
        && Object.defineProperty(
            frag,
            _MULTIPLE_INSTANCES,
            { value: 1, writable: 0 }
        );

        /* ----------------------------------------------------------------- */

        /* 填充 HTML 片段，如果已指定该字段 */
        /* if ( ! isAncestor ) { */
        if ( _HTML in config ) {
            frag[ _HTML ] = config[ _HTML ];
            _invokeRender( frag, frag );
            /* _renderWithHtml.call( frag, config ); */
        } else if ( _URL in config ) {
            frag[ _URL ] = config[ _URL ];
            _invokeRender( frag, frag );
            /* _renderWithUrl.call( frag, config ); */
        }
        /* } */

        /* (config && _HTML in config)
              && isString( config[ _HTML ] )
                  && layout.html( config[ _HTML ] ); */

        /* ----------------------------------------------------------------- */

        try {
            return frag
        } finally {
            /* 将定义的 fragment 放入容器 */
            _add( frag );

            /* 呈现默认 View 如果没有有效的 view id 被指定 */
            ! hasTop && _setupTopIfMatch( frag )
        }
    }

    /**
     * 拼装一个 Router hash 值, 用于区分常规 hash 我们的 hash 则以 !# 开头.
     * @param id
     * @returns {string}
     * @private
     */
    function _convertIdToHash(id) {
        return _FRAGMENT_HASH_PREFIX + id
    }

    function _convertHashToId(hash) {
        return hash.substr( 2 )
    }

    /**
     * 判断是否为 View hash.
     * @param hash
     * @returns {*|boolean}
     * @private
     */
    function _isViewHash/*_isRouterHash*/(hash) {
        return hash && '!' === hash.charAt( 1 )
    }

    /**
     * This is just convert the id to Canonicalized forms.
     * e.g.: app.tour -> app/tour
     * @param id
     * @returns {string}
     * @private
     */
    function _makeIdUrlify(id) {
        return /\.+/g.test( id ) ? ( id.replace( /\./g, '/' ) ) : id
    }

    /**
     * 将 View hash 转化为'命名空间'形式的 id, 如: view/home -> view.home.
     * @param hash
     * @returns {XML|string|void}
     * @private
     */
    function _makeIdentify(hash) {
        return /\/+/g.test( hash ) ? ( hash.replace( /\//g, '.' ) ) : hash
    }

    function _overrideArgs(id, args) {
        // TODO:
        var x = getFragment( id );
        x && (x[ _ARGS ] = args)
    }

    /**
     * 分解 hash, 将从 URL 截取的 hash 片段分解为有效的 view id 及其参数.
     * @param rawHash
     * @returns {{hash: (Array.<T>|string|*|Blob|ArrayBuffer), args: *}}
     * @private
     */
    var _resolveHash = function(rawHash) {
        return {
            hash: _extractHash( rawHash ),
            args: _extractArgs( rawHash ) }
    };

    /**
     * 判断指定的 hash 是否包含参数.
     * @param rawHash
     * @returns {boolean}
     * @private
     */
    function _hasArgs(rawHash) {
        return -1 ^ rawHash.indexOf( _ARG_DELIMITER )
    }

    var _ARG_VALUE_EMPTY = '';

    /**
     * 从 hash 提取参数, 并以 key-value 形式返回.
     * @param rawHash
     * @returns {*}
     * @private
     */
    function _extractArgs(rawHash) {
        if ( ! _hasArgs( rawHash ) )
            return null;

        var result  = {},

            /* 统计条数 */
            counter = 0,

            array   = rawHash
                .substr( 1 + rawHash.indexOf( _ARG_DELIMITER ) )
                .split( '&' ),

            /* 索引, 参数对儿, 参数名, 参数, 数组 */
            idx, pair, key, value, set;

        for ( idx in array ) {
            pair    = array[ idx ].split( '=' );
            key     = pair[ 0 ];
            value   = pair[ 1 ];

            if ( ! key )
                continue;

            if ( key in result ) {
                set = $lr.isArray( value )
                    ? value
                    : [ key ];
                set.push( value );

                result[ key ] = set;
                counter++;
            } else {
                result[ key ] = value;
                counter++;
            }
        }

        return counter ? result : null
    }

    /**
     * 将 hash 参数 URL 化 { a: 'a', b: 'b'} -> a=a&b=b.
     * @param args
     * @returns {string}
     * @private
     */
    function _argsUrlify(args) {
        var result = [];

        /* 参数名, 值, 数组, 索引 */
        var key, value, set, idx;

        for ( key in args ) {
            value = args[ key ];

            if ( $lr.isArray( value ) ) {
                set = value;

                for ( idx in set )
                    result.push( key, '=', set[ idx ], '&' );
            } else {
                result.push( key, '=', value, '&' );
            }
        }

        result.pop();

        return result.join( '' )
    }

    /**
     * 分隔 hash 与其参数.
     * @type {string}
     * @private
     */
    var _ARG_DELIMITER = ':';

    /**
     * 提取 hash.
     * @param rawHash
     * @returns {Array.<T>|string|*|Blob|ArrayBuffer}
     * @private
     */
    function _extractHash(rawHash) {
        return _hasArgs( rawHash )
            ? rawHash.slice( 2, rawHash.indexOf( _ARG_DELIMITER ) )
            : rawHash.slice( 2 )
    }

    /**
     * 是否参数相同.
     * @param l
     * @param r
     * @returns {boolean}
     * @private
     */
    function _isSameArgs(l, r) {
        return JSON.stringify( l ) === JSON.stringify( r )
    }

    /**
     * 判断两个 hash 是否完全相同.
     * @param l
     * @param r
     * @returns {boolean}
     * @private
     */
    function _isSameHash(l, r) {
        return l[ _HASH ] === r[ _HASH ]
            && _isSameArgs( l[ _ARGS ], r[ _ARGS ] )
    }

    /**
     * Called only once.
     * @param fragment
     * @private
     */
    function _setupTopIfMatch(fragment) {
        if ( ! _ORIGIN_HASH )
            return;

        var originHash = _ORIGIN_HASH[ _HASH ],
            originArgs = _ORIGIN_HASH[ _ARGS ];

        originHash === fragment[ _HASH ]
        && (
            /* 更新 args */
            _overrideArgs( fragment[ _ID ], originArgs ),
                _go( fragment[ _ID ] )
        )
    }

    /* --------------------------------------------------------------------- */

    $lr.fragment = function(id, config) {
        /* TODO: alias, short */
        return _build( id, config )
    };

    win.$fragment = {

        /**
         * 默认 title(初始为 host 页面 title)
         */
        title:      document.title,

        /**
         * 初始化一个 Fragment 实例并以指定的 ID 来标识。
         *
         * <pre>
         * e.g:
         *
         * 定义一个 fragment:
         *
         * $fragment.define(
         *      'namespace.views.about',      // fragment 唯一标识，必选项
         *
         *      config {
         *           title:    'Untitled',    // 标题用于显示在支持的浏览器上
         *           multitask: 1,            // 标明该 fragment 是否支持多实例,
         *                                    // 既 Multiple Instances, 此项与
         *                                    // clearContentOnLeave 互斥
         *           args:     {key: 'value'} // 参数对儿
         *           backable: false,         // 是否可后退
         *           requires: {String/[]},   // 依赖项
         *           html/url: 'URL or HTML', // 完整 URL 或 HTML 片段
         *
         *           onAttach: function() {
         *              // fragment 容器被添加到 DOM 中后会调用
         *           },
         *
         *           onCreate: function() {
         *              // 当 fragment 被创建时调用该 callback
         *           },
         *
         *           onCreateView: function() {
         *           },
         *
         *           onStart: function() {
         *           },
         *
         *           onResume: function() {
         *              // fragment 被恢复, 也就是可见状态
         *           },
         *
         *           // -------------- 以下为对应的周期 callback -----------------
         *
         *           onPause: function() {
         *              // 当 fragment 不可见时会调用该 callback
         *           },
         *
         *           onStop: function() {
         *              // 如果要对一个 fragment 执行 destroy 操作会调用该 callback
         *           },
         *
         *           onDestroyView: function() {
         *           },
         *
         *           onDestroy: function() {
         *           },
         *
         *           onDetach: function() {
         *              // 这是 destroy 的最后一步环节, 将容器从 DOM 中移出
         *           },
         *
         *           // -------------- 以下为 reload 对应的 callback ------------
         *
         *           onReload: function() {
         *              // 你可以这里实现 reload 操作
         *           },
         *
         *           // -------------- 以下为 Render 对应的 callback ------------
         *
         *           onPreRender: function(container) {
         *              // 开始 Render 操作, 比如你可以在上里作一些 Reset 操作
         *           },
         *
         *           onRendered: function(container) {
         *              // Render 操作已交付至浏览器, 你可以在这里对你的 DOM 进行操作,
         *              // 如果你 DOM 的 id 不是唯一的那么请基于 container 进行查找,
         *              // 如若不是我们也建议您基于该 container 进行查找以便提升速度,
         *              // 另外我们也对 fragment 实例开放了 getContainer() 方法, 只
         *              // 是你需要注意调用的环节, 如还没有进行过 attach 操作, 我们不
         *              // 建议调用该方法.
         *
         *              // e.g.
         *              console.dir( $( '#idx', container ) );
         *           }
         *      } );
         *
         * 调用该 fn 会创建一个 fragment 的实例, 该实例持有以下方法:
         *
         *  1: setTitle     设置该 fragmnet 对应的标题
         *  2: isVisible    判断该 fragment 是否可见
         *  3: getArgs      获取参数对儿
         *  4: render       渲染 UI 依照给定的参数类型
         *  5: getContainer 获取 fragment 的容器
         *
         * </pre>
         * @param id
         * @param config
         * @returns {object} 一个 fragment 实例
         */
        define:     $lr.fragment,

        /**
         * 构建并呈现 fragment 如果当前不含有效的 hash 则使用指定的作为初始 fragment.
         * @param id
         */
        beginWith:  function(id, args) {
            _ORIGIN_HASH || _go( id, args )
        },

        /**
         * 呈现指定的 fragment, 如: ui.about.
         * @param id
         * @param args
         */
        go:         _go,

        /**
         * 判断是否有上一个 fragment, 如果有则可以执行返回操作.
         */
        canBack:    canBack,

        /**
         * 请求进行后退操作, 如果 BackStack 有可用的记录.
         * @return {boolean} true 说明后退操作有效, 反则无效
         */
        back:       back,

        /**
         * 通知 fragment 更新.
         *
         * @param id
         * @param args
         */
        reload:     _reload,

        /**
         * 可以向 fragment 传递一些参数用来更新.
         * @param id
         * @param params
         */
        update:     function(id, args) {
            // TODO:
            $lr.throwNiyError();
        },

        /**
         * 销毁当前 fragment & 返回上一级.
         * Note: 如果当前为根级则该方法不会被执行
         */
        finish:     finish,

        /**
         * 销毁当前 fragment & 前往指定 fragment.
         * Note: 如果当前为根级则该方法不会被执行
         * @param id
         * @params args
         */
        finishAndGo: _finishAndGo,

        /**
         * 回收一个 fragment.
         * @param id
         */
        destroy:    $lr.throwNiyError
    };

    /* --------------------------------------------------------------------- */

    /**
     * BUG(s):
     * $lairen.get -> error
     * finish 销毁过晚
     * 快速点击 UI 将不可见
     */

    /**
     * TODO:
     * 支持停用动画
     * handling unknown id
     * put => get => remove
     * onPreRender => onRendered
     * progress status
     * root color
     * parent -> back
     * url with args
     * clearContentOnLeave
     * destroyOnLeave
     * open fragment
     * show fragment
     * reveal fragment
     * render fragment
     * present fragment
     * appear fragment
     * reload with args
     * setTitle
     * detectHashChange => onHashChange
     */

    /* --------------------------------------------------------------------- */

    function _processState() {

    }

    var _LISTEN_WINDOW_POP_STATE = 'popstate';

    var _IDX            = _STACK_INDEX_;

    /* 首次加载的 view */
    var _FIRST_STATE    = 0;

    /* 当前状态 */
    var _currentState   = {};
        _currentState[ _IDX ] = _FIRST_STATE;

    function _newState() {
        var state = {};

            state[ _IDX ] = _backStack.length - 1;

        return state
    }

    function _isBackward(event) {
        var current = _currentState;

        return _FIRST_STATE == current[ _IDX ]
            || event.state[ _IDX ] < current[ _IDX ];
    }

    function _handleBackward(event) {
        var idx = event.state[ _IDX ];

        idx in _backStack && _performBack();
    }

    /* XXX(XCL): 是否应该支持 forward 操作 */
    function _handleForward(event) {

    }

    function _checkStateEvent(/* PopStateEvent */event) {
        return event['state'] && _IDX in event.state;
    }

    /* 如果跳转到其它页面当后退至当前页面则可能 stack 丢失(RELOAD) */
    var _popStateHandler = function(event) {
        $lr.dev && console.log( 'history entries: ' + history.length );

        if ( ! _checkStateEvent( event ) )
            return;

        _isBackward( event )
            ? _handleBackward( event )
            : _handleForward( event );

        /**
         * FIXME(XCL): Trying to prevent the user backward operation
         * if ( 'onpopstate' in window ) {
         *    history.pushState( null, null, location.href );
         *
         *    window.addEventListener( 'popstate', function () {
         *        FIXME: To override the history state
         *        history.pushState( null, null, location.href )
         *    } )
         *  }
         */
    };

    /* --------------------------------------------------------------------- */

    /**
     * 依赖该事件进行 fragment 导向
     * @type {string}
     * @private
     */
    var _LISTENER_HASH_CHANGE = 'onhashchange';

    /**
     * 记录初始 hash
     * @private
     */
    var _ORIGIN_HASH = _isViewHash( location.hash )
        ? _resolveHash( location.hash )
        : null;

    /**
     * 当 hash 变更时调用该 fn.
     * @private
     */
    var _onHashChanged = function() {
        /*$lr.dev && console.log( 'onHashChange::cs -> ' + JSON.stringify( _currentState )
            + ' ls -> ' + JSON.stringify( _detect_backward_for_uri )
            + ' ' + new Date().getTime() );*/

        var oldHash = _current
            ? { hash: _current[ _HASH ],
                args: _current[ _ARGS ] }
            : null;

        /* 当前 Browser 中的 hash */
        var hashNow = location.hash;

        /* 是否为 page hash */
        _isViewHash( hashNow )
            && _handleHashChange( oldHash, _resolveHash( hashNow ) )
    };

    var _detect_backward_for_uri = undefined;

    /* TODO: To detect the history back act. */
    var _handleHashChange = function(oldHash, newHash) {
        $lr.dev && console.log( 'onHashChanged ' + JSON.stringify( oldHash )
            + ' ' + JSON.stringify( newHash ) + ' ' + new Date().getTime() );

        /* 是否 hash 真的需要更新 */
        /* 暂时使用 History API */
        if ( ! _isSameHash( oldHash, newHash ) ) {
            _triggerGoNext( newHash, 1, 1 );
            /*_detect_backward_for_uri = _currentState;*/
        }
    };

    /* _triggerLoadFragment */
    /* triggerBackward */
    /**
     * 前往指定的 fragment.
     * @param hash
     * @param from_user 是否来自用户的形为
     * @param from_uri
     * @private
     */
    var _triggerGoNext = function(hash, from_user, from_uri) {
        var id = _makeIdentify( hash[ _HASH ] );

        if ( isSupportMultiInstance( id ) )
            _goNextWithMultiMode( id, hash[ _ARGS ], from_user, from_uri );
        else
            _goNext( id, hash[ _ARGS ], from_user, from_uri );
    };

    function _goNext(id, args, from_user, from_uri) {
        /* 更新 args */
        _overrideArgs( id, args );

        /* 前往该 view */
        _go( id, from_uri )
    }

    function _goNextWithMultiMode(id, args, from_user, from_uri) {
        /**
         * Step 1: 是否支持多实例
         * Step 2: 如果支持看实例是否被创建
         * Step 3: 前往实例
         */

        /**
         * 对于多实例 fragment 我们使用在其基本 id 之上加 args 的 hashcode 用于区分，
         * 如：ui.view#123456
         */
        var deriveId = _calculateDeriveKey( id, args );

        /* XXX: 实际上我们是依赖 args 的不同来维护多实例，但这并不意味着允许 args 为 null */
        if ( id == deriveId ) {
            _goNext( id, args, from_user, from_uri );
            return;
        }

        _exist( deriveId ) || _buildDerive( id, deriveId, args );

        _go( deriveId, from_uri );
    }

    function setGPUAcceleratedCompositingEnabled(viewport, enabled) {
        var flag = 'x-ui';

        viewport = $(viewport);

        if ( enabled ) {
            viewport.hasClass( flag ) || viewport.addClass( flag );
        } else {
            viewport.hasClass( flag ) && viewport.removeClass( flag );
        }
    }

    (function(viewport) {
        /*setGPUAcceleratedCompositingEnabled( viewport, 0 );*/
        /*setGPUAcceleratedCompositingEnabled( viewport, ! ($lr.os.ios && $lr.browser.qqx5) );*/
    }(document.body));

    /* TODO(XCL): addEventListener */
    _LISTENER_HASH_CHANGE in win && ( window[ _LISTENER_HASH_CHANGE ] =
        _onHashChanged );

    /* Manipulating the browser history */
    historyApiSupported
        && window.addEventListener( _LISTEN_WINDOW_POP_STATE,
        _popStateHandler );
}(lairen);