// !(function(doc,win){
// 	var docHtml = doc.documentElement;
// 	var recalc = function(){
// 		var clientW = docHtml.clientWidth;
// 		if(!clientW) return;
// 		// 修改成50px
// 		docHtml.style.fontSize = 100 *(clientW / 750) + 'px';
// 	}
// 	
// 	window.addEventListener('resize',recalc,false);
// 	
// })(document,window)

!(function(doc, win) {
    var docEl = doc.documentElement,
        resizeEvt = 'onorientationchange' in window ? 'onorientationchange' : 'resize',
        recalc = function() {
            var clientWidth = docEl.clientWidth;
            if (!clientWidth) return;
            docEl.style.fontSize = 100 * (clientWidth / 750) + 'px';
        };
    if (!doc.addEventListener) return;
    win.addEventListener(resizeEvt, recalc, false);
    doc.addEventListener('DOMContentLoaded', recalc, false);
})(document, window);