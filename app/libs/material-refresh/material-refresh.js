(function() {
    "use strict";
    (function($){
        var $scrollEl   = $(document.body),
            scrollEl    = document.body;

        var noShowClass     = 'mui-refresh-noshow',
            mainAnimatClass = 'mui-refresh-main-animat',
            blueThemeClass  = 'mui-blue-theme';

        var isShowLoading   = false,
            isStopping      = false,
            isBtnAction     = false;

        var NUM_POS_MAX_Y       = 60 * 3/*65*/;   // Max position for the moving distance
        var NUM_POS_MIN_Y       = -25;  // Min position for the moving distance

        var NUM_POS_START_Y     = -85;
        var NUM_POS_TARGET_Y    = 0; // Where to stop

        var NUM_NAV_TARGET_ADDY = 20; // For custom nav bar

        var touchCurrentY;
        var touchStartY         = 0;
        var customNavTop        = 0;
        var verticalThreshold   = 2;
        var maxRotateTime       = 6000; //Max time to stop rotate
        var basePosY            = 0/*60*/;

        var onBegin     = null,
            onBtnBegin  = null,
            onEnd       = null,
            onBtnEnd    = null;

        var stopAnimatTimeout = null;

        var refreshNav = '';

        var lastTime = new Date().getTime();

        var iOS = !! navigator.userAgent.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/);

        /* 构建 Indicator 的 DOM 结构 */
        var indicatorDom =
            '<div class="spinner-box" id="refresh_indicator" style="display: block;">\
                <div class="spinner">\
                    <div class="bounce1" style="background: #ff3d00;"></div>\
                    <div class="bounce2" style="background: #34A853;"></div>\
                    <div class="bounce3" style="background: #2979FF;"></div>\
                </div>\
            </div>';

        // Defined the object to improve performance
        var touchPos = {
            top: 0,
            x1: 0,
            x2: 0,
            y1: 0,
            y2: 0
        };

        // Default options
        /* var opts = { */
        /*     scrollEl: '', //String  */
        /*     nav: '', //String */
        /*     top: '0px', //String */
        /*     theme: '', //String */
        /*     index: 10001, //Number*/
        /*     maxTime: 3000, //Number */
        /*     freeze: false, //Boolean */
        /*     onBegin: null, //Function */
        /*     onEnd: null //Function */
        /* } */


        /* Known issue:
         * 1. iOS feature when scrolling ,animation will stop
         * 2. Animation display issue in anfroid like miui 小米
         *
         *
         * TODO list:
         * 1. Using translate and scale together to replace top
         * 2. Optimize circle rotate animation
         */

        // Main function to init the refresh style
        function mRefresh(options) {
            options = options || {};

            scrollEl = options.scrollEl ? options.scrollEl :
                iOS ? scrollEl : document;
            $scrollEl = $(scrollEl);

            // extend options
            onBegin         = options.onBegin;
            onEnd           = options.onEnd;
            maxRotateTime   = options.maxTime || maxRotateTime;
            refreshNav      = options.nav || refreshNav;

            /* 将 indicator 添加至 document */
            if ( $('#refresh_indicator').length === 0 ) {
                renderIndicator();

                main        = $( '#refresh_indicator' );
                spinner     = $( '.spinner', main );
                indicators  = $( 'div', spinner );   /* 三个圆点 */

                var zeptoCollection = [];
                indicators.forEach(function(dom, idx) {
                    zeptoCollection[ idx ] = $(dom);
                });
                indicators = zeptoCollection;
            }

            /*
            // Custom nav bar
            if ( ! isDefaultType() ) {
                $refreshMain.addClass('mui-refresh-nav');
                basePosY = $(refreshNav).height() + 20;

                if( $(refreshNav).offset() ) {
                    customNavTop = $(refreshNav).offset().top;

                    // Handle position fix
                    if ( $(refreshNav).css('position') !== 'fixed' ) {
                        basePosY += customNavTop;
                    }
                    // Set the first Y position
                    $refreshMain.css('top', customNavTop + 'px');
                }

                //Set z-index to make sure ablow the nav bar
                var navIndex = $(refreshNav).css('z-index');
                $refreshMain.css('z-index', navIndex - 1);
            }

            //Set custom z-index
            if( options.index ) {
                $refreshMain.css('z-index', ~~options.index);
            }

            //Set custom top, to change the position
            if( options.top ) {
                $refreshMain.css( 'top', options.top );
            }

            // Extract theme
            if ( options.theme ) {
                $refreshMain.addClass( options.theme );
            } else {
                $refreshMain.addClass( blueThemeClass );
            }

            // Add Animation Class
            $refreshMain.addClass(mainAnimatClass);
            */

            if( ! options.freeze ){
                bindEvents();
            }
        }

        // Public Methods

        // Finish loading
        mRefresh.resolve = function() {
            if( ! isStopping && stopAnimatTimeout ) {
                clearTimeout(stopAnimatTimeout);
                stopAnimatTimeout = null;

                restoreRefresh();
            }
        };

        // Destory refresh
        mRefresh.destroy = function(){
            unbindEvents();
            /*$refreshMain.remove();*/
        };

        // Type3: Button action refresh
        mRefresh.refresh = function(opt) {
            // Do rotate
            if ( ! isShowLoading ) {
                var realTargetPos = basePosY + NUM_POS_TARGET_Y - 20;
                isShowLoading = true;
                isBtnAction = true;

                opt = opt || {};
                onBtnBegin = opt.onBegin;
                onBtnEnd = opt.onEnd;

                if ( ! isDefaultType() ) {
                    realTargetPos = realTargetPos + NUM_NAV_TARGET_ADDY;
                }

                /*
                // Handle freeze
                $refreshMain.show();
                //Romove animat time
                $refreshMain.removeClass(mainAnimatClass);
                // move to target position
                $refreshMain.css( 'top', realTargetPos + 'px' );
                // make it small
                $refreshMain.css( '-webkit-transform', 'scale(' + 0.01  + ')' );
                */

                setTimeout( doRefreshing, 60 );
            }
        };

        // Unbind touch events,for freeze type1 and type2
        mRefresh.unbindEvents = function(){
            unbindEvents();
        };

        mRefresh.bindEvents = function(){
            bindEvents();
        };

        // Render html template
        function renderIndicator(){
            document.body.insertAdjacentHTML('beforeend', indicatorDom);
        }

        var isSwipeBeginWithUp;

        /**
         * 处理 Touch 事件.
         *
         * @param evt
         */
        function onTouch(evt) {
            console.log( evt );
            /* TODO(XCL): 暂时不调用该方法, 不然 click 事件将无法触发 */
            /*evt.preventDefault();*/

            if ( evt.touches.length > 1
                || ( evt.type == 'touchend' && evt.touches.length > 0 ) )
                return;

            var newEvt = document.createEvent( 'MouseEvents' );
            var type = null;
            var touch = null;

            switch ( evt.type ) {
            case 'touchstart': {
                type = 'mousedown';
                touch = evt.changedTouches[ 0 ];

                if ( iOS && scrollEl == document.body ) {
                    touchPos.top = window.scrollY;
                } else if ( scrollEl != document ) {
                    touchPos.top = document.querySelector(scrollEl).scrollTop;
                } else {
                    touchPos.top = (
                        document.documentElement
                        || document.body.parentNode
                        || document.body ).scrollTop;
                }

                console.log( 'Top: %s', touchPos.top );

                if ( touchPos.top > 0
                    || isShowLoading
                    || canSwipeRefreshChildScrollUp() ) {
                    return;
                }

                touchCurrentY = basePosY + NUM_POS_START_Y;
                /* 使 indicator 可见 */
                main.show();
                /*$refreshMain.show();*/

                // Fix jQuery touch event detect
                evt = evt.originalEvent || evt;

                if ( evt.touches[0] ) {
                    touchPos.x1 = evt.touches[0].pageX;
                    touchStartY = touchPos.y1 = evt.touches[0].pageY;
                }

                break;
            }
            case 'touchmove': {
                type = 'mousemove';
                touch = evt.changedTouches[0];

                var thisTouch, distanceY;

                var now = new Date().getTime();

                evt = evt.originalEvent || evt;

                //console.dir( ev );

                if (
                    isSwipeBeginWithUp
                    || touchPos.top > 0
                    || isShowLoading
                    || canSwipeRefreshChildScrollUp()
                    || ! evt.touches
                    || evt.touches.length !== 1 ) {
                    // Just allow one finger
                    return;
                }

                thisTouch = evt.touches[ 0 ];

                touchPos.x2 = thisTouch.pageX;
                touchPos.y2 = thisTouch.pageY;

                //if ( ! checkForMotionDirection ) {
                    if ( isSwipeBeginWithUp = touchStartY > touchPos.y2 )
                        break;
                //}

                setSurfaceScrollBarEnabled( 0 );

                // Distance for pageY change
                distanceY = touchPos.y2 - touchStartY;
                //distanceY = touchPos.y2 - touchPos.y1;

                //if (touchPos.y2 - touchStartY + verticalThreshold > 0) {
                //e.preventDefault();

                // Some android phone
                // Throttle, avoid jitter
                //if (now - lastTime < 90) {
                //    return;
                //}

                //console.log("touchCurrentY %s, basePosY %s, customNavTop %s, NUM_POS_MAX_Y %s", touchCurrentY, basePosY, customNavTop, NUM_POS_MAX_Y );
                touchCurrentY = touchPos.y2 - touchStartY;

                if ( 0 > touchCurrentY )
                    return;

                if ( touchCurrentY <= basePosY - customNavTop + NUM_POS_MAX_Y ) {
                    //touchCurrentY += distanceY;
                    //touchCurrentY = touchPos.y2 - touchStartY;
                    updateForceSurface( touchCurrentY );
                    updateIndicator( touchCurrentY );
                } else {
                    // Move over the max position will do the rotate
                    /* TODO(XCL): 尝试在 up 后触发 onRefreshing */
                    doRefreshing();
                    return;
                }
                //}

                // y1 always is the current pageY
                touchPos.y1 = thisTouch.pageY;
                lastTime    = now;

                break;
            }
            case 'touchend': {
                type    = 'mouseup';
                touch   = evt.changedTouches[0];

                onUp();

                setSurfaceScrollBarEnabled( 1 );

                if ( touchPos.top > 0 || isShowLoading ) {
                    return;
                }

                /*ev.preventDefault();*/

                if ( touchCurrentY > basePosY - customNavTop + NUM_POS_MIN_Y ) {
                    /*console.log( 'doRefreshing' );*/
                    // Should move over the min position
                    /*doRefreshing();*/
                    console.log( 'backToStart' );
                    reset();
                } else {
                    /*console.log( 'backToStart' );
                    backToStart();*/
                }

                break;
            }
            case 'touchcancel' : {
                console.log( 'Touch cancel');
                onUp();
                setSurfaceScrollBarEnabled( 1 );
                break;
            }
            }

            /*newEvt.initMouseEvent(
                type,
                true,
                true,
                evt.originalTarget.ownerDocument.defaultView,
                0,
                touch.screenX,
                touch.screenY,
                touch.clientX,
                touch.clientY,
                evt.ctrlKey,
                evt.altKey,
                evt.shiftKey,
                evt.metaKey,
                0,
                null );

            evt.originalTarget.dispatchEvent( newEvt );*/
        }

        var checkForMotionDirection,
            lastTouchY;

        function onUp() {
            lastTouchY = -1;
            isSwipeBeginWithUp = 0;
            checkForMotionDirection = null;
        }

        /**
         * backToStart
         * Return to start position
         */
        function reset() {
            var realStartPos = basePosY + NUM_POS_START_Y;

            /*if ( isDefaultType() ) {
                $refreshMain.css('top', realStartPos + 'px');
                $refreshMain.css('-webkit-transform', 'scale(' + 0  + ')');
            } else {
                // Distance must greater than NUM_POS_MIN_Y
                $refreshMain.css('top', customNavTop + 'px');
            }*/

            setTimeout( function() {
                // Handle button action
                if( ! isShowLoading ) {
                    main.hide();
                    /*$refreshMain.css('opacity', 0);
                    $refreshMain.hide();*/
                }

                /* 还原 fragment 向下偏移的位置 */
                restoreSurfaceView();

                /* 停掉 indicator 动画效果 */
                updateRefreshingAnimateState( 0 );
            }, 300 );
        }

        /* Indicator */
        var main,
            spinner,
            indicators;

        /* 记录最后 swipe 事件产生的 y */
        var lastSwipeY = -1;

        function goToBestPosition(y) {
            moveIndicatorPosition(y);
            updateForceSurface(y);
        }

        /**
         * 更新 indicator 根据当前 swipe 事件的 y 值.
         *
         * @param y
         */
        function updateIndicator(y) {
            /* 标识是否为向下拉 */
            var isSwipeDown = lastSwipeY < y;

            /* 记录最后 swipe 的 y 值 */
            lastSwipeY = y;

            // 30 = 60 / 2(top, alpha)
            // i0 0 ~ 10 / 20
            // i1 11 ~ 20 / 40
            // i2 21 ~ 30 / 60 (fully appear)

            var scaleRate,  /* 垂直居中位置完全可见 */
                scalePer;   /* 缩放百分比 */

            var updateIdx = -1,
                indicatorScale = -1;

            if ( y <= 60 ) {
                scaleRate = 60;
                updateIdx = 0;
                indicatorScale = y / scaleRate;

                indicators[updateIdx].css(
                    '-webkit-transform',    'scale(' + indicatorScale + ')',
                    'opacity',              indicatorScale );
            } /*else*/ if ( y <= 120 ) {
                scaleRate = 120;
                updateIdx = 1;
                indicatorScale = y / scaleRate;

                indicators[updateIdx].css(
                    '-webkit-transform',    'scale(' + indicatorScale + ')',
                    'opacity',              indicatorScale );
            } /*else*/ if ( y <= 180 ) {
                scaleRate = 180;
                updateIdx = 2;
                indicatorScale = y / scaleRate;

                indicators[updateIdx].css(
                    '-webkit-transform',    'scale(' + indicatorScale + ')',
                    'opacity',              indicatorScale );
            }

            console.log( "y %s, isSwipeDown %s, idx %s, scale %s",
                y, isSwipeDown, updateIdx, indicatorScale );

            //if ( ! isSwipeDown ) {
            //    switch (updateIdx) {
            //        case 1:
            //            makeIndicatorHidden( 2 );
            //            break;
            //        case 0:
            //            makeIndicatorHidden( 1, 2 );
            //            break;
            //    }
            //}

            if ( -1 !== indicatorScale ) {
                scalePer = y / scaleRate > 1
                    ? 1
                    : y / scaleRate < 0
                        ? 0
                        : y / scaleRate;

                //indicators[updateIdx].css(
                //    '-webkit-transform',    'scale(' + indicatorScale + ')',
                //    'opacity',              indicatorScale );
            }

            var currMoveY = basePosY + NUM_POS_START_Y + y;

            //console.log( "y %s, scalePer %s, currMoveY %s", y, scalePer, currMoveY );

            moveIndicatorPosition(y)
        }

        function moveIndicatorPosition(y) {
            spinner.css( {
                'top': y / 2 + 'px'/*,*/    /* 垂直居中 */
                /* 'top': (y > 50 ? 50 : y) + '%', */
                /*'opacity': scalePer*/
            } );
        }

        function makeIndicatorHidden(first, second) {
            indicators[ first ].css( 'opacity', 0 );
            second && indicators[ second ].css( 'opacity', 0 );
        }

        /**
         * 调置 Scroll Bar 是否可滚动.
         *
         * @param enabled
         */
        function setSurfaceScrollBarEnabled(enabled) {
            var fake = getCurrentlyFragment();
            if ( fake ) {
                var scroller = $('.fragment-scroller', fake['_el_']['_layout_']);

                (scroller || $(fake['_el_']['_layout_'])).css(
                    'overflow',
                    enabled ? 'auto' : 'hidden');
            }
        }

        /**
         * 是否 Swipe refresh 子元素还可以向上滚动, 如果能则不应该触发 refresh 事件.
         *
         * @returns {boolean}
         */
        function canSwipeRefreshChildScrollUp() {
            var fake = getCurrentlyFragment();
            if ( fake ) {
                var scroller = $('.fragment-scroller', fake[ '_el_' ][ '_layout_' ]);
                //console.dir(scroller);

                return (scroller[0] || fake[ '_el_' ][ '_layout_' ]).scrollTop > 0;
            }

            return 1;
        }

        /**
         * 更新伪受力 Surface 垂直方向 y 轴, 以实现下接效果.
         */
        function updateForceSurface(y) {
            // 返回 true 则不会触发 swipe
            //canSwipeRefreshChildScrollUp
            //canChildScrollUp() {
            //  return ! $0.scrollTop > 0;
            // }

            //console.log('surface:' + y);

            var fake = getCurrentlyFragment();

            if ( 0 < y && fake ) {
                if ( y > smoothY ) {
                    //smoothY += 2;
                    //y = smoothY;
                } else {
                    //smoothY -= 2;
                    //y = smoothY;
                }

                //fake[ '_el_' ][ '_layout_' ].css( 'top', y + 'px' );
                fake[ '_el_' ][ '_layout_' ].css( 'transform', 'translate3d(0,' + y + 'px,0)' );
            }
        }

        function updateRefreshingAnimateState(playing) {
            indicators.forEach(function(zeptoObj) {
                zeptoObj.css( '-webkit-animation-name', playing ? 'mystart' : 'none' );
            });
        }

        /**
         * 将呈现下拉效果的 fragment 位置还原.
         */
        function restoreSurfaceView() {
            console.log('#### Reset ####');

            var fake = getCurrentlyFragment();

            if ( fake ) {
                fake[ '_el_' ][ '_layout_' ].css( 'transform', 'translate3d(0,0,0)' );
            }

            setSurfaceScrollBarEnabled( 1 );
        }

        /* 用于平滑的移动 */
        var smoothY = 0;

        /**
         * doRotate
         * Rotate the circle,and you can stop it by `mRefresh.resolve()`
         * or it will stop within the time: `maxRotateTime`
         */
        function doRefreshing(){
            isShowLoading = true;

            // Do button action callback
            if ( isBtnAction && typeof onBtnBegin === 'function' ) {
                onBtnBegin();
            } else if ( typeof onBegin === 'function') {
                // Do onBegin callback
                onBegin();
            }

            /*
            // Make sure display entirely
            $refreshMain.css('opacity', 1);

            if (!isBtnAction) {
                var realTargetPos = basePosY + NUM_POS_TARGET_Y - 20;
                if (!isDefaultType()) {
                    realTargetPos = realTargetPos + NUM_NAV_TARGET_ADDY;
                }
                $refreshMain.css('top', realTargetPos + 'px');
            } else {
                $refreshMain.addClass(mainAnimatClass);
                $refreshMain.css('-webkit-transform', 'scale(' + 1  + ')');
            }

            $arrowWrapper.hide();

            // Start animation
            $spinnerWrapper.show();
            */

            /* 目前我们认为停靠在这个位置看上去合适些 */
            setTimeout(function() {
                goToBestPosition( 60 );
            }, 1000);

            // Timeout to stop animation
            stopAnimatTimeout = setTimeout( restoreRefresh, 4e3/*maxRotateTime*/ );

            /* 更新 indicator 呈现效果为加载中 */
            updateRefreshingAnimateState( 1 );
        }

        /**
         * Recover Refresh
         * Hide the circle
         */
        function restoreRefresh(){
            // For avoid resolve
            isStopping = true;

            // Stop animation
            /*
            $refreshMain.addClass(noShowClass);

            $spinnerWrapper.hide();*/

            setTimeout(function(){
                /*$refreshMain.removeClass(noShowClass);
                $refreshMain.hide();*/

                reset();

                /* 还原 fragment 位置 */
                restoreSurfaceView();

                /*$arrowWrapper.show();*/

                isShowLoading = false;
                isStopping = false;

                if (isBtnAction && typeof onBtnEnd === 'function') {
                    onBtnEnd();
                } else if (typeof onEnd === 'function') {
                    onEnd();
                }

                isBtnAction = false;
            }, 500);
        }

        /**
         * isDefaultType
         * Check is type1: Above surface
         *
         * @return {boolean}
         */
        function isDefaultType() {
            return $(refreshNav).length === 0;
        }

        function bindEvents() {
            $scrollEl.on( 'touchstart', onTouch );
            $scrollEl.on( 'touchmove', onTouch );
            $scrollEl.on( 'touchend', onTouch );
            $scrollEl.on( 'touchcancel', onTouch );
        }

        function unbindEvents() {
            $scrollEl.off( 'touchstart', onTouch );
            $scrollEl.off( 'touchmove', onTouch );
            $scrollEl.off( 'touchend', onTouch );
            $scrollEl.off( 'touchcancel', onTouch );
        }

        window.mRefresh = mRefresh;

    })(window.Zepto || window.jQuery);
}).call(this);
