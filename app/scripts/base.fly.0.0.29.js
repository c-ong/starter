/**
 * 该代码包含以下内容:
 *
 * 1: 基本函数;
 * 2: Dialog 实现(使用参与 index.html 例子);
 * 3: Fragment 实现(使用参与下面注释 及 index.html 例子);
 */

/**
 * Created by xong on 10/29/15.
 *
 * @dependents Zepto
 */
;!function(undefined) {
    'use strict';

    /* FIXME(XCL): 考虑 App 注入场景 */
    if ( window[ 'lairen' ] )
        return;

    /* 版本号 */
    var VERSION = '0.0.27';

    var $lr;

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
    'ios' in os || (os.ios = ! 1);

    /* 是否运行于微信 WebView 环境 */
    browser.wechat  = !! wechat;
    /* QQ X5 浏览器 */
    browser.qqx5    = !! qqx5;

    /* 一些判断类型的函数 */
    var isUndefined = function(who) { return who === void 0 },
        isString    = function(who) { return 'string' == typeof who },
        isArray     = $.isArray,
        isNumber    = function(who) { return ! isUndefined(who)
            && 'number' === typeof who },
        isFunction  = $.isFunction,
        /* 判断是否为 DOM */
        isDom       = function(who) { return $.isPlainObject(who)
            && who.nodeType > 0 },

        /* FIXME(XCL): 这里我们使用 JSON.stringify 给出的结果来计算 hash code, 数据结构较为简单 */
        stringify   = JSON.stringify/*(function(JSON) {
            return (JSON && 'stringify' in JSON) ? JSON.stringify : function (map) {
                var buffer = [];

                for ( var key in map ) {
                    if ( map.hasOwnProperty( key ) )
                        buffer.push( key, ':', stringify( map[ key ] ) );
                }

                return '{' + buffer.join( ',' ) + '}';
            }
        })(JSON)*/,

        /* 抛出未实现异常, 仅用于开发期间防止无效的调用 */
        throwNiyError = function() { throw new Error( 'Not implement yet!' ) };

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
     * @deprecated
     */
    function get(/* url, data, success, error, dataType */) {
        return $.ajax( _parseArgs.apply( null, arguments ) )
    }

    /**
     * 执行一个 POST 请求.
     * @deprecated
     */
    function post(/* url, data, success, error, dataType */) {
        var options = _parseArgs.apply( null, arguments );
        options.dataType = 'POST';

        $.ajax( options );
    }

    /* 我们 lairen 开放的 fn 及 property */
    $lr = {
        undefined:      undefined,
        emptyFn:        emptyFn,
        win:            win,

        /* 是否为开发模式(待移除) */
        dev:            0,

        /* 用于判断类型的函数 */
        isUndefined:    isUndefined,
        isString:       isString,
        isArray:        isArray,
        isFunction:     isFunction,
        isNumber:       isNumber,
        isDom:          isDom,

        /* 低版本可能没有提供 JSON.stringify */
        stringify:      stringify,

        throwNiyError:  throwNiyError,

        /* HTTP 请求 */
        get:            get,
        post:           post,

        /* Runtime Env */
        os:             os,
        browser:        browser,

        /* Animation timing(Default) */
        cubic_bezier:   'cubic-bezier(.4, 0, .2, 1)',
        brisk_cubic_bezier:   'cubic-bezier(.1,.5,.1,1)'

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
        } : emptyFn
        */
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

    win.lairen = $lr;

    var _loader = document.getElementsByTagName('head')[0];

    var _import = function(res, delay) {
        delay
            ? setTimeout( function() {
                    _loader.appendChild(res)
                }, delay )
            : _loader.appendChild(res);
    };

    /**
     * 加载 Javascript 资源.
     *
     * @param src
     * @param callback
     * @param delay
     */
    win.import_script = function(src, callback, delay) {
        /* TODO(XCL): callback 处理 */
        if ( isNumber(callback) ) delay = callback;

        var script = document.createElement('script');
        script.src = src;

        _import(script, delay);
    };

    /**
     * 加载 Style 资源.
     *
     * @param href
     * @param delay
     */
    win.import_style = function(href, delay) {
        var style = document.createElement('link');
        style.rel = 'stylesheet';
        style.type = 'text/css';
        style.href = href;

        _import(style, delay);
    };

    /**
     * 隐藏 Keyboard.
     *
     * @param {Element} trigger input 元素,如: textarea, input
     */
    win.hide_keyboard = function(trigger) {
        isDom( trigger ) && 'blur' in trigger && trigger.blur();
        document.body.focus();
    };

    /**
     * 当你要执行的操作依赖外部代码, 且又不知外面代码何时载入完成时, 可考虑使用这个 fn, 这里会
     * 按一秒的间隔去调用 checker, 当 checker 返回 true 时, 会调用你指定的 callback, 注
     * 意这仅会调用一次你的 callback, 如:
     * <pre>
     *     case_run( function() {
     *         return 'same_field' in window
     *     },
     *     function() {
     *         alert( 'Found same_field.' );
     *     } );
     * </pre>
     *
     * @param checker 一个 fn 需要有有效的返回值
     * @param callback
     * @param context
     */
    win.case_run = function(checker, callback, context) {
        var ctx = context || window;
        var watcher = function() {
            checker.call( ctx )
                ? callback.call( ctx )
                : setTimeout( watcher, 1e3 );   /* 目前检测间隔为 1 秒 */
        };

        watcher();
    }
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
        /*var html = [];

        html.push( '' );*/

        _DIALOG_WRAPPER_TEMPLATE = $( '<div class="dialog-wrapper" id="dialog_wrapper"><div id="dialog_body"></div></div>'/*html.join( '' )*/ );

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
            cancelable: !! cancelable || 1,

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
        el.wrapper.css( 'margin-top', margin + 'px' );

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

    /* TODO(XCL): auto dismiss */
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
        // 更新 title
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
        _hide( current, _FROM_STACK_YES, 1 );

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
     * @returns {boolean}
     */
    function canBack() {
        return ! _hasFragmentTransInProcessing() && 0 in _backStack
    }

    /**
     * 请求进行后退操作, 如果 BackStack 有可用的记录.
     */
    function back(fromUri) {
        if ( ! canBack() )
            return;

        /* 暂时用 History API */
        history.go( fromUri ? _MAGIC_BACK_FIRER : _STANDARD_BACK );

        /*_performBack()*/
    }

    /* --------------------------------------------------------------------- */

    function _renderWithHtml(data) {
        /* To render using the html snippet */
        /*data && */this[ _EL_ ][ _LAYOUT_ ].html( data[ _HTML ] );

        /* 通知更新 Content loaded 标识 */
        _notifyContentWasLoaded( this );
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

        // _requestGo: id, args, fromUri, animation
        // _requestGo: home, null, 0, undefined
        // C
        // _requestGo: home, undefined, null, 0

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

    function _isSupportMultiInstance(id) {
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

    /* currentlyFragment */

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
        onFragmentChangeBefore: null,
        onFragmentChangeAfter: null,
        onCurrentlyFragmentContentLoaded: null
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

    /**
     * 执行 Go 操作.
     *
     * @param fromUri 默认是通过 $Fragment.go 来调用.
     * @param animation
     * @private
     */
    function _performGo(fromUri, animation) {
        /* 当前 fragment, 也旨即将隐藏的 */
        var current = _current,

            /* 是否有默认 view(Stack-based) */
            first   = ! _hasFragment(),

            /* 要前往的 fragment */
            next    = this,

            /* DOM */
            layout  = getLayout.call( next );

        /* 是否在操作本身 */
        if ( current && next == current )
            return;

        /* Dispatching the fragment change before event */
        _onFragmentChangeBefore( current, next );

        var fireFragmentChangeAfterEvent = function() {
            _onFragmentChangeAfter( current, next );
        };

        /* 切换效果 */
        var transit         = null,

            /* 标识是否为后置结束事务 */
            postCommitTrans = 0;

        /**
         * 关于切换效果:
         * 0: 首个 fragment 不应该被加载动画;
         * 1: override 优先;
         * 2: 其次是 Front fragment 的 animation 定义;
         * 3: 默认的(slide);
         */

        if ( first ) {
            transit = _buildTransition( _TRANSIT_NONE );

            /* 不启用动画, hidden 后也就无需 endTrans */
            postCommitTrans = 0;
        } else {
            if ( animation )
                animation = _resolveFx( animation );
            else
                animation = _getAnimation( next );

            transit         = _buildTransition( animation, _FORWARD );
            postCommitTrans = !! transit.rear;
        }

        /* 是否启用动画(首个 fragment 不应该被加载动画) */
        /* $lr.isUndefined( transit ) && (transit = ! first); */

        _beginTrans();

        /*$lr.dev && console.time('Trans');*/

        /**
         * hide -> rear
         * show -> front
         * 应用 animation 时亦是如此
         */
        _casStackIfNecessary( current, next );

        /* 如果为首次呈现则需要执行一系列的初始动作 */
        ( layout[ 0 ].parentNode && '' != layout.html() )
            ||
            (
                attach      ( next ),
                create      ( next ),
                createView  ( next ),
                start       ( next )
            );

        try {
            /* onVisibilityChanged */

            /* 隐藏当前 fragment */
            current
            && (
                pause( current ),
                _hide( current /*, _FROM_STACK_YES,  endTransNeeded */, transit,
                    fireFragmentChangeAfterEvent )
                );
        } finally {
            /* FIXME(XCL): 不管是否被暂停这里绝对执行恢复操作 */
            resume( next );

            /* 呈现下一个 fragment */
            _show( next, transit/*, _FROM_STACK_NO*/ );

            /* 加入 BackStack */
            if ( current && ! first ) {
                _addToBackStack( current );

                historyApiSupported && _setupCurrentState( next, fromUri )
            } else {
                historyApiSupported && _setupInitialState( next, fromUri )
            }

            _current = next;

            if ( historyApiSupported ) {

            } else {
                /* 更新至 location.hash(此后 hash 将被变更) */
                _applyHash( _current );
            }

            /*
             * 如果 trans 为后置提交, 那么这里将不在处理, 注意 Rear 与 Front 效果呈现时序
             * 有可能不一致.
             */
            if ( ! postCommitTrans ) {
                /* 标识 trans 完成 */
                _endTrans();

                /* 触发 onFragmentChangeAfter 事件 */
                fireFragmentChangeAfterEvent();
            }
            /*postCommitTrans || _endTrans();*/
        }
    }

    function _setupCurrentState(target, from_uri) {
        /* console.log( '## setupCurrentState ' + !! from_uri ); */
        var state   = _newState(),
            title   = target[ _TITLE ],
            hash    = _buildInnerHashByFragment( target );

        if ( from_uri )
            history.replaceState(state, title, hash);
        else
            _pushState( state, title, hash );

         _currentState = state;
    }

    function _setupInitialState(/* fragment */initial, from_uri) {
        var state = {};
            state[_IDX] = _FIRST_STATE;

        /**
         * Chrome 45 (Version 45.0.2454.85 m) started throwing an error,
         * Uncaught SecurityError: Failed to execute 'replaceState' on
         * 'History': A history state object with URL
         * 'file:///usr/local/page.html#p=v' cannot be created in a document
         * with origin 'null'.
         * Ref(Axure)
         */

        /* TODO(XCL): We should use window.location.replace to fix that the
                      browser doesn't support state replace issue. */
        history.replaceState(
            state,
            initial[ _TITLE ],
            _buildInnerHashByFragment( initial ) );

        _currentState = state/*history.state*/;
    }

    /**
     * 获取 fragment 定义的切换效果, 如果没定义则返回默认效果.
     *
     * @param fragment
     * @returns {string}
     * @private
     */
    function _getAnimation(fragment) {
        if ( ! (_ANIMATION in fragment) )
            return fx.slide;

        return fragment[ _ANIMATION ];
    }

    function _performBack() {
        if ( ! canBack() )
            return;

        /* 当前 fragment, 也旨即将隐藏的 */
        var current = _current,
            next    = _popBackStack();

        /* Dispatching the fragment change before event */
        _onFragmentChangeBefore( current, next );

        var fireFragmentChangeAfterEvent = function() {
            _onFragmentChangeAfter( current, next );
        };

        /* rear: fragment-exit, front: fragment-pop-enter */
        /* 切换效果 */
        var transit = _buildTransition( _getAnimation( current ), _BACKWARD ),
            /* 标识是否为后置结束事务 */
            postCommitTrans = !! transit.rear;

        _beginTrans();

        /* FIXME(XCL): 后退操作这里的 stack 是个例外, 即将呈现的不能置于量上层 */
        _casStackIfNecessary( next, current );

        pause( current );

        /* 隐藏当前 fragment */
        _hide( current, transit/*_FROM_STACK_NO,*/ /*endTransNeeded*//*1*/,
            fireFragmentChangeAfterEvent );

        try {
            /* 恢复 */
            resume( next );

            /* 呈现下一个 fragment */
            _show( next, transit/*_TRANSITION_SLIDE, _FROM_STACK_YES*/ );
        } finally {
            _current = next;

            /* 支持 history 则不需要手动更新 hash */
            if ( historyApiSupported ) {

            } else {
                _applyHash( _current )
            }

            if ( ! postCommitTrans ) {
                _endTrans();
                fireFragmentChangeAfterEvent();
            }
            /*postCommitTrans*/ /*ALWAYS_POST_COMMIT_ON_BACK*/ /*|| _endTrans();*/
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

    /* 标识是否有切换效果 */
    var _TRANSIT_YES    = ! 0;
    var _TRANSIT_NONE   = ! _TRANSIT_YES;

    /* 目前我们支持 4 种切换效果 */
    var fx = {
        slide:  'slide', /* 左右滑动切换   */
        cover:  'cover', /* 从下至上的覆盖  */
        fade:   'fade',  /* fade-in-out  */
        none:   'none'   /* 无切换效果     */
    };

    /* 将 fx 置为全局可见 */
    win.fx = fx;

    function _makeAnimationScheme(/* enter, popExit, popEnter, exit, ease */) {
        var ret;

        if ( 1 == arguments.length )
            return arguments[ 0 ];

        ret = {
            /* forward */
            enter:    arguments[ 0 ],   popExit: arguments[ 1 ],

            /* backward */
            popEnter: arguments[ 2 ],   exit:    arguments[ 3 ]
        };

        arguments[4] && (ret['ease'] = arguments[4]);

        return ret;
    }

    /**
     * 指定切换动作对应的4个环节是否需要
     * @type {{AnimationScheme}}
     * @private
     */
    var _transits = {};

    _transits[fx.slide] = _makeAnimationScheme(
        _TRANSIT_YES, _TRANSIT_YES,
        _TRANSIT_YES, _TRANSIT_YES );
    _transits[fx.cover] = _makeAnimationScheme(
        _TRANSIT_YES, _TRANSIT_YES,
        _TRANSIT_YES, _TRANSIT_YES,
        $lr.brisk_cubic_bezier );
    _transits[fx.fade] = _makeAnimationScheme(
        _TRANSIT_YES, _TRANSIT_NONE,
        _TRANSIT_YES, _TRANSIT_NONE );
    _transits[fx.none] = _makeAnimationScheme(
        _TRANSIT_NONE );

    /* OPEN, CLOSE, FADE, SLIDE */
    var /*_TRANSITION_SLIDE   = 1,*/
        _TRANSITION_NONE    = 0,

        /* 进栈 或 出栈 */
        _FROM_STACK_YES     = 1,
        _FROM_STACK_NO      = 0;

    /* 制导方向(Forward OR Backward) */
    var _FORWARD            = 1,
        _BACKWARD           = _FORWARD - 1;

    /* 界面切换效果没设置 */
    var _TRANSITION_UNSET = {
        rear: 0,
        front: 0
    };

    function _show(target, transit/*, fromStack*/) {
        var layout = target[ _EL_ ][ _LAYOUT_ ];

        /*$lr.dev && console.log( "<< show # %s, %s",
            target[ _ID ], transit.front );*/

        /* Show the dom */
        layout.show();

        transit.front
            &&
            layout.animate(
                transit.front,
                $.fx.speeds.slow,
                transit.ease/*$lr.cubic_bezier*//*'linear'*/ )

        /* 提取并执行触发器定义的操作 */
        _fireTriggerIfNecessary.call( target, 'show');
    }

    function _fireTriggerIfNecessary(state) {
        /* 待触发的 trigger 队列 */
        var triggers = _extractTriggers(this[_ID], state);
        /* 没有与之关联的 trigger */
        if ( ! triggers )
            return;

        var idx,        /* 触发器队列索引 */
            trigger,    /* 具体的触发器   */
            action;     /* callback     */

        for ( idx in triggers) {
            trigger = triggers[idx];
            action = trigger['action'];

            /* 如果 action 为 fn 则直接执行 */
            $lr.isFunction( action ) && (action());
        }
    }

    /**
     * 隐藏 fragment.
     *
     * @param target
     * @param fromStack 是否从 stack 中取得 fragment
     * @param endTransNeeded 是否需要结束 trans
     * @param transit 动画
     * @param firer 用于触发事件(optional)
     * @private
     */
    function _hide(target, /*fromStack, endTransNeeded,*/ transit, firer) {
        var layout = target[ _EL_ ][ _LAYOUT_ ];

        /*$lr.isUndefined( transit ) && (transit = _TRANSITION_SLIDE);*/
        /*$lr.dev && console.log( ">> hide # %s, %s", target[ _ID ], transit.rear );*/
        /*$lr.dev && console.time('EndAnimation');*/

        if ( transit.rear ) {
            /* properties, duration, ease, callback, delay */
            layout.animate(
                transit.rear,
                $.fx.speeds.slow,
                transit.ease/*$lr.cubic_bezier*//*'linear'*/,
                function () {
                    layout.hide();

                    _endTrans();

                    firer && firer();
                })
        } else {
            layout.hide();
        }
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

    function _casStackIfNecessary(/* zepto */r, /* zepto */f) {
        if ( ! r )
            return;

        var back  = r[ _STACK_INDEX_ ],
            front = f[ _STACK_INDEX_ ];

        if ( front > back )
            return;

        front = front ^ back;
        back  = back ^ front;
        front = front ^ back;

        r[ _STACK_INDEX_ ] = back;
        f[ _STACK_INDEX_ ] = front;

        r[ _EL_ ][ _LAYOUT_ ].css( 'z-index', back );
        f[ _EL_ ][ _LAYOUT_ ].css( 'z-index', front );

        /*return swapped*/
    }

    /**
     * 取出上一个暂停的 fragment.
     *
     * @returns {fragment}
     * @private
     */
    function _popBackStack() {
        var id = _pop();
        return id ? getFragment( id ) : null
    }

    function _push(fragment) {
        return _backStack.push( _getId( fragment ) );
        /*return _backStack.push( fragment[ _ID ] )*/
    }

    function _pop() {
        return _backStack.pop()
    }

    /* --------------------------------------------------------------------- */

    /**
     * fragment 被暂停.
     *
     * @param fragment
     */
    function pause(fragment) {
        _invokeHandler( fragment, _PAUSE )
    }

    /**
     * fragment 被停止.
     *
     * @param fragment
     */
    function stop(fragment) {
        _invokeHandler( fragment, _STOP )
    }

    function destroyView(fragment) {
        _invokeHandler( fragment, _DESTROY_VIEW )
    }

    function destroy(fragment) {
        _invokeHandler( fragment, _DESTROY )
    }

    function detach(fragment) {
        _invokeHandler( fragment, _DETACH )
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
     *
     * @param id 唯一的 fragment 标识,如: ui.about
     * @param props fragment 的配置数据
     * @returns fragment
     * @private
     */
    function _register(id, /* properties */props) {
        /* TODO: validate the view id */
        if ( ! isString( id ) )
            throw Error( "Invalid id(" + id + ")" );

        if ( $lr.isUndefined( props ) )
            throw Error( "Must be specify the props for " + id );

        /* TODO: 延迟初始化 */
        _ensure();

        /* Fragment 如果已经定义过则无需再次定义 */
        var frag = _exist( id )
            ? getFragment( id )
            : {};

        /* 标识是否需要填充默认 fragment, 如果没有首个 fragment 被呈现 */
        var hasFragmentPresented = _hasFragment();

        /* TODO(XCL): 已经存在的是否允许更新 */
        if ( _ID in frag )
            return frag;

        /* TODO: 这样会造成祖级元素无法被合理使用 */
        /* 是否为祖先级实例 */
        var isAncestor = _MULTIPLE_INSTANCES in props
            && !! props[ _MULTIPLE_INSTANCES ];

        /* 分配一个 idx 实际上就是 z-index */
        var stackIdx = _alloZIndex( $lr.FRAGMENT ),
            requires = undefined;

        /* 用于容纳 fragment 内容 */
        var layout   = _FRAGMENT_TEMPLATE.clone();
        /* layout[ 0 ][ 'id' ] = _fragmentSequenceId( stackIdx ); */

        /* 处理依赖项 */
        isPlainObject( props )
        && _REQUIRES in props
        && ( requires = _resolveRequires( props.requires ) );

        /* ----------------------------------------------------------------- */

        /* 对一个 fragment 开放的实例方法 */
        _bindMethods( frag );

        /* 处置 Handlers */
        _settleHandlers( id, props );

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
        isString( props[ _TITLE ] )
        && (frag[ _TITLE ] = props[ _TITLE ]);

        /* 解析后的 hash, lairen.ui.home -> lairen/ui/home */
        frag[ _HASH ]       = _makeIdUrlify( id );

        /* To retain the arguments if present. */
        _ARGS in props
        && (frag[ _ARGS ] = props[ _ARGS ]);

        /* 是否支持多实例, 如支持多实例则祖先仅终不会被添加至 DOM 中 */
        isAncestor
        && Object.defineProperty(
            frag,
            _MULTIPLE_INSTANCES,
            { value: 1, writable: 0 }
        );

        /* 解析切换效果配置 */
        _settleAnimation( frag, props );

        /* ----------------------------------------------------------------- */

        /* 填充 HTML 片段，如果已指定该字段 */
        /* if ( ! isAncestor ) { */
        if ( _HTML in props ) {
            frag[ _HTML ] = props[ _HTML ];
            _invokeRender( frag, frag );
        } else if ( _URL in props ) {
            frag[ _URL ] = props[ _URL ];
            _invokeRender( frag, frag );
        }
        /* } */

        /* (props && _HTML in props)
              && isString( props[ _HTML ] )
                  && layout.html( props[ _HTML ] ); */

        /* ----------------------------------------------------------------- */

        var triggerDefine = props['trigger'];

        if ( triggerDefine ) {
            var on      = triggerDefine['on'],
                state   = triggerDefine['state'],
                action  = triggerDefine['action'];

            if ( on && state && action ) {
                var host    = _triggers[on];

                /* 首次开劈空间(trigger 被触发完了以后应该释放空间) */
                if ( ! host ) {
                    host = {};
                    _triggers[on] = host;
                }

                var stack = host[state];

                /* 该 state 首个 trigger */
                if ( ! stack ) {
                    stack = [];
                    host[state] = stack;
                }

                var trigger = {
                    target: id,
                    action: action };

                /* 不设置 once 默认指只触发一次 */
                if ( 'once' in triggerDefine && triggerDefine.once ) {
                    trigger['once'] = 1;
                }

                stack.push( trigger );
            }

            /*console.log( _triggers );*/
            /*console.log( JSON.stringify(_triggers) );*/
        }

        /* ----------------------------------------------------------------- */

        try {
            return frag
        } finally {
            /* 将定义的 fragment 放入容器 */
            _add( frag );

            /* 呈现默认 View 如果没有有效的 view id 被指定 */
            /* FIXME(XCL): 暂时从 bootstrap 调用, 以在 register 过程中调用一些未加载的
                           fragment */
            /*! hasFragmentPresented && _setupTopIfMatch( frag )*/
        }
    }

    /**
     * 提取依赖当前 fragment 的 triggers.
     *
     * @param host
     * @param state
     * @returns {Array}
     * @private
     */
    function _extractTriggers(host, state) {
        var host = _triggers[host],
            result;

        /* TODO(XCL): 是否有必要触发一次后移除 */
        if ( host ) {
            var origin = host[state],
                trigger;

            /* Clone */
            result = origin.slice( 0 );

            var idx;
            /* 移除只触发一次的 trigger */
            for ( idx in origin ) {
                trigger = origin[idx];

                'once' in trigger
                    && trigger['once']
                    && ( origin.splice(idx), 1 );
            }

            /* 如果有只触发一次的 trigger 被移除, 则需要同步至 _triggers */
            origin.length != result.length
                && (_triggers[host] = host[state] = origin);
        }

        return result;
    }

    /**
     * 存放 triggers.
     *
     * @type {Map{Map{Array}}}
     * @private
     */
    var _triggers = {};

    /**
     * 当一个 fragment 被定义为支持 pre-load 时该标识默认为 true(也就是 props 中已经指
     * 定 html 或 url).
     *
     * @param fragment
     * @private
     */
    function _markContentWasLoaded(fragment) {
        fragment[ _FLAG_CONTENT_LOADED ] = ! 0;
    }

    /**
     * 通知有 fragment 加载内容完成.
     *
     * @param fragment
     * @private
     */
    function _notifyContentWasLoaded(fragment) {
        _markContentWasLoaded(fragment);

        if ( _current == fragment ) {
            _onCurrentlyFragmentContentLoaded();
        }
    }

    /**
     * 解析切换效果配置.
     *
     * @param fragment
     * @param props
     * @private
     */
    function _settleAnimation(fragment, props) {
        if ( ! _ANIMATION in props )
            return;

        fragment[_ANIMATION] = _resolveFx( props[ _ANIMATION ] );
    }

    /**
     * 拼装一个 Router hash 值, 用于区分常规 hash 我们的 hash 则以 !# 开头.
     *
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
     * 判断是否为用于 fragment 操控的 hash.
     *
     * @param hash
     * @returns {*|boolean}
     * @private
     */
    function _isInnerRawHash(hash) {
        return hash && '!' === hash.charAt( 1 )
    }

    /**
     * 判断是否为 View hash.
     * @param hash
     * @returns {*|boolean}
     * @private
     */
    function _isFragmentHash/*_isRouterHash*/(hash) {
        return _isInnerRawHash( hash ) && ! _isMagicBackHash( hash )
    }

    /**
     * 判断是否为作用于返回的特殊 hash.
     *
     * @param hash
     * @returns {*|boolean}
     * @private
     */
    function _isMagicBackHash(hash) {
        return _MAGIC_BACK_HASH === hash
    }

    /**
     * This is just convert the id to Canonicalized forms.
     * e.g.: app.tour -> app/tour
     *
     * @param id
     * @returns {string}
     * @private
     */
    function _makeIdUrlify(id) {
        return /\.+/g.test( id ) ? ( id.replace( /\./g, '/' ) ) : id
    }

    /**
     * 将 Fragment hash 转化为'命名空间'形式的 id, 如: view/home -> view.home.
     *
     * @param hash
     * @returns {XML|string|void}
     * @private
     */
    function _makeIdentify(hash) {
        return /\/+/g.test( hash ) ? ( hash.replace( /\//g, '.' ) ) : hash
    }

    /**
     * 重写指定 fragment 的 args.
     *
     * @param id
     * @param args
     * @private
     */
    function _overrideArgs(id, args) {
        // TODO:
        var x = getFragment( id );
        x && (x[ _ARGS ] = args)
    }

    /**
     * 分解 hash, 将从 URL 截取的 hash 片段分解为有效的 view id 及其参数.
     *
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
     *
     * @param rawHash {string} 来自 location 的 hash.
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
     *
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
     *
     * @param l
     * @param r
     * @returns {boolean}
     * @private
     */
    function _isSameArgs(l, r) {
        return /*JSON.stringify*/$lr.stringify( l ) === /*JSON.stringify*/$lr.stringify( r )
    }

    /**
     * 判断两个 hash 是否完全相同.
     *
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
     *
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
            _requestGo( fragment[ _ID ] )
        )
    }

    /* --------------------------------------------------------------------- */

    /**
     * BUG(s):
     * $lairen.get -> error;
     * finish 销毁过晚;
     * 快速点击 UI 将不可见;
     * 多实首次 URI 加载, 不走 multitask mode;
     * 多实例跳转后, 再后退动画不误;
     * 通过 beginWith multitask 根实例可能不会被创建;
     *
     */

    //使用 multitask 时会导致 loading indicator 二次呈现;

    /**
     * TODO:
     * Fake go(switch)
     * observer for load trigger(Once OR Ever)(Loading Strategy)
     * {fade:true}
     * bind
     * fragment listener
     * props
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
     * parent accessed by ref
     * setTitle
     * pass args
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
        return event['state'] && _IDX in event['state'];
    }

    /* 如果跳转到其它页面当后退至当前页面则可能 stack 丢失(RELOAD) */
    var _popStateHandler = function(event) {
        /*$lr.dev && console.log( "history entries: %s", history.length );*/
        /**
         * FIXME(XCL): 如果正在进行 trans 时触发 pop state 则说明是为了修正来自用户的
         *              快速 touch 操作来的 fragment 无跳转的问题, 此时仅仅是进行
         *              pop back 操作
         */
        /*if ( _isLocked() )
         return;*/

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
    var _ORIGIN_HASH = _isFragmentHash( location.hash )
        ? _resolveHash( location.hash )
        : null;

    var _onTransEnded = function() {
        _handleDelayedHashChangeEvent();
    };

    /**
     * 延迟处理 hash change 事件.
     *
     * @private
     */
    var _handleDelayedHashChangeEvent = function() {
        if ( ! _delayed_hash_change_event )
            return;

        var oldInnerHash    = _delayed_hash_change_event.oldInnerHash,
            newRawHash      = _delayed_hash_change_event.newRawHash;

        /* 标记 delayed event 已处理 */
        _delayed_hash_change_event = undefined;

        _handleHashChange( oldInnerHash, newRawHash )
    };

    /**
     * 将指定的 hash change 事件延迟处理.
     *
     * @param oldInnerHash
     * @param newRawHash
     * @private
     */
    function _postDelayedHashChangeEvent(oldInnerHash, newRawHash) {
        _delayed_hash_change_event = {
            oldInnerHash: oldInnerHash,
            newRawHash: newRawHash };
    }

    var _roll_back_for_uri_nav = function() {
        /*history.back();*/
        /*var rewind = _convertCurrentlyHashToInner();
         rewind && ( location.hash = _buildInnerHash( rewind ) );*/
    };

    var _detect_backward_for_uri = undefined;

    var _roll_back;

    /**
     * 用于对我们再次包装的 HashChangeEvent 进行延迟处理.
     *
     * @type {object}
     * @private
     */
    var _delayed_hash_change_event = undefined;

    /**
     * 提取当前 fragment 的 InnerHash.
     *
     * @returns {InnerHash}
     * @private
     */
    function _convertCurrentlyHashToInner() {
        var data = null;

        if ( _current ) {
            data = {};

            data[_HASH] = _current[_HASH];
            data[_ARGS] = _current[_ARGS];
        }

        return data;
    }

    /**
     * 当 hash 变更时调用该 fn.
     *
     * @private
     */
    var _onHashChange = function(hashChangeEvent) {
        /*$lr.dev && console.log( "onHashChange::cs -> %s ls -> %s ",
         JSON.stringify( _currentState ),
         JSON.stringify( _detect_backward_for_uri ),
         new Date().getTime() );*/

        var oldInnerHash  = _convertCurrentlyHashToInner(),
            /* 当前 Browser 中的 hash */
            newRawHash    = location.hash;

        /* TODO(XCL): Check for transaction timed out... */
        if ( _hasFragmentTransInProcessing() ) {
            /* TODO(XCL): postDelayed */
            _postDelayedHashChangeEvent( oldInnerHash, newRawHash );

            /*console.log( 'Break now: o : %s n : %s ', hashChangeEvent.oldURL, location.hash );*/
            /*if ( _roll_back != hashChangeEvent.newURL ) {
             _roll_back_for_uri_nav();
             }*/

            return;
        }

        _handleHashChange( oldInnerHash, newRawHash );

        /*_isFragmentHash( newRawHash )
         && _handleHashChange( oldInnerHash, _resolveHash( newRawHash ) )*/
    };

    /**
     * 处理 hash 变更事件.
     *
     * @param oldInnerHash {object}
     * @param newRawHash {string}
     * @private
     */
    function _handleHashChange(oldInnerHash, /*currently*/newRawHash) {
        /*console.log( 'handleHashChange: [OLD] %s, [NEW] %s, %s',
         JSON.stringify(oldInnerHash), newRawHash, _isInnerRawHash(newRawHash) );*/
        if ( ! _isInnerRawHash( newRawHash ) )
            return;

        _processInnerHashChangedEvent( oldInnerHash, newRawHash )
    }

    /* TODO: To detect the history back act. */
    function _processInnerHashChangedEvent(oldInnerHash, /*currently*/newRawHash) {
        if ( _isMagicBackHash( newRawHash ) ) {
            _triggerGoBack()
        }
        /* 是否为 page hash */
        else if ( _isFragmentHash( newRawHash ) ) {
            /*console.log( 'Changed: %s, %s', JSON.stringify( oldInnerHash ), newRawHash );*/

            /* TODO(XCL): Filtering and Sanitizing */
            var resolvedHash = _resolveHash( newRawHash );

            /* 是否 hash 真的需要更新 */
            /* 暂时使用 History API */
            if ( ! _isSameHash( oldInnerHash, resolvedHash ) ) {
                _triggerGoNext( resolvedHash, /* from_user */1, /* from_uri */1 );
                /*_detect_backward_for_uri = _currentState;*/
            }
        }

        /*$lr.dev && console.log( "onHashChanged %s %s %s"
         , JSON.stringify( oldHash )
         , JSON.stringify( newHash )
         , new Date().getTime() );*/
    }

    /* _triggerLoadFragment */
    /* triggerBackward */

    /**
     * 前往指定的 fragment.
     *
     * @param hash {InnerHash}
     * @param fromUser {boolean} 是否来自用户的形为
     * @param fromUri {boolean}
     * @private
     */
    var _triggerGoNext = function(/*InnerHash*/hash, fromUser, fromUri) {
        var id = _makeIdentify( hash[ _HASH ] );

        _requestGo( id, hash[_ARGS], fromUri );

        /*if ( _isSupportMultiInstance( id ) )
            _goNextWithMultiMode( id, hash[ _ARGS ], fromUser, fromUri );
        else
            _goNext( id, hash[ _ARGS ], fromUser, fromUri );*/
    };

    /* TODO(XCL): boot in #!- */
    var _triggerGoBack = function() {
        back( 1 );
    };

    function _goNextWithMultiMode(id, args, fromUser, fromUri, animation) {
        /**
         * Step 1: 是否支持多实例
         * Step 2: 如果支持看实例是否被创建
         * Step 3: 前往实例
         */

        /**
         * 对于多实例 fragment 我们使用在其基本 id 之上加 args 的 hash 用于区分，
         * 如：ui.view#123456
         */
        var deriveId = _calculateDeriveKey( id, args );

        /* XXX: 实际上我们是依赖 args 的不同来维护多实例，但这并不意味着允许 args 为 null */
        if ( id == deriveId ) {
            _goNext( id, args, fromUser, fromUri, animation );
            return;
        }

        _exist( deriveId ) || _buildDerive( id, deriveId, args );

        _performGo.call( getFragment( deriveId ), fromUri, animation );

        /*_requestGo( deriveId, fromUri )*/
    }

    /**
     * 前往下一步 fragment.
     *
     * @param id
     * @param args (optional)
     * @param fromUser (optional)
     * @param fromUri (optional)
     * @private
     */
    function _goNext(id, args, fromUser, fromUri, animation) {
        /* 更新 args */
        args && _overrideArgs( id, args );

        /* 前往该 view */
        _performGo.call( getFragment( id ), fromUri, animation );
        /*_requestGo( id, fromUri )*/
    }

    /**
     * 设置 GPU 硬件加速开启状态.
     *
     * @param viewport
     * @param enabled
     */
    function setGPUAcceleratedCompositingEnabled(viewport, enabled) {
        var flag = 'x-ui';

        viewport = $(viewport);

        if ( enabled )
            viewport.hasClass( flag ) || viewport.addClass( flag );
        else
            viewport.hasClass( flag ) && viewport.removeClass( flag );
    }

    /* TODO(XCL): Just dumping some state or data Of the fragment(s)... */
    function dump() {
    }

    /* --------------------------------------------------------------------- */

    /**
     * TODO(XCL): Mixed props
     *
     * $Fragment.define(['home', {title:'Home'}, 'about', {title:'About'}]);
     */
    $lr.fragment = function(id, props) {
        /* TODO: alias, short */
        return _register( id, props )
    };

    /**
     * $Fragment 开放的静态 fn, 用于定义, 跳转控制.
     *
     * @type { {
     *          config: {Map},
     *          title: string,
     *          define: (lairen.fragment|*),
     *          bootstrap: win.$Fragment.bootstrap,
     *          go: win.$Fragment.go,
     *          goWithoutFx: win.$Fragment.goWithoutFx,
     *          canBack: canBack,
     *          back: back,
     *          reload: _reload,
     *          update: throwNiyError,
     *          finish: win.$Fragment.finish,
     *          finishAndGo: win.$Fragment.finishAndGo,
     *          destroy: throwNiyError
     * } }
     */
    win.$Fragment = {

        /**
         * 对 $Fragment 进行全局配置, 例如指定: listener, property 等
         * <pre>
         * $Fragment.config( {
         *      // 会在 fragment 切换之前调用, 其中 currently 指当前的 fragment,
         *      // upcoming 指即将呈现的 fragment.
         *      onFragmentChangeBefore: function(currently, upcoming) {},
         *
         *      // 会在 fragment 切换完成之后调用(既切换效果呈现完毕之后), older 切换之前
         *      // 的 fragment, currently 指切换之后的 fragment.
         *      onFragmentChangeAfter: function(older, currently) {},
         *
         *      // 会在当前 fragment 内容加载完成之后调用
         *      onCurrentlyFragmentContentLoaded: function() {}
         *  } );
         * </pre>
         */
        config:     config,

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
         * $Fragment.define(
         *      'namespace.views.about',      // fragment 唯一标识，必选项
         *
         *      {
         *           title:    'Untitled',    // 标题用于显示在支持的浏览器上
         *
         *           multitask: 1,            // 标明该 fragment 是否支持多实例,
         *                                    // 既 Multiple Instances, 此项与
         *                                    // clearContentOnLeave 互斥
         *
         *           args:     {key: 'value'} // 参数对儿
         *
         *           backable: false,         // 是否可后退
         *
         *           requires: {String/[]},   // 依赖项
         *
         *           html/url: 'URL or HTML', // 完整 URL 或 HTML 片段
         *
         *           trigger: { on: 'home', state: 'present', do: 'preload' },
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
         * </pre>
         *
         * @param id 用来标识 fragment 的唯一
         * @param {Map} props 定义 fragment 配置及 handler.
         * @returns {object} 一个 fragment 实例
         */
        define:     $lr.fragment,

        /**
         * 启动 fragment 如果当前 location.hash 不含有效的 hash 则使用指定的作
         * 为初始 fragment.
         *
         * @param id
         * @param args
         */
        bootstrap:  function(id, args) {
            _ORIGIN_HASH && ( id = _ORIGIN_HASH[ _HASH ], args = _ORIGIN_HASH[ _ARGS ] );
            _requestGo( id, args, /* from_uri */0 )
        },

        /**
         * 呈现指定的 fragment, 如: ui.about.
         *
         * @param id
         * @param args
         */
        go:         _requestGo,

        /**
         * 呈现指定的 fragment 但不启用动画.
         *
         * @param id
         * @param args
         */
        goFast: function(id, args) {
            _requestGo( id, args, /* from_uri = 0, */ fx.none )
        },

        /**
         * 判断是否有前一个 fragment, 如果有则可以执行返回操作.
         *
         * @return {boolean}
         */
        canBack:    canBack,

        /**
         * 请求进行后退操作, 如果 BackStack 有可用的记录.
         *
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
         *
         * @param id
         * @param args
         * @deprecated
         */
        update:     $lr.throwNiyError,

        /**
         * 销毁当前 fragment & 返回上一级.
         * Note: 如果当前为根级则该方法不会被执行
         * @deprecated
         */
        finish:     $lr.throwNiyError,

        /**
         * 销毁当前 fragment & 前往指定 fragment.
         * Note: 如果当前为根级则该方法不会被执行
         *
         * @param id
         * @params args
         * @deprecated
         */
        finishAndGo: $lr.throwNiyError,

        /**
         * 回收一个 fragment.
         *
         * @param id
         * @deprecated
         */
        destroy:    $lr.throwNiyError
    };

    /* ---------------------------------------------------------------------- */

    /**
     * 为 $Fragment[go, back] 添加短名方法.
     *
     * @type {function}
     */
    win.go          = win.$Fragment.go,
    /* 以没有切换效果的模式前往下一个 fragment */
    win.goFast      = win.$Fragment.goFast,
    /* 后退操作 */
    win.back        = win.$Fragment.back;

   /* ----------------------------------------------------------------------- */

    /* TODO(XCL): addEventListener */
    _LISTENER_HASH_CHANGE in win && ( window[ _LISTENER_HASH_CHANGE ] =
        _onHashChange );

    /* Manipulating the browser history */
    historyApiSupported
        && (window.addEventListener( _LISTEN_WINDOW_POP_STATE, _popStateHandler ) );

    /* 配置 CSS Transform 硬件加速 */
    (function(viewport) {
        /*setGPUAcceleratedCompositingEnabled( viewport, 0 );*/
        /*setGPUAcceleratedCompositingEnabled( viewport, ! ($lr.os.ios && $lr.browser.qqx5) );*/
    }(document.body));

    /* -----------------------------------------------------------------------
     *                       以下为 Swipe to refresh 扩展提供支持
     * --------------------------------------------------------------------- */

    /**
     * 获取不当 fragment.
     *
     * @returns {fragment}
     */
    win.getCurrentlyFragment = function() {
        return _current;
    }
}(lairen);