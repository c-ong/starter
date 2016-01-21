/**
 * Created by xong on 1/21/16.
 */
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

        if ( ! historyApiSupported ) {
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
        if ( ! historyApiSupported ) {
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

    /* Experiment: 解析 trigger */
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
    /* TODO(XCL): 校验参数的合法性 */
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

/* 使用 multitask 时会导致 loading indicator 二次呈现; */

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
 * parentable -> back(TaskStackBuilder)
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

    /* 变更之前的 InnerHash */
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
    /* 是否为 up 操作 */
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
    back( _OP_FROM_URI )
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