/**
 * Created by xong on 10/29/15.
 *
 * @dependents Zepto
 */
;!function() {
    "use strict";

    var undefined;

    var win     = window;

    /**
     * Global
     * @type {{}}
     */
    var $lr  = {};

    /**
     * The root of UIs
     * @type {undefined}
     * @private
     */
    var _viewport = undefined;

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
        dialog          : [ 1, 999, 999, 999 ],
        dialog_mask     : [ 1, 1000, 1000, 1000 ],
        //dialog_stack    : [ 1, 1001, 1001, 1001 ],
        dialog_wrapper  : [ 0, 1002, 2000, 1002 ]
    };

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

    // ------------------------------------------------------------------------

    $lr.ID_DIALOG       = 'lairen-dialog';
    $lr.ID_DIALOG_MASK  = 'dialog-mask';

    // Layer manager
    // hasTopLayer

    $lr.DIALOG          = 'dialog';
    $lr.DIALOG_MASK     = 'dialog_mask';
    //DIALOG_STACK  = 'dialog_stack',
    $lr.DIALOG_WRAPPER  = 'dialog_wrapper';

    // ------------------------------------------------------------------------

    $lr._isShowing = function() {
        return 'none' !== this.css( 'display' )
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
    /**
     * 全部 Dialog
     * @type {Array}
     * @private
     */
    var _dialogs = [];

    /**
     * The root of dialog element
     * @type {undefined}
     * @private
     */
    var _dialog_root = undefined,

        /**
         * The mask of dialog
         * @type {undefined}
         * @private
         */
        _dialog_mask = undefined;

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

    function _dialogIdx(id) {
        return 'lr-dlg-' + id
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

        _dialog_root = $( $lr._idSelector( $lr.ID_DIALOG ) );
        _dialog_mask = $( $lr._idSelector( $lr.ID_DIALOG_MASK ) )

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
        _dialog_current && _dialog_current.cancelable && void _dialog_current.cancel();
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
    function _buildDialog(html, cancelable) {
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

        console.dir( _dialog_mask );

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
        console.dir( this );

        var el = this._el_;

        if ( ! $lr._isShowing.call( el.wrapper ) )
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

        _dialog_current = undefined;

        return this
    }

    function _hideMask() {

    }

    function _hideWrapperOnly() {
        var el = this._el_;

        // properties, duration, ease, callback, delay
        el.wrapper.animate(
            { opacity: .1 },
            $.fx.speeds.fast,
            'ease-out',
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

        current && void _hideWrapperOnly.call( current );

        var el = this._el_;

        if ( el.dismissed )
            return;

        current || (
            _dialog_mask.show(),
                _dialog_root.show(),

                // properties, duration, ease, callback, delay
                _dialog_mask.animate(
                    'dialog-mask-in',
                    $.fx.speeds.fast,
                    'linear' ) );

        el.wrapper.show();

        // Vertical Center
        var margin = (_dialog_root.height() / 2) - (el.wrapper.height() / 2);
        el.wrapper.css( 'margin-top', margin + "px" );

        _dialog_current = this;

        console.dir( this );

        return this
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
        console.dir( _dialogs )
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
        return _buildDialog( html, cancelable )
    };
    console.dir(this)
}(lairen);

/**
 * ----------------------------------------------------------------------------
 *                              Fragment module
 * ----------------------------------------------------------------------------
 */
!function($lr) {
    var _fragments = [];

    function onAttch() {

    }

    function onCreate() {

    }

    function onCreateView() {

    }

    function onStart() {

    }

    function onRending() {

    }

    function onRendered() {

    }

    function onResume() {

    }

    // ---------------------------------------------------------------

    function onPause() {

    }

    function onStop() {

    }

    function onDestoryView() {

    }

    function onDestroy() {

    }

    function onDetach() {

    }


}(lairen);
