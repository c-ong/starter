/**
 * Created by xong on 10/29/15.
 *
 * @dependents Zepto
 */
;!function() {
    "use strict";

    var VERSION = '0.0.2';

    var win     = window;
    var emptyFn = function() {};

    var undefined,
        isUndefined = function(who) { return undefined === who },
        isString    = function(who) { return 'string' == typeof who },
        isArray     = $.isArray,
        isFunction  = $.isFunction;

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
    };

    /**
     * 执行一个 GET 请求.
     */
    function get(/* url, data, success, error, dataType */) {
        return $.ajax( _parseArgs.apply( null, arguments ) )
    }

    function post(/* url, data, success, error, dataType */) {
        var options = _parseArgs.apply( null, arguments );
        options.dataType = 'POST';
        $.ajax( options );
    }

    /**
     * Global
     */
    var $lr  = { undefined: undefined,
        win:            win,

        // 是否为开发模式
        dev:            1,

        // 用于判断类型的函数
        isUndefined:    isUndefined,
        isString:       isString,
        isArray:        isArray,
        isFunction:     isFunction,

        // HTTP 请求
        get:            get,
        post:           post,

        // 提供了短名方法,用于访问 console 方法
        //log: console ? function(msg) {
        //    lairen.dev && console.log( msg )
        //} : emptyFn,
        //dir: console ? function(obj) {
        //    lairen.dev && console.dir( obj )
        //} : emptyFn,
        //error: console ? function(msg) {
        //    lairen.dev && console.error( msg )
        //} : emptyFn
    };

    /**
     * The root of UIs
     * @type {undefined}
     * @private
     */
    var _viewport       = undefined;

    // ------------------------------------------------------------------------

    // Exend
    $lr.ID_DIALOG        = 'lairen-dialog';
    $lr.ID_DIALOG_MASK   = 'dialog-mask';
    $lr.ID_FRAGMENT_ROOT = 'lairen-fragments';

    // Layer manager
    // hasTopLayer

    $lr.DIALOG_WRAPPER  = 'dialog_wrapper';
    //DIALOG_STACK  = 'dialog_stack',
    $lr.DIALOG_MASK     = 'dialog_mask';
    $lr.DIALOG          = 'dialog';
    $lr.FRAGMENT        = 'fragment';
    $lr.FRAGMENTS       = 'fragment_root';

    // ------------------------------------------------------------------------

    var Z_IDX_FIXED     = 0,
        Z_IDX_MIN       = 1,
        Z_IDX_MAX       = 2,
        Z_IDX_CURRENT   = 3;

    /**
     *
     * @type {{dialog: number[], dialog_mask: number[], dialog_wrapper: number[]}}
     */
    var zIndexes = {
        // fixed, min, max, current

        dialog_wrapper  : [ 0, 1002, 2000, 1002 ],
        //dialog_stack    : [ 1, 1001, 1001, 1001 ],
        dialog_mask     : [ 1, 1000, 1000, 1000 ],
        // container
        dialog          : [ 1, 999, 999, 999 ],

        fragment        : [ 0, 1, 200, 1 ],
        // container
        fragment_root   : [ 1, 0, 0, 0 ]
    };

    // ------------------------------------------------------------------------

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
            next = current;

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

    // ------------------------------------------------------------------------

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
        _idSelector = $lr._idSelector;

    /**
     * 全部 Dialog
     * @type {Array}
     * @private
     */
    var _dialogs    = [];

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

        html.push( '<div class="dialog-wrapper" id="dialog-wrapper">' );
        html.push( '<div id="dialog-body"></div>' );
        html.push( '</div>' );

        _DIALOG_WRAPPER_TEMPLATE = $( html.join( '' ) );

        _dialog_root = $( _idSelector( $lr.ID_DIALOG ) );
        _dialog_mask = $( _idSelector( $lr.ID_DIALOG_MASK ) )

        _dialog_root.css( 'z-index', $lr._alloZIndex( $lr.DIALOG ) );
        _dialog_mask.css( 'z-index', $lr._alloZIndex( $lr.DIALOG_MASK ) );

        _dialog_mask.on( 'click', _handleMaskTap );
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
    function _build(html, cancelable) {
        _ensureDialogBase();

        var _d;

        // 分配一个 id 实际上就是 z-index
        var stackId = $lr._alloZIndex( $lr.DIALOG_WRAPPER );

        var wrapper = _DIALOG_WRAPPER_TEMPLATE.clone();

        //$( "#dialog-stack" ).css( 'z-index', _alloZIndex( DIALOG_STACK ) );
        wrapper.css( 'z-index', stackId );

        _d = {
            id: stackId,

            cancelable: cancelable || 1,
            dismissed: 0,

            _el_: {
                wrapper: wrapper
            }
        };

        // 绑定方法
        var methods = [['show', show],['cancel', cancel], ['dismiss', dismiss]];
        methods.forEach( function(fn) {
            _d[ fn[ 0 ] ] = fn[ 1 ]
        } );

        _dialogs[ _dialogIdx( stackId ) ] = _d;

        // 填充 Dialog 内容
        html && void wrapper.find( '#dialog-body').html( html );

        // 添加到 Dialog 根节点
        _dialog_root.append( wrapper );

        return _d
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

        ! el.dismissed && _hideWrapperOnly.call( this );

        _dialog_mask.animate(
            'dialog-mask-out',
            $.fx.speeds.fast,
            'linear',
            function() {
                _dialog_mask.hide();
                _dialog_root.hide();

                //// Reset the opacity prop
                //el.wrapper.css( { opacity: 1 } );
                //el.wrapper.hide()
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

        // properties, duration, ease, callback, delay
        el.wrapper.animate(
            { opacity: .1 },
            $.fx.speeds.fast,
            /*'cubic-bezier(0.4, 0, 0.2, 1)'*/'ease-out',
            function() {
                // Reset the opacity prop
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

        // 清当前 dialog
        (current && this != current) && void _hideWrapperOnly.call( current );

        var el = this._el_;

        if ( el.dismissed )
            return;

        current || (
            _dialog_mask.show(),
                _dialog_root.show(),

                // properties, duration, ease, callback, delay
                _dialog_mask.animate(
                    'dialog-mask-in',
                    $.fx.speeds.slow,
                    /*'cubic-bezier(0.4, 0, 0.2, 1)'*/'linear' ) );

        el.wrapper.show();

        // Vertical Center
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

        // 如果已经操作过 dismiss 则不在执行
        if ( el.dismissed )
            return;

        this._el_.dismissed = ! 0;

        this.cancel();
        this._el_.wrapper.remove();

        delete _dialogs[ _dialogIdx( this.id ) ];
        //console.dir( _dialogs )
    }

    /**
     * 初始化一个 Dialog 实例，你可以调用内建的方法来实现 show、cancel、dismiss 操作。
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
    $lr.dialog = function(html, cancelable) {
        return _build( html, cancelable )
    };
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

        _idSelector     = $lr._idSelector,
        isShowing       = $lr._isShowing,
        isString        = $lr.isString,
        isPlainObject   = $.isPlainObject;

    /**
     * 记录转化后的 hash 值, 及参数.
     * @type {string}
     * @private
     */
    var _HASH   = 'hash',
        _ARGS   = 'args',
        _TITLE  = 'title';

    /**
     * 一个 fragment 从定义到销毁将会执行以下这些过程.
     * @type {Array}
     */
    var LIFECYCLE_METHODS = ("attach create createView start " +
        "resume pause stop destroyView destroy detach")
            .split( ' ' );

    /**
     * 这个 LIFECYCLE_METHODS 对应的 Callback.
     * @type {array}
     */
    var SUPPORTED_HANDLERS = ("onAttach onCreate onCreateView onStart " +
        "onResume onPause onStop onDestroyView onDestroy onDetach")
            .split( ' ' );

    /**
     * LIFECYCLE_METHODS 与 SUPPORTED_HANDLERS 映射关系.
     * @type {{map}}
     */
    var METHOD_HANDLERS_MAPPING = {};
    LIFECYCLE_METHODS.forEach( function(lifecycle, idx) {
        METHOD_HANDLERS_MAPPING[ lifecycle ] = SUPPORTED_HANDLERS[ idx ]
    } );

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
     * @type {Array}
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

    function _fragmentIdx(stackId) {
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
        _fragments[ fragment.id ] = fragment;
    }

    function _prepare() {
        var html = [];

        html.push( '<div class="lairen-layout--fragment">' );
        html.push( '</div>' );

        _FRAGMENT_TEMPLATE = $( html.join( '' ) );

        _fragment_root = $( _idSelector( $lr.ID_FRAGMENT_ROOT ) );
        // 设置 z-index
        _fragment_root.css( 'z-index', $lr._alloZIndex( $lr.FRAGMENTS ) );
    }

    function _ensure() {
        _fragment_root || void _prepare()
    }

    // ------------------------------------------------------------------------

    function attach(fragment) {
        _fragment_root.append( fragment._el_.layout );
        _invokeHandler( fragment, attach )
    }

    function create(fragment) {
        _invokeHandler( fragment, create )
    }

    function createView(fragment) {
        _invokeHandler( fragment, createView )
    }

    function start(fragment) {
        _invokeHandler( fragment, start )
    }

    function resume(fragment) {
        fragment[ _TITLE ] && _triggerUpdateTitle( fragment.title );
        _invokeHandler( fragment, resume )
    }

    // ------------------------------------------------------------------------

    var INITIALIZING = 0;     // Not yet created.
    var CREATED = 1;          // Created.
    var ACTIVITY_CREATED = 2; // The activity has finished its creation.
    var STOPPED = 3;          // Fully created, not started.
    var STARTED = 4;          // Created and started, not resumed.
    var RESUMED = 5;          // Created started and resumed.

    var state = INITIALIZING;

    function _invokeHandler(fragment, fn) {
        var handler     = METHOD_HANDLERS_MAPPING[ fn.name ],
            handlers    = _handlers[ fragment.id ];

        handlers
            && handler in handlers
            && handlers[ handler ]
                .apply( fragment, 3 in arguments ? arguments.slice( 2 ) : [] )
    }

    function rending() {

    }

    function rendered() {

    }

    // ------------------------------------------------------------------------

    /**
     * 填充内容, 可以传入 HTML 片段或 URL.
     * { html: html }
     * { url: url, param: params }
     */
    function render(data) {
        if ( ! this._el_.layout[ 0 ].parentNode )
            throw new Error( "You haven't call the show method with this fragment!" );

        data
            && ( ( 'html' in data && _renderWithHtml.call( this, data ) )
                || ( 'url' in data && _renderWithUrl.call( this, data ) ) )
    }

    /**
     * 设置当前 title.
     * @param title
     */
    function setTitle(title) {
        document.title = title;
    }

    /**
     * 当前 fragment 是否可见.
     * @returns {*}
     */
    function isVisible() {
        return this._el_.layout && isShowing( this._el_.layout )
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
        _performBack()
    }

    // ------------------------------------------------------------------------

    function _renderWithHtml(data) {
        data && this._el_.layout.html( data.html )
    }

    function _renderWithUrl() {
    }

    var _applyHash = function(fragment) {
        // TODO
        _syncHashToBrowser( fragment );
    };

    function _syncHashToBrowser(fragment) {
        var x = [ '#!', fragment[ _HASH ] ];

        fragment[ _ARGS ]
            && ( x.push( _ARG_DELIMITER ), x.push( _argsUrlify( fragment[ _ARGS ] ) ) );

        location.hash = x.join( '' );
    }

    function _go(id, args) {
        _exist( id )
            && ( args && _overrideArgs(id, args),
                _performGo.call( getFragment( id ) ) )
    }

    function _performGo() {
        var current = _current,
            isTop = ! _hasTop(),
            target  = this,
            layout  = target._el_.layout;

        // 是否在操作本身
        if ( current && target == current )
            return;

        layout[ 0 ].parentNode
            || ( attach( target ),
                create( target ),
                createView( target ),
                start( target ) );

        // onVisibilityChanged
        // 是否被暂停
        var paused = ! isShowing( layout );

        // FIXME(XCL): 不管是否被暂停这里绝对执行恢复操作
        /*paused && */resume( target );

        // 隐藏当前 fragment
        current && _hide( current, 1 );

        // 呈现下一个 fragment
        try {
            _show( this, isTop, 0 );
            //! paused && _show( this, isTop, 1 );
        } finally {
            // 加入 BackStack
            current && ! isTop && _addToBackStack( current );

            _current = this;

            // 更新至 location.hash
            _applyHash( _current );
        }
    }

    function _performBack() {
        if ( ! canBack() )
            return;

        var current = _current;
        var next    = _popBackStack();

        pause( current )
        // 隐藏当前 fragment
        _hide( current, 0 );

        try {
            // 恢复
            resume( next );

            // 呈现下一个 fragment
            _show( next, 0, 1 );
        } finally {
            _current = next;

            _applyHash( _current );
        }
    }

    // ------------------------------------------------------------------------

    function _show(target, noTransition, fromStack) {
        var layout = target._el_.layout;

        console.log( '<< show # ' + target.id + ', ' + (noTransition ? '' : (fromStack ? 'fragment-pop-enter':'fragment-enter') ) );

        layout.show();

        noTransition || layout.animate(
            fromStack ? 'fragment-pop-enter' : 'fragment-enter',
            $.fx.speeds.slow,
            'cubic-bezier(0.4, 0, 0.2, 1)'/*'linear'*/ );
    }

    function _hide(target, fromStack) {
        var layout = target._el_.layout;

        console.log( '>> hide # ' + target.id + ', ' + (fromStack ? 'fragment-pop-exit':'fragment-exit') );

        // properties, duration, ease, callback, delay
        layout.animate(
            fromStack ? 'fragment-pop-exit' : 'fragment-exit',
            $.fx.speeds.slow,
            'cubic-bezier(0.4, 0, 0.2, 1)'/*'linear'*/,
            function() {
                // Reset the opacity prop
                layout.hide();
                //layout.css( { opacity: 1 } );
            } );
    }

    // ------------------------------------------------------------------------

    // FIXME: 相同 hash 不同参数不列为一个新的 Back stack record.
    var _backStack = [];

    /**
     * 将 fragment 添加至 BackStack, 并返回 stack 的数量.
     * @param fragment
     * @returns {*}
     * @private
     */
    function _addToBackStack(fragment) {
        return _push( fragment );
    }

    function _casStack(f, b) {

    }

    /**
     *
     * @returns {*}
     * @private
     */
    function _popBackStack() {
        var id = _pop();
        return id ? getFragment( id ) : null;
    }

    function _push(fragment) {
        return _backStack.push( fragment.id );
    }

    function _pop() {
        return _backStack.pop();
    }

    // ------------------------------------------------------------------------

    function pause(fragment) {
        _invokeHandler( fragment, pause )
    }

    function stop(fragment) {
        _invokeHandler( fragment, stop )
    }

    function destroyView(fragment) {
        _invokeHandler( fragment, destroyView )
    }

    function destroy(fragment) {
        _invokeHandler( fragment, destroy )
    }

    function detach(fragment) {
        _invokeHandler( fragment, detach )
    }

    // ------------------------------------------------------------------------

    /**
     * 从集合中取 fragment 根据指定的 id, 如: about.
     * @param id
     * @returns {*}
     */
    function getFragment(id) {
        return _fragments[ id ]
    }

    function _resolveRequires(requires) {
        // TODO:
    }

    function _importRequiresIfNecessary(requires) {
        // TODO:
    }

    function _settleHandlers(id, handlers) {
        var map = _handlers[ id ] = {};

        isPlainObject( handlers ) && SUPPORTED_HANDLERS.forEach( function(fn) {
            (fn in handlers) && (map[ fn ] = handlers[ fn ])
        } );
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
     * 构建一个 fragment.
     * @param id
     * @param config
     * @returns {{}}
     * @private
     */
    function _build(id, config) {
        // TODO: validate the view id
        if ( ! isString( id ) )
            throw Error( "Invalid id(" + id + ")" );

        // TODO: 延迟初始化
        _ensure();

        // 标识是否需要填充默认 fragment
        var hasTop = _hasTop();

        var fragment = _exist( id ) ? _fragments[ id ] : {};

        // TODO: 已经存在的是否允许更新
        if ( 'id' in fragment )
            return fragment;

        // 分配一个 id 实际上就是 z-index
        var stackId     = $lr._alloZIndex( $lr.FRAGMENT ),
            requires    = undefined;

        // 用于容纳 fragment 内容
        var layout      = undefined;

        // 处理依赖项
        isPlainObject( config )
            && 'requires' in config
            && ( requires = _resolveRequires( config.requires ) );

        // --------------------------------------------------------------------

        layout = _FRAGMENT_TEMPLATE.clone();

        // 填充 HTML 片段，如果已指定该字段
        (config && 'html' in config)
            && isString( config.html )
                && layout.html( config.html );

        // --------------------------------------------------------------------
        // 对一个 fragment 开放的实例方法
        var methods = [
            // 填充内空
            [ 'render',     render ],
            [ 'setTitle',   setTitle ],

            // 判别是否可见
            [ 'isVisible',  isVisible ],
            // 获取参数对儿
            [ 'getArgs',    getArgs ]
            //[ 'canBack',      canBack ],
            //[ 'back',         back    ]
        ];

        // 开放的方法
        methods.forEach( function(fn) {
            fragment[ fn[ 0 ] ] = fn[ 1 ]
        } );

        // 处置 Handlers
        _settleHandlers( id, config );

        // 初始化依赖项
        requires && _importRequiresIfNecessary( requires );

        // --------------------------------------------------------------------

        fragment.id             = id;
        fragment.stackIdx       = stackId;
        // DOM 节点
        fragment._el_           = { layout: layout };

        // 标题
        fragment[ _TITLE ] = isString( config[ _TITLE ] )
            ? config[ _TITLE ]
            : document.title;

        // 解析后的 hash, lairen.ui.home -> lairen/ui/home
        fragment[ _HASH ]       = _makeIdUrlify( id );

        // To retain the arguments if present.
        _ARGS in config && (fragment[ _ARGS ] = config[ _ARGS ]);

        //console.log( JSON.stringify( config ) );
        //console.log( id + " " + JSON.stringify( fragment[ _ARGS ] ) );

        try {
            return fragment
        } finally {
            // 将定义的 fragment 放入容器
            _add( fragment );

            // 呈现默认 View 如果没有有效的 view id 被指定
            ! hasTop && _setupTop( fragment );
        }
    }

    /**
     * 拼装一个 Router hash 值, 用于区分常规 hash 我们的 hash 则以 ! 开头.
     * @param id
     * @returns {string}
     * @private
     */
    function _convertIdToHash(id) {
        return '#!' + id
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
        console.dir( args );
        x && (x[ _ARGS ] = args)
        console.dir( getFragment( id ) );
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
        return -1 != rawHash.indexOf( _ARG_DELIMITER )
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

        // TODO ARRAY
        var result  = {};
        var counter = 0;

        var array = rawHash
            .substr( 1 + rawHash.indexOf( _ARG_DELIMITER ) )
            .split( '&' );

        var idx, pair, key, value, set;

        for ( idx in array ) {
            pair    = array[ idx ].split( '=' );
            key     = pair[ 0 ];
            value   = pair[ 1 ];

            if ( ! key )
                continue;

            if ( key in result ) {
                set = $lr.isArray( value )
                    ? value : [ key ];
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

        // 参数名, 值, 数组, 索引
        var key, value, set, idx;

        for ( key in args ) {
            value = args[ key ];

            if ( $lr.isArray( value ) ) {
                set = value;

                for ( idx in set ) {
                    result.push( key, '=', set[ idx ], '&' );
                }
            } else {
                result.push( key, '=', value, '&' );
            }
        }

        result.pop();

        return result.join( '' );
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
    function _setupTop(fragment) {
        _ORIGIN_HASH
            && _ORIGIN_HASH.hash === fragment[ _HASH ]
            && _go( fragment.id )
    }

    // ------------------------------------------------------------------------

    $lr.fragment = function(id, config) {
        // TODO: alias, short
        return _build( id, config )
    };

    win.$fragment = {
        /**
         * 初始化一个 Fragment 并以指定的 ID 来标识。
         *
         * e.g: package.views.home
         *      package.views.help
         *      package.views.about
         *
         *      config {
         *           backable: false,
         *           requires: {String/[]},
         *           html: {}
         *      }
         *
         * @param id
         * @param config
         * @returns {object} 一个 fragment 实例
         */
        define:     $lr.fragment,

        /**
         * 构建并呈现 fragment 如果当前不含有效的 hash 则使用指定的作为初始 fragment.
         * @param id
         */
        beginWith:  function(id) {
            _ORIGIN_HASH || _go( id )
        },

        /**
         * 呈现指定的 fragment, 如: about.
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
         */
        back:       back,

        /**
         * 可以向 fragment 传递一些参数用来更新.
         * @param id
         * @param params
         */
        update:     function(id, params) {
            // TODO:
        },

        reload:     function(id, params) {

        },

        /**
         * 回收一个 fragment.
         * @param id
         */
        destroy:    function(id) {
            // TODO:
        }
    };

    // ------------------------------------------------------------------------

    // TODO:
    // clearContentOnLeave
    // destroyOnLeave
    // open fragment
    // show fragment
    // reveal fragment
    // render fragment
    // present fragment
    // appear fragment
    // reload with args
    // setTitle
    // detectHashChange => onHashChange

    // 依赖该事件进行 fragment 导向
    var _LISTENER_HASH_CHANGE = 'onhashchange';

    /**
     * 记录初始 hash
     * @private
     */
    var _ORIGIN_HASH = _isViewHash( location.hash )
        ? _resolveHash( location.hash ) : null;

    /**
     * 当 hash 变更时调用该 fn.
     * @private
     */
    var _onHashChanged = function() {
        var oldHash = _current
            && { hash: _current[ _HASH ], args: _current[ _ARGS ] }
            || null;

        // 是否为 page hash
        _isViewHash( location.hash )
            && _handleHashChange( oldHash, _resolveHash( location.hash ) );
    };

    // TODO: To detect the history back act.
    var _handleHashChange = function(oldHash, newHash) {
        console.log( 'onHashChanged ' + JSON.stringify( oldHash ) + ' ' +
            JSON.stringify( newHash ) + ' ' + new Date().getTime() );

        ! _isSameHash( oldHash, newHash )
            && _triggerLoadFragment( newHash )
    };

    // triggerBackward
    var _triggerLoadFragment = function(hash, fromUser) {
        var id = _makeIdentify( hash[ _HASH ] );

        _overrideArgs( id, hash[ _ARGS ] );
        _go( id )
    };

    // TODO addEventListener
    _LISTENER_HASH_CHANGE in win && (window[ _LISTENER_HASH_CHANGE ] =
        _onHashChanged);

    // FIXME(XCL): Trying to prevent the user backward operation
    if ( 'onpopstate' in window ) {
        history.pushState( null, null, location.href );

        window.addEventListener( 'popstate', function (event) {
            // To override the history state
            history.pushState( null, null, location.href );
        } );
    }
}(lairen);